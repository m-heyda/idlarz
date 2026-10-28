import type { CloudInfo, CloudLink } from '@/lib/startPlan';
import { shouldKeepalive } from '@/lib/syncPolicy';
import { scoped } from '@/lib/storageScope';

/** The browser side of /api/save. Saves stay local first; the cloud copy follows. */
export type FetchCloud = { status: 'empty' } | { status: 'ok'; cloud: CloudInfo } | { status: 'unavailable' };

export const fetchCloud = async (): Promise<FetchCloud> => {
	try {
		const response = await fetch('/api/save', { credentials: 'same-origin', cache: 'no-store' });
		if (!response.ok) return { status: 'unavailable' };
		const body = (await response.json()) as { empty?: boolean } & Partial<CloudInfo>;
		if (body.empty) return { status: 'empty' };
		if (typeof body.rev !== 'number' || typeof body.text !== 'string' || !body.summary) return { status: 'unavailable' };
		return { status: 'ok', cloud: { rev: body.rev, serverSavedAt: body.serverSavedAt ?? 0, text: body.text, summary: body.summary } };
	} catch {
		return { status: 'unavailable' };
	}
};

export type PushResult =
	| { status: 'ok'; rev: number; /** Set when the server kept less XP than the save held: the one it can explain */ xp?: number }
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
		const reply = (await response.json().catch(() => ({}))) as { rev?: number; xp?: number; error?: string };
		if (response.ok && typeof reply.rev === 'number') return { status: 'ok', rev: reply.rev, xp: typeof reply.xp === 'number' && Number.isFinite(reply.xp) ? reply.xp : undefined };
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
