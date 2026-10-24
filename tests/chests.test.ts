import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEST, GRID_CENTER_X, GRID_CENTER_Y } from '../src/config/gameConfig';
import { CHEST_ITEMS, pickChestSpot, rewardWeights, rollChestLoot } from '../src/lib/chests';
import { emptyBag, addToBag } from '../src/lib/inventory';
import { ITEM_CATALOG } from '../src/config/itemCatalog';
import type { BagSlot, BiomeType, Resources, Tile } from '../src/types/game';

const rng = (seed: number) => {
	let a = (seed + 1) * 0x9e3779b1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const SIZE = 51;
const blank = (): Tile[][] => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ biome: 'empty' as BiomeType, isOwned: false })));
/** A tiny territory: the castle plus a (2r+1)^2 block of plains around it. */
const territory = (r: number): Tile[][] => {
	const g = blank();
	for (let y = -r; y <= r; y++)
		for (let x = -r; x <= r; x++) g[GRID_CENTER_Y + y][GRID_CENTER_X + x] = { biome: x === 0 && y === 0 ? 'castle' : 'plains', isOwned: true, ...(x === 0 && y === 0 ? { level: 1 } : {}) };
	return g;
};
const rates = (over: Partial<Resources> = {}): Resources => ({ gold: 2, wood: 1, stone: 1, coal: 0.5, food: 1, meat: 0, eggs: 0, milk: 0, hide: 0, xp: 1, ...over });

test('chest spot: only owned tiles, never the castle, a building, a monster or another chest', () => {
	const g = territory(2);
	g[GRID_CENTER_Y][GRID_CENTER_X + 1] = { biome: 'grounds', isOwned: true, building: 'farm', level: 2 };
	g[GRID_CENTER_Y + 1][GRID_CENTER_X].hasChest = true;
	const taken = new Set([`${GRID_CENTER_X - 1},${GRID_CENTER_Y}`]);
	for (let i = 0; i < 400; i++) {
		const spot = pickChestSpot(g, taken, 1, rng(i))!;
		const t = g[spot.y][spot.x];
		assert.ok(t.isOwned && t.biome !== 'castle' && !t.hasChest && !(t.biome === 'grounds' && t.building));
		assert.ok(!taken.has(`${spot.x},${spot.y}`));
	}
});

test('chest spot: nothing eligible gives null, and the fortress ward is off limits', () => {
	assert.equal(pickChestSpot(blank(), new Set(), 1), null);
	const g = territory(1); // castle + its 8 neighbours = exactly the ward
	assert.equal(pickChestSpot(g, new Set(), 7), null);
	assert.ok(pickChestSpot(g, new Set(), 6));
});

test('chest spot: the edge of the land is favoured over the middle, and chests spread out', () => {
	const g = territory(3);
	const edge = (x: number, y: number) => Math.max(Math.abs(x - GRID_CENTER_X), Math.abs(y - GRID_CENTER_Y)) === 3;
	let onEdge = 0;
	const n = 3000;
	for (let i = 0; i < n; i++) {
		const s = pickChestSpot(g, new Set(), 1, rng(i))!;
		if (edge(s.x, s.y)) onEdge++;
	}
	// 24 of the 48 candidate tiles are on the rim; a uniform pick would give 50%, the frontier bonus must beat that clearly
	assert.ok(onEdge / n > 0.65, `${onEdge / n}`);

	g[GRID_CENTER_Y - 3][GRID_CENTER_X].hasChest = true;
	let near = 0;
	for (let i = 0; i < n; i++) {
		const s = pickChestSpot(g, new Set(), 1, rng(i))!;
		if (Math.max(Math.abs(s.x - GRID_CENTER_X), Math.abs(s.y - (GRID_CENTER_Y - 3))) <= CHEST.placement.nearbyRadius) near++;
	}
	const nearTiles = 5 * 3 - 1; // tiles within the radius that are owned and free, roughly
	assert.ok(near / n < nearTiles / 48, `${near / n} should be below the uniform share ${nearTiles / 48}`);
});

test('chest loot: every kind turns up, with roughly the configured odds', () => {
	const seen: Record<string, number> = {};
	const n = 6000;
	for (let i = 0; i < n; i++) {
		const loot = rollChestLoot({ rates: rates(), luck: 0, bag: emptyBag() }, rng(i));
		seen[loot.kind] = (seen[loot.kind] ?? 0) + 1;
	}
	const total = Object.values(CHEST.rewards).reduce((s, v) => s + v, 0);
	for (const [kind, weight] of Object.entries(CHEST.rewards)) {
		const share = (seen[kind] ?? 0) / n;
		assert.ok(Math.abs(share - weight / total) < 0.03, `${kind}: ${share} vs ${weight / total}`);
	}
});

test('chest loot: gold is minutes of income (like before), a lucky chest pays x1.5, bundles and XP have a floor', () => {
	for (let i = 0; i < 500; i++) {
		const loot = rollChestLoot({ rates: rates({ gold: 3, wood: 0, stone: 0, coal: 0, food: 0, xp: 0 }), luck: 0, bag: emptyBag() }, rng(i));
		if (loot.kind === 'gold') {
			assert.ok(loot.minutes >= CHEST.minMinutes && loot.minutes <= CHEST.maxMinutes);
			assert.equal(loot.gold, Math.floor(3 * loot.minutes * 60));
		} else if (loot.kind === 'boost') {
			assert.equal(loot.multiplier, CHEST.boostMultiplier);
			assert.equal(loot.gold, Math.floor(3 * loot.minutes * 60 * CHEST.boostMultiplier));
		} else if (loot.kind === 'bundle') {
			assert.ok(loot.items.length >= 1 && loot.items.length <= 2);
			assert.equal(new Set(loot.items.map((x) => x.resource)).size, loot.items.length);
			loot.items.forEach((x) => assert.ok(x.amount >= CHEST.bundle.floor));
		} else if (loot.kind === 'xp') {
			assert.ok(loot.xp >= CHEST.xp.floor);
		} else {
			assert.ok(CHEST_ITEMS.includes(loot.itemId));
			assert.notEqual(ITEM_CATALOG[loot.itemId].set, 'rattatui', 'chests never hold Rattatui pieces');
		}
	}
});

test('chest loot: luck moves weight from plain gold to lucky chests and items', () => {
	const none = rewardWeights(0);
	const lucky = rewardWeights(40);
	assert.ok(lucky.gold < none.gold && lucky.boost > none.boost && lucky.item > none.item);
	assert.ok(Math.abs(Object.values(lucky).reduce((s, v) => s + v, 0) - Object.values(none).reduce((s, v) => s + v, 0)) < 1e-9);
	assert.ok(lucky.gold > 0);
});

test('chest loot: an item that does not fit in a full bag becomes gold', () => {
	let bag: BagSlot[] = emptyBag();
	const gear = CHEST_ITEMS.filter((id) => !ITEM_CATALOG[id].consumable); // gear does not stack: every slot used
	bag = bag.map((_, i) => ({ id: gear[i % gear.length], qty: 1 }));
	for (const id of CHEST_ITEMS.filter((i) => !ITEM_CATALOG[i].consumable)) assert.equal(addToBag(bag, id, 1).added, 0);
	assert.equal(addToBag(bag, 'potion_minor', 1).added, 0);
	for (let i = 0; i < 4000; i++) {
		const loot = rollChestLoot({ rates: rates(), luck: 100, bag }, rng(i));
		assert.notEqual(loot.kind, 'item');
	}
});
