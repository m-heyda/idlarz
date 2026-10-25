import type { Tile } from '@/types/game';

/**
 * The map: a sparse, immutable set of explored tiles on an unbounded (negative coordinates allowed) integer grid.
 *
 * Only owned tiles are stored; everything else is "not explored" (`tileAt` answers an empty tile, `getTile` undefined).
 * Updates are copy-on-write (`setTile` returns a new World) so a store `tiles` reference changes exactly when the map does,
 * and the counters (owned, buildings, per-biome) and bounds are kept up to date incrementally: no per-tick scans.
 *
 * Coordinates are logical: the castle stays at (25, 25) as it always was, so old saves and the procedural art (which hashes
 * absolute coordinates) are unchanged. |x| and |y| are limited to COORD_LIMIT so a tile has a small-integer key (a Map with
 * keys that are V8 small integers is several times faster than one with doubles).
 */

export const COORD_LIMIT = 16_000;
export const MAX_OWNED_TILES = 250_000;

const SPAN = 2 * COORD_LIMIT + 1;

/** Key of (x, y); below 2^30, so a small integer. Both coordinates must be integers within +-COORD_LIMIT. */
export const tileKey = (x: number, y: number): number => (y + COORD_LIMIT) * SPAN + (x + COORD_LIMIT);
export const keyX = (key: number): number => (key % SPAN) - COORD_LIMIT;
export const keyY = (key: number): number => Math.floor(key / SPAN) - COORD_LIMIT;

export const inRange = (x: number, y: number): boolean =>
	Number.isInteger(x) && Number.isInteger(y) && Math.abs(x) <= COORD_LIMIT && Math.abs(y) <= COORD_LIMIT;

/** What an unexplored position looks like to callers that index the map the old way. */
export const EMPTY_TILE: Readonly<Tile> = Object.freeze({ biome: 'empty', isOwned: false } as Tile);

/** Inclusive tile-coordinate rectangle. */
export interface Bounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export interface WorldStats {
	owned: number;
	buildings: number;
	chests: number;
	byBiome: Readonly<Record<string, number>>;
}

export interface World {
	readonly map: ReadonlyMap<number, Tile>;
	readonly stats: WorldStats;
	/** Bounding box of the owned tiles, null for an empty world. The same object while it does not change. */
	readonly bounds: Bounds | null;
}

export interface Placed {
	x: number;
	y: number;
	tile: Tile;
}

const EMPTY_STATS: WorldStats = { owned: 0, buildings: 0, chests: 0, byBiome: {} };
export const EMPTY_WORLD: World = { map: new Map(), stats: EMPTY_STATS, bounds: null };

// ---- statistics ----------------------------------------------------------------------------------------------------

/** Running totals while a batch of changes is applied (one byBiome copy per batch, not per tile). */
interface Tally {
	owned: number;
	buildings: number;
	chests: number;
	byBiome: Record<string, number>;
}

const startTally = (stats: WorldStats): Tally => ({
	owned: stats.owned,
	buildings: stats.buildings,
	chests: stats.chests,
	byBiome: { ...stats.byBiome },
});

/** Accounts for replacing `old` (undefined = not stored) with `next` (undefined = removed). */
const account = (t: Tally, old: Tile | undefined, next: Tile | undefined): void => {
	if (old) {
		t.owned--;
		if (old.building) t.buildings--;
		if (old.hasChest) t.chests--;
		if (--t.byBiome[old.biome] <= 0) delete t.byBiome[old.biome];
	}
	if (next) {
		t.owned++;
		if (next.building) t.buildings++;
		if (next.hasChest) t.chests++;
		t.byBiome[next.biome] = (t.byBiome[next.biome] ?? 0) + 1;
	}
};

const grow = (bounds: Bounds | null, x: number, y: number): Bounds => {
	if (!bounds) return { minX: x, maxX: x, minY: y, maxY: y };
	if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) return bounds;
	return {
		minX: Math.min(bounds.minX, x),
		maxX: Math.max(bounds.maxX, x),
		minY: Math.min(bounds.minY, y),
		maxY: Math.max(bounds.maxY, y),
	};
};

const computeBounds = (map: ReadonlyMap<number, Tile>): Bounds | null => {
	let bounds: Bounds | null = null;
	for (const key of map.keys()) bounds = grow(bounds, keyX(key), keyY(key));
	return bounds;
};

// ---- reading -------------------------------------------------------------------------------------------------------

/**
 * The owned tile at (x, y), or undefined. Hot path (income rates read four neighbours of every tile): a range check without
 * the integer test, since a fractional or NaN position gives a key no tile has.
 */
export const getTile = (world: World, x: number, y: number): Tile | undefined =>
	x >= -COORD_LIMIT && x <= COORD_LIMIT && y >= -COORD_LIMIT && y <= COORD_LIMIT ? world.map.get(tileKey(x, y)) : undefined;

/** The tile at (x, y); an empty, unowned tile (frozen) when it is not explored: the old `tiles[y][x]` semantics. */
export const tileAt = (world: World, x: number, y: number): Tile => getTile(world, x, y) ?? EMPTY_TILE;

export const isOwnedAt = (world: World, x: number, y: number): boolean => getTile(world, x, y) !== undefined;

export const ownedCount = (world: World): number => world.stats.owned;
export const buildingCount = (world: World): number => world.stats.buildings;
export const biomeCount = (world: World, biome: string): number => world.stats.byBiome[biome] ?? 0;
export const ownedBounds = (world: World): Bounds | null => world.bounds;

/** Calls `fn` for every owned tile, in the order they were added. Do not set tiles from inside `fn`. */
export const forEachOwned = (world: World, fn: (tile: Tile, x: number, y: number) => void): void => {
	for (const [key, tile] of world.map) fn(tile, keyX(key), keyY(key));
};

const entryCache = new WeakMap<World, Placed[]>();

/** Every owned tile with its coordinates, in the order they were added (cached per World, so cheap to call again). */
export const ownedEntries = (world: World): readonly Placed[] => {
	let list = entryCache.get(world);
	if (!list) {
		list = [];
		for (const [key, tile] of world.map) list.push({ x: keyX(key), y: keyY(key), tile });
		entryCache.set(world, list);
	}
	return list;
};

const rowMajorCache = new WeakMap<World, readonly Placed[]>();

/**
 * Every owned tile ordered by row, then column (the order the old `tiles[y][x]` scans visited them). Random pickers use it
 * so one seed gives the same pick however the tiles were added or loaded. Cached per World.
 */
export const ownedRowMajor = (world: World): readonly Placed[] => {
	let list = rowMajorCache.get(world);
	if (!list) {
		list = [...ownedEntries(world)].sort((a, b) => a.y - b.y || a.x - b.x);
		rowMajorCache.set(world, list);
	}
	return list;
};

const SIDES: readonly (readonly [number, number])[] = [
	[-1, 0],
	[1, 0],
	[0, -1],
	[0, 1],
];

export const hasOwnedNeighbour = (world: World, x: number, y: number): boolean =>
	SIDES.some(([dx, dy]) => isOwnedAt(world, x + dx, y + dy));

/** An unexplored position next to an explored tile: the places a tile can be bought. */
export const isFrontier = (world: World, x: number, y: number): boolean =>
	inRange(x, y) && !isOwnedAt(world, x, y) && hasOwnedNeighbour(world, x, y);

// ---- writing (copy-on-write) ---------------------------------------------------------------------------------------

/**
 * Applies several changes with one copy: each entry sets the tile at (x, y), or removes it when `tile` is undefined or
 * not owned. Returns the same World when nothing changes.
 */
export const setTiles = (world: World, changes: Iterable<{ x: number; y: number; tile: Tile | undefined }>): World => {
	let map: Map<number, Tile> | null = null;
	let tally: Tally | null = null;
	let bounds = world.bounds;
	let removed = false;
	for (const { x, y, tile } of changes) {
		if (!inRange(x, y)) throw new RangeError(`tile (${x}, ${y}) is outside the map limits`);
		const key = tileKey(x, y);
		const old = (map ?? world.map).get(key);
		const next = tile && tile.isOwned ? tile : undefined;
		if (old === next) continue;
		if (!map) {
			map = new Map(world.map);
			tally = startTally(world.stats);
		}
		if (next) {
			map.set(key, next);
			bounds = grow(bounds, x, y);
		} else {
			map.delete(key);
			removed = true;
		}
		account(tally as Tally, old, next);
	}
	if (!map || !tally) return world;
	if (removed) bounds = computeBounds(map);
	return { map, stats: tally, bounds };
};

export const setTile = (world: World, x: number, y: number, tile: Tile | undefined): World =>
	setTiles(world, [{ x, y, tile }]);

/** Merges `patch` into the tile at (x, y); false-y when there is no such tile. */
export const patchTile = (world: World, x: number, y: number, patch: Partial<Tile>): World => {
	const old = getTile(world, x, y);
	return old ? setTile(world, x, y, { ...old, ...patch }) : world;
};

/** A World from a list of placed tiles (unowned ones are skipped). Later duplicates win. */
export const createWorld = (entries: Iterable<Placed>): World =>
	setTiles(
		EMPTY_WORLD,
		(function* () {
			for (const { x, y, tile } of entries) yield { x, y, tile };
		})()
	);

// ---- adapters to the old row-major arrays (legacy saves, tests) --------------------------------------------------------

/** A World from rows of tiles, row 0 at y = `oy` and column 0 at x = `ox`; unowned tiles are not stored. */
export const worldFromRows = (rows: readonly (readonly Tile[])[], ox = 0, oy = 0): World => {
	const entries: Placed[] = [];
	rows.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (tile && tile.isOwned) entries.push({ x: x + ox, y: y + oy, tile });
		})
	);
	return createWorld(entries);
};

/** The rectangle [x0, x0 + width) x [y0, y0 + height) as rows of tiles (fresh empty tiles where nothing is explored). */
export const worldToRows = (world: World, x0: number, y0: number, width: number, height: number): Tile[][] => {
	const rows: Tile[][] = [];
	for (let y = y0; y < y0 + height; y++) {
		const row: Tile[] = [];
		for (let x = x0; x < x0 + width; x++) row.push(getTile(world, x, y) ?? { biome: 'empty', isOwned: false });
		rows.push(row);
	}
	return rows;
};
