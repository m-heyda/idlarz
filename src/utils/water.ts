import { ATLAS, CELL, dockAt, depth, hash32, type GroundGrid, type GroundSrc, type TerrainAtlas } from './terrain';

/**
 * Where the map's water ripples go: a few per open-water lake tile and one per deep swamp tile, placed by hash so the
 * same map always gets the same ripples (a purchase only adds or removes the ones of the tiles it changes). The swamp
 * ones sit on spots the terrain build found inside the murky pools (atlas `water.swamp`, 4x4 blocks of the texture).
 */
export const RIPPLE_FRAMES = 8;
export const RIPPLE_SIZE = { lake: [16, 6], swamp: [12, 5] } as const;

export interface Ripple {
	key: string;
	kind: 'lake' | 'swamp';
	tx: number; // the tile it belongs to (for culling)
	ty: number;
	x: number; // world px, top-left
	y: number;
	/** negative start delay (ms) so neighbours never pulse together */
	offsetMs: number;
	/** one pulse, including the rest at the end */
	ms: number;
}

const at = (g: GroundSrc, x: number, y: number) => (typeof g === 'function' ? g(x, y) : g[y]?.[x] ?? null);

/** x mod 4 as 0..3, also for negative coordinates (the map has them). */
const mod4 = (n: number) => ((n % 4) + 4) % 4;

export function tileRipples(g: GroundSrc, x: number, y: number, m: TerrainAtlas = ATLAS): Ripple[] {
	const me = at(g, x, y);
	if (me !== 'lake' && me !== 'swamp') return [];
	const d = depth(g, x, y);
	const roll = hash32(x, y, 800) % 100;
	const out: Ripple[] = [];
	const timing = (k: number) => ({ ms: 2800 + (hash32(x, y, 830 + k) % 1800), offsetMs: hash32(x, y, 840 + k) % 4600 });

	if (me === 'lake') {
		const [w, h] = RIPPLE_SIZE.lake;
		const count = d >= 1 ? (roll < 10 ? 0 : roll < 50 ? 1 : roll < 88 ? 2 : 3) : roll < 15 ? 1 : 0; // shore tiles are mostly foam
		for (let k = 0; k < count; k++) {
			// shore tiles keep to the middle; open water may use the whole tile
			const left = d >= 1 ? 4 + (hash32(x, y, 810 + k) % (CELL - w - 7)) : 12 + (hash32(x, y, 810 + k) % 9);
			const top = d >= 1 ? 3 + (hash32(x, y, 820 + k) % (CELL - h - 5)) : 14 + (hash32(x, y, 820 + k) % 13);
			if (out.some((o) => Math.abs(o.x - (x * CELL + left)) < w && Math.abs(o.y - (y * CELL + top)) < h + 4)) continue;
			out.push({ key: `${x},${y},${k}`, kind: 'lake', tx: x, ty: y, x: x * CELL + left, y: y * CELL + top, ...timing(k) });
		}
	} else if (d >= 1 && roll < 65) {
		const spots = m.water?.swamp?.[mod4(y) * 4 + mod4(x)];
		if (spots?.length) {
			const [w, h] = RIPPLE_SIZE.swamp;
			const [sx, sy] = spots[hash32(x, y, 810) % spots.length];
			out.push({ key: `${x},${y},0`, kind: 'swamp', tx: x, ty: y, x: x * CELL + sx - (w >> 1), y: y * CELL + sy - (h >> 1), ...timing(0) });
		}
	}
	return out;
}

/** The soft glitter over open lake water: one 48px sheet (4 frames) per tile, see sprites_water.py `water_shimmer`. */
export const SHIMMER = { size: CELL, frames: 4 } as const;

export interface Shimmer {
	key: string;
	tx: number;
	ty: number;
	x: number; // world px, top-left of the tile
	y: number;
	/** mirrored, so neighbouring tiles do not repeat the same dashes */
	flip: boolean;
	/** one full loop (ms) and a negative start delay, so the glitter never moves in step across the lake */
	ms: number;
	offsetMs: number;
}

/** Open-water lake tiles (not the shore, which is foam and bank) each get one shimmer. */
export function tileShimmer(g: GroundSrc, x: number, y: number): Shimmer | null {
	if (at(g, x, y) !== 'lake' || depth(g, x, y) < 1) return null;
	return {
		key: `${x},${y}`,
		tx: x,
		ty: y,
		x: x * CELL,
		y: y * CELL,
		flip: hash32(x, y, 850) % 2 === 0,
		ms: 3200 + (hash32(x, y, 851) % 2400),
		offsetMs: hash32(x, y, 852) % 6000,
	};
}

export function buildShimmers(g: GroundGrid): Shimmer[] {
	const out: Shimmer[] = [];
	for (let y = 0; y < g.length; y++)
		for (let x = 0; x < g[0].length; x++) {
			const s = tileShimmer(g, x, y);
			if (s) out.push(s);
		}
	return out;
}

/** Every ripple of the map. */
export function buildRipples(g: GroundGrid, m: TerrainAtlas = ATLAS): Ripple[] {
	const out: Ripple[] = [];
	for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) out.push(...tileRipples(g, x, y, m));
	return out;
}

// ------------------------------------------------------------------ life on the water: bubbles, waterfalls, boats, dolphins
export const BUBBLE = { size: 10, frames: 8 } as const;
export const FALL = { w: 16, h: 24, frames: 4 } as const;
export const BOAT = { w: 20, h: 18, frames: 2 } as const;
/** A leap fits a 52x34 box whose waterline is 26px down: the body slides along an arc inside it (see globals.css), the splashes sit on the waterline. */
export const DOLPHIN = { w: 52, h: 34, waterline: 26, pose: 24, poses: 5, splashW: 20, splashH: 8, splashFrames: 4 } as const;

/** Everything below is placed by hash like the ripples: the same map always gets the same sprites. */
interface Placement {
	key: string;
	tx: number; // the tile it belongs to (for culling)
	ty: number;
	x: number; // world px, top-left
	y: number;
	/** one loop (ms) and a negative start delay, so neighbours never move in step */
	ms: number;
	offsetMs: number;
}

/** A corruption bubble on a swamp pool: swells and pops. Pure decoration. */
export type Bubble = Placement;

export function tileBubbles(g: GroundSrc, x: number, y: number, m: TerrainAtlas = ATLAS): Bubble[] {
	if (at(g, x, y) !== 'swamp') return [];
	const deep = depth(g, x, y) >= 1; // deep swamp has the big pools (the ripples' spots), the rim only the small ones
	const spots = (deep ? m.water?.swamp : m.water?.swamp0)?.[mod4(y) * 4 + mod4(x)];
	if (!spots?.length) return [];
	const roll = hash32(x, y, 900) % 100;
	const count = deep ? (roll < 20 ? 0 : roll < 65 ? 1 : 2) : roll < 55 ? 0 : 1;
	const used = new Set<number>();
	if (deep && hash32(x, y, 800) % 100 < 65) used.add(hash32(x, y, 810) % spots.length); // the swamp ripple's spot stays free
	const out: Bubble[] = [];
	for (let k = 0; k < count; k++) {
		let i = hash32(x, y, 901 + k) % spots.length;
		for (let tries = 0; used.has(i) && tries < spots.length; tries++) i = (i + 1) % spots.length;
		if (used.has(i)) break;
		used.add(i);
		const [sx, sy] = spots[i];
		out.push({
			key: `${x},${y},${k}`,
			tx: x,
			ty: y,
			x: x * CELL + sx - (BUBBLE.size >> 1),
			y: y * CELL + sy - (BUBBLE.size >> 1),
			ms: 2600 + (hash32(x, y, 905 + k) % 2600),
			offsetMs: hash32(x, y, 907 + k) % 6000,
		});
	}
	return out;
}

/** A waterfall where a hill's south face drops into a lake (seen from the front: the cliff face is what the player looks at). */
export type Fall = Placement;

const FALL_PCT = 55;

/** The roll of the hill tile (x, y) for a waterfall into the lake south of it, or null: needs hills over a lake and a passing roll. */
const fallRoll = (g: GroundSrc, x: number, y: number): number | null => {
	if (at(g, x, y) !== 'hills' || at(g, x, y + 1) !== 'lake' || hash32(x, y, 920) % 100 >= FALL_PCT) return null;
	return hash32(x, y, 930);
};

export function tileFalls(g: GroundSrc, x: number, y: number): Fall[] {
	const mine = fallRoll(g, x, y);
	if (mine === null) return [];
	// at most one per stretch of shore: a neighbour along the edge with a higher roll takes it
	for (const s of [-1, 1]) {
		const other = fallRoll(g, x + s, y);
		if (other !== null && (other > mine || (other === mine && s < 0))) return [];
	}
	if (dockAt(g, x, y + 1).length) return []; // a pier already stands on this shore
	return [
		{
			key: `${x},${y}`,
			tx: x,
			ty: y,
			x: x * CELL + 8 + (hash32(x, y, 950) % (CELL - 2 * FALL.w)),
			y: (y + 1) * CELL - 17,
			ms: 700 + (hash32(x, y, 940) % 300),
			offsetMs: hash32(x, y, 945) % 1000,
		},
	];
}

/** A sailboat drifting to and fro over a lake big enough for it (8+ of the 5x5 window round it is lake, with lake on all four sides of its tile, so it keeps off the shore). */
export interface Boat extends Placement {
	axis: 'x' | 'y';
	/** how far (px) it sails either side of its start */
	range: number;
}

const BOAT_PCT = 22;
const DOLPHIN_PCT = 5;
/** Lake tiles of the 5x5 window round a tile: a boat needs a real lake (BOAT_POOL), a dolphin a big one (DOLPHIN_POOL). */
const BOAT_POOL = 8;
const DOLPHIN_POOL = 11;
const poolSize = (g: GroundSrc, x: number, y: number): number => {
	let n = 0;
	for (let ox = -2; ox <= 2; ox++) for (let oy = -2; oy <= 2; oy++) if (at(g, x + ox, y + oy) === 'lake') n++;
	return n;
};
const isLake = (g: GroundSrc, x: number, y: number) => at(g, x, y) === 'lake';
/** Lake on both sides of (x, y) along an axis: room to sail there. */
const roomAlong = (g: GroundSrc, x: number, y: number, axis: 'x' | 'y') =>
	axis === 'x' ? isLake(g, x - 1, y) && isLake(g, x + 1, y) : isLake(g, x, y - 1) && isLake(g, x, y + 1);
/** Open water: a lake tile inside a pool of at least `pool` of the 5x5 window, and (for a boat) with lake on all four sides, so it never sails at the shore. */
const openWater = (g: GroundSrc, x: number, y: number, pool: number, run: boolean) =>
	isLake(g, x, y) && poolSize(g, x, y) >= pool && (!run || (roomAlong(g, x, y, 'x') && roomAlong(g, x, y, 'y')));

/** One of the rolls passing at (x, y) that is the highest within 2 tiles (so boats and dolphins never bunch up). */
const isLocalBest = (g: GroundSrc, x: number, y: number, pct: number, salt: number, pool: number, run: boolean): boolean => {
	if (hash32(x, y, salt) % 100 >= pct || !openWater(g, x, y, pool, run)) return false;
	const mine = hash32(x, y, salt + 1);
	for (let ox = -2; ox <= 2; ox++)
		for (let oy = -2; oy <= 2; oy++) {
			if (!ox && !oy) continue;
			const other = hash32(x + ox, y + oy, salt + 1);
			if (hash32(x + ox, y + oy, salt) % 100 < pct && (other > mine || (other === mine && (ox < 0 || (ox === 0 && oy < 0)))) && openWater(g, x + ox, y + oy, pool, run)) return false;
		}
	return true;
};

export function tileBoat(g: GroundSrc, x: number, y: number): Boat | null {
	if (!isLocalBest(g, x, y, BOAT_PCT, 960, BOAT_POOL, true)) return null;
	const preferred = hash32(x, y, 962) % 2 ? 'x' : 'y';
	const axis = roomAlong(g, x, y, preferred) ? preferred : preferred === 'x' ? 'y' : 'x';
	const ms = 36000 + (hash32(x, y, 963) % 30000);
	return {
		key: `${x},${y}`,
		tx: x,
		ty: y,
		x: x * CELL + (CELL - BOAT.w) / 2,
		y: y * CELL + (CELL - BOAT.h) / 2,
		axis,
		range: 14 + (hash32(x, y, 964) % 6), // the neighbour tile along the course is lake: 14-19 px plus half the boat stays on water
		ms,
		offsetMs: hash32(x, y, 965) % ms,
	};
}

/** A dolphin leaping now and then (a long rest between jumps), only in big pools (11+ of the 5x5 window) on a tile with lake on all four sides and no boat. */
export interface Dolphin extends Placement {
	flip: boolean;
}

export function tileDolphin(g: GroundSrc, x: number, y: number): Dolphin | null {
	if (!isLocalBest(g, x, y, DOLPHIN_PCT, 970, DOLPHIN_POOL, false) || tileBoat(g, x, y)) return null;
	if (![[0, -1], [1, 0], [0, 1], [-1, 0]].every(([dx, dy]) => isLake(g, x + dx, y + dy))) return null; // the whole leap stays over water
	const ms = 9000 + (hash32(x, y, 972) % 7000);
	return {
		key: `${x},${y}`,
		tx: x,
		ty: y,
		x: x * CELL - 2 + (hash32(x, y, 973) % 8), // the leap is wider than the tile: every side of the tile is lake
		y: y * CELL + 18 - DOLPHIN.waterline + (hash32(x, y, 974) % 10),
		flip: hash32(x, y, 975) % 2 === 0,
		ms,
		offsetMs: hash32(x, y, 976) % ms,
	};
}
