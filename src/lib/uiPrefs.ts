// Remembered view options (not game state): plain booleans in localStorage, every access guarded
// (private windows and blocked storage throw, and the server render has no window).

import { scoped } from '@/lib/storageScope';

export type UiPrefKey = 'showMinimap' | 'combatMinimized' | 'compactHeader' | 'farmAnimalsOpen' | 'farmHudOpen' | 'farmUpgradesOpen';

/** What a first visit (and the server render) sees: the minimap on */
export const PREF_DEFAULTS: Record<UiPrefKey, boolean> = {
	showMinimap: true,
	combatMinimized: false, // the combat panel starts open
	compactHeader: false, // the header shows each resource with its amount; compact leaves only the icons (the amounts are in the dropdown of each group)
	farmAnimalsOpen: true, // the Farm window's animal shop, stats readout and upgrade drawer: what is folded stays folded
	farmHudOpen: true,
	farmUpgradesOpen: false,
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

const jsonKey = (key: string) => scoped(`idlarz.ui.${key}`);

/** A remembered string (the merchant's amount, a tab): null when nothing is stored or storage is unavailable */
export const readStringPref = (key: string): string | null => {
	try {
		return window.localStorage.getItem(jsonKey(key));
	} catch {
		return null;
	}
};

export const writeStringPref = (key: string, value: string): void => {
	try {
		window.localStorage.setItem(jsonKey(key), value);
	} catch {
		/* storage unavailable: not remembered */
	}
};

/** A remembered JSON value (window positions): null when missing or unreadable. The caller validates the shape. */
export const readJsonPref = (key: string): unknown => {
	const raw = readStringPref(key);
	if (raw === null) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
};

export const writeJsonPref = (key: string, value: unknown): void => writeStringPref(key, JSON.stringify(value));

export const writePref = (key: UiPrefKey, value: boolean): void => {
	try {
		window.localStorage.setItem(storageKey(key), value ? '1' : '0');
	} catch {
		/* storage unavailable: the option simply is not remembered */
	}
};
