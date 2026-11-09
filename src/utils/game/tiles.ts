// Map-level counts and the new-game map (part of the former utils/gameUtils.ts, split in IDL-15).
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import type { BiomeType, Tile } from '@/types/game';
import { RING, generateStartRing } from '@/utils/biomeRules';
import { EMPTY_WORLD, biomeCount, ownedCount, setTiles, type Placed, type World } from '@/utils/world';

/** Number of owned tiles on the map (kept up to date by the world, so this is O(1)). */
export const countOwnedTiles = (tiles: World): number => ownedCount(tiles);

/** Number of owned tiles of one biome (O(1)). */
export const countOwnedBiomeTypes = (tiles: World, biomeType: BiomeType): number => biomeCount(tiles, biomeType);

/**
 * Tiles that did not cost anything: the castle and its four neighbours (north, east, south, west) in a new game.
 */
export const STARTER_FREE_TILES = 5;

/**
 * Owned-tile count as the economy sees it: purchases + 1 (the old castle-only start). Tile cost, XP per tile, the extra
 * resource costs, the biome picker cadence and the rebirth requirements all use this, so the free starting tiles do not
 * make the first purchases expensive. Pass the state's `freeTiles`.
 *
 * @category Economy/Tiles
 * @order 6
 * @formula
 * economyTiles = owned tiles - freeTiles + 1       (freeTiles = STARTER_FREE_TILES = 5 in a new game)
 */
export const economyTiles = (tiles: World, freeTiles: number): number => countOwnedTiles(tiles) - freeTiles + 1;

/** A new map: the castle at (CASTLE_X, CASTLE_Y) and the tiles north, east, south and west of it already owned, generated from the basic biomes. */
export const createInitialWorld = (random: () => number = Math.random): World => {
	const placed: Placed[] = [
		{
			x: CASTLE_X,
			y: CASTLE_Y,
			tile: {
				biome: 'castle',
				isOwned: true,
				level: 1,
				upgradeCost: CASTLE_UPGRADE.upgradeCosts[0],
			} as Tile,
		},
	];
	const ring = generateStartRing(random);
	RING.forEach(([dx, dy], i) => placed.push({ x: CASTLE_X + dx, y: CASTLE_Y + dy, tile: { biome: ring[i], isOwned: true } }));
	return setTiles(EMPTY_WORLD, placed);
};
