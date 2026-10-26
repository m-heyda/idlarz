import { CASTLE_X, CASTLE_Y, TILE_SIZE } from '@/config/gameConfig';
import type { Point, Size } from '@/lib/mapView';

/**
 * Finding the castle again on a map without edges: whether it is on screen and, when it is not, where on the screen's edge an
 * arrow should sit so it points toward it. Pure maths on the view (see mapView.ts and viewStore.ts), no React.
 */

/** Where the map is: the same fields as the view store */
export interface ViewLike extends Point, Size {
	zoom: number;
}

/** Parts of the screen the map cannot be seen through or where the arrow must not sit, px */
export interface Insets {
	top: number;
	right: number;
	bottom: number;
	left: number;
	/** A box in the bottom right corner (the minimap) the arrow stays out of */
	avoid?: Size;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** How far (px) from the edge of the free screen the arrow's centre stays, so the whole badge fits */
export const ARROW_MARGIN = 38;

export interface CompassArrow {
	/** Centre of the arrow badge on the screen, px */
	x: number;
	y: number;
	/** Direction toward the castle, degrees clockwise from "right" (screen coordinates, y down) */
	angle: number;
	/** Distance from the middle of the free screen to the castle, whole tiles */
	tiles: number;
}

/** Screen position (px) of the middle of the castle tile. */
export const castleScreenPoint = (view: ViewLike): Point => ({
	x: view.x + (CASTLE_X + 0.5) * TILE_SIZE * view.zoom,
	y: view.y + (CASTLE_Y + 0.5) * TILE_SIZE * view.zoom,
});

/** The part of the window where the map can be seen. */
const freeRect = (view: ViewLike, insets: Insets) => ({
	left: insets.left,
	top: insets.top,
	right: view.w - insets.right,
	bottom: view.h - insets.bottom,
});

/** Whether any part of the castle tile is on the screen (inside the window, not under `insets`). */
export const isCastleOnScreen = (view: ViewLike, insets: Insets = NO_INSETS): boolean => {
	const half = (TILE_SIZE * view.zoom) / 2;
	const c = castleScreenPoint(view);
	const r = freeRect(view, insets);
	return c.x + half > r.left && c.x - half < r.right && c.y + half > r.top && c.y - half < r.bottom;
};

/**
 * Where the arrow to the castle goes, or null while the castle is on screen. It sits on the border of the free screen (shrunk
 * by ARROW_MARGIN) on the line from the middle of the screen to the castle, nudged along the border when it would land on the
 * `avoid` box, and its angle always points at the castle from where it ended up.
 */
export const compassArrow = (view: ViewLike, insets: Insets = NO_INSETS, margin: number = ARROW_MARGIN): CompassArrow | null => {
	if (isCastleOnScreen(view, insets)) return null;
	const castle = castleScreenPoint(view);
	const r = freeRect(view, insets);
	const cx = (r.left + r.right) / 2;
	const cy = (r.top + r.bottom) / 2;
	const dx = castle.x - cx;
	const dy = castle.y - cy;
	// half size of the box the arrow may be on; never negative on a tiny window
	const hw = Math.max(0, (r.right - r.left) / 2 - margin);
	const hh = Math.max(0, (r.bottom - r.top) / 2 - margin);
	const reach = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
	const scale = Number.isFinite(reach) ? reach : 0;
	let x = cx + dx * scale;
	let y = cy + dy * scale;

	const avoid = insets.avoid;
	if (avoid) {
		const left = view.w - avoid.w - margin;
		const top = view.h - avoid.h - margin;
		if (x > left && y > top) {
			// slide along the border to the nearest free spot: up the right edge or left along the bottom edge
			const up = y - top;
			const sideways = x - left;
			if (up <= sideways) y = top;
			else x = left;
		}
	}
	return {
		x,
		y,
		angle: (Math.atan2(castle.y - y, castle.x - x) * 180) / Math.PI,
		tiles: Math.round(Math.hypot(dx, dy) / (TILE_SIZE * view.zoom)),
	};
};
