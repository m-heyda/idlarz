import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import type { BootSnapshot } from '@/lib/offline/types';
import { scoped } from '@/lib/storageScope';

/** The browser side of /api/auth/*: the page only ever talks to our own routes, never to Supabase. */
export interface Profile {
	characterName: string;
	playerClass: PlayerClassId;
	/** The chosen avatar (a catalog id, `catalog/avatars.ts`); null = none chosen yet (the class bust is shown). Absent from an older server's answer. */
	avatarId?: string | null;
}

/** The numbers on the landing's Continue card (from `player_stats`, absent for an account that has not played yet). */
export interface ProfileStats {
	level: number;
	rebirths: number;
}

/** Why accounts cannot be used: the server has no Supabase setup (retrying cannot help), or it is an outage / network problem (it may pass). */
export type UnavailableReason = 'not_configured' | 'outage';

export type AuthResult =
	// `epoch` / `needsReset`: what /api/auth/me says about the server's data epoch (IDL-76). Absent while the server does not send them (the guard is then a no-op).
	| { status: 'ok'; userId: string; profile: Profile | null; epoch?: number; needsReset?: boolean; stats?: ProfileStats; game?: BootSnapshot }
	| { status: 'guest' } // no session (a clean 401)
	| { status: 'unavailable'; reason: UnavailableReason } // outage, missing env, network: never treated as "logged out"
	| { status: 'error'; message: string }; // the player's input was refused

/** A request that hangs must not leave the player on the loading screen: it counts as an outage. */
const REQUEST_TIMEOUT_MS = 8000;

const request = async (path: string, init?: RequestInit): Promise<AuthResult> => {
	try {
		const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		const body = (await response.json().catch(() => ({}))) as {
			user?: { id?: string };
			profile?: Profile | null;
			error?: string;
			unavailable?: boolean;
			reason?: UnavailableReason;
			epoch?: unknown;
			needsReset?: unknown;
			stats?: { level?: unknown; rebirths?: unknown } | null;
			game?: { inv?: unknown; craft?: unknown; serverNowSec?: unknown } | null;
		};
		if (response.ok) {
			const epoch = typeof body.epoch === 'number' && Number.isInteger(body.epoch) && body.epoch >= 1 ? { epoch: body.epoch } : {};
			const needsReset = body.needsReset === true ? { needsReset: true } : {};
			const { level, rebirths } = body.stats ?? {};
			const stats = typeof level === 'number' && typeof rebirths === 'number' ? { stats: { level, rebirths } } : {};
			const game =
				body.game && typeof body.game.serverNowSec === 'number' && typeof body.game.craft === 'object' && body.game.craft !== null
					? { game: body.game as BootSnapshot }
					: {};
			return { status: 'ok', userId: body.user?.id ?? '', profile: body.profile ?? null, ...epoch, ...needsReset, ...stats, ...game };
		}
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

/** `game: true`: the game's own first load, which also gets the bag and crafting snapshot (`BootSnapshot`) in the same request. */
export const fetchMe = (opts: { game?: boolean } = {}) => request(opts.game ? '/api/auth/me?game=1' : '/api/auth/me');
export const login = (email: string, password: string) => post('/api/auth/login', { email, password });
export const register = (email: string, password: string, characterName: string, playerClass: PlayerClassId, avatarId: string | null = null) =>
	post('/api/auth/register', { email, password, characterName, playerClass, avatarId });
export const saveProfile = (characterName: string, playerClass: PlayerClassId, avatarId: string | null = null) =>
	post('/api/auth/profile', { characterName, playerClass, avatarId });
/** The "A new chapter" confirm (`POST /api/auth/epoch`, IDL-76): archives the old game and starts over with this name and hero. `nameTaken`: another account holds the name, nothing was reset. */
export type ChapterResult = { status: 'ok' } | { status: 'error'; message: string; nameTaken?: boolean } | { status: 'unavailable' };
export const startChapter = async (characterName: string, playerClass: PlayerClassId, avatarId: string | null = null): Promise<ChapterResult> => {
	try {
		const response = await fetch('/api/auth/epoch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ characterName, playerClass, avatarId }),
			credentials: 'same-origin',
			cache: 'no-store',
			signal: AbortSignal.timeout(30_000),
		});
		const body = (await response.json().catch(() => ({}))) as { error?: string; nameTaken?: boolean };
		if (response.ok) return { status: 'ok' };
		if (response.status === 503 && !body.error) return { status: 'unavailable' };
		return { status: 'error', message: body.error ?? 'Something went wrong.', ...(body.nameTaken ? { nameTaken: true } : {}) };
	} catch {
		return { status: 'unavailable' };
	}
};

/** The avatar picker's data (`GET /api/auth/avatar`): the chosen avatar and every id the account may pick. `null` when the server cannot be reached. */
export interface AvatarState {
	/** The profile's class: decides which starters are enabled */
	playerClass: PlayerClassId;
	avatarId: string | null;
	unlocked: string[];
}
export const fetchAvatars = async (): Promise<AvatarState | null> => {
	try {
		const response = await fetch('/api/auth/avatar', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
		if (!response.ok) return null;
		const body = (await response.json().catch(() => null)) as { playerClass?: unknown; avatarId?: unknown; unlocked?: unknown } | null;
		if (!body || !Array.isArray(body.unlocked) || typeof body.playerClass !== 'string' || !PLAYER_CLASSES[body.playerClass as PlayerClassId]) return null;
		return {
			playerClass: body.playerClass as PlayerClassId,
			avatarId: typeof body.avatarId === 'string' ? body.avatarId : null,
			unlocked: body.unlocked.filter((id): id is string => typeof id === 'string'),
		};
	} catch {
		return null;
	}
};
/** Picks an avatar (`POST /api/auth/avatar`); the server refuses an unknown or locked id with its reason. */
export const chooseAvatar = async (avatarId: string): Promise<{ ok: true } | { ok: false; message: string }> => {
	try {
		const response = await fetch('/api/auth/avatar', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ avatarId }),
			credentials: 'same-origin',
			cache: 'no-store',
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		if (response.ok) return { ok: true };
		const body = (await response.json().catch(() => ({}))) as { error?: string };
		return { ok: false, message: body.error ?? 'Something went wrong.' };
	} catch {
		return { ok: false, message: 'The server could not be reached. Try again in a moment.' };
	}
};
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
