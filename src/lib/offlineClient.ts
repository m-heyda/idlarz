import type { ClaimResult } from '@/lib/offline/types';

/** The browser side of /api/offline. */
export type ClaimResponse =
	| { status: 'ok'; result: ClaimResult }
	| { status: 'no_save' } // the account has no cloud save yet: nothing to pay
	| { status: 'unavailable' }; // not set up, an outage, signed out: play on, the claim happens next time

export const requestClaim = async (claimId: string): Promise<ClaimResponse> => {
	try {
		const response = await fetch('/api/offline', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ claimId }),
		});
		if (response.status === 404) return { status: 'no_save' };
		if (!response.ok) return { status: 'unavailable' };
		const body = (await response.json()) as Partial<ClaimResult>;
		if (!body || typeof body.serverNowSec !== 'number' || !body.tickets || typeof body.gems !== 'number') return { status: 'unavailable' };
		return { status: 'ok', result: body as ClaimResult };
	} catch {
		return { status: 'unavailable' };
	}
};

// The idempotency key of a claim that has not been applied yet. It is kept until the answer is in hand, so a reload while the request is
// in flight repeats the SAME claim and the server replays its answer instead of paying again (or losing the payment).
const PENDING_KEY = 'idlarz.offline.pending';

interface Pending {
	userId: string;
	id: string;
}

export const newClaimId = (): string => {
	const bytes = new Uint8Array(16);
	globalThis.crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const readPendingClaim = (userId: string): string | null => {
	try {
		const raw = window.localStorage.getItem(PENDING_KEY);
		if (!raw) return null;
		const pending = JSON.parse(raw) as Partial<Pending>;
		return pending.userId === userId && typeof pending.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(pending.id) ? pending.id : null;
	} catch {
		return null;
	}
};

export const writePendingClaim = (userId: string, id: string | null): void => {
	try {
		if (id) window.localStorage.setItem(PENDING_KEY, JSON.stringify({ userId, id }));
		else window.localStorage.removeItem(PENDING_KEY);
	} catch {
		/* without storage a lost answer just means the next login claims again (nothing is paid twice: the anchor moved) */
	}
};
