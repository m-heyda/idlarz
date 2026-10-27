/** A random source: uniform in [0, 1). The game passes `Math.random`; tests and the loot simulator pass a seeded one. */
export type Rng = () => number;

/** mulberry32: a small seedable generator, so a failing distribution or a balance run can be reproduced exactly. */
export const mulberry32 = (seed: number): Rng => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

/** A whole number in [min, max], both included. */
export const randomInt = (rng: Rng, min: number, max: number): number => {
	const lo = Math.ceil(Math.min(min, max));
	const hi = Math.floor(Math.max(min, max));
	return lo + Math.floor(rng() * (hi - lo + 1));
};

/**
 * Picks one entry by relative weight. Weights need not sum to anything in particular (they are normalised by their
 * total); entries with a weight of 0 or less are never picked. With a single pickable entry no random number is used.
 */
export const weightedPick = <T>(entries: readonly T[], weight: (entry: T) => number, rng: Rng): T | undefined => {
	const live = entries.filter((entry) => weight(entry) > 0);
	if (live.length === 0) return undefined;
	if (live.length === 1) return live[0];
	let r = rng() * live.reduce((sum, entry) => sum + weight(entry), 0);
	for (const entry of live) {
		r -= weight(entry);
		if (r < 0) return entry;
	}
	return live[live.length - 1];
};

/** Linear interpolation between `lo` and `hi` by `t` in [0, 1]. */
export const lerp = (lo: number, hi: number, t: number): number => lo + (hi - lo) * t;
