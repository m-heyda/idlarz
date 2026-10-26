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
export const MONSTER_COLOR = '#ff4d4d';
export const CHEST_COLOR = '#ffd23a';
/** Dots closer than this (px) become one bigger dot */
export const CLUSTER_PX = 7;
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

/** A dot on the overview standing for `n` monsters or chests that are close together. `px`, `py`: its centre in the box (px). */
export interface MarkerCluster {
	px: number;
	py: number;
	n: number;
}

export interface MinimapMarkers {
	monsters: MarkerCluster[];
	chests: MarkerCluster[];
}

/**
 * Merges points (box px) that would overlap into clusters: first a grid of `cell` px so a big pile costs one pass, then the
 * neighbours across grid lines are merged too, so two dots 2 px apart never stay separate just because a line runs between them.
 * A cluster sits at the mean of its points. Deterministic: the same points always give the same clusters, in the same order.
 */
export const clusterPoints = (points: { px: number; py: number }[], cell: number = CLUSTER_PX): MarkerCluster[] => {
	const bins = new Map<number, { sx: number; sy: number; n: number }>();
	for (const p of points) {
		const key = Math.floor(p.py / cell) * 65536 + Math.floor(p.px / cell);
		const bin = bins.get(key);
		if (bin) {
			bin.sx += p.px;
			bin.sy += p.py;
			bin.n++;
		} else bins.set(key, { sx: p.px, sy: p.py, n: 1 });
	}
	const list = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
	// merge neighbours across the grid lines (a few hundred bins at most: the box is small)
	// a merge moves the mean of a cluster, so go over the list again until nothing is close any more
	let changed = true;
	while (changed) {
		changed = false;
		for (let i = 0; i < list.length; i++) {
			for (let j = list.length - 1; j > i; j--) {
				const a = list[i];
				const b = list[j];
				if (Math.abs(a.sx / a.n - b.sx / b.n) < cell && Math.abs(a.sy / a.n - b.sy / b.n) < cell) {
					a.sx += b.sx;
					a.sy += b.sy;
					a.n += b.n;
					list.splice(j, 1);
					changed = true;
				}
			}
		}
	}
	return list.map((b) => ({ px: Math.round(b.sx / b.n), py: Math.round(b.sy / b.n), n: b.n }));
};

/** Side (px) of a dot standing for n things: a single one is small, a pile reads as a bigger dot. */
export const clusterSize = (n: number): number => (n >= 10 ? 9 : n >= 5 ? 7 : n >= 2 ? 5 : 3);

/**
 * The monsters (`monsters`: their tiles) and chests of the map as clustered dots of this layout. Chests are read off the
 * explored tiles (skipped without a scan when there are none).
 */
export const minimapMarkers = (world: World, monsters: { x: number; y: number }[], l: MinimapLayout): MinimapMarkers => {
	const centre = (x: number, y: number) => ({
		px: l.offsetX + (x - l.x0 + 0.5) * l.scale,
		py: l.offsetY + (y - l.y0 + 0.5) * l.scale,
	});
	const chests: { px: number; py: number }[] = [];
	if (world.stats.chests > 0) forEachOwned(world, (tile, x, y) => void (tile.hasChest && chests.push(centre(x, y))));
	return { monsters: clusterPoints(monsters.map((m) => centre(m.x, m.y))), chests: clusterPoints(chests) };
};

/** A square dot of `size` px centred on (cx, cy) with a 1 px dark outline. */
const drawDot = (data: Uint8ClampedArray, l: MinimapLayout, cx: number, cy: number, size: number, color: RGB): void => {
	const left = cx - Math.floor(size / 2);
	const top = cy - Math.floor(size / 2);
	fillRect(data, l.width, l.height, left - 1, top - 1, size + 2, size + 2, hexToRgb(MARKER_OUTLINE));
	fillRect(data, l.width, l.height, left, top, size, size, color);
};

/**
 * A soft yellow halo around every chest dot, on a transparent picture (RGBA, layout size) that lies over the map and is pulsed
 * by CSS. The colour is constant, only the alpha falls off with the distance.
 */
export const paintChestGlow = (data: Uint8ClampedArray, l: MinimapLayout, chests: MarkerCluster[]): void => {
	data.fill(0);
	const [r, g, b] = hexToRgb(CHEST_COLOR);
	for (const c of chests) {
		const reach = clusterSize(c.n) / 2 + 5;
		for (let y = Math.max(0, Math.floor(c.py - reach)); y <= Math.min(l.height - 1, Math.ceil(c.py + reach)); y++) {
			for (let x = Math.max(0, Math.floor(c.px - reach)); x <= Math.min(l.width - 1, Math.ceil(c.px + reach)); x++) {
				const d = Math.hypot(x + 0.5 - c.px, y + 0.5 - c.py);
				if (d >= reach) continue;
				const alpha = Math.round(170 * (1 - d / reach) ** 2);
				const i = (y * l.width + x) * 4;
				if (alpha <= data[i + 3]) continue;
				data[i] = r;
				data[i + 1] = g;
				data[i + 2] = b;
				data[i + 3] = alpha;
			}
		}
	}
};

/**
 * Paints the whole overview into `data` (RGBA, layout.width x layout.height): background, a square per explored tile in its
 * biome colour, then the markers on top so they are never covered by a neighbour: castle and workshops, then chests (yellow),
 * then monsters (red) above everything, when `markers` are given.
 */
export const paintMinimap = (data: Uint8ClampedArray, world: World, l: MinimapLayout, markers?: MinimapMarkers): void => {
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
	if (!markers) return;
	for (const c of markers.chests) drawDot(data, l, c.px, c.py, clusterSize(c.n), hexToRgb(CHEST_COLOR));
	for (const c of markers.monsters) drawDot(data, l, c.px, c.py, clusterSize(c.n), hexToRgb(MONSTER_COLOR));
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
