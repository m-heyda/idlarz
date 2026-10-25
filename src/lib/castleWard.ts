import { CASTLE_FORTRESS, CASTLE_RANGE, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import type { Monster } from '@/types/game';
import { getTile, type World } from '@/utils/world';

// The castle's ward: from CASTLE_FORTRESS.fromLevel the 3x3 range around the castle is walled in and kept free of
// monsters (and chests). Pure helpers so spawning, the tick and the save check all agree.

export const castleLevelOf = (tiles: World): number => getTile(tiles, CASTLE_X, CASTLE_Y)?.level ?? 1;

export const isInWard = (x: number, y: number, castleLevel: number): boolean =>
	castleLevel >= CASTLE_FORTRESS.fromLevel &&
	Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= CASTLE_RANGE.radius;

/** Drops the monsters standing in the ward, except the one being fought (`keepId`). Returns the same array when nothing is warded. */
export const monstersOutsideWard = (monsters: Monster[], castleLevel: number, keepId: number | null): Monster[] =>
	castleLevel < CASTLE_FORTRESS.fromLevel
		? monsters
		: monsters.filter((m) => m.id === keepId || !isInWard(m.x, m.y, castleLevel));

/** Wall set of the fortress: plain stone ('a') for levels 7-8, gold-trimmed ('b') from level 9. */
export const fortressWallTier = (castleLevel: number): 'a' | 'b' => (castleLevel >= 9 ? 'b' : 'a');
