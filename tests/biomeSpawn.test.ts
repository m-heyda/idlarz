import test from 'node:test';
import assert from 'node:assert/strict';
import { RING, SELECTABLE_BIOMES, biomeVerdicts, generateStartRing, neighbourBiomes, rollBiome } from '../src/utils/biomeRules';
import { createInitialWorld, economyTiles, STARTER_FREE_TILES, countOwnedTiles } from '../src/utils/gameUtils';
import { BIOME_RULES } from '../src/config/biomeRules';
import { SCALING_CONFIG, BIOMES, CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import type { BiomeType, Tile } from '../src/types/game';
import { tileAt, worldFromRows } from '../src/utils/world';
import { growWorld, loneTileStats, saddleCount } from '../src/utils/growWorld';

const tile = (biome: BiomeType, isOwned = true): Tile => ({ biome, isOwned });
const empty = (): Tile[][] => Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => tile('empty', false)));
/** A 5x5 map with the given owned tiles around the centre (2,2): rows of letters, '.' = not owned. */
const L: Record<string, BiomeType> = { P: 'plains', F: 'forest', H: 'hills', S: 'swamp', T: 'tundra',B: 'coast', L: 'lake', C: 'castle' };
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
	const one = spread(map(['.....', '.F...', '.F...', '.....', '.....']), 20); // a pair: not a lone tile the new one would join
	const three = spread(map(['.....', '.FF..', '.F...', '.FF..', '.....']), 20); // three forest sides, none of them lone
	assert.ok(one.forest > none.forest * 2.5, `${one.forest} vs ${none.forest}`);
	assert.ok(three.forest > one.forest);
	assert.ok(three.forest / 1000 <= BIOME_RULES.cluster.capPct / 100 + 0.2);
});

test('grounds, the old building lot, is gone: not a biome, never rolled (buildings go on any explored tile)', () => {
	assert.equal('grounds' in BIOMES, false);
	assert.equal(SELECTABLE_BIOMES.includes('grounds' as BiomeType), false);
	const g = map(['.....', '..P..', '.P.P.', '..P..', '.....']);
	assert.equal(spread(g, 20).grounds ?? 0, 0);
	assert.equal(spread(empty(), 20).grounds ?? 0, 0);
});

test('water clusters: next to a lake, lakes and coasts both get likelier', () => {
	const base = spread(empty(), 20);
	const near = spread(map(['.....', '.L...', '.L...', '.....', '.....']), 20);
	assert.ok(near.lake > base.lake * 2);
	assert.ok((near.coast ?? 0) > (base.coast ?? 0));
});

test('buddy rule: a tile beside a lone tile joins it, so no biome stays a 1x1 speck', () => {
	const lone = map(['.....', '.....', '.F...', '.....', '.....']); // a single forest west of (2,2)
	assert.equal(spread(lone, 20).forest, 1000);
	const pair = map(['.....', '.F...', '.F...', '.....', '.....']);
	assert.ok(spread(pair, 20).forest < 1000, 'a forest that already has a neighbour does not force the roll');
	// swamp is blocked beside tundra, so a lone swamp cannot be joined there
	const blocked = map(['.....', '.....', '.S...', '..T..', '.....']);
	assert.equal(spread(blocked, 20).swamp, undefined);
});

test('a gap (every side owned) continues one of its neighbours', () => {
	const gap = map(['.....', '..F..', '.PCH.', '..L..', '.....']);
	const seen = spread(gap, 20);
	assert.deepEqual(Object.keys(seen).sort(), ['forest', 'hills', 'lake', 'plains'].sort());
	assert.ok(!('swamp' in seen) && !('tundra' in seen) && !('coast' in seen));
});

test('growing a map leaves few 1x1 specks and none that can never be joined', () => {
	for (const policy of ['nearest', 'random'] as const) {
		let lone = 0;
		let stuck = 0;
		let total = 0;
		for (let seed = 0; seed < 40; seed++) {
			const s = loneTileStats(growWorld(150, seed, policy));
			lone += s.lone;
			stuck += s.stuck;
			total += s.total;
		}
		assert.ok(lone / total < 0.07, `${policy}: ${((100 * lone) / total).toFixed(1)}% lone tiles (was ~12% before the buddy rule)`);
		assert.ok(stuck / 40 < 1, `${policy}: ${stuck / 40} stuck lone tiles per map`);
	}
});

test('no two tiles of a biome touch only at a corner: the new tile joins the pair or stays off the biome', () => {
	// forest NW of the target (2,2) with plains between: forest would pinch, so it is never rolled
	const pinch = map(['.....', '.FP..', '.PP..', '.....', '.....']);
	assert.equal(spread(pinch, 20).forest, undefined);
	// a diagonal pair of forest with the 4th corner plains: the new tile must be forest
	const pair = map(['.....', '.....', '...FF', '..FP.', '..F..']);
	assert.deepEqual(Object.keys(spread(pair, 20)), ['forest']);
	for (const policy of ['nearest', 'random'] as const)
		for (let seed = 0; seed < 30; seed++) assert.equal(saddleCount(growWorld(200, seed, policy)), 0, `${policy} seed ${seed}`);
});

test('neighbourBiomes ignores unowned tiles and the castle', () => {
	const g = map(['.....', '.....', '.FC..', '.....', '.....']);
	g[2][1].isOwned = false;
	assert.deepEqual(neighbourBiomes(worldFromRows(g), 2, 2), { four: [], eight: [] });
});

test('start ring: only plains and forest, every patch 2+ tiles, at least 3 plains, no other biome more than maxOfOther times, always valid across many seeds', () => {
	for (let i = 0; i < 300; i++) {
		const ring = generateStartRing(seqRandom(i));
		assert.equal(ring.length, 8);
		assert.ok(ring.every((b) => b === 'plains' || b === 'forest'), 'no hills or lakes touch the castle');
		ring.forEach((b, k) => assert.ok(b === ring[(k + 7) % 8] || b === ring[(k + 1) % 8], `ring tile ${k} is a 1x1 patch`));
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
