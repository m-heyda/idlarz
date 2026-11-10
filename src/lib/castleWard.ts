import { CASTLE_AREA_BONUS, CASTLE_WARD, CASTLE_RANGE, CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { getTile, type World } from '@/utils/world';

// The castle's ward: from CASTLE_WARD.fromLevel the whole range area around the castle is kept free of monsters (and
// chests). Pure helpers so spawning, the tick and the save check all agree.

export const castleLevelOf = (tiles: World): number => getTile(tiles, CASTLE_X, CASTLE_Y)?.level ?? 1;

/**
 * Is this tile inside the ward: from castle level 7 the whole range area (3x3 at level 7, up to 9x9 at level 10) is free of monsters and chests, and monsters standing in it are driven out.
 *
 * @category Economy/Castle
 * @order 6
 */
export const isInWard = (x: number, y: number, castleLevel: number): boolean =>
	castleLevel >= CASTLE_WARD.fromLevel && Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= castleRangeRadius(castleLevel);

/**
 * How far (tiles, every side) the violet range area reaches: 1 (3x3) up to level 7, then one more tile per level (5x5 at 8, 9x9 at 10).
 *
 * Used by the income (the area bonus pass), the castle range overlay and the save checks.
 *
 * @category Economy/Castle
 * @order 7
 * @formula
 * radius = 1 + max(0, level - 8 + 1) x 1          level 1-7: 1 (3x3), 8: 2 (5x5), 9: 3 (7x7), 10: 4 (9x9)
 */
export const castleRangeRadius = (castleLevel: number): number =>
	CASTLE_RANGE.radius + Math.max(0, castleLevel - CASTLE_RANGE.growFromLevel + 1) * CASTLE_RANGE.growPerLevel;

/** The biggest the range gets, so far-away tiles can skip looking at the castle at all. */
export const MAX_CASTLE_RANGE_RADIUS = castleRangeRadius(CASTLE_UPGRADE.maxLevel);

/** Inside the (growing) range area (the ward covers the same tiles from level 7). */
export const inCastleRange = (x: number, y: number, castleLevel: number): boolean =>
	Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= castleRangeRadius(castleLevel);

/**
 * The extra output (as a fraction: 1 = +100%) every tile inside the castle range gets: +50% below level 7, then one step per tile of range.
 *
 * @category Economy/Castle
 * @order 8
 * @formula
 * bonus = 0.5                      castle level < 7
 *       = radius(level) x 1        castle level >= 7        (+100% at 7, +200% at 8, +300% at 9, +400% at 10)
 */
export const castleAreaBonus = (castleLevel: number): number =>
	castleLevel >= CASTLE_AREA_BONUS.fromLevel ? castleRangeRadius(castleLevel) * CASTLE_AREA_BONUS.perRadiusTile : CASTLE_AREA_BONUS.earlyBonus;
