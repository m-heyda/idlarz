// Geometry of the farm pasture: an isometric fenced pen on an endless repeating meadow, shown at a whole-pixel zoom and centred in the Farm window.
// The parts (fence, barn, tubs ...) are loose PNGs from scripts/pixel/farm_parts.py laid out by farmLayout.ts from the lists below; animals walk on the
// ground plane and are projected with the same camera. `PEN` is the frame whose centre is the window's centre.

export const PEN = {
	w: 348,
	h: 300,
	scale: 13,
	ox: 140,
	oy: 165,
};

/** Native -> CSS pixels: a whole number, 3 in a normal window, 4 in a big one (1500 x 1000 and up), smaller only when the window is narrow. The meadow tile around the pen follows the same zoom. */
export const penZoom = (stageW: number, stageH = 0) => (stageW >= 1500 && stageH >= 1000 ? 4 : stageW >= 760 ? 3 : stageW >= 500 ? 2 : 1);

/** Ground position (x, y world units, z = 0) -> pixel position inside the pen image (native pixels). */
export const project = (gx: number, gy: number) => ({
	x: PEN.ox + (gx - gy) * 0.7071 * PEN.scale,
	y: PEN.oy - (gx + gy) * 0.3536 * PEN.scale,
});

// The props of the pasture (ground position x, y). Their art is the farm_rework set baked down in public/pixel/farm/: water tubs, a stone well, hay, barrels, log piles.
export const TUBS: [number, number][] = [
	[-3.3, 1.4],
	[11, -1.5],
	[-6, -7],
	[4, 10.5],
];
export const WELLS: [number, number][] = [[-9, 9]];
export const HAY: [number, number][] = [
	[-6, 7],
	[11.5, 1.2],
	[2, -6],
	[-11, -1],
	[14.5, 13],
];
export const BARRELS: [number, number][] = [
	[11.6, 5.6],
	[-3.4, 9.2],
	[-4.1, 9.9],
];
export const CRATES: [number, number][] = [
	[1.8, 12.4],
	[12, 14.2],
	[-4.8, 12.4],
];
/** Bare earth where the animals gather (trodden dirt in the meadow) */
export const SPOTS: [number, number][] = [
	[-0.5, 6],
	[6, 6],
	[-8, 2],
];

export const BARN = { x: 8.5, y: 8.5 };
export const COOP = { x: -1, y: 11 };
export const POND = { x: -12, y: -4 };
export const STALL = { x: -13, y: 12.5 };

/** Where animals may walk: inside the fence (at +-18), clear of its posts */
export const BOUNDS = { x: 16.5, y: 16.5 };

const box = (x: number, y: number, hx: number, hy: number): [number, number, number, number] => [x - hx, x + hx, y - hy, y + hy];

// Rectangles animals keep out of (x0, x1, y0, y1): every prop plus about a body's width round it, so an animal never stands in
// or on a building, a trough, a hay stack and so on (its feet stay a whole sprite away from the prop's footprint)
const BLOCKED: [number, number, number, number][] = [
	box(BARN.x, BARN.y, 3.4, 2.9),
	box(COOP.x, COOP.y, 2.2, 2.0),
	box(STALL.x, STALL.y, 2.6, 2.2),
	box(POND.x, POND.y, 3.3, 3.0),
	...TUBS.map(([x, y]) => box(x, y, 1.7, 1.7)),
	...WELLS.map(([x, y]) => box(x, y, 1.6, 1.6)),
	...HAY.map(([x, y]) => box(x, y, 2.3, 2.3)),
	...BARRELS.map(([x, y]) => box(x, y, 1.35, 1.35)),
	...CRATES.map(([x, y]) => box(x, y, 1.6, 1.6)),
];

/** Animals keep at least this far (world units) from each other */
export const PERSONAL_SPACE = 0.9;

/** The part of the pasture that is actually on screen and not under a panel, in native pen pixels (feet positions). */
export interface WalkView {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

/** Panels laid over the farm window, in CSS px */
export interface Insets {
	right: number;
}

// the upgrade button along the bottom edge (CSS px, with its margin); the open upgrade window covers the whole scene and reserves nothing
const UPGRADE_TAB_H = 36;
const SPRITE = { halfW: 24, above: 42, below: 6 }; // an animal's extent round its feet, native px

/** The walkable window for a stage of this size at this zoom, with the panels subtracted. */
export const walkView = (stageW: number, stageH: number, zoom: number, insets: Insets): WalkView => {
	const left = (stageW - PEN.w * zoom) / 2; // stage px of the image's left / top edge (negative when it is cropped)
	const top = (stageH - PEN.h * zoom) / 2;
	const toX = (px: number) => (px - left) / zoom;
	const toY = (py: number) => (py - top) / zoom;
	return {
		x0: toX(0) + SPRITE.halfW,
		x1: toX(stageW - insets.right) - SPRITE.halfW,
		y0: toY(0) + SPRITE.above,
		y1: toY(stageH - UPGRADE_TAB_H) - SPRITE.below,
	};
};

export const walkable = (x: number, y: number, view?: WalkView | null) => {
	if (Math.abs(x) > BOUNDS.x || Math.abs(y) > BOUNDS.y) return false;
	if (BLOCKED.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return false;
	if (!view) return true;
	const p = project(x, y);
	return !(p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1);
};

export const randomSpot = (rnd: () => number = Math.random, view?: WalkView | null) => {
	for (let i = 0; i < 120; i++) {
		const x = (rnd() * 2 - 1) * BOUNDS.x;
		const y = (rnd() * 2 - 1) * BOUNDS.y;
		if (walkable(x, y, view)) return { x, y };
	}
	return { x: 0, y: 0 };
};

/**
 * A spot with plenty of room: of `tries` random walkable spots, the one farthest from every point in `others`. Used for where
 * an animal first appears and where it wanders next, so the herd spreads over the whole meadow instead of bunching up.
 */
export const roomySpot = (others: { x: number; y: number }[], tries: number, rnd: () => number = Math.random, view?: WalkView | null) => {
	let best = randomSpot(rnd, view);
	let bestRoom = -1;
	for (let i = 0; i < tries; i++) {
		const spot = randomSpot(rnd, view);
		let room = Infinity;
		for (const o of others) room = Math.min(room, Math.hypot(o.x - spot.x, o.y - spot.y));
		if (room > bestRoom) {
			bestRoom = room;
			best = spot;
		}
	}
	return best;
};

/** Walking speed (world units / second) and sprite anchor (feet) in native sprite pixels */
export const ANIMAL_MOTION: Record<string, { speed: number }> = {
	chicken: { speed: 1.3 },
	pig: { speed: 0.9 },
	cow: { speed: 0.7 },
	sheep: { speed: 0.8 },
};

/**
 * Where an animal's feet are in its 48 x 48 box (native px). The Sprite Fusion art is 96 x 96 and is drawn at half size, an exact 2:1 step.
 */
export const ANCHOR = { x: 24, y: 42 };

/**
 * How big each animal is drawn inside its 48 x 48 box, so the herd is in true proportion: a cow's body is about 29 native px wide, a pig's 23, a sheep's 21,
 * a chicken's 13 (the art is 96 px with a different margin per animal, so the factors differ more than the sizes do).
 */
export const ANIMAL_SIZES: Record<string, number> = {
	animal_cow_1: 0.66,
	animal_cow_2: 0.66,
	animal_pig: 0.52,
	animal_sheep: 0.5,
	animal_chicken_1: 0.4,
	animal_chicken_2: 0.36,
	animal_rooster: 0.38,
	animal_duck: 0.32,
};
const DEFAULT_ANIMAL_SIZE = 0.5;
export const animalSize = (icon: string): number => ANIMAL_SIZES[icon] ?? DEFAULT_ANIMAL_SIZE;

/** How an animal icon sits in the 48 x 48 box: its scale and its offset (native px): centred sideways, standing on the bottom edge so the feet stay about where they were */
export const spriteFit = (iconWidth: number, size: number) => ({ scale: (48 * size) / iconWidth, dx: (48 - 48 * size) / 2, dy: 48 - 48 * size });
