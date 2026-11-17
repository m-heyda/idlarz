import { isGuestPage, scoped } from '@/lib/storageScope';
import { checkCharacterName, checkPlayerClass } from '@/lib/authValidation';
import type { Profile } from '@/lib/authClient';

// The seam between the browser's game calls and the guest engine. `epochFetch` (the one door of the game's /api calls) asks `guestFetch` first: on the guest page nothing ever goes to the network, the call is answered by the transport the guest
// page installed (`src/lib/guest`, loaded only there) or, with none installed, by a 503. Nothing in here imports the engine, so a signed-in player's bundle does not contain it.

/** What the guest engine answers: an HTTP-like status and a JSON body, the shapes the real routes send. */
export interface GuestAnswer {
	status: number;
	body: unknown;
}

export type GuestTransport = (path: string, body: Record<string, unknown>) => Promise<GuestAnswer>;

let transport: GuestTransport | null = null;

/** Registered by `installGuest` once the guest engine is loaded. */
export const setGuestTransport = (next: GuestTransport | null): void => {
	transport = next;
};

/** True when this page is the guest game: no request leaves the browser, no account is involved. */
export const isGuestSession = (): boolean => isGuestPage();

const respond = ({ status, body }: GuestAnswer): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Answers a game call on the guest page as the server would (a `Response`), without any network. */
export const guestFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
	const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
	if (!transport) return respond({ status: 503, body: { error: 'Guest mode is not ready.' } });
	let body: Record<string, unknown> = {};
	if (typeof init.body === 'string') {
		try {
			const parsed = JSON.parse(init.body) as unknown;
			if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
		} catch {
			return respond({ status: 400, body: { error: 'Bad request.' } });
		}
	}
	try {
		return respond(await transport(path, body));
	} catch {
		return respond({ status: 503, body: { error: 'Guest mode failed.' } });
	}
};

/** `fetch` for the calls that belong to an account (sign-in, avatars, badges, rankings): the guest game has no account, so there it fails at once and the caller's own "unavailable" path answers. Nothing leaves the browser. */
export const networkFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
	isGuestSession() ? Promise.reject(new Error('guest mode has no account')) : fetch(input, init);

// ---- what a guest leaves in the browser ------------------------------------------------------------------------------------------------------

const HERO_KEY = () => scoped('idlarz.guest.hero');

/** The guest's hero (name and class, the avatar picked): chosen once on `/guest`, kept in this browser only. */
export const readGuestHero = (): Profile | null => {
	try {
		const parsed = JSON.parse(window.localStorage.getItem(HERO_KEY()) ?? 'null') as Partial<Profile> | null;
		const name = checkCharacterName(parsed?.characterName);
		const playerClass = checkPlayerClass(parsed?.playerClass);
		if (!name.ok || !playerClass.ok) return null;
		return { characterName: name.value, playerClass: playerClass.value, avatarId: typeof parsed?.avatarId === 'string' ? parsed.avatarId : null };
	} catch {
		return null;
	}
};

export const writeGuestHero = (hero: Profile): void => {
	try {
		window.localStorage.setItem(HERO_KEY(), JSON.stringify(hero));
	} catch {
		/* the hero is only a convenience: without storage the picker shows again next time */
	}
};

let wiped = false;

/** True once the guest game was discarded: nothing may write it again (the tab is on its way out). */
export const guestWiped = (): boolean => wiped;

/**
 * Discards the guest game for good: every key the guest page wrote (`.guest` scope, with the `.dev` and epoch suffixes, `scoped` / `epochScoped`) leaves this browser. Used when the guest registers: the new account starts fresh and no guest data is
 * adopted. The caller pauses the save writer first (`setSavePaused(true)`), so the closing page cannot write the game back.
 */
export const wipeGuestStorage = (): void => {
	wiped = true;
	try {
		const doomed: string[] = [];
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i);
			if (key && /\.guest(\.dev)?(\.e\d+)?$/.test(key)) doomed.push(key);
		}
		doomed.forEach((key) => window.localStorage.removeItem(key));
	} catch {
		/* nothing readable, nothing to remove */
	}
};

/** True when this browser holds a guest game (a hero was picked on `/guest`): the landing then offers to continue it. Reads the guest key from outside the guest page, where `scoped` does not add the suffix. */
export const hasGuestGame = (): boolean => {
	try {
		for (let i = 0; i < window.localStorage.length; i++) {
			const key = window.localStorage.key(i);
			if (key && /^idlarz\.guest\.hero\.guest(\.dev)?$/.test(key)) return true;
		}
	} catch {
		/* storage blocked: no guest game to show */
	}
	return false;
};
