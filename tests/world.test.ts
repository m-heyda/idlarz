import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import type { BiomeType, Tile } from '../src/types/game';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import {
	COORD_LIMIT,
	EMPTY_WORLD,
	biomeCount,
	buildingCount,
	createWorld,
	forEachOwned,
	getTile,
	hasOwnedNeighbour,
	inRange,
	isFrontier,
	isOwnedAt,
	keyX,
	keyY,
	ownedBounds,
	ownedCount,
	ownedEntries,
	patchTile,
	setTile,
	setTiles,
	tileAt,
	tileKey,
	worldFromRows,
	worldToRows,
} from '../src/utils/world';
import { connectedCluster } from '../src/utils/cluster';
import { syntheticWorld } from '../src/utils/worldGen';

const own = (biome: BiomeType, extra: Partial<Tile> = {}): Tile => ({ biome, isOwned: true, ...extra });
const label = (set: Set<number>) =>
	[...set].map((k) => `${keyX(k)},${keyY(k)}`).sort();

test('tile keys round trip, including negative and extreme coordinates', () => {
	for (const [x, y] of [
		[0, 0],
		[25, 25],
		[-1, -1],
		[-COORD_LIMIT, COORD_LIMIT],
		[COORD_LIMIT, -COORD_LIMIT],
		[-123, 4567],
	]) {
		const k = tileKey(x, y);
		assert.ok(Number.isInteger(k) && k >= 0 && k < 2 ** 30, `key ${k} is a small non-negative integer`);
		assert.equal(keyX(k), x);
		assert.equal(keyY(k), y);
	}
	assert.equal(new Set([tileKey(0, 1), tileKey(1, 0), tileKey(-1, 0), tileKey(0, -1)]).size, 4);
	assert.ok(inRange(COORD_LIMIT, -COORD_LIMIT));
	assert.ok(!inRange(COORD_LIMIT + 1, 0));
	assert.ok(!inRange(0.5, 0));
});

test('the empty world: nothing owned, tileAt answers an empty tile', () => {
	assert.equal(ownedCount(EMPTY_WORLD), 0);
	assert.equal(ownedBounds(EMPTY_WORLD), null);
	assert.equal(getTile(EMPTY_WORLD, 3, 3), undefined);
	assert.deepEqual({ ...tileAt(EMPTY_WORLD, -50, 99999) }, { biome: 'empty', isOwned: false });
	assert.ok(!isOwnedAt(EMPTY_WORLD, 0, 0));
});

test('setTile / patchTile / removal keep the counters and bounds exact', () => {
	let w = setTile(EMPTY_WORLD, 5, 5, own('plains'));
	w = setTile(w, -3, 7, own('forest', { building: 'workshop' } as Partial<Tile>));
	w = setTile(w, 6, 5, own('forest', { hasChest: true } as Partial<Tile>));
	assert.equal(ownedCount(w), 3);
	assert.equal(buildingCount(w), 1);
	assert.equal(w.stats.chests, 1);
	assert.equal(biomeCount(w, 'forest'), 2);
	assert.equal(biomeCount(w, 'plains'), 1);
	assert.deepEqual(ownedBounds(w), { minX: -3, maxX: 6, minY: 5, maxY: 7 });

	// the original is untouched (copy on write)
	assert.equal(ownedCount(EMPTY_WORLD), 0);

	// patching merges, and a chest or a building moves the counters
	const patched = patchTile(w, 5, 5, { hasChest: true } as Partial<Tile>);
	assert.equal(patched.stats.chests, 2);
	assert.equal(getTile(patched, 5, 5)?.biome, 'plains');
	assert.equal(patchTile(w, 100, 100, { hasChest: true } as Partial<Tile>), w, 'patching nothing returns the same world');

	// removing the extreme tile shrinks the bounds
	const removed = setTile(w, -3, 7, undefined);
	assert.equal(ownedCount(removed), 2);
	assert.equal(buildingCount(removed), 0);
	assert.deepEqual(ownedBounds(removed), { minX: 5, maxX: 6, minY: 5, maxY: 5 });
	// an unowned tile counts as removal
	assert.equal(ownedCount(setTile(w, 5, 5, { biome: 'plains', isOwned: false })), 2);
});

test('setTile with an identical tile returns the same world and bounds object stays while the box does not change', () => {
	const t = own('plains');
	const w = setTile(EMPTY_WORLD, 0, 0, t);
	assert.equal(setTile(w, 0, 0, t), w);
	const w2 = setTile(setTile(w, 4, 4, own('plains')), 2, 2, own('forest'));
	const b = ownedBounds(w2);
	const w3 = setTile(w2, 3, 3, own('forest'));
	assert.equal(ownedBounds(w3), b, 'a tile inside the box reuses the bounds object');
});

test('setTiles applies a batch with one copy and rejects out-of-range coordinates', () => {
	const w = setTiles(EMPTY_WORLD, [
		{ x: 0, y: 0, tile: own('plains') },
		{ x: 1, y: 0, tile: own('forest') },
		{ x: 1, y: 0, tile: own('hills') },
	]);
	assert.equal(ownedCount(w), 2);
	assert.equal(getTile(w, 1, 0)?.biome, 'hills', 'later entries win');
	assert.equal(setTiles(w, []), w);
	assert.throws(() => setTile(w, COORD_LIMIT + 1, 0, own('plains')), RangeError);
});

test('owned tiles are listed in insertion order, and the entry list is cached per world', () => {
	const w = createWorld([
		{ x: 9, y: 9, tile: own('plains') },
		{ x: -2, y: 4, tile: own('forest') },
		{ x: 0, y: 0, tile: own('hills') },
	]);
	assert.deepEqual(
		ownedEntries(w).map((e) => `${e.x},${e.y}`),
		['9,9', '-2,4', '0,0']
	);
	assert.equal(ownedEntries(w), ownedEntries(w));
	const seen: string[] = [];
	forEachOwned(w, (tile, x, y) => seen.push(`${tile.biome}@${x},${y}`));
	assert.deepEqual(seen, ['plains@9,9', 'forest@-2,4', 'hills@0,0']);
});

test('neighbours and the frontier', () => {
	const w = setTile(EMPTY_WORLD, 0, 0, own('plains'));
	assert.ok(hasOwnedNeighbour(w, 1, 0));
	assert.ok(hasOwnedNeighbour(w, 0, -1));
	assert.ok(!hasOwnedNeighbour(w, 1, 1), 'diagonal is not a neighbour');
	assert.ok(isFrontier(w, -1, 0));
	assert.ok(!isFrontier(w, 0, 0), 'an owned tile is not frontier');
	assert.ok(!isFrontier(w, 5, 5));
	assert.ok(!isFrontier(w, COORD_LIMIT + 1, 0));
});

const parse = (rows: string[]): Tile[][] => {
	const map: Record<string, BiomeType> = { F: 'forest', P: 'plains', C: 'castle', L: 'lake', '.': 'empty' };
	return rows.map((r) =>
		[...r].map((c) => (c === '.' ? ({ biome: 'empty', isOwned: false } as Tile) : own(map[c])))
	);
};

test('rows adapter round trips with an offset', () => {
	const rows = parse(['FP.', '.CL']);
	const w = worldFromRows(rows, -1, 10);
	assert.equal(ownedCount(w), 4);
	assert.equal(getTile(w, -1, 10)?.biome, 'forest');
	assert.equal(getTile(w, 0, 11)?.biome, 'castle');
	assert.ok(!isOwnedAt(w, 1, 10));
	const back = worldToRows(w, -1, 10, 3, 2);
	assert.deepEqual(
		back.map((r) => r.map((t) => (t.isOwned ? t.biome : '.')).join(',')),
		['forest,plains,.', '.,castle,lake']
	);
});

test('connected cluster: same biome, 4-neighbour, the castle and unexplored ground give nothing', () => {
	const w = worldFromRows(parse(['FFPFF', 'FFPFF', 'PPCPP', 'FFPFL']));
	assert.deepEqual(label(connectedCluster(w, 0, 0)), ['0,0', '0,1', '1,0', '1,1']);
	assert.deepEqual(label(connectedCluster(w, 1, 1)), ['0,0', '0,1', '1,0', '1,1']);
	assert.deepEqual(label(connectedCluster(w, 4, 1)), ['3,0', '3,1', '4,0', '4,1']);
	assert.deepEqual(label(connectedCluster(w, 2, 0)), ['2,0', '2,1']);
	assert.equal(connectedCluster(w, 2, 2).size, 0, 'the castle is not a biome area');
	assert.equal(connectedCluster(w, 40, 40).size, 0, 'unexplored');
	// diagonal tiles are separate clusters
	const diag = worldFromRows(parse(['F.', '.F']));
	assert.equal(connectedCluster(diag, 0, 0).size, 1);
	// a building does not change the biome of the cluster
	const built = patchTile(w, 1, 0, { building: 'workshop' } as Partial<Tile>);
	assert.deepEqual(label(connectedCluster(built, 0, 0)), ['0,0', '0,1', '1,0', '1,1']);
});

test('syntheticWorld is deterministic, connected, holds the castle and reaches negative coordinates', () => {
	const a = syntheticWorld(800, 7);
	const b = syntheticWorld(800, 7);
	assert.equal(ownedCount(a), 800);
	assert.deepEqual(
		ownedEntries(a).map((e) => [e.x, e.y, e.tile.biome]),
		ownedEntries(b).map((e) => [e.x, e.y, e.tile.biome])
	);
	assert.notDeepEqual(
		ownedEntries(a).map((e) => [e.x, e.y]),
		ownedEntries(syntheticWorld(800, 8)).map((e) => [e.x, e.y])
	);
	assert.equal(getTile(a, CASTLE_X, CASTLE_Y)?.biome, 'castle');
	assert.ok((ownedBounds(a)?.minX ?? 0) < 0, 'drifts left past x = 0');
	// every tile is reachable from the castle through owned tiles
	const seen = new Set<number>([tileKey(CASTLE_X, CASTLE_Y)]);
	const stack = [tileKey(CASTLE_X, CASTLE_Y)];
	while (stack.length) {
		const k = stack.pop() as number;
		for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
			const nk = tileKey(keyX(k) + dx, keyY(k) + dy);
			if (!seen.has(nk) && isOwnedAt(a, keyX(k) + dx, keyY(k) + dy)) {
				seen.add(nk);
				stack.push(nk);
			}
		}
	}
	assert.equal(seen.size, 800);
	// growing from an existing world keeps it
	const more = syntheticWorld(100, 3, a);
	assert.equal(ownedCount(more), 900);
});

test('50,000 tiles: building, one purchase and a scan stay fast', () => {
	const t0 = performance.now();
	const w = syntheticWorld(50_000, 1);
	const build = performance.now() - t0;
	assert.equal(ownedCount(w), 50_000);
	const b = ownedBounds(w);
	assert.ok(b && b.maxX - b.minX > 50);

	const edge = ownedEntries(w)[0];
	const t1 = performance.now();
	const bigger = setTile(w, edge.x, edge.y - 1000, own('plains'));
	const purchase = performance.now() - t1;
	assert.equal(ownedCount(bigger), 50_001);

	const t2 = performance.now();
	let n = 0;
	forEachOwned(w, () => n++);
	const pass = performance.now() - t2;
	assert.equal(n, 50_000);

	assert.ok(build < 3000, `build ${build.toFixed(0)}ms`);
	assert.ok(purchase < 250, `purchase ${purchase.toFixed(1)}ms`);
	assert.ok(pass < 100, `pass ${pass.toFixed(1)}ms`);
});
