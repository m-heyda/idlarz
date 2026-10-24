import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, store } from './helpers';
import { AMBIENT_LIFE, FARM_BONUS, GRID_CENTER_X, GRID_CENTER_Y, TILE_SIZE } from '../src/config/gameConfig';
import { nextSpawnDelay, pickAmbientCritter, type Viewport } from '../src/lib/ambientLife';
import type { Tile } from '../src/types/game';

const emptyGrid = (): Tile[][] =>
	Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => ({ biome: 'empty', isOwned: false }) as Tile));
const WHOLE_MAP: Viewport = { minX: 0, maxX: 49, minY: 0, maxY: 49 };

/** A deterministic rng that walks through a fixed list of numbers. */
const seq = (...values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

test('critters need owned land in view, and never appear on the castle or unowned tiles', () => {
	const tiles = emptyGrid();
	assert.equal(pickAmbientCritter(tiles, WHOLE_MAP), null);
	tiles[25][25] = { biome: 'castle', isOwned: true, level: 1 };
	assert.equal(pickAmbientCritter(tiles, WHOLE_MAP), null);
	tiles[10][10] = { biome: 'forest', isOwned: true };
	assert.equal(pickAmbientCritter(tiles, { minX: 20, maxX: 30, minY: 20, maxY: 30 }), null); // forest is out of view
	assert.ok(pickAmbientCritter(tiles, WHOLE_MAP));
});

test('a critter picks a type that likes the biome and starts inside its tile', () => {
	for (const biome of Object.keys(AMBIENT_LIFE.byBiome)) {
		const tiles = emptyGrid();
		tiles[12][7] = { biome, isOwned: true } as Tile;
		for (let i = 0; i < 30; i++) {
			const c = pickAmbientCritter(tiles, WHOLE_MAP)!;
			assert.ok(AMBIENT_LIFE.byBiome[biome].includes(c.type), `${biome}: ${c.type}`);
			assert.ok(c.x >= 7 * TILE_SIZE && c.x <= 8 * TILE_SIZE);
			assert.ok(c.y >= 12 * TILE_SIZE && c.y <= 13 * TILE_SIZE);
			assert.ok(Math.abs(c.dx) <= AMBIENT_LIFE.roamTiles * TILE_SIZE + 1e-9);
			assert.ok(c.lifeMs >= AMBIENT_LIFE.lifeMinMs && c.lifeMs <= AMBIENT_LIFE.lifeMaxMs);
		}
	}
});

test('about one critter in twelve carries a gift, and spawn delays stay in range', () => {
	const tiles = emptyGrid();
	tiles[3][3] = { biome: 'plains', isOwned: true };
	let gifts = 0;
	const n = 6000;
	for (let i = 0; i < n; i++) if (pickAmbientCritter(tiles, WHOLE_MAP)!.golden) gifts++;
	assert.ok(Math.abs(gifts / n - AMBIENT_LIFE.giftChance) < 0.02, `share ${gifts / n}`);
	assert.equal(pickAmbientCritter(tiles, WHOLE_MAP, seq(0.5, 0.5, 0.5, 0.01, 0.5, 0.5, 0.5, 0.5))!.golden, true);
	assert.equal(nextSpawnDelay(() => 0), AMBIENT_LIFE.spawnMinMs);
	assert.equal(nextSpawnDelay(() => 1), AMBIENT_LIFE.spawnMaxMs);
});

const click = (id: number, now: number, trusted = true) => ({ eventId: id, now, trusted });

test('critter gifts: real clicks only, amount decided by the store, cooldown per source', () => {
	freshGame();
	growTo(6);
	setResources({ gold: 0, food: 0, meat: 0, xp: 0 });
	const rate = api().resourceRates.total.gold;

	assert.equal(api().claimCritterGift({ source: 'map', type: 'butterfly', golden: true }, click(1, 100_000, false)), null);
	assert.equal(api().claimCritterGift({ source: 'map', type: 'dragon' as 'bee', golden: true }, click(2, 100_000)), null);
	assert.equal(api().claimCritterGift({ source: 'moon' as 'map', type: 'bee', golden: true }, click(3, 100_000)), null);
	assert.equal(api().resources.gold, 0);

	const def = FARM_BONUS.critters.butterfly;
	const first = api().claimCritterGift({ source: 'map', type: 'butterfly', golden: true }, click(4, 100_000))!;
	assert.equal(first.resource, 'gold');
	const expected = Math.round(Math.max(def.min, rate * AMBIENT_LIFE.giftSeconds) * FARM_BONUS.goldenMultiplier * 10) / 10;
	assert.equal(first.amount, expected);
	assert.ok(Math.abs(api().resources.gold - expected) < 1e-6);

	// same source: blocked until the cooldown is over (and the blocked try gives nothing)
	assert.equal(api().claimCritterGift({ source: 'map', type: 'butterfly', golden: true }, click(5, 100_000 + AMBIENT_LIFE.giftCooldownMs - 1)), null);
	// the farm meadow has its own cooldown
	assert.ok(api().claimCritterGift({ source: 'farm', type: 'bee', golden: false }, click(6, 100_001)));
	assert.ok(api().claimCritterGift({ source: 'map', type: 'butterfly', golden: true }, click(7, 100_000 + AMBIENT_LIFE.giftCooldownMs)));

	// the number a UI might want to "suggest" is irrelevant: only the store decides
	assert.equal(api().claimCritterGift({ source: 'map', type: 'rabbit', golden: false, amount: 1e12 } as never, click(8, 500_000))!.amount < 1e6, true);
});

test('critter gifts share the click limiter: no tokens, no gift', () => {
	freshGame();
	growTo(4);
	// drain the burst bucket with paid clicks at the same instant
	for (let i = 0; i < 20; i++) api().clickForGold({ eventId: 1000 + i, now: 1_000_000, trusted: true });
	assert.equal(api().claimCritterGift({ source: 'map', type: 'bee', golden: true }, click(2000, 1_000_000)), null);
	assert.ok(api().claimCritterGift({ source: 'map', type: 'bee', golden: true }, click(2001, 1_002_000)));
});

test('rebirth and full reset clear the gift cooldowns', () => {
	freshGame();
	growTo(3);
	assert.ok(api().claimCritterGift({ source: 'map', type: 'bee', golden: true }, click(1, 10_000_000)));
	assert.equal(api().claimCritterGift({ source: 'map', type: 'bee', golden: true }, click(2, 10_000_001)), null);
	api().resetGame();
	growTo(3);
	assert.ok(api().claimCritterGift({ source: 'map', type: 'bee', golden: true }, click(3, 10_000_002)));
	assert.equal(store.getState().tiles[GRID_CENTER_Y][GRID_CENTER_X].level, 1);
	assert.equal(GRID_CENTER_X, 25);
});

test('a built-on tile hosts the critters of its foundation biome (swamp plot -> ladybugs and frogs only, never the grounds rabbit)', () => {
	const tiles = emptyGrid();
	for (let y = 11; y <= 13; y++) for (let x = 6; x <= 8; x++) tiles[y][x] = { biome: 'swamp', isOwned: true };
	tiles[12][7] = { biome: 'grounds', isOwned: true, building: 'farm', level: 2 };
	const hosts = new Set<string>();
	for (let i = 0; i < 400; i++) {
		const c = pickAmbientCritter(tiles, WHOLE_MAP, () => (i * 0.6180339 + 0.1) % 1)!;
		if (Math.floor(c.x / TILE_SIZE) === 7 && Math.floor(c.y / TILE_SIZE) === 12) hosts.add(c.type);
	}
	assert.ok(hosts.size > 0, 'the plot hosts critters');
	for (const t of hosts) assert.ok(['frog', 'ladybug'].includes(t), `${t} lives on a swamp foundation`);
});

test('fish only swim in open water, and only the four farm critters can carry a gift', () => {
	const pond = emptyGrid();
	for (let y = 10; y <= 14; y++) for (let x = 5; x <= 9; x++) pond[y][x] = { biome: 'lake', isOwned: true } as Tile;
	const rim = new Set<string>();
	const inner = new Set<string>();
	for (let i = 0; i < 1500; i++) {
		const c = pickAmbientCritter(pond, WHOLE_MAP, seq(((i * 0.6180339) % 1), ((i * 0.3819) % 1), 0.37, 0.61, 0.2, 0.9, 0.4))!;
		const tx = Math.floor(c.x / TILE_SIZE);
		const ty = Math.floor(c.y / TILE_SIZE);
		const interior = tx > 5 && tx < 9 && ty > 10 && ty < 14;
		(interior ? inner : rim).add(c.type);
		if (!['butterfly', 'bee', 'ladybug', 'rabbit'].includes(c.type)) assert.equal(c.golden, false, `${c.type} never carries a gift`);
	}
	assert.ok(inner.has('fish'), 'fish swim in the middle of the lake');
	assert.equal(rim.has('fish'), false, 'no fish on a lake tile that touches the shore');
});

test('swamp frogs, coast crabs, hill goats and forest wolves exist and stay close to where they appear', () => {
	for (const [biome, type] of [['swamp', 'frog'], ['coast', 'crab'], ['hills', 'goat'], ['forest', 'wolf']] as const) {
		const tiles = emptyGrid();
		tiles[12][7] = { biome, isOwned: true } as Tile;
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) {
			const c = pickAmbientCritter(tiles, WHOLE_MAP, () => ((i * 0.61803) % 1))!;
			seen.add(c.type);
			if (c.type === type) assert.ok(Math.abs(c.dx) <= AMBIENT_LIFE.roamTiles * TILE_SIZE * AMBIENT_LIFE.roamScale[type] + 1e-9);
		}
		assert.ok(seen.has(type), `${biome} has ${type}s`);
	}
});

test('critters are rare on purpose: farm visitors at least a minute apart, map critters spaced out and few at once', () => {
	assert.ok(FARM_BONUS.minGapMs >= 60_000 && FARM_BONUS.firstDelayMs >= 30_000);
	assert.ok(FARM_BONUS.maxGapMs > FARM_BONUS.minGapMs);
	assert.ok(AMBIENT_LIFE.spawnMinMs >= 10_000 && AMBIENT_LIFE.maxAlive <= 3);
	assert.ok(AMBIENT_LIFE.firstSpawnMs > 0 && AMBIENT_LIFE.firstSpawnMs <= AMBIENT_LIFE.spawnMinMs);
});
