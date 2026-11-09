// Named bands of castle distance (Chebyshev tiles), so biome, monster and chest rules all share one vocabulary and a tweak is a
// one-line edit here. `bandOf` in src/lib/distance.ts finds the band of a distance.
//
// `from` is the first distance in the band; a band ends where the next one starts, and the last one is open-ended. Distance 0
// (the castle tile) counts as the first band. `dangerOffset` is extra spawn levels for monsters in the band; it is 0 everywhere
// for now, so nothing changes until the per-band spawn tables read it.

export type DistanceBandId = 'home' | 'outskirts' | 'frontier' | 'wilds';

export interface DistanceBand {
	id: DistanceBandId;
	/** First castle distance of the band (inclusive) */
	from: number;
	/** Levels added to monsters spawned in this band, on top of the danger bonus. 0 = no effect. */
	dangerOffset: number;
}

// Ordered by `from`, ascending (checked by tests/world/distance.test.ts).
/**
 * Distance bands: home 1-6, outskirts 7-12, frontier 13-21, wilds 22+, read by {@link bandOf}. No spawn rule reads them yet.
 *
 * @category Monsters/Spawning
 * @order 6
 */
export const DISTANCE_BANDS: readonly DistanceBand[] = [
	{ id: 'home', from: 1, dangerOffset: 0 }, // 1-6
	{ id: 'outskirts', from: 7, dangerOffset: 0 }, // 7-12
	{ id: 'frontier', from: 13, dangerOffset: 0 }, // 13-21
	{ id: 'wilds', from: 22, dangerOffset: 0 }, // 22+
];
