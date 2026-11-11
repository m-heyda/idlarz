import { BASELINE_EPOCH } from '@/config/epoch';
import { readSeenEpoch, writeSeenEpoch } from '@/lib/seenEpoch';
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
 * game with a fresh link. The server sends `epoch` and `needsReset` (`config/epoch.ts`); a reply with no epoch (an older server) means the guard does nothing. A browser with no stored epoch counts as
 * `BASELINE_EPOCH`, the value the server has today, so every browser that predates the guard is wiped on the flip and a brand new one is not.
 *
 * The local game's keys also carry the epoch (`storageScope.epochScoped`, `saveStorage`): from epoch 2 on the browser reads `idlarz.save.e2`, so the previous epoch's game is never read again even if this guard
 * never ran; `archiveForNewGame` still finds it under the old names and keeps it, `resetSave` then removes them.
 *
 * What this cannot do: a tab that is already open when the epoch flips never asks `/api/auth/me` again. That tab is stopped by the server: every game request carries the epoch
 * the browser last saw (`lib/epochFetch`) and a lower one is refused with 412 `staleEpoch`, after which the page reloads into this guard. See `docs/plan/reset-proof-browsers.md`.
 *
 * @title The browser's half of the data epoch
 * @category Saves & Server/Browser state
 * @order 1
 */
export { BASELINE_EPOCH };

export { readSeenEpoch, writeSeenEpoch };

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
