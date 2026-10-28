import { create } from 'zustand';
import { CASTLE_X, CASTLE_Y, TILE_SIZE } from '@/config/gameConfig';
import { clampPosition, positionForCenter, type Point } from '@/lib/mapView';
import { useGameStore } from '@/stores/gameStore';
import { ownedBounds } from '@/utils/world';

/**
 * Where the map is on the screen (pan and zoom). A store of its own because more than the map reads and moves it: the
 * minimap shows the visible rectangle and pans on click. Never saved. Every change is clamped to the explored area
 * (see mapView.ts), so no caller has to remember to.
 */
interface ViewState {
	/** Screen position (px) of the world origin */
	x: number;
	y: number;
	zoom: number;
	/** Size of the map area (the window) in px */
	w: number;
	h: number;
	setPosition: (pos: Point) => void;
	/** Sets the zoom keeping the world point under `anchor` (a screen point, default the middle) where it is. */
	setZoom: (zoom: number, anchor?: Point) => void;
	setSize: (w: number, h: number) => void;
	/** Puts the world point (wx, wy) (px) in the middle of the screen. */
	centerOn: (wx: number, wy: number) => void;
	centerOnCastle: () => void;
	/** Applies the clamp again (the explored area, the window or the zoom changed). */
	reclamp: () => void;
}

const DEFAULT_ZOOM = 1;

const clampNow = (pos: Point, zoom: number, w: number, h: number): Point =>
	clampPosition(pos, zoom, { w, h }, ownedBounds(useGameStore.getState().tiles));

export const useViewStore = create<ViewState>((set, get) => ({
	x: 0,
	y: 0,
	zoom: DEFAULT_ZOOM,
	w: 800,
	h: 600,
	setPosition: (pos) => {
		const { x, y, zoom, w, h } = get();
		const next = clampNow(pos, zoom, w, h);
		if (next.x !== x || next.y !== y) set({ x: next.x, y: next.y });
	},
	setZoom: (zoom, anchor) => {
		const { x, y, zoom: from, w, h } = get();
		if (zoom === from) return;
		const at = anchor ?? { x: w / 2, y: h / 2 };
		const ratio = zoom / from;
		const next = clampNow({ x: at.x - (at.x - x) * ratio, y: at.y - (at.y - y) * ratio }, zoom, w, h);
		set({ zoom, x: next.x, y: next.y });
	},
	setSize: (w, h) => {
		const { x, y, zoom } = get();
		const next = clampNow({ x, y }, zoom, w, h);
		set({ w, h, x: next.x, y: next.y });
	},
	centerOn: (wx, wy) => {
		const { zoom, w, h } = get();
		get().setPosition(positionForCenter(wx, wy, zoom, { w, h }));
	},
	centerOnCastle: () => get().centerOn((CASTLE_X + 0.5) * TILE_SIZE, (CASTLE_Y + 0.5) * TILE_SIZE),
	reclamp: () => get().setPosition({ x: get().x, y: get().y }),
}));
