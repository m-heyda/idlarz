import { CASTLE_FORTRESS, CASTLE_RANGE, SPAWN_LIMIT } from '@/config/gameConfig';
import type { World } from '@/utils/world';

// How many monsters and chests the map can hold: a share of the land they could stand on, so a small map never fills up
// with them. O(1) (world counters only), because the tick asks every second while the spawn timers are paused at the limit.

/** Tiles the ward keeps clear (the walled range around the castle, without the castle itself); 0 below the fortress level. */
export const wardTiles = (castleLevel: number): number =>
	castleLevel >= CASTLE_FORTRESS.fromLevel ? (2 * CASTLE_RANGE.radius + 1) ** 2 - 1 : 0;

/** Owned land a monster or chest can stand on: not the castle, not a lake, no building, outside the ward. An estimate, never below 0. */
export const freeTiles = (world: World, castleLevel: number): number => {
	const { owned, buildings, byBiome } = world.stats;
	return Math.max(0, owned - (byBiome.castle ?? 0) - (byBiome.lake ?? 0) - buildings - wardTiles(castleLevel));
};

/** The most monsters and chests together: `SPAWN_LIMIT.maxFraction` of the free tiles (never below `minAllowed`). */
export const spawnCap = (world: World, castleLevel: number): number =>
	Math.max(SPAWN_LIMIT.minAllowed, Math.floor(freeTiles(world, castleLevel) * SPAWN_LIMIT.maxFraction));

/** True while there is still room for one more monster or chest. */
export const canSpawn = (world: World, castleLevel: number, monsterCount: number, chestCount: number): boolean =>
	monsterCount + chestCount < spawnCap(world, castleLevel);
