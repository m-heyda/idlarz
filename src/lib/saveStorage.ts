import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { legacyVault, parseLegacy, LEGACY_PREFIX, type LegacyVault } from '@/lib/legacyVault';
import { decodeSave, encodeSave, type DecodeResult } from '@/lib/saveFormat';
import type { PersistedGame } from '@/lib/sanitizeSave';

/**
 * Where the game is kept: the browser's localStorage, one text line (see saveFormat.ts).
 *
 * Why this keeps a save alive:
 *   - Writes are SYNCHRONOUS. A closing tab or browser can drop async work (IndexedDB, encryption), but a
 *     localStorage write made inside `pagehide` / `visibilitychange` is completed before the page goes.
 *   - While playing the save is written at most every 2 s, and always when the tab is hidden or closed.
 *   - Two copies: `current`, and `backup` (the previous `current`, refreshed every 10 min). If `current` cannot
 *     be read the game starts from the backup and the damaged text is kept under `damaged`, never overwritten
 *     silently.
 *   - The browser is asked to mark the storage as persistent, so it is not cleared when disk space runs low.
 *   - If the browser refuses to store (full, blocked, private mode) the game keeps running from memory and the
 *     save dialog says so, so the player can export instead.
 *   - Saves from the first format (encrypted IndexedDB) are copied over on first start (legacyVault.ts).
 */

export const PERSIST_VERSION = 1; // for the zustand persist option only; the real schema lives in saveFormat.ts
export const PERSIST_NAME = 'idlarz-save';

const KEY_CURRENT = 'idlarz.save';
const KEY_BACKUP = 'idlarz.save.backup';
const KEY_DAMAGED = 'idlarz.save.damaged';
const KEY_PREVIOUS_GAME = 'idlarz.save.previous-game'; // the game a New Game replaced; reset never removes it
const BARELY_PLAYED_SEC = 300;
const FLUSH_DELAY_MS = 2000;
const ROTATE_EVERY_MS = 10 * 60 * 1000;

export interface KeyValue {
	get(key: string): string | null;
	/** Throws when the browser refuses (quota, blocked). */
	set(key: string, value: string): void;
	remove(key: string): void;
}

export type SaveError = 'full' | 'unavailable';

export interface SaveInfo {
	/** When the stored save was last written (ms), if known. */
	savedAt: number | null;
	/** Size of the stored text. */
	bytes: number;
	/** Whether the browser promised not to evict the storage (null: cannot be told). */
	persisted: boolean | null;
	/** Set when the browser refused to store the save. */
	error: SaveError | null;
	/** Set when the save could not be read at start (what happened, in words). */
	loadProblem: string | null;
}

/** What the start hub sees in storage. `unreadable`: something is stored but neither copy decodes. */
export type SavePeek =
	| { kind: 'none' }
	| { kind: 'ok'; state: PersistedGame; savedAt: number | null; fromBackup: boolean }
	| { kind: 'unreadable' };

interface Options {
	kv: KeyValue | null;
	legacy?: LegacyVault;
	now?: () => number;
	/** Asks the browser for persistent storage; resolves to whether it was granted. */
	requestPersist?: () => Promise<boolean | null>;
	queryPersisted?: () => Promise<boolean | null>;
}

export const createSaveStorage = (options: Options) => {
	const { kv, legacy } = options;
	const now = options.now ?? Date.now;

	let ready = false; // nothing is written before the first load finished (a fresh game must not overwrite a save)
	let frozen = false; // set while importing/resetting so the running game cannot overwrite the new save
	let paused = false; // set while another tab owns the game: this tab must not write
	let pending: StorageValue<PersistedGame> | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let lastRotation = 0;
	let savedAt: number | null = null;
	let error: SaveError | null = null;
	let loadProblem: string | null = null;
	let persistAsked = false;

	// Holds what the browser would not take, so a rehydrate in the same session still sees it
	const memory = new Map<string, string>();

	const load = (key: string): string | null => {
		const held = memory.get(key);
		if (held !== undefined) return held;
		try {
			return kv ? kv.get(key) : null;
		} catch {
			return null;
		}
	};

	const store = (key: string, value: string): boolean => {
		if (!kv) {
			memory.set(key, value);
			error = 'unavailable';
			return false;
		}
		try {
			kv.set(key, value);
			memory.delete(key);
			error = null;
			return true;
		} catch (e) {
			memory.set(key, value);
			error = (e as { name?: string })?.name === 'QuotaExceededError' ? 'full' : 'unavailable';
			return false;
		}
	};

	const drop = (key: string) => {
		memory.delete(key);
		try {
			kv?.remove(key);
		} catch {
			/* nothing to remove from */
		}
	};

	const askForPersistence = () => {
		if (persistAsked || !options.requestPersist) return;
		persistAsked = true;
		void options.requestPersist().catch(() => undefined);
	};

	// ---- load ------------------------------------------------------------------------------------------------

	const markDamaged = (text: string, reason: string) => {
		store(KEY_DAMAGED, text);
		loadProblem = reason;
	};

	const loadGame = async (): Promise<PersistedGame | null> => {
		const current = load(KEY_CURRENT);
		if (current) {
			const result = decodeSave(current);
			if (result.ok) {
				savedAt = result.savedAt;
				lastRotation = 0; // the first write of this session keeps this save as the backup
				return result.state;
			}
			markDamaged(current, result.reason);
		}

		const backup = load(KEY_BACKUP);
		if (backup) {
			const result = decodeSave(backup);
			if (result.ok) {
				savedAt = result.savedAt;
				lastRotation = now(); // `current` is unusable: do not rotate it over this good backup
				if (current) loadProblem = 'Your latest save could not be read, so the previous backup was loaded.';
				return result.state;
			}
			if (!current) markDamaged(backup, result.reason);
		}

		if (!current && !backup && legacy) {
			const state = await legacy.read();
			if (state) {
				// Copy into the new storage, check it reads back, only then delete the old vault
				const text = encodeSave(state, now());
				if (store(KEY_CURRENT, text) && decodeSave(load(KEY_CURRENT) ?? '').ok) await legacy.clear();
				savedAt = null;
				lastRotation = 0;
				return state;
			}
		}

		lastRotation = now();
		if (current || backup) {
			loadProblem = 'Your save could not be read. The damaged text was kept; you can copy it from the save dialog.';
		}
		return null;
	};

	// ---- write -----------------------------------------------------------------------------------------------

	const writeNow = (value: StorageValue<PersistedGame>) => {
		const time = now();
		if (time - lastRotation > ROTATE_EVERY_MS) {
			const previous = load(KEY_CURRENT);
			if (previous) store(KEY_BACKUP, previous);
			lastRotation = time;
		}
		if (store(KEY_CURRENT, encodeSave(value.state, time))) {
			savedAt = time;
			askForPersistence();
		}
	};

	const flush = () => {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		const value = pending;
		pending = null;
		if (value && ready && !frozen && !paused) writeNow(value);
	};

	const dropPending = () => {
		pending = null;
		if (timer) clearTimeout(timer);
		timer = null;
	};

	/** Storage for the zustand persist middleware: state objects in, debounced synchronous writes out. */
	const storage: PersistStorage<PersistedGame> = {
		getItem: async () => {
			const state = await loadGame();
			return state ? { state, version: PERSIST_VERSION } : null;
		},
		setItem: (_name, value) => {
			if (!ready || frozen || paused) return;
			pending = value;
			if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS);
		},
		removeItem: () => {
			drop(KEY_CURRENT);
			drop(KEY_BACKUP);
		},
	};

	// ---- controls --------------------------------------------------------------------------------------------

	const freeze = () => {
		frozen = true;
		dropPending();
	};

	/** Parses pasted / uploaded save text, in either format. */
	const parse = async (text: string): Promise<DecodeResult> => {
		if (text.trim().startsWith(LEGACY_PREFIX)) return parseLegacy(text);
		return decodeSave(text);
	};

	/** Replaces the stored save with an imported one. The caller reloads the page afterwards. */
	const commitImport = (state: PersistedGame) => {
		freeze();
		const previous = load(KEY_CURRENT);
		if (previous) store(KEY_BACKUP, previous);
		const text = encodeSave(state, now());
		if (!store(KEY_CURRENT, text) || !decodeSave(load(KEY_CURRENT) ?? '').ok) {
			throw new Error('The browser would not store the imported save.');
		}
		drop(KEY_DAMAGED);
	};

	const reset = async () => {
		freeze();
		drop(KEY_CURRENT);
		drop(KEY_BACKUP);
		drop(KEY_DAMAGED);
		if (legacy) await legacy.clear();
	};

	/** Read-only look at what is stored (start hub): never writes, never starts a game, never touches the legacy vault. */
	const peek = (): SavePeek => {
		const current = load(KEY_CURRENT);
		const backup = load(KEY_BACKUP);
		if (!current && !backup) return { kind: 'none' };
		if (current) {
			const result = decodeSave(current);
			if (result.ok) return { kind: 'ok', state: result.state, savedAt: result.savedAt, fromBackup: false };
		}
		if (backup) {
			const result = decodeSave(backup);
			if (result.ok) return { kind: 'ok', state: result.state, savedAt: result.savedAt, fromBackup: true };
		}
		return { kind: 'unreadable' };
	};

	/**
	 * Keeps a copy of the stored game under its own key before a New Game wipes it. A copy of a barely played game
	 * never replaces an earlier copy of a real one. False when a copy was needed but the browser would not store it.
	 */
	const archiveForNewGame = (): boolean => {
		const text = load(KEY_CURRENT) ?? load(KEY_BACKUP);
		if (!text) return true;
		const result = decodeSave(text);
		if (result.ok && result.state.playSeconds < BARELY_PLAYED_SEC && load(KEY_PREVIOUS_GAME)) return true;
		return store(KEY_PREVIOUS_GAME, text) && load(KEY_PREVIOUS_GAME) === text;
	};

	/**
	 * Makes the given save text (the account's cloud save) this browser's current game, before the game is loaded.
	 * The game that was here is copied aside first; false (nothing changed) when that copy, the text or the write fails.
	 */
	const install = (text: string): boolean => {
		const decoded = decodeSave(text);
		if (!decoded.ok || !archiveForNewGame()) return false;
		const previous = load(KEY_CURRENT);
		if (previous) store(KEY_BACKUP, previous);
		const written = encodeSave(decoded.state, now());
		if (!store(KEY_CURRENT, written) || !decodeSave(load(KEY_CURRENT) ?? '').ok) return false;
		drop(KEY_DAMAGED);
		return true;
	};

	const info = async (): Promise<SaveInfo> => {
		let persisted: boolean | null = null;
		try {
			persisted = options.queryPersisted ? await options.queryPersisted() : null;
		} catch {
			persisted = null;
		}
		return { savedAt, bytes: load(KEY_CURRENT)?.length ?? 0, persisted, error, loadProblem };
	};

	return {
		storage,
		/** Call once the store has finished hydrating: from now on state changes are saved. */
		markReady: () => {
			ready = true;
		},
		/** Pause/resume writing (a tab that does not own the game must never overwrite the owner's save). */
		setPaused: (value: boolean) => {
			paused = value;
			if (value) dropPending();
		},
		freeze,
		flush,
		peek,
		archiveForNewGame,
		install,
		parse,
		commitImport,
		reset,
		info,
		/** The text of the save that could not be read, if one was kept. */
		damagedCopy: () => load(KEY_DAMAGED),
	};
};

// ---- the browser instance ------------------------------------------------------------------------------------------

const browserKv = (): KeyValue | null => {
	try {
		if (typeof window === 'undefined') return null;
		const ls = window.localStorage;
		return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
	} catch {
		return null; // blocked by the browser
	}
};

const persistence = () => (typeof navigator !== 'undefined' ? navigator.storage : undefined);

const saves = createSaveStorage({
	kv: browserKv(),
	legacy: legacyVault,
	requestPersist: async () => (await persistence()?.persist?.()) ?? null,
	queryPersisted: async () => (await persistence()?.persisted?.()) ?? null,
});

if (typeof window !== 'undefined') {
	// The moments a tab can vanish: write synchronously, right now
	window.addEventListener('pagehide', saves.flush);
	window.addEventListener('beforeunload', saves.flush);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') saves.flush();
	});
}

export const saveStorage = saves.storage;
export const markSaveReady = saves.markReady;
export const setSavePaused = saves.setPaused;
export const freezeSaves = saves.freeze;
/** Writes what is pending to localStorage right now (a milestone should not wait for the 2 s autosave delay). */
export const flushSaves = saves.flush;
export const parseSaveText = saves.parse;
export const commitImport = saves.commitImport;
export const resetSave = saves.reset;
export const peekSave = saves.peek;
export const archiveForNewGame = saves.archiveForNewGame;
export const installSave = saves.install;
export const getSaveInfo = saves.info;
export const getDamagedSave = saves.damagedCopy;

/** Writes the given state right now instead of waiting for the autosave delay ("Save game"); false when the browser or tab would not take it. */
export const saveNow = async (state: PersistedGame): Promise<boolean> => {
	const before = (await saves.info()).savedAt;
	saves.storage.setItem(PERSIST_NAME, { state, version: PERSIST_VERSION });
	saves.flush();
	const after = await saves.info();
	return !after.error && after.savedAt !== null && after.savedAt !== before;
};

/** The text a player can copy or download to back up (or move) their game. */
export const exportSaveText = (state: PersistedGame): string => encodeSave(state);
