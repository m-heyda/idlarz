import type { PlayerClassId } from '@/config/playerClasses';
import { scoped } from '@/lib/storageScope';

/** The browser side of /api/auth/*: the page only ever talks to our own routes, never to Supabase. */
export interface Profile {
	characterName: string;
	playerClass: PlayerClassId;
}

/** Why accounts cannot be used: the server has no Supabase setup (retrying cannot help), or it is an outage / network problem (it may pass). */
export type UnavailableReason = 'not_configured' | 'outage';

export type AuthResult =
	| { status: 'ok'; userId: string; profile: Profile | null }
	| { status: 'guest' } // no session (a clean 401)
	| { status: 'unavailable'; reason: UnavailableReason } // outage, missing env, network: never treated as "logged out"
	| { status: 'error'; message: string }; // the player's input was refused

/** A request that hangs must not leave the player on the loading screen: it counts as an outage. */
const REQUEST_TIMEOUT_MS = 8000;

const request = async (path: string, init?: RequestInit): Promise<AuthResult> => {
	try {
		const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		const body = (await response.json().catch(() => ({}))) as { user?: { id?: string }; profile?: Profile | null; error?: string; unavailable?: boolean; reason?: UnavailableReason };
		if (response.ok) return { status: 'ok', userId: body.user?.id ?? '', profile: body.profile ?? null };
		if (response.status === 503 || response.status >= 500 || body.unavailable) {
			return { status: 'unavailable', reason: body.reason === 'not_configured' ? 'not_configured' : 'outage' };
		}
		if (response.status === 401 && path === '/api/auth/me') return { status: 'guest' };
		return { status: 'error', message: body.error ?? 'Something went wrong.' };
	} catch {
		return { status: 'unavailable', reason: 'outage' };
	}
};

const post = (path: string, body?: unknown) =>
	request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

export const fetchMe = () => request('/api/auth/me');
export const login = (email: string, password: string) => post('/api/auth/login', { email, password });
export const register = (email: string, password: string, characterName: string, playerClass: PlayerClassId) =>
	post('/api/auth/register', { email, password, characterName, playerClass });
export const saveProfile = (characterName: string, playerClass: PlayerClassId) => post('/api/auth/profile', { characterName, playerClass });
export const logout = async (): Promise<void> => {
	await post('/api/auth/logout');
};

// ---- "this tab is already playing" flag -----------------------------------------------------------------------------

const ENTERED_KEY = scoped('idlarz.entered');

/** 'account': past the start page with a session. Lives only as long as the tab. */
export type EnteredMode = 'account';

export const readEntered = (): EnteredMode | null => {
	try {
		const value = window.sessionStorage.getItem(ENTERED_KEY);
		return value === 'account' ? value : null;
	} catch {
		return null;
	}
};

export const writeEntered = (mode: EnteredMode | null): void => {
	try {
		if (mode) window.sessionStorage.setItem(ENTERED_KEY, mode);
		else window.sessionStorage.removeItem(ENTERED_KEY);
	} catch {
		/* the hub just shows again on refresh */
	}
};
