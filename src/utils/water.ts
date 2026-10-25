import { ATLAS, CELL, depth, hash32, type GroundGrid, type TerrainAtlas } from './terrain';

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

const at = (g: GroundGrid, x: number, y: number) => g[y]?.[x] ?? null;

export function tileRipples(g: GroundGrid, x: number, y: number, m: TerrainAtlas = ATLAS): Ripple[] {
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
		const spots = m.water?.swamp?.[(y % 4) * 4 + (x % 4)];
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
export function tileShimmer(g: GroundGrid, x: number, y: number): Shimmer | null {
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
