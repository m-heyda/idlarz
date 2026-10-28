import { create } from 'zustand';
import { PREF_DEFAULTS, readPref, writePref, type UiPrefKey } from '@/lib/uiPrefs';
import type { OfflineReport } from '@/lib/offline/apply';
import { connectedCluster } from '@/utils/cluster';
import { getTile, type World } from '@/utils/world';

/** The tabs of the main menu window (everything the old header buttons opened) */
export type MenuTab = 'character' | 'stats' | 'merchant' | 'farm';

export interface ContextMenuItem {
	id: string;
	label: string;
	onSelect: () => void;
	/** Red entry for something destructive */
	danger?: boolean;
	/** Greyed out; `hint` says why */
	disabled?: boolean;
	hint?: string;
	/** A label that changes while the menu is open (a countdown): the menu asks again every second and shows it instead of `hint` */
	liveHint?: () => string | undefined;
	/** A toggle: shows a tick box */
	checked?: boolean;
	/** A thin rule above this entry */
	separator?: boolean;
}

export interface ContextMenuState {
	/** Screen position (viewport px) the menu opens at */
	x: number;
	y: number;
	title?: string;
	items: ContextMenuItem[];
}

let toastId = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

/** How long a highlighted area stays tinted (ms) */
export const HIGHLIGHT_MS = 3000;

// Transient UI flags (never persisted): dialogs that are opened from several places.
interface UiState {
	/** The main menu window; menuTab remembers the last tab for the rest of the session */
	menuOpen: boolean;
	menuTab: MenuTab;
	openMenu: (tab?: MenuTab) => void;
	closeMenu: () => void;
	toggleMenu: () => void;
	setMenuTab: (tab: MenuTab) => void;
	classDialogOpen: boolean;
	openClassDialog: () => void;
	closeClassDialog: () => void;
	settingsOpen: boolean;
	toggleSettings: () => void;
	closeSettings: () => void;
	legacyOpen: boolean;
	toggleLegacy: () => void;
	closeLegacy: () => void;
	tutorialOpen: boolean;
	openTutorial: () => void;
	closeTutorial: () => void;
	saveMenuOpen: boolean;
	toggleSaveMenu: () => void;
	closeSaveMenu: () => void;
	/** The welcome-back window after an absence (what the server paid); null when there is none to show */
	offlineReport: OfflineReport | null;
	showOfflineReport: (report: OfflineReport) => void;
	closeOfflineReport: () => void;
	/** The one right-click / dropdown menu: opened at a screen position with its entries already worked out */
	contextMenu: ContextMenuState | null;
	openContextMenu: (menu: ContextMenuState) => void;
	closeContextMenu: () => void;
	/** The build dialog of one explored tile */
	buildDialog: { x: number; y: number } | null;
	openBuildDialog: (x: number, y: number) => void;
	closeBuildDialog: () => void;
	/** Confirmations: a monster to dismiss (id) and a bag stack to discard (slot index) */
	dismissMonsterId: number | null;
	askDismissMonster: (id: number | null) => void;
	discardIndex: number | null;
	askDiscard: (index: number | null) => void;
	/** The connected area of one biome that is tinted for a few seconds ("Highlight" in the tile menu): its tiles as map keys */
	highlight: { biome: string; cells: ReadonlySet<number> } | null;
	/** Tints the area of the same biome around tile (x, y): every tile of that biome that touches it, side by side. */
	flashCluster: (world: World, x: number, y: number) => void;
	/** A short message at the bottom of the screen */
	toast: { id: number; text: string } | null;
	showToast: (text: string) => void;
	/** Remembered view options (localStorage, see lib/uiPrefs): the minimap and the dev admin panel */
	showMinimap: boolean;
	showAdmin: boolean;
	adminCollapsed: boolean;
	setPref: (key: UiPrefKey, value: boolean) => void;
	loadPrefs: () => void;
}

export const useUiStore = create<UiState>((set) => ({
	menuOpen: false,
	menuTab: 'character',
	openMenu: (tab) => set((state) => ({ menuOpen: true, menuTab: tab ?? state.menuTab })),
	closeMenu: () => set({ menuOpen: false }),
	toggleMenu: () => set((state) => ({ menuOpen: !state.menuOpen })),
	setMenuTab: (tab) => set({ menuTab: tab }),
	classDialogOpen: false,
	openClassDialog: () => set({ classDialogOpen: true }),
	closeClassDialog: () => set({ classDialogOpen: false }),
	settingsOpen: false,
	toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
	closeSettings: () => set({ settingsOpen: false }),
	legacyOpen: false,
	toggleLegacy: () => set((state) => ({ legacyOpen: !state.legacyOpen })),
	closeLegacy: () => set({ legacyOpen: false }),
	tutorialOpen: false,
	openTutorial: () => set({ tutorialOpen: true }),
	closeTutorial: () => set({ tutorialOpen: false }),
	saveMenuOpen: false,
	toggleSaveMenu: () => set((state) => ({ saveMenuOpen: !state.saveMenuOpen })),
	closeSaveMenu: () => set({ saveMenuOpen: false }),
	offlineReport: null,
	showOfflineReport: (report) => set({ offlineReport: report }),
	closeOfflineReport: () => set({ offlineReport: null }),
	contextMenu: null,
	openContextMenu: (menu) => set({ contextMenu: menu }),
	closeContextMenu: () => set((state) => (state.contextMenu ? { contextMenu: null } : state)),
	buildDialog: null,
	openBuildDialog: (x, y) => set({ buildDialog: { x, y }, contextMenu: null }),
	closeBuildDialog: () => set({ buildDialog: null }),
	dismissMonsterId: null,
	askDismissMonster: (id) => set({ dismissMonsterId: id, contextMenu: null }),
	discardIndex: null,
	askDiscard: (index) => set({ discardIndex: index, contextMenu: null }),
	highlight: null,
	flashCluster: (world, x, y) => {
		if (flashTimer) clearTimeout(flashTimer);
		const tile = getTile(world, x, y);
		const cells = connectedCluster(world, x, y);
		if (!tile || cells.size === 0) {
			set({ highlight: null, contextMenu: null });
			return;
		}
		set({ highlight: { biome: tile.biome, cells }, contextMenu: null });
		flashTimer = setTimeout(() => set({ highlight: null }), HIGHLIGHT_MS);
	},
	toast: null,
	showToast: (text) => {
		if (toastTimer) clearTimeout(toastTimer);
		set({ toast: { id: ++toastId, text } });
		toastTimer = setTimeout(() => set({ toast: null }), 2200);
	},
	...PREF_DEFAULTS,
	setPref: (key, value) => {
		writePref(key, value);
		set({ [key]: value });
	},
	// read after mount (the server render has no localStorage): keeps hydration identical
	loadPrefs: () =>
		set({
			showAdmin: readPref('showAdmin'),
			adminCollapsed: readPref('adminCollapsed'),
		}),
}));
