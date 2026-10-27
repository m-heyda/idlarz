import type { PlayerClassId } from '@/config/playerClasses';

/** The browser side of /api/auth/*: the page only ever talks to our own routes, never to Supabase. */
export interface Profile {
	characterName: string;
	playerClass: PlayerClassId;
}

export type AuthResult =
	| { status: 'ok'; userId: string; profile: Profile | null }
	| { status: 'guest' } // no session (a clean 401)
	| { status: 'unavailable' } // outage, missing env, network: never treated as "logged out"
	| { status: 'error'; message: string }; // the player's input was refused

const request = async (path: string, init?: RequestInit): Promise<AuthResult> => {
	try {
		const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store' });
		const body = (await response.json().catch(() => ({}))) as { user?: { id?: string }; profile?: Profile | null; error?: string; unavailable?: boolean };
		if (response.ok) return { status: 'ok', userId: body.user?.id ?? '', profile: body.profile ?? null };
		if (response.status === 503 || response.status >= 500 || body.unavailable) return { status: 'unavailable' };
		if (response.status === 401 && path === '/api/auth/me') return { status: 'guest' };
		return { status: 'error', message: body.error ?? 'Something went wrong.' };
	} catch {
		return { status: 'unavailable' };
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

const ENTERED_KEY = 'idlarz.entered';

/** 'account': past the start page with a session; 'offline': playing without an account. Lives only as long as the tab. */
export type EnteredMode = 'account' | 'offline';

export const readEntered = (): EnteredMode | null => {
	try {
		const value = window.sessionStorage.getItem(ENTERED_KEY);
		return value === 'account' || value === 'offline' ? value : null;
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
