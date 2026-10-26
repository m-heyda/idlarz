import type { Tile } from '@/types/game';
import { CASTLE_FORTRESS } from '@/config/gameConfig';
import atlasJson from '@/config/terrainAtlas.json';
import { getTile, inRange, tileKey, type World } from './world';

/**
 * Dual-grid terrain. A dual cell (48 px) sits on the corner shared by four map tiles; per ground that is present
 * among those corners it picks one of 16 shapes by which corners belong to it, and grounds are layered bottom-up by
 * RANK (the higher ground draws its own rim over the lower one). Interior tiles get deeper tiers (`lake_d1`,
 * `hills_d2`, ...) and a few sprites (trees, rocks, docks) are placed by hash.
 *
 * This file is a line-for-line port of scripts/pixel/terrain_logic.py (integer maths only); tests/terrain.test.ts
 * checks it against tests/fixtures/terrain-parity.json written by the Python build, so art previews and game agree.
 */
export const CELL = 48;
const NW = 1;
const NE = 2;
const SW = 4;
const SE = 8;

/** Low to high: the higher ground draws its rim over the lower one. */
export const RANK = ['mist', 'coast', 'plains', 'swamp', 'tundra', 'grounds', 'forest', 'hills', 'lake', 'yard', 'castle'] as const;
export type Ground = (typeof RANK)[number];
export type GroundGrid = (Ground | null)[][];
/** The ground at a tile (null = nothing there): the map reads it through this, a test grid through the array form. */
export type GroundFn = (x: number, y: number) => Ground | null;
/** What the terrain maths reads. An array is clamped to its edges (the oldest tests rely on that); a function is exact. */
export type GroundSrc = GroundGrid | GroundFn;

export const MAX_DEPTH: Record<string, number> = { forest: 1, hills: 2, swamp: 1, tundra: 1, lake: 2 };
const LAND: string[] = ['plains', 'forest', 'hills', 'swamp', 'tundra', 'coast'];
const SIDES: [number, number, string][] = [
	[0, -1, 'n'],
	[1, 0, 'e'],
	[0, 1, 's'],
	[-1, 0, 'w'],
];
const DOCK_PCT = 55;

interface PropTable {
	edge: number[];
	deep: number[];
	opts: [string, number, number][]; // [sprite id, weight, min tile depth]
}
export interface TerrainAtlas {
	cell: number;
	tex: number;
	styles: string[];
	square: string[];
	sprites: Record<string, [number, number, number, number]>; // id -> x, y, w, h in props.png
	props: Record<string, PropTable>;
	decor?: Record<string, PropTable>; // tiny second-pass decorations (flowers, fallen trees)
	water?: { swamp?: [number, number][][] }; // ripple spots inside swamp pools, per 48px block of the 4x4 texture
}
export const ATLAS = atlasJson as unknown as TerrainAtlas;

/** 32-bit integer mix (mirrored in terrain_field.py). */
export function hash32(x: number, y: number, salt = 0): number {
	let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
	h = (h ^ (h >>> 15)) >>> 0;
	h = Math.imul(h, 0x85ebca6b) >>> 0;
	h = (h ^ (h >>> 13)) >>> 0;
	h = Math.imul(h, 0xc2b2ae35) >>> 0;
	h = (h ^ (h >>> 16)) >>> 0;
	return h;
}

const rankOf = (g: string) => RANK.indexOf(g as Ground);

/** The ground an owned tile is drawn with; null when it is not owned. A built-on grounds tile is still `grounds` here: the grid resolves its foundation. */
export function groundOf(tile: Tile | undefined): Ground | null {
	if (!tile || !tile.isOwned) return null;
	if (tile.biome === 'castle' && (tile.level ?? 1) >= CASTLE_FORTRESS.fromLevel) return 'yard'; // the fortress stands on cobbles
	return rankOf(tile.biome) > 0 ? (tile.biome as Ground) : null;
}

/** A tile with a building (any biome). */
export const isBuilt = (tile: Tile | undefined): boolean => !!tile && tile.isOwned && !!tile.building;

/** Old Grounds lots take the ground of the land around them; a building on any other biome keeps its own ground and gets a pad in that biome's style. */
const isGroundsLot = (tile: Tile | undefined): boolean => isBuilt(tile) && tile!.biome === 'grounds';

type OwnedName = Ground | 'building' | null;

/** Foundation of a building tile: the land biome most common among its 8 neighbours (a lake counts as coast, so a lakeside
 * plot stands on sand); ties go to the earlier entry; no land around -> plains. */
export const FOUNDATION_ORDER = ['hills', 'forest', 'tundra', 'swamp', 'plains', 'coast'] as const;
const PAD_VARIANTS = 2;

function foundation(nameAt: (x: number, y: number) => OwnedName | undefined, x: number, y: number): Ground {
	const counts: Record<string, number> = { hills: 0, forest: 0, tundra: 0, swamp: 0, plains: 0, coast: 0 };
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			if (!dx && !dy) continue;
			const n = nameAt(x + dx, y + dy);
			const name = n === 'lake' ? 'coast' : n;
			if (name && name in counts) counts[name]++;
		}
	const best = Math.max(...Object.values(counts));
	if (best === 0) return 'plains';
	return FOUNDATION_ORDER.find((b) => counts[b] === best) as Ground;
}

const nameOf = (t: Tile | undefined): OwnedName => (isGroundsLot(t) ? 'building' : groundOf(t));
const ownedNames = (tiles: Tile[][]): OwnedName[][] => tiles.map((row) => row.map(nameOf));

/** The biome a tile's ground belongs to for the eye: its own, or (built-on tiles) the foundation biome. */
export function foundationBiome(tiles: World, x: number, y: number): string {
	const t = getTile(tiles, x, y);
	if (!isGroundsLot(t)) return t?.biome ?? 'empty';
	return foundation((nx, ny) => nameOf(getTile(tiles, nx, ny)), x, y);
}

/** Ground per tile; unowned tiles 4-adjacent to an owned one become 'mist' (the buyable ring), the rest stay null. */
export function buildGroundGrid(tiles: Tile[][] | undefined): GroundGrid {
	if (!tiles) return [];
	const owned = ownedNames(tiles);
	const resolved: GroundGrid = owned.map((row, y) => row.map((g, x) => (g === 'building' ? foundation((nx, ny) => owned[ny]?.[nx], x, y) : g)));
	return resolved.map((row, y) =>
		row.map((g, x) =>
			g ??
			(SIDES.some(([dx, dy]) => owned[y + dy]?.[x + dx] != null) ? ('mist' as Ground) : null)
		)
	);
}

/** Foundation pads (48x48 worked-ground decals) under building tiles; `bottom` is the pad's bottom edge in world px. */
export function allPads(tiles: Tile[][] | undefined): Placed[] {
	if (!tiles) return [];
	const owned = ownedNames(tiles);
	const out: Placed[] = [];
	tiles.forEach((row, y) =>
		row.forEach((tile, x) => {
			if (!isBuilt(tile)) return;
			// a lot on its own biome gets that biome's pad; an old Grounds lot the pad of the land around it
			const kind = isGroundsLot(tile) ? foundation((nx, ny) => owned[ny]?.[nx], x, y) : (FOUNDATION_ORDER as readonly string[]).includes(tile.biome) ? tile.biome : 'plains';
			out.push({ id: `pad_${kind}_${hash32(x, y, 600) % PAD_VARIANTS}`, x: x * CELL, bottom: (y + 1) * CELL });
		})
	);
	return out;
}

/** One character per tile: changes only when the drawn terrain changes (not on chest toggles, resources, ...). Built-on tiles are upper case. */
export function terrainKey(tiles: Tile[][] | undefined): string {
	if (!tiles) return '';
	const g = buildGroundGrid(tiles);
	return g
		.map((row, y) =>
			row
				.map((gr, x) => {
					if (!gr) return '.';
					const c = String.fromCharCode(97 + rankOf(gr));
					return isBuilt(tiles[y][x]) ? c.toUpperCase() : c;
				})
				.join('')
		)
		.join('/');
}

const at = (g: GroundSrc, x: number, y: number): Ground | null =>
	typeof g === 'function' ? g(x, y) : g[Math.min(Math.max(y, 0), g.length - 1)][Math.min(Math.max(x, 0), g[0].length - 1)];

/** How many rings (1..MAX_DEPTH) around the tile share its ground; 0 on edges and for flat grounds. */
export function depth(g: GroundSrc, x: number, y: number): number {
	const me = at(g, x, y);
	let d = 0;
	for (let r = 1; r <= (me ? (MAX_DEPTH[me] ?? 0) : 0); r++) {
		let same = true;
		for (let dx = -r; dx <= r && same; dx++) for (let dy = -r; dy <= r; dy++) if (at(g, x + dx, y + dy) !== me) { same = false; break; }
		if (same) d = r;
		else break;
	}
	return d;
}

export interface Layer {
	style: string;
	mask: number;
	variant: number;
}

/** Layers bottom-up for dual cell (cx, cy); corners are tiles NW=(cx-1,cy-1), NE=(cx,cy-1), SW=(cx-1,cy), SE=(cx,cy). */
export function cellLayers(g: GroundSrc, cx: number, cy: number): Layer[] {
	const corners: [number, number, number][] = [
		[NW, cx - 1, cy - 1],
		[NE, cx, cy - 1],
		[SW, cx - 1, cy],
		[SE, cx, cy],
	];
	const info = corners.map(([bit, x, y]) => ({ bit, ground: at(g, x, y), d: depth(g, x, y) }));
	const present = [...new Set(info.map((i) => i.ground).filter((v): v is Ground => v !== null))].sort((a, b) => rankOf(a) - rankOf(b));
	const layers = present.map((gr) => ({
		gr,
		mask: info.reduce((s, i) => (i.ground && rankOf(i.ground) >= rankOf(gr) ? s + i.bit : s), 0),
		variant: hash32(cx, cy, rankOf(gr)) % 2,
	}));
	let lastFull = -1;
	layers.forEach((l, i) => {
		if (l.mask === 15) lastFull = i;
	});
	const out: Layer[] = [];
	layers.forEach(({ gr, mask, variant }, i) => {
		if (lastFull >= 0 && i < lastFull) return;
		out.push({ style: gr, mask, variant });
		for (let tier = 1; tier <= (MAX_DEPTH[gr] ?? 0); tier++) {
			const dmask = info.reduce((s, c) => (c.ground === gr && c.d >= tier ? s + c.bit : s), 0);
			if (dmask) out.push({ style: `${gr}_d${tier}`, mask: dmask, variant });
		}
	});
	return out;
}

// ------------------------------------------------------------------ sprites on top of the terrain
export interface Placed {
	id: string;
	x: number;
	bottom: number;
}

const gap2 = (rx0: number, ry0: number, [bx0, by0, bx1, by1]: number[]) => {
	const gx = Math.max(rx0 - bx1, bx0 - (rx0 + CELL), 0);
	const gy = Math.max(ry0 - by1, by0 - (ry0 + CELL), 0);
	return gx * gx + gy * gy;
};

/** Box (tile-local px, may extend outside the tile) keeps `margin` px from every neighbouring tile of another ground. */
function fits(g: GroundSrc, x: number, y: number, box: number[], margin: number, ground: Ground | null): boolean {
	for (let dx = -1; dx <= 1; dx++)
		for (let dy = -1; dy <= 1; dy++)
			if ((dx || dy) && at(g, x + dx, y + dy) !== ground && gap2(dx * CELL, dy * CELL, box) < margin * margin) return false;
	return true;
}

function pick(opts: [string, number, number][], h: number): [string, number, number] {
	const total = opts.reduce((s, o) => s + o[1], 0);
	let n = h % total;
	for (const o of opts) {
		if (n < o[1]) return o;
		n -= o[1];
	}
	return opts[opts.length - 1];
}

/** 0..3 props for tile (x, y), anchored at their base centre. */
export function tileSprites(g: GroundSrc, x: number, y: number, m: TerrainAtlas = ATLAS): Placed[] {
	const me = at(g, x, y);
	const table = me ? m.props[me] : undefined;
	if (!me || !table) return [];
	const d = depth(g, x, y);
	const probs = d ? table.deep : table.edge; // thousandths for 0, 1, 2.. props
	const roll = hash32(x, y, 500) % 1000;
	let count = probs.length - 1;
	let acc = 0;
	for (let i = 0; i < probs.length; i++) {
		acc += probs[i];
		if (roll < acc) {
			count = i;
			break;
		}
	}
	let opts = table.opts.filter((o) => d >= o[2]);
	if (me === 'mist') opts = opts.filter((o) => m.sprites[o[0]][2] <= 18);
	const out: Placed[] = [];
	const anchors: [number, number][] = [];
	for (let k = 0; k < count; k++) {
		const o = pick(opts, hash32(x, y, 510 + k));
		const [, , sw, sh] = m.sprites[o[0]];
		for (let attempt = 0; attempt < 4; attempt++) {
			let px: number, py: number, cx: number, cy: number;
			if (me === 'mist') {
				// fog tiles keep their centre for the '?' marker
				const slot = hash32(x, y, 520 + k * 5 + attempt) % 4;
				px = slot % 2 === 0 ? 3 : CELL - sw - 3;
				py = slot < 2 ? 3 : CELL - sh - 3;
				cx = px + Math.floor(sw / 2);
				cy = py + sh;
			} else {
				cx = 5 + (hash32(x, y, 520 + k * 5 + attempt) % (CELL - 10));
				cy = 12 + (hash32(x, y, 540 + k * 5 + attempt) % (CELL - 14));
				px = cx - Math.floor(sw / 2);
				py = cy - sh;
			}
			if (anchors.some(([ax, ay]) => (cx - ax) ** 2 + (cy - ay) ** 2 < 169)) continue;
			if (fits(g, x, y, [px, py, px + sw, py + sh], me === 'mist' ? 2 : sh < 20 ? 6 : 4, me)) {
				anchors.push([cx, cy]);
				out.push({ id: o[0], x: x * CELL + px, bottom: y * CELL + py + sh });
				break;
			}
		}
	}
	return out;
}

const overlaps = (a: number[], b: number[], margin: number) =>
	a[0] < b[2] + margin && b[0] < a[2] + margin && a[1] < b[3] + margin && b[1] < a[3] + margin;

/**
 * Tiny decorations (flowers on plains, fallen trees on swamps): a second hash pass that never moves the props.
 * `props` are this tile's prop placements; decor keeps clear of them and of the neighbouring grounds.
 */
export function decorSprites(g: GroundSrc, x: number, y: number, props: Placed[], m: TerrainAtlas = ATLAS): Placed[] {
	const me = at(g, x, y);
	const table = me ? m.decor?.[me] : undefined;
	if (!me || !table) return [];
	const d = depth(g, x, y);
	const probs = d ? table.deep : table.edge;
	const roll = hash32(x, y, 700) % 1000;
	let count = probs.length - 1;
	let acc = 0;
	for (let i = 0; i < probs.length; i++) {
		acc += probs[i];
		if (roll < acc) {
			count = i;
			break;
		}
	}
	const opts = table.opts.filter((o) => d >= o[2]);
	const boxes = props.map((p) => {
		const [, , w, h] = m.sprites[p.id];
		return [p.x - x * CELL, p.bottom - h - y * CELL, p.x - x * CELL + w, p.bottom - y * CELL];
	});
	const out: Placed[] = [];
	for (let k = 0; k < count; k++) {
		const o = pick(opts, hash32(x, y, 710 + k));
		const [, , sw, sh] = m.sprites[o[0]];
		for (let attempt = 0; attempt < 6; attempt++) {
			const px = 2 + (hash32(x, y, 720 + k * 7 + attempt) % (CELL - sw - 4));
			const py = 2 + (hash32(x, y, 760 + k * 7 + attempt) % (CELL - sh - 4));
			const box = [px, py, px + sw, py + sh];
			if (boxes.some((b) => overlaps(box, b, 2)) || !fits(g, x, y, box, 3, me)) continue;
			boxes.push(box);
			out.push({ id: o[0], x: x * CELL + px, bottom: y * CELL + py + sh });
			break;
		}
	}
	return out;
}

/** A pier (sometimes with a boat) on a lake tile with exactly one land side; only a local maximum of the roll. */
export function dockAt(g: GroundSrc, x: number, y: number, m: TerrainAtlas = ATLAS): Placed[] {
	const eligible = (tx: number, ty: number): [number, number, string] | null => {
		if (at(g, tx, ty) !== 'lake') return null;
		const land = SIDES.filter(([dx, dy]) => at(g, tx + dx, ty + dy) !== 'lake');
		if (land.length !== 1 || !LAND.includes(at(g, tx + land[0][0], ty + land[0][1]) as string)) return null;
		const [dx, dy] = land[0];
		for (let ox = -1; ox <= 1; ox++)
			for (let oy = -1; oy <= 1; oy++)
				if ((ox !== 0 || oy !== 0) && ox * dx + oy * dy <= 0 && at(g, tx + ox, ty + oy) !== 'lake') return null; // water-side diagonals must be water
		return land[0];
	};

	const land = eligible(x, y);
	if (!land || hash32(x, y, 300) % 100 >= DOCK_PCT) return [];
	const mine = hash32(x, y, 301);
	for (let ox = -2; ox <= 2; ox++)
		for (let oy = -2; oy <= 2; oy++)
			if ((ox || oy) && eligible(x + ox, y + oy) && hash32(x + ox, y + oy, 300) % 100 < DOCK_PCT && hash32(x + ox, y + oy, 301) >= mine) return [];
	const d = land[2];
	const length = [22, 26, 30][hash32(x, y, 302) % 3];
	const barrel = hash32(x, y, 303) % 3 === 0 ? 1 : 0;
	const pid = `pier_${d}_${length}_${barrel}`;
	const [, , w, h] = m.sprites[pid];
	const horizontalAxis = d === 'n' || d === 's';
	const off = 8 + (hash32(x, y, 304) % (CELL - 16 - (horizontalAxis ? w : h)));
	let px: number, py: number;
	if (d === 's') [px, py] = [x * CELL + off, (y + 1) * CELL + 7 - h];
	else if (d === 'n') [px, py] = [x * CELL + off, y * CELL - 7];
	else if (d === 'e') [px, py] = [(x + 1) * CELL + 7 - w, y * CELL + off];
	else [px, py] = [x * CELL - 7, y * CELL + off];
	const out: Placed[] = [{ id: pid, x: px, bottom: py + h }];
	if (hash32(x, y, 305) % 3 === 0) {
		// a rowboat moored beside the pier
		const bid = horizontalAxis ? 'boat_v' : 'boat_h';
		const [, , bw, bh] = m.sprites[bid];
		const side = (horizontalAxis ? px - x * CELL : py - y * CELL) < 20 ? 1 : -1;
		let bx: number, by: number;
		if (horizontalAxis) {
			bx = px + (side > 0 ? w + 1 : -bw - 1);
			by = py + (d === 's' ? 6 : h - bh - 6);
		} else {
			by = py + (side > 0 ? h + 1 : -bh - 1);
			bx = px + (d === 'e' ? 6 : w - bw - 6);
		}
		out.push({ id: bid, x: bx, bottom: by + bh });
	}
	return out;
}

/** Coordinates ("x,y") of building tiles: they carry no props, the building stands there. */
export function builtSet(tiles: Tile[][] | undefined): Set<string> {
	const out = new Set<string>();
	tiles?.forEach((row, y) => row.forEach((t, x) => isBuilt(t) && out.add(`${x},${y}`)));
	return out;
}

/** Every sprite of the map in draw order (bottom edge, then x). */
export function allSprites(g: GroundGrid, m: TerrainAtlas = ATLAS, built?: Set<string>): Placed[] {
	const items: Placed[] = [];
	for (let y = 0; y < g.length; y++)
		for (let x = 0; x < g[0].length; x++) {
			const skip = built?.has(`${x},${y}`);
			const props = skip ? [] : tileSprites(g, x, y, m);
			items.push(...props, ...(skip ? [] : decorSprites(g, x, y, props, m)), ...dockAt(g, x, y, m));
		}
	return items.sort((a, b) => a.bottom - b.bottom || a.x - b.x);
}

// ------------------------------------------------------------------ the map, in chunks
/** The map is drawn in square chunks of this many tiles (a 768 px canvas each), only near the screen. */
export const CHUNK_TILES = 16;
/**
 * How far from a chunk the drawing can depend on the ground: the deepest ring (2), a neighbour's neighbour for docks (3)
 * and the margin of `fits` all stay inside 5 tiles, so a chunk's picture is a function of the ground in chunk + 5.
 */
export const CHUNK_HALO = 5;
/** Sprites of tiles this close to a chunk can reach into it (a pier is under one tile long). */
const SPRITE_REACH = 2;

export const chunkOf = (tile: number): number => Math.floor(tile / CHUNK_TILES);

const groundCache = new WeakMap<World, GroundFn>();

/**
 * The ground of every tile of a World, the way buildGroundGrid derives it for an array: an explored tile has its own ground
 * (a building on an old Grounds lot takes the land around it), an unexplored tile next to explored land is 'mist', the rest
 * is nothing. Cached per World (and per tile), so drawing a chunk does not recompute the same neighbours again and again.
 */
export function worldGround(world: World): GroundFn {
	let fn = groundCache.get(world);
	if (!fn) {
		const memo = new Map<number, Ground | null>();
		const nameAt = (x: number, y: number): OwnedName => nameOf(getTile(world, x, y));
		fn = (x, y) => {
			if (!inRange(x, y)) return null;
			const key = tileKey(x, y);
			const known = memo.get(key);
			if (known !== undefined) return known;
			const own = nameAt(x, y);
			let ground: Ground | null;
			if (own === 'building') ground = foundation(nameAt, x, y);
			else if (own) ground = own;
			else ground = SIDES.some(([dx, dy]) => nameAt(x + dx, y + dy) != null) ? 'mist' : null;
			memo.set(key, ground);
			return ground;
		};
		groundCache.set(world, fn);
	}
	return fn;
}

/**
 * One character per tile of the chunk and its halo: changes exactly when the chunk's picture changes (the ground, and which
 * tiles carry a building, upper case), not on chest toggles, resources, ... Only letters mean there is something to draw.
 */
export function chunkSignature(world: World, cx: number, cy: number): string {
	const g = worldGround(world);
	const x0 = cx * CHUNK_TILES - CHUNK_HALO;
	const y0 = cy * CHUNK_TILES - CHUNK_HALO;
	const n = CHUNK_TILES + 2 * CHUNK_HALO;
	let out = '';
	for (let y = y0; y < y0 + n; y++) {
		for (let x = x0; x < x0 + n; x++) {
			const gr = g(x, y);
			if (!gr) {
				out += '.';
				continue;
			}
			const c = String.fromCharCode(97 + rankOf(gr));
			out += isBuilt(getTile(world, x, y)) ? c.toUpperCase() : c;
		}
		out += '/';
	}
	return out;
}

/** Foundation pads of the building tiles inside the chunk. */
export function chunkPads(world: World, cx: number, cy: number): Placed[] {
	const out: Placed[] = [];
	const nameAt = (x: number, y: number): OwnedName => nameOf(getTile(world, x, y));
	for (let y = cy * CHUNK_TILES; y < (cy + 1) * CHUNK_TILES; y++) {
		for (let x = cx * CHUNK_TILES; x < (cx + 1) * CHUNK_TILES; x++) {
			const tile = getTile(world, x, y);
			if (!tile || !isBuilt(tile)) continue;
			// a lot on its own biome gets that biome's pad; an old Grounds lot the pad of the land around it
			const kind = isGroundsLot(tile) ? foundation(nameAt, x, y) : (FOUNDATION_ORDER as readonly string[]).includes(tile.biome) ? tile.biome : 'plains';
			out.push({ id: `pad_${kind}_${hash32(x, y, 600) % PAD_VARIANTS}`, x: x * CELL, bottom: (y + 1) * CELL });
		}
	}
	return out;
}

/** Props, decorations and docks that can touch the chunk (those of tiles up to SPRITE_REACH away too), bottom edge first. */
export function chunkSprites(world: World, cx: number, cy: number, m: TerrainAtlas = ATLAS): Placed[] {
	const g = worldGround(world);
	const items: Placed[] = [];
	for (let y = cy * CHUNK_TILES - SPRITE_REACH; y < (cy + 1) * CHUNK_TILES + SPRITE_REACH; y++) {
		for (let x = cx * CHUNK_TILES - SPRITE_REACH; x < (cx + 1) * CHUNK_TILES + SPRITE_REACH; x++) {
			if (!g(x, y)) continue;
			const built = isBuilt(getTile(world, x, y));
			const props = built ? [] : tileSprites(g, x, y, m);
			items.push(...props, ...(built ? [] : decorSprites(g, x, y, props, m)), ...dockAt(g, x, y, m));
		}
	}
	return items.sort((a, b) => a.bottom - b.bottom || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
