import { create } from 'zustand';

// Transient UI flags (never persisted): dialogs that are opened from several places.
interface UiState {
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
