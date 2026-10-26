import { CASTLE_FORTRESS, CASTLE_RANGE, CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import type { Monster } from '@/types/game';
import { getTile, type World } from '@/utils/world';

// The castle's ward: from CASTLE_FORTRESS.fromLevel the 3x3 range around the castle is walled in and kept free of
// monsters (and chests). Pure helpers so spawning, the tick and the save check all agree.

export const castleLevelOf = (tiles: World): number => getTile(tiles, CASTLE_X, CASTLE_Y)?.level ?? 1;

export const isInWard = (x: number, y: number, castleLevel: number): boolean =>
	castleLevel >= CASTLE_FORTRESS.fromLevel &&
	Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= CASTLE_RANGE.radius;

/** How far (tiles, every side) the violet range area reaches: 1 (3x3) up to level 7, then one more tile per level (5x5 at 8, 9x9 at 10). */
export const castleRangeRadius = (castleLevel: number): number =>
	CASTLE_RANGE.radius + Math.max(0, castleLevel - CASTLE_RANGE.growFromLevel + 1) * CASTLE_RANGE.growPerLevel;

/** The biggest the range gets, so far-away tiles can skip looking at the castle at all. */
export const MAX_CASTLE_RANGE_RADIUS = castleRangeRadius(CASTLE_UPGRADE.maxLevel);

/** Inside the (growing) range area: unlike the ward it is not limited to the walled 3x3. */
export const inCastleRange = (x: number, y: number, castleLevel: number): boolean =>
	Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= castleRangeRadius(castleLevel);

/** Drops the monsters standing in the ward, except the one being fought (`keepId`). Returns the same array when nothing is warded. */
export const monstersOutsideWard = (monsters: Monster[], castleLevel: number, keepId: number | null): Monster[] =>
	castleLevel < CASTLE_FORTRESS.fromLevel
		? monsters
		: monsters.filter((m) => m.id === keepId || !isInWard(m.x, m.y, castleLevel));

/** Wall set of the fortress: plain stone ('a') for levels 7-8, gold-trimmed ('b') from level 9. */
export const fortressWallTier = (castleLevel: number): 'a' | 'b' => (castleLevel >= 9 ? 'b' : 'a');
