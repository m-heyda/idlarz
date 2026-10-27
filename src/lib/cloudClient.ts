import type { CloudInfo, CloudLink } from '@/lib/startPlan';
import { shouldKeepalive } from '@/lib/syncPolicy';

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
	| { status: 'ok'; rev: number }
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
		const reply = (await response.json().catch(() => ({}))) as { rev?: number; error?: string };
		if (response.ok && typeof reply.rev === 'number') return { status: 'ok', rev: reply.rev };
		if (response.status === 409) return { status: 'conflict', rev: reply.rev ?? 0 };
		if (response.status === 401) return { status: 'signed_out' };
		if (response.status === 422 || response.status === 400) return { status: 'rejected', message: reply.error ?? 'The save was refused.' };
		return { status: 'retry' };
	} catch {
		return { status: 'retry' };
	}
};

// ---- the link between this browser's save and an account's cloud save ----------------------------------------------

const LINK_KEY = 'idlarz.cloud';

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
