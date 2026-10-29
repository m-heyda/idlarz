import type { Tile } from '@/types/game';
import { CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { getTile, hasOwnedNeighbour, inRange, setTile, type World } from '@/utils/world';
import type { Cell } from './dragPaint';

/**
 * Drawing on a World with a drag: the one function a tool needs (`applyStroke`) and the tools the map lab ships with.
 * Pure and safe: out-of-range cells are skipped, the castle and the last tile are never removed, land only grows from
 * land (no far-away islands the map could not show), and the world is never mutated.
 *
 * A road tool later is one more `StrokeTool`: `(world, cell) => Tile | undefined | 'skip'`.
 */

/** What a tool does to one cell: a new tile, `undefined` to remove the tile, or 'skip' to leave it alone. */
export type StrokeTool = (world: World, cell: Cell) => Tile | undefined | 'skip';

const isCastle = (c: Cell) => c.x === CASTLE_X && c.y === CASTLE_Y;

/** Applies `tool` to the cells in order (each sees the result of the cells before it, so a stroke can grow outwards). */
export const applyStroke = (world: World, cells: readonly Cell[], tool: StrokeTool): World => {
	let next = world;
	for (const cell of cells) {
		if (!inRange(cell.x, cell.y)) continue;
		const result = tool(next, cell);
		if (result === 'skip') continue;
		if (result === undefined && (isCastle(cell) || next.stats.owned <= 1)) continue; // never leaves a world without land
		next = setTile(next, cell.x, cell.y, result);
	}
	return next;
};

const reachable = (world: World, c: Cell) => !!getTile(world, c.x, c.y) || hasOwnedNeighbour(world, c.x, c.y);

/** Paints `biome` on land and on the cells next to land. Keeps what the tile had (level, chest, building) except its biome. */
export const paintTool =
	(biome: string): StrokeTool =>
	(world, c) => {
		if (isCastle(c) || !reachable(world, c)) return 'skip';
		const old = getTile(world, c.x, c.y);
		if (old?.biome === biome) return 'skip';
		return { ...old, biome, isOwned: true };
	};

/** "Extend": adds `biome` only where there is no land yet, next to land (the unexplored ring), never overwriting. */
export const extendTool =
	(biome: string): StrokeTool =>
	(world, c) => (getTile(world, c.x, c.y) || !hasOwnedNeighbour(world, c.x, c.y) ? 'skip' : { biome, isOwned: true });

/** Removes land (the castle stays). */
export const eraseTool: StrokeTool = (world, c) => (getTile(world, c.x, c.y) ? undefined : 'skip');

/** Puts a chest on land (not on the castle); a second pass over the same tile does nothing. */
export const chestTool: StrokeTool = (world, c) => {
	const old = getTile(world, c.x, c.y);
	return !old || isCastle(c) || old.hasChest ? 'skip' : { ...old, hasChest: true };
};

/** Takes a chest off. */
export const unchestTool: StrokeTool = (world, c) => {
	const old = getTile(world, c.x, c.y);
	if (!old?.hasChest) return 'skip';
	const rest = { ...old };
	delete rest.hasChest;
	return rest;
};

/** Grows the land by one ring of `biome` on every unexplored tile next to land. */
export const extendRing = (world: World, biome: string): World => {
	const b = world.bounds;
	if (!b) return world;
	const cells: Cell[] = [];
	for (let y = b.minY - 1; y <= b.maxY + 1; y++) for (let x = b.minX - 1; x <= b.maxX + 1; x++) cells.push({ x, y });
	// decided against the world as it is now (not as it grows), so it is one ring and not a flood
	const edge = cells.filter((c) => !getTile(world, c.x, c.y) && hasOwnedNeighbour(world, c.x, c.y));
	return applyStroke(world, edge, () => ({ biome, isOwned: true }));
};
