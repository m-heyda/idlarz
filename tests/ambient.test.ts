import test from 'node:test';
import assert from 'node:assert/strict';
import { api, worldFromRows } from './helpers';
import { AMBIENT_LIFE, FARM_CRITTERS, TILE_SIZE } from '../src/config/gameConfig';
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
	assert.equal(pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP), null);
	tiles[25][25] = { biome: 'castle', isOwned: true, level: 1 };
	assert.equal(pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP), null);
	tiles[10][10] = { biome: 'forest', isOwned: true };
	assert.equal(pickAmbientCritter(worldFromRows(tiles), { minX: 20, maxX: 30, minY: 20, maxY: 30 }), null); // forest is out of view
	assert.ok(pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP));
});

test('a critter picks a type that likes the biome and starts inside its tile', () => {
	for (const biome of Object.keys(AMBIENT_LIFE.byBiome)) {
		const tiles = emptyGrid();
		tiles[12][7] = { biome, isOwned: true } as Tile;
		for (let i = 0; i < 30; i++) {
			const c = pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP)!;
			assert.ok(AMBIENT_LIFE.byBiome[biome].includes(c.type), `${biome}: ${c.type}`);
			assert.ok(c.x >= 7 * TILE_SIZE && c.x <= 8 * TILE_SIZE);
			assert.ok(c.y >= 12 * TILE_SIZE && c.y <= 13 * TILE_SIZE);
			assert.ok(Math.abs(c.dx) <= AMBIENT_LIFE.roamTiles * TILE_SIZE + 1e-9);
			assert.ok(c.lifeMs >= AMBIENT_LIFE.lifeMinMs && c.lifeMs <= AMBIENT_LIFE.lifeMaxMs);
		}
	}
});

test('spawn delays stay in range', () => {
	assert.equal(nextSpawnDelay(() => 0), AMBIENT_LIFE.spawnMinMs);
	assert.equal(nextSpawnDelay(() => 1), AMBIENT_LIFE.spawnMaxMs);
});

test('critters are cosmetic only: nothing to claim, nothing that carries a gift', () => {
	const tiles = emptyGrid();
	tiles[3][3] = { biome: 'plains', isOwned: true };
	for (let i = 0; i < 200; i++) {
		const critter = pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP) as unknown as Record<string, unknown>;
		assert.equal('golden' in critter, false);
	}
	assert.equal('claimCritterGift' in api(), false);
});

test('a built-on tile hosts the critters of its own biome (swamp plot -> ladybugs and frogs only)', () => {
	const tiles = emptyGrid();
	for (let y = 11; y <= 13; y++) for (let x = 6; x <= 8; x++) tiles[y][x] = { biome: 'swamp', isOwned: true };
	tiles[12][7] = { biome: 'swamp', isOwned: true, building: 'farm' };
	const hosts = new Set<string>();
	for (let i = 0; i < 400; i++) {
		const c = pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP, () => (i * 0.6180339 + 0.1) % 1)!;
		if (Math.floor(c.x / TILE_SIZE) === 7 && Math.floor(c.y / TILE_SIZE) === 12) hosts.add(c.type);
	}
	assert.ok(hosts.size > 0, 'the plot hosts critters');
	for (const t of hosts) assert.ok(['frog', 'ladybug'].includes(t), `${t} lives on a swamp plot`);
});

test('fish only swim in open water', () => {
	const pond = emptyGrid();
	for (let y = 10; y <= 14; y++) for (let x = 5; x <= 9; x++) pond[y][x] = { biome: 'lake', isOwned: true } as Tile;
	const rim = new Set<string>();
	const inner = new Set<string>();
	for (let i = 0; i < 1500; i++) {
		const c = pickAmbientCritter(worldFromRows(pond), WHOLE_MAP, seq(((i * 0.6180339) % 1), ((i * 0.3819) % 1), 0.37, 0.61, 0.2, 0.9, 0.4))!;
		const tx = Math.floor(c.x / TILE_SIZE);
		const ty = Math.floor(c.y / TILE_SIZE);
		const interior = tx > 5 && tx < 9 && ty > 10 && ty < 14;
		(interior ? inner : rim).add(c.type);
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
			const c = pickAmbientCritter(worldFromRows(tiles), WHOLE_MAP, () => ((i * 0.61803) % 1))!;
			seen.add(c.type);
			if (c.type === type) assert.ok(Math.abs(c.dx) <= AMBIENT_LIFE.roamTiles * TILE_SIZE * AMBIENT_LIFE.roamScale[type] + 1e-9);
		}
		assert.ok(seen.has(type), `${biome} has ${type}s`);
	}
});

test('critters are rare on purpose: farm visitors at least a minute apart, map critters spaced out and few at once', () => {
	assert.ok(FARM_CRITTERS.minGapMs >= 60_000 && FARM_CRITTERS.firstDelayMs >= 30_000);
	assert.ok(FARM_CRITTERS.maxGapMs > FARM_CRITTERS.minGapMs);
	assert.ok(AMBIENT_LIFE.spawnMinMs >= 10_000 && AMBIENT_LIFE.maxAlive <= 3);
	assert.ok(AMBIENT_LIFE.firstSpawnMs > 0 && AMBIENT_LIFE.firstSpawnMs <= AMBIENT_LIFE.spawnMinMs);
});
