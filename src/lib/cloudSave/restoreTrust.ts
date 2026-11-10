import { decodeSave } from '@/lib/saveFormat';
import { PINNED_KEEP, storedToText, type SaveRepo, type StoredSave } from './pipeline';
import { summarize } from './summary';
import type { SaveFlag } from './verify';

/** What `restoreTrust` did. Only `restored` wrote anything. */
export type RestoreOutcome =
	| { kind: 'restored'; fromRev: number; rev: number; flagsCleared: SaveFlag[]; wasRanked: boolean; auditRatio: number }
	| { kind: 'already_trusted' }
	| { kind: 'no_save' }
	| { kind: 'unreadable'; reason: string }
	/** Someone saved between the read and the write; nothing was changed, run it again */
	| { kind: 'conflict' };

/**
 * The way back for a false positive (IDL-209). A save that fires `castle_jump` or `networth_exceeds` is paid from the last trusted economy
 * ({@link trustedEconomy}) and the account loses its ranking for good (`everFlagged`). Nothing in the save path ever lifts that, so an honest
 * account hit by a clock jump or a bug in a build would stay frozen. This is the owner's tool for it: it takes the account's stored game as
 * the new baseline.
 *
 * What it does, in one atomic write (compare-and-swap on the revision, so a save arriving at the same moment makes it answer `conflict` and change nothing):
 *  - the stored save's summary is worked out again from the stored game itself, so the rates, castle and castle timer the server pays from are
 *    the CLAIMED ones again (the stored game was never altered by the freeze, only the numbers derived from it);
 *  - `flags` is cleared and `everFlagged` is false, so the account is ranking-eligible again if its first save was a young game;
 *  - the XP base and the gem balance are kept as they were, the save time stays (away pay is not touched), the revision goes up by one.
 *
 * Before it writes, the save it replaces is pinned in the history (`PINNED_KEEP`), so what the account looked like when it was flagged is still
 * there; the caller logs the returned `restored` outcome as the audit line (`scripts/restore-trust.ts` prints it as JSON).
 *
 * Idempotent: an account with no flags on its save and no `everFlagged` answers `already_trusted` and nothing is written, so running it twice is safe.
 *
 * It judges nothing. Only restore an account that was looked at and found honest: if the claimed land is still worth more than the game could have paid,
 * the very next save raises `networth_exceeds` again and the account is frozen again, now at the restored rates. It changes nothing for any other save:
 * `acceptSave` never calls it, and with `ENFORCEMENT.enabled` off (as shipped) the save path behaves exactly as before.
 *
 * @category Saves & Server/Accepting a save
 * @order 4
 */
export const restoreTrust = async (repo: SaveRepo, userId: string, displayName: string): Promise<RestoreOutcome> => {
	const current = await repo.load(userId, { world: true });
	if (!current) return { kind: 'no_save' };
	if (current.flags.length === 0 && !current.everFlagged) return { kind: 'already_trusted' };

	let text: string;
	try {
		text = storedToText(current);
	} catch {
		return { kind: 'unreadable', reason: 'the stored save has no map' };
	}
	const decoded = decodeSave(text);
	if (!decoded.ok) return { kind: 'unreadable', reason: decoded.reason };

	const summary = summarize(decoded.state);
	summary.derived.xpBase = current.summary.derived.xpBase;
	summary.gems = current.summary.gems;

	if (current.world) await repo.pin(userId, current, PINNED_KEEP);
	const restored: StoredSave = { ...current, rev: current.rev + 1, summary, flags: [], everFlagged: false, world: undefined };
	const written = await repo.commit(userId, current.rev, restored, null, { displayName, trusted: !current.testAccount && current.freshStart });
	if (!written) return { kind: 'conflict' };
	return {
		kind: 'restored',
		fromRev: current.rev,
		rev: restored.rev,
		flagsCleared: current.flags,
		wasRanked: !current.everFlagged,
		auditRatio: current.auditRatio,
	};
};
