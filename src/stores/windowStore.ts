import { create } from 'zustand';
import { readJsonPref, writeJsonPref } from '@/lib/uiPrefs';

/**
 * The game's windows: Hero, Merchant, Farm, Crafting, Deeds, Bestiary, Rankings and the castle upgrade. Any number can be open at once, each can be dragged,
 * and the one you click comes to the front (`order` is back to front: the last id is on top). Where a window was left is remembered.
 */
export type WinId = 'equipment' | 'merchant' | 'farm' | 'castle' | 'achievements' | 'bestiary' | 'rankings';
export const WIN_IDS: readonly WinId[] = ['equipment', 'merchant', 'farm', 'castle', 'achievements', 'bestiary', 'rankings'];

export interface WinPos {
	x: number;
	y: number;
}

/** Where a window first opens (staggered, so several never sit exactly on top of each other); clamped to the screen when drawn */
export const DEFAULT_WINDOW_POS: Record<WinId, WinPos> = {
	equipment: { x: 40, y: 100 },
	merchant: { x: 140, y: 148 },
	farm: { x: 190, y: 172 },
	castle: { x: 240, y: 196 },
	achievements: { x: 340, y: 244 },
	bestiary: { x: 290, y: 220 },
	rankings: { x: 390, y: 268 },
};

export interface WinSize {
	w: number;
	h: number;
}

const POSITIONS_KEY = 'windowPositions';
const SIZES_KEY = 'windowSizes';

interface WindowState {
	/** Open windows, back to front */
	order: WinId[];
	positions: Record<WinId, WinPos>;
	/** Sizes the player dragged a window to (a window not in here opens at its default size) */
	sizes: Partial<Record<WinId, WinSize>>;
	openWindow: (id: WinId) => void;
	closeWindow: (id: WinId) => void;
	toggleWindow: (id: WinId) => void;
	/** Brings a window to the front (a click anywhere on it) */
	focusWindow: (id: WinId) => void;
	/** While dragging: moves without saving */
	moveWindow: (id: WinId, x: number, y: number) => void;
	/** After a drag: remembers where the windows are */
	savePositions: () => void;
	/** Read after mount (the server render has no localStorage) */
	loadPositions: () => void;
	resizeWindow: (id: WinId, w: number, h: number) => void;
	saveSizes: () => void;
}

const isOpen = (order: readonly WinId[], id: WinId) => order.includes(id);
const toFront = (order: readonly WinId[], id: WinId): WinId[] => [...order.filter((other) => other !== id), id];

export const useWindowStore = create<WindowState>((set, get) => ({
	order: [],
	positions: { ...DEFAULT_WINDOW_POS },
	sizes: {},
	openWindow: (id) => set((state) => ({ order: toFront(state.order, id) })),
	closeWindow: (id) => set((state) => (isOpen(state.order, id) ? { order: state.order.filter((other) => other !== id) } : state)),
	toggleWindow: (id) => {
		const { order } = get();
		// closed: open it in front; open but behind another: bring it forward; on top: close it
		if (!isOpen(order, id)) set({ order: toFront(order, id) });
		else if (order[order.length - 1] !== id) set({ order: toFront(order, id) });
		else set({ order: order.filter((other) => other !== id) });
	},
	focusWindow: (id) => set((state) => (state.order[state.order.length - 1] === id || !isOpen(state.order, id) ? state : { order: toFront(state.order, id) })),
	moveWindow: (id, x, y) => set((state) => ({ positions: { ...state.positions, [id]: { x, y } } })),
	savePositions: () => writeJsonPref(POSITIONS_KEY, get().positions),
	resizeWindow: (id, w, h) => set((state) => ({ sizes: { ...state.sizes, [id]: { w, h } } })),
	saveSizes: () => writeJsonPref(SIZES_KEY, get().sizes),
	loadPositions: () => {
		const savedSizes = readJsonPref(SIZES_KEY);
		if (savedSizes && typeof savedSizes === 'object') {
			const sizes: Partial<Record<WinId, WinSize>> = {};
			for (const id of WIN_IDS) {
				const size = (savedSizes as Record<string, Partial<WinSize> | undefined>)[id];
				if (size && Number.isFinite(size.w) && Number.isFinite(size.h)) sizes[id] = { w: size.w as number, h: size.h as number };
			}
			set({ sizes });
		}
		const saved = readJsonPref(POSITIONS_KEY);
		if (!saved || typeof saved !== 'object') return;
		const positions = { ...DEFAULT_WINDOW_POS };
		for (const id of WIN_IDS) {
			const pos = (saved as Record<string, Partial<WinPos> | undefined>)[id];
			if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) positions[id] = { x: pos.x as number, y: pos.y as number };
		}
		set({ positions });
	},
}));
