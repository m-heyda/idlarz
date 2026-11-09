import type { CloudInfo, CloudLink } from '@/lib/startPlan';
import type { PrestigeState } from '@/types/game';
import { shouldKeepalive } from '@/lib/syncPolicy';
import { scoped } from '@/lib/storageScope';
import { decodeSave } from '@/lib/saveFormat';
import { judgeRebase, type Progress } from '@/lib/cloudRecovery';

/** The browser side of /api/save. Saves stay local first; the cloud copy follows. */
/** `lastReset` is when the last season reset happened (epoch ms): a browser save older than it belongs to a game that was reset */
export type FetchCloud =
	| { status: 'empty'; lastReset?: number | null }
	| { status: 'ok'; cloud: CloudInfo; lastReset?: number | null }
	| { status: 'unavailable' };

export const fetchCloud = async (): Promise<FetchCloud> => {
	try {
		const response = await fetch('/api/save', { credentials: 'same-origin', cache: 'no-store' });
		if (!response.ok) return { status: 'unavailable' };
		const body = (await response.json()) as { empty?: boolean; lastReset?: number | null } & Partial<CloudInfo>;
		const lastReset = typeof body.lastReset === 'number' ? body.lastReset : null;
		if (body.empty) return { status: 'empty', lastReset };
		if (typeof body.rev !== 'number' || typeof body.text !== 'string' || !body.summary) return { status: 'unavailable' };
		return { status: 'ok', cloud: { rev: body.rev, serverSavedAt: body.serverSavedAt ?? 0, text: body.text, summary: body.summary }, lastReset };
	} catch {
		return { status: 'unavailable' };
	}
};

/** New Game: replaces the account's cloud game (its old save is kept in the history). True when the server did it. */
export const newGameCloud = async (): Promise<boolean> => {
	try {
		const response = await fetch('/api/save', { method: 'DELETE', credentials: 'same-origin' });
		return response.ok;
	} catch {
		return false;
	}
};

const readPrestige = (raw: unknown): PrestigeState | undefined => {
	const p = raw as Partial<PrestigeState> | null | undefined;
	if (!p || typeof p !== 'object') return undefined;
	const ok = [p.rebirths, p.legacyPoints, p.legacyEarned].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
	return ok && p.upgrades && typeof p.upgrades === 'object' ? (p as PrestigeState) : undefined;
};

export type PushResult =
	| {
			status: 'ok';
			rev: number;
			/** Set when the server kept less XP than the save held: the one it can explain */ xp?: number;
			/** Set when the server kept fewer Embers or rebirths than the save held: the ones a rebirth could have paid */ prestige?: PrestigeState;
	  }
	| { status: 'conflict'; rev: number }
	| { status: 'signed_out' } // the session is gone (expired, or logged out in another tab): retrying cannot help
	| { status: 'retry' } // too soon, outage, no network: try again later, nothing is wrong with the save
	| { status: 'rejected'; message: string };

export const pushCloud = async (text: string, baseRev: number, keepalive = false): Promise<PushResult> => {
	try {
		const body = JSON.stringify({ text, baseRev });
		const response = await fetch('/api/save', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body,
			// browsers refuse a keepalive body above 64 KiB (the fetch throws): a big save goes out as a normal request
			keepalive: keepalive && shouldKeepalive(body),
		});
		const reply = (await response.json().catch(() => ({}))) as { rev?: number; xp?: number; prestige?: unknown; error?: string };
		if (response.ok && typeof reply.rev === 'number')
			return {
				status: 'ok',
				rev: reply.rev,
				xp: typeof reply.xp === 'number' && Number.isFinite(reply.xp) ? reply.xp : undefined,
				prestige: readPrestige(reply.prestige),
			};
		if (response.status === 409) return { status: 'conflict', rev: reply.rev ?? 0 };
		if (response.status === 401) return { status: 'signed_out' };
		if (response.status === 422 || response.status === 400) return { status: 'rejected', message: reply.error ?? 'The save was refused.' };
		return { status: 'retry' };
	} catch {
		return { status: 'retry' };
	}
};

// ---- the link between this browser's save and an account's cloud save ----------------------------------------------

const LINK_KEY = scoped('idlarz.cloud');

export const readLink = (): CloudLink | null => {
	try {
		const raw = window.localStorage.getItem(LINK_KEY);
		if (!raw) return null;
		const link = JSON.parse(raw) as Partial<CloudLink>;
		return typeof link.userId === 'string' && Number.isInteger(link.rev) ? { userId: link.userId, rev: link.rev as number } : null;
	} catch {
		return null;
	}
};

export const writeLink = (link: CloudLink | null): void => {
	try {
		if (link) window.localStorage.setItem(LINK_KEY, JSON.stringify(link));
		else window.localStorage.removeItem(LINK_KEY);
	} catch {
		/* without a link the hub just asks again next time */
	}
};

// ---- uploads whose answer never arrived ----------------------------------------------------------------------------------
// The server can store a save while the page that sent it is already gone (closing or reloading the tab sends a last upload
// that nobody reads the answer of). The next upload from the reloaded page then carries the old revision and the server says
// "newer save": but the newer save is this browser's own. So every upload is remembered until one is confirmed, and a conflict
// first checks whether the account's save is one of them (same revision step, same play time) before calling it another browser.

const ATTEMPTS_KEY = scoped('idlarz.cloud.attempts');
const ATTEMPTS_KEEP = 5;

export interface PushAttempt {
	userId: string;
	/** The revision the upload was based on */
	baseRev: number;
	/** The play time inside the uploaded save: the same game on both sides has the same number */
	playSeconds: number;
}

const readAttempts = (): PushAttempt[] => {
	try {
		const list = JSON.parse(window.localStorage.getItem(ATTEMPTS_KEY) ?? '[]') as Partial<PushAttempt>[];
		return Array.isArray(list)
			? list.filter((a): a is PushAttempt => typeof a?.userId === 'string' && Number.isInteger(a.baseRev) && typeof a.playSeconds === 'number')
			: [];
	} catch {
		return [];
	}
};

export const writeAttempts = (list: PushAttempt[]): void => {
	try {
		if (list.length) window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(list.slice(-ATTEMPTS_KEEP)));
		else window.localStorage.removeItem(ATTEMPTS_KEY);
	} catch {
		/* without storage a lost answer is reported as a conflict, which the player can resolve in the hub */
	}
};

/** Remembers an upload before it is sent (the page may die before the answer comes). */
export const recordAttempt = (attempt: PushAttempt): void => writeAttempts([...readAttempts(), attempt]);

/** True when the account's save is the very save one of these uploads was sending: the step after its base revision, with its play time. */
export const isOwnSave = (attempts: readonly PushAttempt[], userId: string, cloud: Pick<CloudInfo, 'rev' | 'summary'>): boolean =>
	attempts.some((a) => a.userId === userId && cloud.rev === a.baseRev + 1 && cloud.summary.playSeconds === a.playSeconds);

export interface AdoptDeps {
	fetchCloud: () => Promise<FetchCloud>;
	readAttempts: () => PushAttempt[];
	writeLink: (link: CloudLink) => void;
	clearAttempts: () => void;
}

const REAL_ADOPT_DEPS: AdoptDeps = { fetchCloud, readAttempts, writeLink, clearAttempts: () => writeAttempts([]) };

/**
 * After a 409: if the account's save is one of this browser's own lost uploads, take its revision as the new base and return
 * it (the caller uploads again on top of it). Null when the save really came from somewhere else, or could not be checked.
 */
export const adoptOwnSave = async (userId: string, deps: AdoptDeps = REAL_ADOPT_DEPS): Promise<number | null> => {
	const attempts = deps.readAttempts();
	if (attempts.length === 0) return null;
	const latest = await deps.fetchCloud();
	if (latest.status !== 'ok' || !isOwnSave(attempts, userId, latest.cloud)) return null;
	deps.writeLink({ userId, rev: latest.cloud.rev });
	deps.clearAttempts();
	return latest.cloud.rev;
};

// ---- resolving a 409 -----------------------------------------------------------------------------------------------------------

/** What a 409 turned out to be, after looking at the account's save. */
export type ConflictResolution =
	| { kind: 'rebased'; rev: number; via: 'own' | 'ahead' | 'overwrite' } // upload again on top of `rev`
	| { kind: 'gone' } // the account has no save at all
	| { kind: 'diverged'; rev: number } // the account's save is ahead of, or another game than, this browser's: the player chooses
	| { kind: 'unknown' }; // the account could not be read: nothing was decided

export interface ResolveDeps extends AdoptDeps {
	readLink: () => CloudLink | null;
	now?: () => number;
}

const REAL_RESOLVE_DEPS: ResolveDeps = { ...REAL_ADOPT_DEPS, readLink };

/** The headline numbers of a cloud save, read from the text the server handed out (the rebirth count is not in the summary). */
const cloudProgress = (cloud: CloudInfo): Progress | null => {
	const decoded = decodeSave(cloud.text);
	if (!decoded.ok) return null;
	const { level, tilesOwned, playSeconds } = cloud.summary;
	return { level, tilesOwned, playSeconds, rebirths: decoded.state.prestige.rebirths };
};

/**
 * After a 409, decide whether it needs the player. Looks at the account's save once and answers:
 *   - it is one of this browser's own lost uploads (`isOwnSave`), or this browser's game is the same game and at least as far along
 *     (`judgeRebase`): the link is moved to its revision and the caller uploads again (`rebased`);
 *   - it holds more than this browser's game but nobody has saved it for `QUIET_MS` (the other session is gone): this browser's game replaces it
 *     (`rebased` via `overwrite`, owner decision; the server pins the replaced save in the history and the caller tells the player);
 *   - it holds more and is still being saved, or its revision is not above the link's (a New Game elsewhere restarts the revisions): `diverged`,
 *     nothing is uploaded, the caller looks again later (the player can choose in the hub meanwhile);
 *   - the account has no save (`gone`), or could not be read (`unknown`).
 * Nothing is uploaded here, so the server's revision check stays the only thing that decides what is stored.
 *
 * @category Saves & Server/Uploading
 * @order 3
 */
export const resolveConflict = async (userId: string, local: Progress, deps: ResolveDeps = REAL_RESOLVE_DEPS): Promise<ConflictResolution> => {
	const latest = await deps.fetchCloud();
	if (latest.status === 'empty') return { kind: 'gone' };
	if (latest.status !== 'ok') return { kind: 'unknown' };
	const { cloud } = latest;
	const link = deps.readLink();
	const own = isOwnSave(deps.readAttempts(), userId, cloud);
	let via: 'own' | 'ahead' | 'overwrite' = 'own';
	if (!own) {
		const cloudSide = cloudProgress(cloud);
		const verdict =
			cloudSide && link && link.userId === userId ? judgeRebase(link, local, cloudSide, cloud.rev, cloud.serverSavedAt, (deps.now ?? Date.now)()) : 'never';
		if (verdict === 'never' || verdict === 'wait') return { kind: 'diverged', rev: cloud.rev };
		via = verdict;
	}
	deps.writeLink({ userId, rev: cloud.rev });
	deps.clearAttempts();
	return { kind: 'rebased', rev: cloud.rev, via };
};

// ---- how often it happens --------------------------------------------------------------------------------------------------------

const CONFLICTS_KEY = scoped('idlarz.cloud.conflicts');

export interface ConflictStats {
	/** 409s seen by this browser */ total: number;
	/** ... that were resolved without the player */ rebased: number;
	/** ... that needed the player (the account's save is ahead and still being saved, or another game) */ diverged: number;
	/** Times this browser's game replaced a cloud save that held more (the replaced save is pinned in the history) */ overwrites: number;
	/** The last one (epoch ms) */ lastAt: number;
}

export const readConflictStats = (): ConflictStats => {
	try {
		const raw = JSON.parse(window.localStorage.getItem(CONFLICTS_KEY) ?? '{}') as Partial<ConflictStats>;
		const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
		return { total: n(raw.total), rebased: n(raw.rebased), diverged: n(raw.diverged), overwrites: n(raw.overwrites), lastAt: n(raw.lastAt) };
	} catch {
		return { total: 0, rebased: 0, diverged: 0, overwrites: 0, lastAt: 0 };
	}
};

/** Zeroes the counters (the epoch guard: they describe the old game's sessions). */
export const clearConflictStats = (): void => {
	try {
		window.localStorage.removeItem(CONFLICTS_KEY);
	} catch {
		/* a counter only */
	}
};

/** Counts one 409 (kept in this browser, and written to the console so a bug report carries it). Server side the same event is the `save_conflict` log line. */
export const noteConflict = (resolution: ConflictResolution['kind'], now: number = Date.now()): ConflictStats => {
	const stats = readConflictStats();
	const next: ConflictStats = {
		total: stats.total + 1,
		rebased: stats.rebased + (resolution === 'rebased' ? 1 : 0),
		diverged: stats.diverged + (resolution === 'diverged' ? 1 : 0),
		overwrites: stats.overwrites,
		lastAt: now,
	};
	return store(next, `Cloud save conflict: ${resolution}`);
};

/** Counts one time this browser's game replaced a cloud save that held more (called once the server accepted it). */
export const noteOverwrite = (now: number = Date.now()): ConflictStats => {
	const stats = readConflictStats();
	return store({ ...stats, overwrites: stats.overwrites + 1, lastAt: now }, 'Cloud save replaced by this browser (the old one is pinned in the history)');
};

const store = (stats: ConflictStats, message: string): ConflictStats => {
	try {
		window.localStorage.setItem(CONFLICTS_KEY, JSON.stringify(stats));
	} catch {
		/* a counter only */
	}
	console.info(message, stats);
	return stats;
};
