import { CASTLE_FORTRESS, CASTLE_RANGE, GRID_CENTER_X, GRID_CENTER_Y } from '@/config/gameConfig';
import type { Monster, Tile } from '@/types/game';

// The castle's ward: from CASTLE_FORTRESS.fromLevel the 3x3 range around the castle is walled in and kept free of
// monsters (and chests). Pure helpers so spawning, the tick and the save check all agree.

export const castleLevelOf = (tiles: Tile[][]): number => tiles[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level ?? 1;

export const isInWard = (x: number, y: number, castleLevel: number): boolean =>
	castleLevel >= CASTLE_FORTRESS.fromLevel &&
	Math.max(Math.abs(x - GRID_CENTER_X), Math.abs(y - GRID_CENTER_Y)) <= CASTLE_RANGE.radius;

/** Drops the monsters standing in the ward, except the one being fought (`keepId`). Returns the same array when nothing is warded. */
export const monstersOutsideWard = (monsters: Monster[], castleLevel: number, keepId: number | null): Monster[] =>
	castleLevel < CASTLE_FORTRESS.fromLevel
		? monsters
		: monsters.filter((m) => m.id === keepId || !isInWard(m.x, m.y, castleLevel));
