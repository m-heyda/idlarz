import { TILE_SIZE } from '@/config/gameConfig';
import type { Bounds } from '@/utils/world';

/**
 * The view of the map: where the world is on the screen and what part of it can be seen. Pure maths, no React.
 *
 * `pos` is the screen position (px) of the world origin, i.e. the map div is drawn with translate(pos) scale(zoom); a world
 * point (wx, wy) in px is then at (pos.x + wx * zoom, pos.y + wy * zoom). Tile (tx, ty) covers world px
 * [tx * TILE_SIZE, (tx + 1) * TILE_SIZE).
 */
export interface Point {
	x: number;
	y: number;
}

export interface Size {
	w: number;
	h: number;
}

/** Tile range, from inclusive to exclusive on both axes. */
export interface TileRange {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

/**
 * How far past the explored land the middle of the screen may be dragged, in tiles. The map has no edge, but it should not
 * be possible to lose the land: the screen's centre always stays within the explored area plus this margin, so someone who
 * explored far to the left can pan out there (and zoom out to find it) but never into endless emptiness.
 */
export const PAN_MARGIN_TILES = 6;

/** The world point (px) in the middle of the screen. */
export const centerOf = (pos: Point, zoom: number, size: Size): Point => ({
	x: (size.w / 2 - pos.x) / zoom,
	y: (size.h / 2 - pos.y) / zoom,
});

/** The position of the world origin that puts the world point (wx, wy) (px) in the middle of the screen. */
export const positionForCenter = (wx: number, wy: number, zoom: number, size: Size): Point => ({
	x: size.w / 2 - wx * zoom,
	y: size.h / 2 - wy * zoom,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Keeps the middle of the screen inside the explored area (its bounding box, in tiles) plus `margin` tiles. A position that
 * is already allowed is returned as it is (same object). Without any explored land there is nothing to keep.
 */
export const clampPosition = (pos: Point, zoom: number, size: Size, bounds: Bounds | null, margin: number = PAN_MARGIN_TILES): Point => {
	if (!bounds) return pos;
	const c = centerOf(pos, zoom, size);
	const x = clamp(c.x, (bounds.minX - margin) * TILE_SIZE, (bounds.maxX + 1 + margin) * TILE_SIZE);
	const y = clamp(c.y, (bounds.minY - margin) * TILE_SIZE, (bounds.maxY + 1 + margin) * TILE_SIZE);
	return x === c.x && y === c.y ? pos : positionForCenter(x, y, zoom, size);
};

/** The tiles on screen, widened by `pad` tiles on every side. */
export const visibleTileRange = (pos: Point, zoom: number, size: Size, pad = 0): TileRange => {
	const tilePx = TILE_SIZE * zoom;
	return {
		minX: Math.floor(-pos.x / tilePx) - pad + 0, // + 0: never -0
		maxX: Math.ceil((size.w - pos.x) / tilePx) + pad,
		minY: Math.floor(-pos.y / tilePx) - pad + 0,
		maxY: Math.ceil((size.h - pos.y) / tilePx) + pad,
	};
};
