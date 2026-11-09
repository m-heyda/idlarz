import { CASTLE_X, CASTLE_Y } from '@/config/castle';
import { DISTANCE_BANDS, type DistanceBand } from '@/config/distanceBands';

/** How far a tile is from the castle, the way the chest placement and the danger bonus measure it (Chebyshev: the larger of the x and y gaps). */
export const castleDistance = (spot: { x: number; y: number }): number => Math.max(Math.abs(spot.x - CASTLE_X), Math.abs(spot.y - CASTLE_Y));

/**
 * The band a castle distance falls in. Anything below the first band (the castle tile itself) or NaN is the first band.
 *
 * @category Monsters/Spawning
 * @order 7
 */
export const bandOf = (distance: number): DistanceBand => {
	let band = DISTANCE_BANDS[0];
	for (const candidate of DISTANCE_BANDS) {
		if (distance >= candidate.from) band = candidate;
	}
	return band;
};
