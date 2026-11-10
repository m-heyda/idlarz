import { scoped } from '@/lib/storageScope';

// The data epoch this browser last saw (`localStorage` `idlarz.epoch`). Kept apart from `epochGuard` so the request wrapper can read it without importing the guard's wipe code.

const EPOCH_KEY = scoped('idlarz.epoch');

/** The epoch this browser last saw, or null when it never recorded one (a browser from before the guard, or a new one). */
export const readSeenEpoch = (): number | null => {
	try {
		const n = Number(window.localStorage.getItem(EPOCH_KEY));
		return Number.isInteger(n) && n >= 1 ? n : null;
	} catch {
		return null;
	}
};

export const writeSeenEpoch = (epoch: number): void => {
	try {
		window.localStorage.setItem(EPOCH_KEY, String(epoch));
	} catch {
		/* without storage the next load compares against the baseline again and wipes again: harmless, the browser is already fresh */
	}
};
