import { CASTLE_FORTRESS, CASTLE_RANGE } from '@/config/castle';
import { SPAWN_LIMIT } from '@/config/spawns';
import type { World } from '@/utils/world';

// How many monsters and chests the map can hold: a share of the land they could stand on, so a small map never fills up
// with them. O(1) (world counters only), because the tick asks every second while the spawn timers are paused at the limit.

/** Tiles the ward keeps clear (the walled range around the castle, without the castle itself); 0 below the fortress level. */
export const wardTiles = (castleLevel: number): number => (castleLevel >= CASTLE_FORTRESS.fromLevel ? (2 * CASTLE_RANGE.radius + 1) ** 2 - 1 : 0);

/**
 * Owned land a monster or chest can stand on: not the castle, not a lake, outside the ward. An estimate, never below 0.
 * One formula for the client (`freeTiles`, from the live map) and the server (`ticketCap`, from the save's counts), so the same map gives the same cap.
 *
 * @formula free = max(0, owned - castle - lakes - wardTiles(castleLevel))
 */
export const freeLand = (owned: number, castle: number, lakes: number, castleLevel: number): number =>
	Math.max(0, owned - castle - lakes - wardTiles(castleLevel));

/** `freeLand` of a live map (client). */
export const freeTiles = (world: World, castleLevel: number): number => {
	const { owned, byBiome } = world.stats;
	return freeLand(owned, byBiome.castle ?? 0, byBiome.lake ?? 0, castleLevel);
};

/** The most monsters and chests together: `SPAWN_LIMIT.maxFraction` of the free tiles (never below `minAllowed`). */
export const spawnCap = (world: World, castleLevel: number): number =>
	Math.max(SPAWN_LIMIT.minAllowed, Math.floor(freeTiles(world, castleLevel) * SPAWN_LIMIT.maxFraction));
