// Remembered view options (not game state): plain booleans in localStorage, every access guarded
// (private windows and blocked storage throw, and the server render has no window).

import { scoped } from '@/lib/storageScope';

export type UiPrefKey = 'showAdmin' | 'adminCollapsed' | 'showMinimap' | 'combatMinimized' | 'compactHeader';

/** What a first visit (and the server render) sees: the dev admin panel starts open, the minimap on */
export const PREF_DEFAULTS: Record<UiPrefKey, boolean> = {
	showAdmin: true,
	adminCollapsed: false,
	showMinimap: true,
	combatMinimized: false, // the combat panel starts open
	compactHeader: false, // the header shows each resource with its amount; compact leaves only the icons (the amounts are in the dropdown of each group)
};

const storageKey = (key: UiPrefKey) => scoped(`idlarz.ui.${key}`);

export const readPref = (key: UiPrefKey): boolean => {
	try {
		const raw = window.localStorage.getItem(storageKey(key));
		return raw === null ? PREF_DEFAULTS[key] : raw === '1';
	} catch {
		return PREF_DEFAULTS[key];
	}
};

export const writePref = (key: UiPrefKey, value: boolean): void => {
	try {
		window.localStorage.setItem(storageKey(key), value ? '1' : '0');
	} catch {
		/* storage unavailable: the option simply is not remembered */
	}
};
