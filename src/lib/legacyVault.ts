import { sanitizeSave, type PersistedGame } from '@/lib/sanitizeSave';
import type { DecodeResult } from '@/lib/saveFormat';

/**
 * READ-ONLY support for the first save format, so nobody loses progress when the game moves to the plain
 * `IDLZ2.` text save (see saveFormat.ts):
 *   - the encrypted IndexedDB vault (database `idlarz`, slots `current` / `previous`) is read once, copied into
 *     the new storage and then deleted;
 *   - old exported `.sav` files (`IDLZ1.<base64 of gzip + AES-GCM>`) can still be imported.
 * Nothing is ever written in the old format. Delete this file when old exports no longer matter.
 */

export const LEGACY_PREFIX = 'IDLZ1.';
/** The last schema the old format wrote; older saves are accepted too and sanitizeSave decides. */
const LEGACY_LAST_VERSION = 12;

const DB_NAME = 'idlarz';
const STORE = 'saves';
const SLOTS = ['current', 'previous'];
// Even older plain-text saves; they were never migrated, only removed
const OLD_LOCAL_STORAGE_KEYS = ['idle-explorer-v11', 'idle-explorer-v12'];

const APP_SECRET = 'idlarz/save/v1/b7d1c4e9-5f0a-4f8e-9a52-3c61d0e7a1f4';
const APP_SALT = new TextEncoder().encode('idlarz-vault-salt-2025');
const AAD = new TextEncoder().encode('idlarz-save-v1');

let keyPromise: Promise<CryptoKey> | null = null;
const getKey = (): Promise<CryptoKey> => {
	if (!keyPromise) {
		keyPromise = crypto.subtle
			.importKey('raw', new TextEncoder().encode(APP_SECRET), 'PBKDF2', false, ['deriveKey'])
			.then((base) =>
				crypto.subtle.deriveKey(
					{ name: 'PBKDF2', salt: APP_SALT, iterations: 100_000, hash: 'SHA-256' },
					base,
					{ name: 'AES-GCM', length: 256 },
					false,
					['decrypt']
				)
			);
	}
	return keyPromise;
};

const fromBase64 = (text: string): Uint8Array => {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

const gunzip = async (data: Uint8Array): Promise<string> => {
	const stream = new DecompressionStream('gzip');
	const writer = stream.writable.getWriter();
	void writer.write(data as unknown as BufferSource);
	void writer.close();
	return new TextDecoder().decode(new Uint8Array(await new Response(stream.readable).arrayBuffer()));
};

/** "IDLZ1.<base64(iv + ciphertext)>" -> JSON text. Throws if the text was edited, truncated or is not a save. */
const decryptText = async (envelope: string): Promise<string> => {
	const trimmed = envelope.replace(/\s+/g, '');
	if (!trimmed.startsWith(LEGACY_PREFIX)) throw new Error('not a save file');
	const bytes = fromBase64(trimmed.slice(LEGACY_PREFIX.length));
	if (bytes.length < 13 + 16) throw new Error('save is truncated');
	const packed = new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.subarray(0, 12) as unknown as BufferSource, additionalData: AAD },
			await getKey(),
			bytes.subarray(12) as unknown as BufferSource
		)
	);
	return gunzip(packed);
};

const readEnvelope = async (text: string): Promise<PersistedGame | { reason: string }> => {
	let envelope: { v?: unknown; state?: unknown; savedAt?: unknown };
	try {
		envelope = JSON.parse(await decryptText(text));
	} catch {
		return { reason: 'This is an old-format save that was edited, cut off or belongs to another game.' };
	}
	if (typeof envelope?.v !== 'number' || envelope.v > LEGACY_LAST_VERSION) {
		return { reason: 'This save belongs to a different game version.' };
	}
	const result = sanitizeSave(envelope.state);
	return result.ok ? result.state : { reason: `The save contains impossible data (${result.reason}).` };
};

/** Parses an exported old-format file. */
export const parseLegacy = async (text: string): Promise<DecodeResult> => {
	const out = await readEnvelope(text);
	if ('reason' in out) return { ok: false, reason: out.reason };
	return { ok: true, state: out, savedAt: null, schema: 0 };
};

// ---- the old IndexedDB vault -------------------------------------------------------------------------------------

/** Opens the old database WITHOUT creating it: a new player has none, and an empty one would only be clutter. */
const openExisting = (): Promise<IDBDatabase | null> => {
	if (typeof indexedDB === 'undefined') return Promise.resolve(null);
	return new Promise((resolve) => {
		try {
			const request = indexedDB.open(DB_NAME);
			let existed = true;
			request.onupgradeneeded = () => {
				existed = false;
				request.transaction?.abort();
			};
			request.onsuccess = () => {
				if (existed) resolve(request.result);
				else {
					request.result.close();
					resolve(null);
				}
			};
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
};

const readSlot = (db: IDBDatabase, slot: string): Promise<string | null> =>
	new Promise((resolve) => {
		try {
			const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(slot);
			request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});

export interface LegacyVault {
	/** The newest readable game in the old vault, or null. */
	read(): Promise<PersistedGame | null>;
	/** Deletes the old vault (call after the game was copied into the new storage). */
	clear(): Promise<void>;
}

export const legacyVault: LegacyVault = {
	read: async () => {
		try {
			OLD_LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
		} catch {
			/* storage blocked: nothing to clean */
		}
		const db = await openExisting();
		if (!db) return null;
		try {
			for (const slot of SLOTS) {
				const stored = await readSlot(db, slot);
				if (!stored) continue;
				const out = await readEnvelope(stored);
				if (!('reason' in out)) return out;
			}
			return null;
		} finally {
			db.close();
		}
	},
	clear: () =>
		new Promise((resolve) => {
			if (typeof indexedDB === 'undefined') return resolve();
			try {
				const request = indexedDB.deleteDatabase(DB_NAME);
				request.onsuccess = request.onerror = request.onblocked = () => resolve();
			} catch {
				resolve();
			}
		}),
};
