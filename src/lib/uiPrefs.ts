// Remembered view options (not game state): plain booleans in localStorage, every access guarded
// (private windows and blocked storage throw, and the server render has no window).

export type UiPrefKey = 'showStats' | 'showAdmin' | 'adminCollapsed';

/** What a first visit (and the server render) sees: the dev admin panel starts open, the statistics panel off */
export const PREF_DEFAULTS: Record<UiPrefKey, boolean> = {
	showStats: false,
	showAdmin: true,
	adminCollapsed: false,
};

const storageKey = (key: UiPrefKey) => `idlarz.ui.${key}`;

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
