// Lays out the farm's loose parts (public/pixel/farm/*.png: the fence, gate, coop, pine, pond and dirt from scripts/pixel/farm_parts.py, everything else the
// farm_rework Sprite Fusion set baked down to the pen's pixel grid) as a list of props on the ground plane: the fence round the pen with its gate, the barn,
// coop, well, produce stall, water tubs, hay, barrels and log piles, the dirt road from the gate to the barn door, and an endless apron of trees, grass
// tufts, rocks and flowers outside the fence. Pure: the same call gives the same props, and the apron is built from cells that do not depend on how far the window reaches, so a
// bigger window only adds props at its edge. FarmProps.tsx draws them.
import parts from '../../../../public/pixel/farm/index.json';
import { mulberry32 } from '@/lib/rng';
import { BARN, BARRELS, COOP, CRATES, HAY, POND, SPOTS, STALL, TUBS, WELLS, project } from './farmGeometry';

export type FarmPart = keyof typeof parts;

/** One part standing at ground position (x, y); `ground` parts lie flat under everything (dirt, the pond). */
export interface FarmProp {
	key: string;
	part: FarmPart;
	x: number;
	y: number;
	ground?: boolean;
	/** drawn mirrored left to right (a second look for hay, rocks and tufts) */
	flip?: boolean;
}

/** Half-extents of the fenced pen and the gate in its near-right fence (y = -HY) */
const HX = 18;
const HY = 18;
export const GATE: [number, number] = [-4, -2];

const fenceRun = (axis: 'x' | 'y', fixed: number, lo: number, hi: number, gap?: [number, number]): FarmProp[] => {
	const n = Math.max(1, Math.round((hi - lo) / 1.75));
	const out: FarmProp[] = [];
	for (let i = 0; i <= n; i++) {
		const t = lo + ((hi - lo) * i) / n;
		const next = lo + ((hi - lo) * (i + 1)) / n;
		// the gate stands in the gap: no post inside it and no rail across it
		if (gap && ((i < n && t < gap[1] && next > gap[0]) || (t > gap[0] && t < gap[1]))) continue;
		const x = axis === 'x' ? t : fixed;
		const y = axis === 'x' ? fixed : t;
		out.push({ key: `fence-${axis}${fixed}-${i}`, part: i === n ? 'fence_post' : axis === 'x' ? 'fence_x' : 'fence_y', x, y });
	}
	return out;
};

/** Everything inside and on the fence: fence, gate, buildings, water, hay, barrels, crates, dirt, the pond. */
export const penProps = (): FarmProp[] => {
	const props: FarmProp[] = [
		...fenceRun('x', HY, -HX, HX),
		...fenceRun('y', HX, -HY, HY),
		...fenceRun('y', -HX, -HY, HY),
		...fenceRun('x', -HY, -HX, HX, GATE),
		{ key: 'gate', part: 'gate', x: GATE[0], y: -HY },
		{ key: 'barn', part: 'red_barn', x: BARN.x, y: BARN.y },
		{ key: 'coop', part: 'coop', x: COOP.x, y: COOP.y },
		{ key: 'pond', part: 'pond', x: POND.x, y: POND.y, ground: true },
		{ key: 'bucket', part: 'bucket', x: -1.9, y: 2.9 },
		{ key: 'stall', part: 'produce_stall', x: STALL.x, y: STALL.y },
		{ key: 'sign', part: 'signpost_blank', x: GATE[1] + 2.4, y: -HY + 1.4 },
		{ key: 'sheaf-0', part: 'wheat_sheaf', x: BARN.x - 4.4, y: BARN.y - 4.4 },
		{ key: 'sheaf-1', part: 'wheat_sheaf', x: BARN.x - 5.4, y: BARN.y - 3.6, flip: true },
	];
	// the dirt road from the gate to the barn door: down from the gate, across, then up to the door, a chain of overlapping worn patches
	const gx = (GATE[0] + GATE[1]) / 2;
	const PATH_Y = -8;
	const road = (key: string, from: [number, number], to: [number, number]) => {
		const n = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 1.6);
		for (let i = 0; i <= n; i++) {
			const t = i / n;
			props.push({
				key: `${key}-${i}`,
				part: i % 2 ? 'dirt_0' : 'dirt_1',
				x: from[0] + (to[0] - from[0]) * t,
				y: from[1] + (to[1] - from[1]) * t,
				ground: true,
			});
		}
	};
	road('road-a', [gx, -HY + 0.6], [gx, PATH_Y]);
	road('road-b', [gx, PATH_Y], [BARN.x, PATH_Y]);
	road('road-c', [BARN.x, PATH_Y], [BARN.x, BARN.y - 3.4]);
	TUBS.forEach(([x, y], i) => props.push({ key: `tub-${i}`, part: 'water_tub', x, y }));
	WELLS.forEach(([x, y], i) => props.push({ key: `well-${i}`, part: 'stone_well', x, y }));
	const HAY_PARTS: FarmPart[] = ['hay_roll_iso', 'hay_stack_block', 'hay_roll_front'];
	HAY.forEach(([x, y], i) => props.push({ key: `hay-${i}`, part: HAY_PARTS[i % 3], x, y, flip: i % 2 === 1 }));
	BARRELS.forEach(([x, y], i) => props.push({ key: `barrel-${i}`, part: i % 3 === 2 ? 'barrel_lid' : 'barrel_upright', x, y }));
	CRATES.forEach(([x, y], i) => props.push({ key: `crate-${i}`, part: i % 2 === 0 ? 'log_pile' : 'barrel_lid', x, y, flip: i % 3 === 0 }));
	SPOTS.forEach(([x, y], i) => props.push({ key: `spot-${i}`, part: 'dirt_2', x, y, ground: true }));
	// scenery inside the fence: seeded rocks, grass tufts along the fence, a few bean sprouts and flowers (kept off the buildings and the water)
	const rnd = mulberry32(7);
	const taken: [number, number, number][] = [
		[BARN.x, BARN.y, 3.2],
		[COOP.x, COOP.y, 2.2],
		[POND.x, POND.y, 3],
		[STALL.x, STALL.y, 2.6],
		...props.filter((p) => p.key.startsWith('road-')).map((p): [number, number, number] => [p.x, p.y, 1.4]),
		...[...TUBS, ...WELLS, ...HAY, ...BARRELS, ...CRATES].map(([x, y]): [number, number, number] => [x, y, 1.6]),
	];
	const free = (x: number, y: number, pad = 0) => taken.every(([tx, ty, r]) => Math.hypot(x - tx, y - ty) > r + pad);
	const scatter = (n: number, pad: number): [number, number][] => {
		const out: [number, number][] = [];
		for (let k = 0; k < 400 && out.length < n; k++) {
			const x = (rnd() * 2 - 1) * 16.6;
			const y = (rnd() * 2 - 1) * 16.6;
			if (free(x, y, pad)) out.push([x, y]);
		}
		return out;
	};
	scatter(9, 0.6).forEach(([x, y], i) => props.push({ key: `stone-${i}`, part: i % 4 === 3 ? 'boulder_flat' : 'rock_cluster', x, y, flip: i % 2 === 1 }));
	scatter(5, 0.8).forEach(([x, y], i) => props.push({ key: `sprout-${i}`, part: 'beanstalk_sprout', x, y }));
	for (let i = 0; i < 16; i++) {
		const t = (rnd() * 2 - 1) * 16;
		const side = i % 4;
		const [x, y] = side === 0 ? [t, HY - 0.9] : side === 1 ? [HX - 0.9, t] : side === 2 ? [-HX + 0.9, t] : [t, -HY + 0.9];
		if (free(x, y) && !(side === 3 && t > GATE[0] - 1.5 && t < GATE[1] + 1.5))
			props.push({ key: `edge-tuft-${i}`, part: 'grass_tuft', x, y, flip: i % 2 === 1 });
	}
	scatter(60, 0.2).forEach(([x, y], i) => props.push({ key: `flower-${i}`, part: `flower_${i % 3}` as FarmPart, x, y }));
	return props;
};

/** World size of one apron cell; every cell decides its own trees, grass tufts, rocks and flowers from its coordinates alone. */
const CELL = 5;

/**
 * The meadow outside the fence out to `reach` world units from the pen's centre (in x and y): conifers, grass tufts, rocks and flowers, one deterministic
 * set per cell of the grid, so asking for a larger reach only adds cells. The fenced pen and a margin round it stay free.
 */
export const apronProps = (reach: number): FarmProp[] => {
	const out: FarmProp[] = [];
	const cells = Math.ceil(reach / CELL);
	for (let cx = -cells; cx <= cells; cx++) {
		for (let cy = -cells; cy <= cells; cy++) {
			const rnd = mulberry32(((cx + 512) * 1103 + (cy + 512) * 7919 + 13) >>> 0);
			const at = (): [number, number] => [(cx + rnd()) * CELL, (cy + rnd()) * CELL];
			const outside = (x: number, y: number) => Math.max(Math.abs(x), Math.abs(y)) > HX + 1.2;
			const roll = rnd();
			const [x, y] = at();
			if (outside(x, y)) {
				if (roll < 0.16) out.push({ key: `a-${cx}-${cy}-p`, part: 'pine', x, y });
				else if (roll < 0.36) out.push({ key: `a-${cx}-${cy}-b`, part: 'grass_tuft', x, y, flip: rnd() < 0.5 });
				else if (roll < 0.46) out.push({ key: `a-${cx}-${cy}-s`, part: rnd() < 0.3 ? 'boulder_flat' : 'rock_cluster', x, y, flip: rnd() < 0.5 });
			}
			const flowers = Math.floor(rnd() * 5);
			for (let f = 0; f < flowers; f++) {
				const [fx, fy] = at();
				if (outside(fx, fy)) out.push({ key: `a-${cx}-${cy}-f${f}`, part: `flower_${f % 3}` as FarmPart, x: fx, y: fy });
			}
		}
	}
	return out;
};

/** The world reach (x and y, in units) a stage of this many CSS px shows at this zoom, with a margin, so `apronProps` covers the window. */
export const apronReach = (stageW: number, stageH: number, zoom: number): number => {
	const halfW = stageW / zoom / 2 + 60;
	const halfH = stageH / zoom / 2 + 60;
	// |x - y| <= halfW / (0.7071 * 13), |x + y| <= halfH / (0.3536 * 13): the larger of x and y needed is half the sum of both
	return halfW / 9.19 / 2 + halfH / 4.6 / 2 + 2;
};

/** Where a prop's top-left corner is (native px, relative to the pen frame), its size and its stacking order (the animals use their foot's y the same way). */
export const propPlace = (p: FarmProp) => {
	const info = parts[p.part];
	const foot = project(p.x, p.y);
	return { left: foot.x - info.ax, top: foot.y - info.ay, w: info.w, h: info.h, z: p.ground ? -100000 : Math.round(foot.y) };
};
