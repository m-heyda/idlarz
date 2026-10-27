import test from 'node:test';
import assert from 'node:assert/strict';
import {
	ATLAS,
	CELL,
	CHUNK_HALO,
	CHUNK_TILES,
	buildGroundGrid,
	cellLayers,
	chunkPads,
	chunkSignature,
	chunkSprites,
	decorSprites,
	dockAt,
	isBuilt,
	tileSprites,
	worldGround,
	type Ground,
	type GroundFn,
	type Placed,
} from '../src/utils/terrain';
import { tileRipples, tileShimmer } from '../src/utils/water';
import { COORD_LIMIT, EMPTY_WORLD, getTile, ownedBounds, ownedEntries, setTile, worldFromRows, worldToRows, type World } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';
import type { BiomeType, Tile } from '../src/types/game';

// The map is drawn in chunks. A chunk's picture must be a function of the ground inside chunk + CHUNK_HALO only (so the
// signature of that window decides when it is redrawn), and chunks must agree with each other along their borders.

const NAMES: Record<string, BiomeType> = { P: 'plains', S: 'swamp', L: 'lake', T: 'tundra', H: 'hills', F: 'forest',B: 'coast', C: 'castle' };
const rows = (lines: string[]): Tile[][] =>
	lines.map((row) =>
		[...row].map((c): Tile =>
			c === 'Y' ? { biome: 'plains', isOwned: true, building: 'tavern' } : NAMES[c] ? { biome: NAMES[c], isOwned: true } : { biome: 'empty', isOwned: false }
		)
	);

test('the map ground matches the array ground for every position(explored, building, mist ring, nothing)', () => {
	const lines = ['..........', '.PPPFFF...', '.PYPFLL...', '.PPPFLL...', '.HHSSTT...', '.HHSBBT...', '..........'];
	const tiles = rows(lines);
	const array = buildGroundGrid(tiles);
	const world = worldFromRows(tiles);
	const fn = worldGround(world);
	for (let y = 0; y < lines.length; y++) for (let x = 0; x < lines[0].length; x++) assert.equal(fn(x, y), array[y][x], `(${x},${y})`);
	assert.equal(fn(-3, -3), null);
	assert.equal(fn(COORD_LIMIT + 5, 0), null);
	assert.equal(worldGround(world), fn, 'cached per world');
});

// ---- the data a chunk is drawn from --------------------------------------------------------------------------------------

const byDrawOrder = (a: Placed, b: Placed) => a.bottom - b.bottom || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Cells and sprites of a chunk computed from `g`, the way terrainRenderer / chunkSprites read them. */
const chunkData = (world: World, g: GroundFn, cx: number, cy: number) => {
	const cells = [];
	for (let y = cy * CHUNK_TILES; y <= (cy + 1) * CHUNK_TILES; y++)
		for (let x = cx * CHUNK_TILES; x <= (cx + 1) * CHUNK_TILES; x++) cells.push(cellLayers(g, x, y));
	const sprites: Placed[] = [];
	for (let y = cy * CHUNK_TILES - 2; y < (cy + 1) * CHUNK_TILES + 2; y++) {
		for (let x = cx * CHUNK_TILES - 2; x < (cx + 1) * CHUNK_TILES + 2; x++) {
			if (!g(x, y)) continue;
			const built = isBuilt(getTile(world, x, y));
			const props = built ? [] : tileSprites(g, x, y);
			sprites.push(...props, ...(built ? [] : decorSprites(g, x, y, props)), ...dockAt(g, x, y));
		}
	}
	return { cells, sprites: sprites.sort(byDrawOrder), pads: chunkPads(world, cx, cy) };
};

/** A ground function that only knows the chunk and its halo and clamps to that window, like a canvas that did not look further. */
const windowed = (g: GroundFn, cx: number, cy: number): GroundFn => {
	const x0 = cx * CHUNK_TILES - CHUNK_HALO;
	const y0 = cy * CHUNK_TILES - CHUNK_HALO;
	const n = CHUNK_TILES + 2 * CHUNK_HALO;
	const win: (Ground | null)[][] = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => g(x0 + i, y0 + j)));
	return (x, y) => win[Math.min(Math.max(y - y0, 0), n - 1)][Math.min(Math.max(x - x0, 0), n - 1)];
};

/** A busy map: every ground side by side, lakes with docks, deep forest / hills / swamp, negative coordinates, buildings. */
const busyWorld = (seed: number): World => {
	let w = syntheticWorld(2500, seed);
	let n = 0;
	for (const { x, y, tile } of ownedEntries(w)) {
		if (tile.biome !== 'castle' && tile.biome !== 'lake' && ++n % 37 === 0) w = setTile(w, x, y, { ...tile, building: 'tavern' });
	}
	return w;
};

const chunkRange = (world: World) => {
	const b = ownedBounds(world)!;
	const list: [number, number][] = [];
	for (let cy = Math.floor(b.minY / CHUNK_TILES); cy <= Math.floor(b.maxY / CHUNK_TILES); cy++)
		for (let cx = Math.floor(b.minX / CHUNK_TILES); cx <= Math.floor(b.maxX / CHUNK_TILES); cx++) list.push([cx, cy]);
	return list;
};

test('halo: a chunk drawn from only chunk + halo of ground gets the same cells and sprites as one that sees the whole map', () => {
	for (const seed of [1, 2, 3]) {
		const world = busyWorld(seed);
		const g = worldGround(world);
		let sprites = 0;
		for (const [cx, cy] of chunkRange(world)) {
			const full = chunkData(world, g, cx, cy);
			const win = chunkData(world, windowed(g, cx, cy), cx, cy);
			assert.deepEqual(win, full, `chunk ${cx},${cy} (seed ${seed})`);
			assert.deepEqual(full.sprites, chunkSprites(world, cx, cy), 'chunkSprites is that list');
			sprites += full.sprites.length;
		}
		assert.ok(sprites > 100, `sprites compared (${sprites})`);
	}
});

test('signature: equal signatures mean equal pictures, whatever changed outside the window', () => {
	const world = busyWorld(4);
	const b = ownedBounds(world)!;
	const cx = Math.floor((b.minX + b.maxX) / 2 / CHUNK_TILES);
	const cy = Math.floor((b.minY + b.maxY) / 2 / CHUNK_TILES);
	const before = chunkData(world, worldGround(world), cx, cy);
	const sig = chunkSignature(world, cx, cy);
	assert.ok(/[a-z]/.test(sig));

	const x0 = cx * CHUNK_TILES;
	const y0 = cy * CHUNK_TILES;
	const biomes: BiomeType[] = ['lake', 'forest', 'hills', 'swamp', 'plains', 'tundra', 'coast'];
	let equalSignatures = 0;
	let changedSignatures = 0;
	for (let i = 0; i < 600; i++) {
		// a deterministic pseudo-random tile within 14 tiles of the chunk: re-biomed or (un)built
		const x = x0 - 14 + ((i * 7919) % (CHUNK_TILES + 28));
		const y = y0 - 14 + ((i * 104729) % (CHUNK_TILES + 28));
		const old = getTile(world, x, y);
		if (!old || old.biome === 'castle') continue;
		const mutated =
			i % 3 === 0
				? setTile(world, x, y, { ...old, building: old.building ? undefined : 'tavern' })
				: setTile(world, x, y, { ...old, biome: biomes[i % biomes.length] });
		if (chunkSignature(mutated, cx, cy) === sig) {
			equalSignatures++;
			assert.deepEqual(chunkData(mutated, worldGround(mutated), cx, cy), before, `signature unchanged but the picture differs (tile ${x},${y})`);
		} else changedSignatures++;
	}
	assert.ok(equalSignatures > 20 && changedSignatures > 20, `${equalSignatures} unchanged, ${changedSignatures} changed`);
});

test('sprites that reach over a chunk border are listed by both chunks', () => {
	const world = busyWorld(5);
	const key = (s: Placed) => `${s.id}@${s.x},${s.bottom}`;
	let crossing = 0;
	for (const [cx, cy] of chunkRange(world)) {
		for (const s of chunkSprites(world, cx, cy)) {
			const [, , w, h] = ATLAS.sprites[s.id];
			for (let ny = cy - 1; ny <= cy + 1; ny++) {
				for (let nx = cx - 1; nx <= cx + 1; nx++) {
					if (nx === cx && ny === cy) continue;
					const left = nx * CHUNK_TILES * CELL;
					const top = ny * CHUNK_TILES * CELL;
					const overlaps = s.x < left + CHUNK_TILES * CELL && s.x + w > left && s.bottom - h < top + CHUNK_TILES * CELL && s.bottom > top;
					if (!overlaps) continue;
					crossing++;
					assert.ok(chunkSprites(world, nx, ny).some((o) => key(o) === key(s)), `${key(s)} reaches chunk ${nx},${ny} from ${cx},${cy}`);
				}
			}
		}
	}
	assert.ok(crossing > 5, `sprites crossing a border (${crossing})`);
});

test('chunk lookups work with negative chunk numbers and an empty world draws nothing', () => {
	assert.ok(!/[a-zA-Z]/.test(chunkSignature(EMPTY_WORLD, -3, -3)));
	assert.deepEqual(chunkSprites(EMPTY_WORLD, -1, -1), []);
	assert.deepEqual(chunkPads(EMPTY_WORLD, 0, 0), []);
	const w = setTile(setTile(EMPTY_WORLD, -1, -1, { biome: 'forest', isOwned: true }), 0, -1, { biome: 'forest', isOwned: true });
	assert.ok(/[a-z]/.test(chunkSignature(w, -1, -1)) && /[a-z]/.test(chunkSignature(w, 0, -1)), 'a tile at the chunk border shows in both chunks (halo)');
	const ground = worldGround(w);
	assert.equal(ground(-1, -1), 'forest');
	assert.equal(ground(-2, -1), 'mist');
});

test('water: ripples at negative coordinates follow the same pattern as at positive ones (no negative modulo)', () => {
	const swamp: GroundFn = () => 'swamp';
	const count = (from: number) => {
		let n = 0;
		for (let y = from; y < from + 12; y++) for (let x = from; x < from + 12; x++) n += tileRipples(swamp, x, y).length;
		return n;
	};
	const positive = count(4);
	const negative = count(-16);
	assert.ok(positive > 20, `positive ${positive}`);
	assert.ok(negative > positive * 0.5 && negative < positive * 2, `negative ${negative} vs positive ${positive}`);
	// a swamp ripple sits inside its own tile
	for (let y = -8; y < 0; y++)
		for (let x = -8; x < 0; x++)
			for (const r of tileRipples(swamp, x, y)) {
				assert.ok(r.x >= x * CELL && r.x < (x + 1) * CELL && r.y >= y * CELL && r.y < (y + 1) * CELL, `ripple of ${x},${y}`);
			}
	const lake: GroundFn = () => 'lake';
	assert.ok(tileShimmer(lake, -5, -7), 'shimmer on open water at negative coordinates');
});

test('the 50 x 50 rows view of a world holds exactly the tiles inside that square', () => {
	const w = syntheticWorld(600, 2);
	const inside = ownedEntries(w).filter((e) => e.x >= 0 && e.x < 50 && e.y >= 0 && e.y < 50).length;
	assert.ok(inside > 0 && inside <= 600);
	assert.equal(worldToRows(w, 0, 0, 50, 50).flat().filter((t) => t.isOwned).length, inside);
});
