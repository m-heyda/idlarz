import type { PushOutcome } from '@/lib/syncPolicy';
import { scoped } from '@/lib/storageScope';

/**
 * "Save game" in the menu: always saves to this browser, and when an account is signed in it also uploads the game to the
 * account's cloud save, at most once every 10 minutes. The automatic uploads (milestones, the 5 minute heartbeat, hiding the
 * tab) keep running on their own; this is the player's manual button, so the limit is about how often it may be pressed.
 * Pure apart from the small registry and the remembered time: the clock, the storage and the uploader are injected.
 */
export const MANUAL_CLOUD_COOLDOWN_MS = 10 * 60_000;

/** What the sync hook offers the menu while an account is signed in and cloud saving is active. */
export interface CloudSaver {
	userId: string;
	/** Uploads now through the sync scheduler (so it never overlaps an automatic upload); `busy`: one is already running, `stopped`: cloud saving is paused for this session. */
	run: () => Promise<PushOutcome | 'busy' | 'stopped'>;
}

let saver: CloudSaver | null = null;

/** The sync hook registers itself while it runs; returns the function that removes it again. */
export const registerCloudSaver = (next: CloudSaver): (() => void) => {
	saver = next;
	return () => {
		if (saver === next) saver = null;
	};
};

// ---- the remembered time of the last manual cloud save (survives a reload, so refreshing does not reset the limit) -------

const KEY = scoped('idlarz.cloud.manual');

export interface ManualStore {
	read: (userId: string) => number | null;
	write: (userId: string, at: number) => void;
}

const browserManualStore: ManualStore = {
	read: (userId) => {
		try {
			const raw = window.localStorage.getItem(KEY);
			const saved = raw ? (JSON.parse(raw) as { userId?: string; at?: number }) : null;
			return saved && saved.userId === userId && typeof saved.at === 'number' && Number.isFinite(saved.at) ? saved.at : null;
		} catch {
			return null;
		}
	},
	write: (userId, at) => {
		try {
			window.localStorage.setItem(KEY, JSON.stringify({ userId, at }));
		} catch {
			/* without storage the limit just resets on reload */
		}
	},
};

/** Milliseconds until the next manual cloud save is allowed; 0 when it is allowed now. A clock set back never locks it for longer than the limit. */
export const cooldownLeftMs = (userId: string, now: number, store: ManualStore = browserManualStore): number => {
	const last = store.read(userId);
	if (last === null) return 0;
	return Math.min(MANUAL_CLOUD_COOLDOWN_MS, Math.max(0, last + MANUAL_CLOUD_COOLDOWN_MS - now));
};

/** 7:05 for 425 000 ms (rounded up, so it never shows 0:00 while still locked). */
export const formatCountdown = (ms: number): string => {
	const total = Math.ceil(Math.max(0, ms) / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** The short live label next to "Save game": when the cloud copy can be saved again. Empty when there is no account to save to. */
export const cloudHint = (now: number, store: ManualStore = browserManualStore): string | undefined => {
	if (!saver) return undefined;
	const left = cooldownLeftMs(saver.userId, now, store);
	return left > 0 ? `cloud in ${formatCountdown(left)}` : 'cloud ready';
};

export type ManualSaveResult =
	| { local: false }
	| { local: true; cloud: 'no_account' }
	| { local: true; cloud: 'cooldown'; leftMs: number }
	| { local: true; cloud: 'saved' | 'failed' | 'busy' | 'stopped' };

export interface ManualSaveDeps {
	saveLocal: () => Promise<boolean>;
	now: () => number;
	store?: ManualStore;
	/** Defaults to the registered saver */
	saver?: CloudSaver | null;
}

/** Saves to this browser, then to the account if one is signed in and the 10 minutes since the last manual cloud save are over. */
export const saveGameEverywhere = async (deps: ManualSaveDeps): Promise<ManualSaveResult> => {
	if (!(await deps.saveLocal())) return { local: false };
	const target = deps.saver === undefined ? saver : deps.saver;
	if (!target) return { local: true, cloud: 'no_account' };
	const store = deps.store ?? browserManualStore;
	const left = cooldownLeftMs(target.userId, deps.now(), store);
	if (left > 0) return { local: true, cloud: 'cooldown', leftMs: left };
	const outcome = await target.run();
	if (outcome === 'ok') {
		store.write(target.userId, deps.now()); // only a save that went through starts the wait
		return { local: true, cloud: 'saved' };
	}
	return { local: true, cloud: outcome === 'retry' ? 'failed' : outcome === 'stop' ? 'stopped' : outcome };
};

/** The toast text for a result. The hook already explains why an upload stopped (newer save elsewhere, signed out, refused). */
export const manualSaveMessage = (result: ManualSaveResult): string => {
	if (!result.local) return 'Could not save: the browser blocked it, or another tab runs the game';
	switch (result.cloud) {
		case 'no_account':
			return 'Game saved';
		case 'cooldown':
			return `Game saved. Cloud save again in ${formatCountdown(result.leftMs)}`;
		case 'saved':
			return 'Game saved, and copied to your account';
		case 'failed':
			return 'Game saved here. The cloud copy did not go through, it retries on its own';
		case 'busy':
			return 'Game saved here. A cloud save is already running';
		case 'stopped':
			return 'Game saved here. Cloud saving is paused for this session';
	}
};
