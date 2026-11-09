import { scoped } from '@/lib/storageScope';
import { clearConflictStats, writeAttempts, writeLink } from '@/lib/cloudClient';
import { clearCursor } from '@/lib/combatCursor';
import { clearManualCloudStamp } from '@/lib/manualCloudSave';
import { writePendingClaim } from '@/lib/offlineClient';
import { writeEntered } from '@/lib/authClient';
import { archiveForNewGame, resetSave } from '@/lib/saveStorage';

/**
 * The browser's half of the data epoch. A server reset (the New chapter release flips the server's `GAME_EPOCH`, IDL-76) leaves this browser holding state
 * that belongs to the old game: the cloud link (a revision the account no longer has: 409 loops, or `no_save` 404s), upload attempts, the combat log cursor, a
 * pending offline claim, the manual save cooldown, the conflict counters, the tab's "entered" flag and the local save itself.
 *
 * The browser remembers the epoch it last saw (`localStorage` `idlarz.epoch`). When `/api/auth/me` reports a higher one (`epochVerdict` says `wipe`),
 * the local save is put aside (`archiveForNewGame`) and reset, every key above is cleared (`wipeStaleBrowser`), the new epoch is recorded last (a
 * failed wipe is simply tried again on the next load) and the page reloads into the normal start check, which finds an account with no save and starts a new
 * game with a fresh link. No epoch in the reply (the server does not send one yet) means the guard does nothing. A browser with no stored epoch counts as
 * `BASELINE_EPOCH`, the value the server has today, so every browser that predates the guard is wiped on the flip and a brand new one is not.
 *
 * What this cannot do: a tab that is already open when the epoch flips never asks `/api/auth/me` again. That tab is stopped by the server (a save from an old
 * epoch has to be refused there), not by this guard. See `docs/plan/reset-proof-browsers.md`.
 *
 * @category Saves & Server/Browser state
 * @order 1
 */
export const BASELINE_EPOCH = 1;

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

/**
 * What to do about the server's epoch: `none` (the server sent no epoch, or it is not newer), `record` (first visit at the baseline: just remember it) or
 * `wipe` (this browser's state belongs to an older epoch). An epoch lower than the stored one (the constant was rolled back) never wipes.
 */
export const epochVerdict = (seen: number | null, server: number | undefined): 'none' | 'record' | 'wipe' => {
	if (server === undefined) return 'none';
	const known = seen ?? BASELINE_EPOCH;
	if (server > known) return 'wipe';
	return seen === null ? 'record' : 'none';
};

/** What `wipeStaleBrowser` needs; injected so the order of the steps is testable. */
export interface WipeDeps {
	/** Puts the local game aside; false when the browser would not keep the copy (nothing may be wiped then) */
	archiveLocal: () => boolean;
	resetLocal: () => Promise<void>;
	/** Clears every per-browser key that describes the old game or its link to the account */
	clearKeys: () => void;
	recordEpoch: (epoch: number) => void;
}

/** The clearing of every per-browser key of the old game (the table in `docs/plan/reset-proof-browsers.md`). UI preferences and the archived game stay. */
export const clearStaleKeys = (): void => {
	writeLink(null);
	writeAttempts([]);
	clearConflictStats();
	clearCursor();
	clearManualCloudStamp();
	writePendingClaim('', null);
	writeEntered(null);
};

const REAL_WIPE_DEPS: WipeDeps = { archiveLocal: archiveForNewGame, resetLocal: resetSave, clearKeys: clearStaleKeys, recordEpoch: writeSeenEpoch };

/**
 * Starts this browser over for a new epoch: archive the local game, reset it, clear the stale keys, then record the epoch. False (nothing changed, epoch not
 * recorded) when the archive could not be kept; the caller must not carry on syncing with the stale link then. The caller reloads the page after a true
 * (`resetSave` froze this page's save writer).
 */
export const wipeStaleBrowser = async (epoch: number, deps: WipeDeps = REAL_WIPE_DEPS): Promise<boolean> => {
	if (!deps.archiveLocal()) return false;
	await deps.resetLocal();
	deps.clearKeys();
	deps.recordEpoch(epoch);
	return true;
};
