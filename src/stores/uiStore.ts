import { create } from 'zustand';

/** The tabs of the main menu window (everything the old header buttons opened) */
export type MenuTab = 'character' | 'stats' | 'merchant' | 'farm';

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
}));
