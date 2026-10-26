import test from 'node:test';
import assert from 'node:assert/strict';
import { RING, SELECTABLE_BIOMES, biomeVerdicts, generateStartRing, neighbourBiomes, rollBiome } from '../src/utils/biomeRules';
import { createInitialWorld, economyTiles, STARTER_FREE_TILES, countOwnedTiles } from '../src/utils/gameUtils';
import { BIOME_RULES } from '../src/config/biomeRules';
import { SCALING_CONFIG, BIOMES, CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import type { BiomeType, Tile } from '../src/types/game';
import { tileAt, worldFromRows } from '../src/utils/world';

const tile = (biome: BiomeType, isOwned = true): Tile => ({ biome, isOwned });
const empty = (): Tile[][] => Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => tile('empty', false)));
/** A 5x5 map with the given owned tiles around the centre (2,2): rows of letters, '.' = not owned. */
const L: Record<string, BiomeType> = { P: 'plains', F: 'forest', H: 'hills', S: 'swamp', T: 'tundra', B: 'coast', L: 'lake', G: 'grounds', C: 'castle' };
const map = (rows: string[]): Tile[][] => rows.map((r) => [...r].map((c) => (c === '.' ? tile('empty', false) : tile(L[c]))));

/** Deterministic sweep of the random range. */
const spread = (tiles: Tile[][], purchased: number, n = 1000) => {
	const world = worldFromRows(tiles);
	const seen: Record<string, number> = {};
	for (let i = 0; i < n; i++) {
		const b = rollBiome(world, 2, 2, purchased, seqRandom(i));
		seen[b] = (seen[b] ?? 0) + 1;
	}
	return seen;
};
/** Seeded generator (mulberry32): independent values per call, reproducible per i. */
const seqRandom = (i: number) => {
	let a = (i + 1) * 0x9e3779b1;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
const verdict = (tiles: Tile[][], purchased: number, biome: string) => biomeVerdicts(worldFromRows(tiles), 2, 2, purchased).find((v) => v.biome === biome)!;

test('rolled biomes are always allowed, never the castle or empty land', () => {
	const seen = spread(empty(), 20);
	assert.equal(seen.castle, undefined);
	assert.equal(seen.empty, undefined);
	for (const b of Object.keys(seen)) assert.ok(b in BIOMES && SELECTABLE_BIOMES.includes(b as BiomeType));
});

test('unlocks: swamp and tundra only after enough purchases', () => {
	const g = map(['.....', '.....', '.....', '.....', '.....']);
	assert.equal(verdict(g, 5, 'swamp').allowed, false);
	assert.match(verdict(g, 5, 'swamp').reason ?? '', /Unlocks after 6/);
	assert.equal(verdict(g, 6, 'swamp').allowed, true);
	assert.equal(verdict(g, 9, 'tundra').allowed, false);
	assert.equal(verdict(g, 10, 'tundra').allowed, true);
	assert.equal(spread(g, 0).swamp, undefined);
	assert.equal(spread(g, 0).tundra, undefined);
});

test('conflicts: tundra-swamp, tundra-coast and hills-coast may not touch (8 neighbours); plains always fits', () => {
	const g = map(['.....', '.T...', '.....', '.....', '.....']); // a tundra at (1,1): diagonal of (2,2)
	assert.equal(verdict(g, 20, 'swamp').allowed, false);
	assert.match(verdict(g, 20, 'swamp').reason ?? '', /Not next to Tundra/);
	assert.equal(verdict(g, 20, 'plains').allowed, true);
	assert.equal(verdict(g, 20, 'forest').allowed, true);
	const h = map(['.....', '.H...', '.....', '.....', '.....']);
	assert.equal(verdict(h, 20, 'coast').allowed, false);
	assert.equal(spread(g, 20).swamp, undefined);
});

test('coast needs a lake or coast within the 8 neighbours', () => {
	assert.equal(verdict(map(['.....', '.....', '.....', '.....', '.....']), 20, 'coast').allowed, false);
	assert.match(verdict(map(['.....', '.....', '.....', '.....', '.....']), 20, 'coast').reason ?? '', /water/);
	assert.equal(verdict(map(['.....', '.L...', '.....', '.....', '.....']), 20, 'coast').allowed, true);
	assert.equal(verdict(map(['.....', '.....', '.B...', '.....', '.....']), 20, 'coast').allowed, true);
});

test('the picker marks a biome that continues an adjoining area', () => {
	const g = map(['.....', '.....', '.F...', '.....', '.....']);
	assert.equal(verdict(g, 20, 'forest').extends, true);
	assert.equal(verdict(g, 20, 'lake').extends, false);
});

test('clustering: a forest neighbour makes forest much likelier, and more neighbours make it likelier still', () => {
	const none = spread(empty(), 20);
	const one = spread(map(['.....', '.....', '.F...', '.....', '.....']), 20);
	const three = spread(map(['.....', '..F..', '.F...', '..F..', '.....']), 20);
	assert.ok(one.forest > none.forest * 2.5, `${one.forest} vs ${none.forest}`);
	assert.ok(three.forest > one.forest);
	assert.ok(three.forest / 1000 <= BIOME_RULES.cluster.capPct / 100 + 0.2);
});

test('grounds, the old building lot, is never rolled any more (buildings go on any explored tile)', () => {
	const g = map(['.....', '..G..', '.G.G.', '..G..', '.....']);
	assert.equal(spread(g, 20).grounds ?? 0, 0);
	assert.equal(spread(empty(), 20).grounds ?? 0, 0);
});

test('water clusters: next to a lake, lakes and coasts both get likelier', () => {
	const base = spread(empty(), 20);
	const near = spread(map(['.....', '.....', '.L...', '.....', '.....']), 20);
	assert.ok(near.lake > base.lake * 2);
	assert.ok((near.coast ?? 0) > (base.coast ?? 0));
});

test('neighbourBiomes ignores unowned tiles and the castle', () => {
	const g = map(['.....', '.....', '.FC..', '.....', '.....']);
	g[2][1].isOwned = false;
	assert.deepEqual(neighbourBiomes(worldFromRows(g), 2, 2), { four: [], eight: [] });
});

test('start ring: only plains and forest, at least 3 plains, no other biome more than maxOfOther times, always valid across many seeds', () => {
	for (let i = 0; i < 300; i++) {
		const ring = generateStartRing(seqRandom(i));
		assert.equal(ring.length, 8);
		assert.ok(ring.every((b) => b === 'plains' || b === 'forest'), 'no hills or lakes touch the castle');
		assert.ok(ring.filter((b) => b === 'plains').length >= BIOME_RULES.startRing.minPlains);
		for (const b of new Set(ring)) {
			assert.ok(b in BIOME_RULES.startRing.weights, `${b} is a basic biome`);
			if (b !== 'plains') assert.ok(ring.filter((r) => r === b).length <= BIOME_RULES.startRing.maxOfOther);
		}
	}
	const seen = new Set<string>();
	for (let i = 0; i < 300; i++) generateStartRing(seqRandom(i)).forEach((b) => seen.add(b));
	assert.ok(seen.size >= 2, 'the ring varies between games');
});

test('a new map owns the castle and its 8 neighbours; the economy still sees a castle-only start', () => {
	const g = createInitialWorld(seqRandom(7));
	assert.equal(countOwnedTiles(g), 9);
	assert.equal(tileAt(g, CASTLE_X, CASTLE_Y).biome, 'castle');
	RING.forEach(([dx, dy]) => {
		const t = tileAt(g, CASTLE_X + dx, CASTLE_Y + dy);
		assert.ok(t.isOwned && t.biome !== 'castle' && t.biome !== 'empty');
	});
	assert.equal(economyTiles(g, STARTER_FREE_TILES), 1); // first purchase is priced like tile #1 always was
	assert.equal(economyTiles(g, 1), 9); // an old save (castle only free) keeps its own count
});

test('tile cost: three phases, endgame growth is gentler than the mid game', () => {
	const c = SCALING_CONFIG.costFormula;
	const { earlyTiles, lateTiles, growthLate, growthEndgame } = SCALING_CONFIG;
	assert.ok(Math.abs(c(earlyTiles + 1) / c(earlyTiles) - growthLate) < 0.01);
	assert.ok(Math.abs(c(lateTiles + 1) / c(lateTiles) - growthEndgame) < 0.01);
	assert.ok(growthEndgame < growthLate);
	assert.ok(c(lateTiles + 10) < 1e9, 'tile 50 stays in reach');
});
