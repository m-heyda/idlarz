// Geometry of the farm pasture drawn by scripts/pixel/sprites_farm.py (keep the constants and prop lists in sync with that file).
// The pasture is an isometric meadow the size of a big window, shown at a fixed whole-pixel zoom and centred in the Farm window
// (cropped, never scaled); animals walk on its ground plane and are projected with the same camera.

export const PEN = {
	w: 348,
	h: 300,
	scale: 13,
	ox: 140,
	oy: 165,
};

/** Native -> CSS pixels: a whole number, 3 in a normal window, smaller only when the window is narrow (phones) */
export const penZoom = (stageW: number) => (stageW >= 760 ? 3 : stageW >= 500 ? 2 : 1);

/** Ground position (x, y world units, z = 0) -> pixel position inside the pen image (native pixels). */
export const project = (gx: number, gy: number) => ({
	x: PEN.ox + (gx - gy) * 0.7071 * PEN.scale,
	y: PEN.oy - (gx + gy) * 0.3536 * PEN.scale,
});

// The props of the pasture (same lists as sprites_farm.py): x, y (and the long side of a trough)
const TROUGHS: [number, number, 'x' | 'y'][] = [
	[-3.3, 1.4, 'x'], [8, -1.5, 'y'], [-6, -7, 'x'], [4, 10.5, 'x'], [13.5, 11.5, 'x'], [-7, -1, 'y'], [1, -10, 'x'],
];
const TANKS: [number, number][] = [[-9, 9], [11.5, 2.5], [6, 13], [-1, -4]];
const HAY: [number, number][] = [[-6, 7], [10, 2], [2, -6], [-5, -3.5], [-11, -1], [14.5, 13], [-3, -11]];
const BARRELS: [number, number][] = [[11.6, 5.6], [12.4, 6.5], [11.5, 7], [-3.4, 9.2], [-4.1, 9.9]];
const CRATES: [number, number][] = [[1.8, 12.4], [2.7, 12.9], [12, 14.2], [-4.8, 12.4]];
const BARN = { x: 8.5, y: 8.5 };
const COOP = { x: -1, y: 11 };
const POND = { x: -12, y: -4 };

/** Where animals may walk: inside the fence (at +-18), clear of its posts */
const BOUNDS = { x: 16.5, y: 16.5 };

const box = (x: number, y: number, hx: number, hy: number): [number, number, number, number] => [x - hx, x + hx, y - hy, y + hy];

// Rectangles animals keep out of (x0, x1, y0, y1): every prop plus about a body's width round it, so an animal never stands in
// or on a building, a trough, a hay stack and so on (its feet stay a whole sprite away from the prop's footprint)
const BLOCKED: [number, number, number, number][] = [
	box(BARN.x, BARN.y, 3.4, 2.9),
	box(COOP.x, COOP.y, 2.2, 2.0),
	box(POND.x, POND.y, 3.3, 3.0),
	...TROUGHS.map(([x, y, axis]) => (axis === 'x' ? box(x, y, 2.1, 1.5) : box(x, y, 1.5, 2.1))),
	...TANKS.map(([x, y]) => box(x, y, 1.95, 1.95)),
	...HAY.map(([x, y]) => box(x, y, 2.3, 2.3)),
	...BARRELS.map(([x, y]) => box(x, y, 1.35, 1.35)),
	...CRATES.map(([x, y]) => box(x, y, 1.4, 1.4)),
];

/** Animals keep at least this far (world units) from each other */
export const PERSONAL_SPACE = 0.9;

/** The part of the pasture that is actually on screen and not under a panel, in native pen pixels (feet positions). */
export interface WalkView {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
	/** Top-left readout: feet left of x1h and above y1h are hidden behind it */
	x1h: number;
	y1h: number;
}

/** Panels laid over the farm window, in CSS px */
export interface Insets {
	right: number;
	/** The stats readout in the top-left corner is unfolded */
	hudOpen: boolean;
}

// the stats readout in the top-left corner (CSS px, plus its margin), unfolded and folded up
const HUD = { open: { w: 285, h: 235 }, closed: { w: 285, h: 48 } };
// the upgrade drawer's tab along the bottom edge (CSS px, with its margin); the open drawer overlays the scene and reserves nothing
const UPGRADE_TAB_H = 36;
const SPRITE = { halfW: 20, above: 33, below: 6 }; // an animal's extent round its feet, native px

/** The walkable window for a stage of this size at this zoom, with the panels subtracted. */
export const walkView = (stageW: number, stageH: number, zoom: number, insets: Insets): WalkView => {
	const left = (stageW - PEN.w * zoom) / 2; // stage px of the image's left / top edge (negative when it is cropped)
	const top = (stageH - PEN.h * zoom) / 2;
	const toX = (px: number) => (px - left) / zoom;
	const toY = (py: number) => (py - top) / zoom;
	const hud = insets.hudOpen ? HUD.open : HUD.closed;
	return {
		x0: toX(0) + SPRITE.halfW,
		x1: toX(stageW - insets.right) - SPRITE.halfW,
		y0: toY(0) + SPRITE.above,
		y1: toY(stageH - UPGRADE_TAB_H) - SPRITE.below,
		x1h: toX(hud.w) + SPRITE.halfW,
		y1h: toY(hud.h) + SPRITE.below,
	};
};

export const walkable = (x: number, y: number, view?: WalkView | null) => {
	if (Math.abs(x) > BOUNDS.x || Math.abs(y) > BOUNDS.y) return false;
	if (BLOCKED.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return false;
	if (!view) return true;
	const p = project(x, y);
	if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) return false;
	return !(p.x < view.x1h && p.y < view.y1h);
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

/** Small deterministic generator so a given animal always starts in the same place. */
export const seeded = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** Walking speed (world units / second) and sprite anchor (feet) in native sprite pixels */
export const ANIMAL_MOTION: Record<string, { speed: number }> = {
	chicken: { speed: 1.3 },
	pig: { speed: 0.9 },
	cow: { speed: 0.7 },
	deer: { speed: 1.6 },
};

export const ANCHOR = { x: 20, y: 33 };
