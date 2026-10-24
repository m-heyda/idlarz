// Geometry of the farm pen drawn by scripts/pixel/sprites_farm.py (keep the constants in sync with that file).
// The pen is an isometric meadow; animals walk on its ground plane and are projected with the same camera.

export const PEN = {
	w: 256,
	h: 184,
	scale: 13,
	ox: 128,
	oy: 124,
};

/** Native -> CSS pixels: the biggest whole number of pixels that fits the stage (min 1, max 4) */
export const penZoom = (stageW: number, stageH: number) =>
	Math.max(1, Math.min(4, Math.floor(Math.min(stageW / PEN.w, stageH / PEN.h))));

/** Ground position (x, y world units, z = 0) -> pixel position inside the pen image (native pixels). */
export const project = (gx: number, gy: number) => ({
	x: PEN.ox + (gx - gy) * 0.7071 * PEN.scale,
	y: PEN.oy - (gx + gy) * 0.3536 * PEN.scale,
});

// Where animals may walk: inside the fence, clear of the barn, trough and hay bales
const BOUNDS = { x: 6.0, y: 4.0 };
const BLOCKED: [number, number, number, number][] = [
	[2.2, 6.0, 0.8, 3.9], // barn
	[-4.9, -1.8, 0.5, 2.3], // trough
	[-6.3, -3.3, 1.8, 4.5], // hay bales
];

export const walkable = (x: number, y: number) =>
	Math.abs(x) <= BOUNDS.x &&
	Math.abs(y) <= BOUNDS.y &&
	!BLOCKED.some(([x0, x1, y0, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);

export const randomSpot = (rnd: () => number = Math.random) => {
	for (let i = 0; i < 40; i++) {
		const x = (rnd() * 2 - 1) * BOUNDS.x;
		const y = (rnd() * 2 - 1) * BOUNDS.y;
		if (walkable(x, y)) return { x, y };
	}
	return { x: 0, y: -2 };
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
