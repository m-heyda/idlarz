import { CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { BIOME_COLORS } from '@/config/biomePalette';
import { BUILDING_GLOW } from '@/config/pixelIcons';
import type { Size } from '@/lib/mapView';
import { forEachOwned, type Bounds, type World } from '@/utils/world';

/**
 * The minimap: an overview of the explored map as one tiny coloured square per tile (like the navigator of an image
 * editor), purple markers on workshops, a gold one on the castle. Pure layout and pixel painting here; Minimap.tsx owns
 * the canvas, the viewport rectangle and the pointer.
 */

/** Tiles of empty space around the explored land in the overview */
export const MINIMAP_MARGIN = 2;
/** Biggest square a tile gets (px); a small map is shown larger than a huge one, but never as chunky blocks */
export const MINIMAP_MAX_SCALE = 6;

export const WORKSHOP_COLOR = BUILDING_GLOW.workshop ?? '#b27aff';
export const CASTLE_MARKER_COLOR = '#ffd860';
const MARKER_OUTLINE = '#15091f';
const BACKGROUND: RGB = [10, 14, 28];

type RGB = [number, number, number];

export interface MinimapLayout {
	/** The tile shown at the top left corner of the region (fractional only through `scale`) */
	x0: number;
	y0: number;
	/** Pixels per tile: a whole number from MINIMAP_MAX_SCALE down to 1, a fraction for maps too big for that */
	scale: number;
	/** Where the region starts inside the box (px), so it is centred */
	offsetX: number;
	offsetY: number;
	/** The box, px */
	width: number;
	height: number;
}

/**
 * Fits the explored land (plus MINIMAP_MARGIN) into the box: as large as it can be with whole pixels per tile, and when even
 * one pixel per tile does not fit, as large as fits with a fraction. Without any land the layout shows the castle's surroundings.
 */
export const minimapLayout = (bounds: Bounds | null, box: Size, margin = MINIMAP_MARGIN): MinimapLayout => {
	const b = bounds ?? { minX: CASTLE_X, maxX: CASTLE_X, minY: CASTLE_Y, maxY: CASTLE_Y };
	const x0 = b.minX - margin;
	const y0 = b.minY - margin;
	const tilesW = b.maxX - b.minX + 1 + 2 * margin;
	const tilesH = b.maxY - b.minY + 1 + 2 * margin;
	const fit = Math.min(box.w / tilesW, box.h / tilesH);
	const scale = fit >= 1 ? Math.min(MINIMAP_MAX_SCALE, Math.floor(fit)) : fit;
	return {
		x0,
		y0,
		scale,
		offsetX: Math.floor((box.w - tilesW * scale) / 2),
		offsetY: Math.floor((box.h - tilesH * scale) / 2),
		width: box.w,
		height: box.h,
	};
};

/** Box position (px) of the top left corner of tile (tx, ty). */
export const tileToMinimap = (l: MinimapLayout, tx: number, ty: number): { x: number; y: number } => ({
	x: l.offsetX + (tx - l.x0) * l.scale,
	y: l.offsetY + (ty - l.y0) * l.scale,
});

/** The (fractional) tile under a box position (px). */
export const minimapToTile = (l: MinimapLayout, px: number, py: number): { x: number; y: number } => ({
	x: l.x0 + (px - l.offsetX) / l.scale,
	y: l.y0 + (py - l.offsetY) / l.scale,
});

const hexToRgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const colorCache = new Map<string, RGB>();
const rgbOfBiome = (biome: string): RGB => {
	let c = colorCache.get(biome);
	if (!c) {
		c = hexToRgb(BIOME_COLORS[biome] ?? '#555555');
		colorCache.set(biome, c);
	}
	return c;
};

const setPixel = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number, [r, g, b]: RGB): void => {
	if (x < 0 || y < 0 || x >= width || y >= height) return;
	const i = (y * width + x) * 4;
	data[i] = r;
	data[i + 1] = g;
	data[i + 2] = b;
	data[i + 3] = 255;
};

const fillRect = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number, w: number, h: number, color: RGB): void => {
	for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPixel(data, width, height, xx, yy, color);
};

/** A dot of `inner` px with a 1 px dark outline, centred on the tile whose top left is (px, py) and which is `size` px wide. */
const drawMarker = (data: Uint8ClampedArray, l: MinimapLayout, px: number, py: number, size: number, color: RGB): void => {
	const inner = 3;
	const cx = px + Math.floor(size / 2) - 1;
	const cy = py + Math.floor(size / 2) - 1;
	fillRect(data, l.width, l.height, cx - 1, cy - 1, inner + 2, inner + 2, hexToRgb(MARKER_OUTLINE));
	fillRect(data, l.width, l.height, cx, cy, inner, inner, color);
};

/**
 * Paints the whole overview into `data` (RGBA, layout.width x layout.height): background, a square per explored tile in its
 * biome colour, then the markers on top so they are never covered by a neighbour.
 */
export const paintMinimap = (data: Uint8ClampedArray, world: World, l: MinimapLayout): void => {
	for (let i = 0; i < l.width * l.height; i++) {
		data[i * 4] = BACKGROUND[0];
		data[i * 4 + 1] = BACKGROUND[1];
		data[i * 4 + 2] = BACKGROUND[2];
		data[i * 4 + 3] = 255;
	}
	const size = Math.max(1, Math.ceil(l.scale));
	const workshops: { px: number; py: number }[] = [];
	const castle: { px: number; py: number }[] = [];
	forEachOwned(world, (tile, x, y) => {
		const px = Math.floor(l.offsetX + (x - l.x0) * l.scale);
		const py = Math.floor(l.offsetY + (y - l.y0) * l.scale);
		fillRect(data, l.width, l.height, px, py, size, size, rgbOfBiome(tile.biome));
		if (tile.building === 'workshop') workshops.push({ px, py });
		else if (tile.biome === 'castle') castle.push({ px, py });
	});
	const cell = Math.max(size, 3);
	for (const { px, py } of castle) drawMarker(data, l, px, py, cell, hexToRgb(CASTLE_MARKER_COLOR));
	for (const { px, py } of workshops) drawMarker(data, l, px, py, cell, hexToRgb(WORKSHOP_COLOR));
};

/** The box rectangle (px) of a (fractional) tile range: the part of the map that is on screen. */
export const viewRectangle = (
	l: MinimapLayout,
	tiles: { minX: number; maxX: number; minY: number; maxY: number }
): { left: number; top: number; width: number; height: number } => {
	const a = tileToMinimap(l, tiles.minX, tiles.minY);
	const b = tileToMinimap(l, tiles.maxX, tiles.maxY);
	return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
};
