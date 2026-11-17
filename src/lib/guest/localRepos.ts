import { SAVE_SCHEMA, packBody } from '@/lib/saveFormat';
import { pickPersisted } from '@/lib/sanitizeSave';
import { splitBody, type SaveRepo, type StoredSave } from '@/lib/cloudSave/pipeline';
import { summarize } from '@/lib/cloudSave/summary';
import { clearedAttrs } from '@/lib/offline/attrs';
import type { IdentityInfo, IdentityRepo } from '@/lib/offline/identity';
import { seedLedger, type Ledger, type LedgerRepo } from '@/lib/offline/ledger';
import { countSave, emptyStats } from '@/lib/offline/stats';
import { settleTrades } from '@/lib/offline/trade';
import { emptyBank } from '@/lib/offline/tickets';
import { scoped } from '@/lib/storageScope';
import type { GameState } from '@/types/game';

// The guest game's stand-ins for the database: the ledger (what the server would remember about the player) lives in `localStorage`, the "saved game" the engine reads is built from the live game in the browser, and the identity is kept in memory.
// Nothing here talks to a server. The engine on top of these (`src/lib/offline/*`) is the same code the signed-in game runs.

const LEDGER_KEY = () => scoped('idlarz.guest.ledger');
const SEEN_KEY = () => scoped('idlarz.guest.seen');
const ID_KEY = () => scoped('idlarz.guest.id');

const read = (key: string): string | null => {
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};
const write = (key: string, value: string | null): void => {
	try {
		if (value === null) window.localStorage.removeItem(key);
		else window.localStorage.setItem(key, value);
	} catch {
		/* storage full or blocked: the guest game keeps running from memory (the save dialog already says so) */
	}
};

/** The guest's id: random per browser, so two guests do not roll the same chests (the engine seals every roll on it). It never leaves the browser. */
export const guestUserId = (): string => {
	let id = read(ID_KEY());
	if (!id) {
		const bytes = new Uint8Array(12);
		globalThis.crypto.getRandomValues(bytes);
		id = `guest-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
		write(ID_KEY(), id);
	}
	return id;
};

/** What the guest engine is. The seal secret is public on purpose: nothing a guest rolls is ever paid anywhere else. */
export const GUEST_SECRET = 'guest-game-local-only';

let memoryLedger: Ledger | null | undefined;

/** The ledger, in `localStorage` (and in memory when the storage refuses). Versioned like the database row, so the engine's compare-and-swap works unchanged. */
export const localLedgerRepo = (): LedgerRepo => ({
	load: async () => {
		if (memoryLedger === undefined) {
			const text = read(LEDGER_KEY());
			try {
				memoryLedger = text ? (JSON.parse(text) as Ledger) : null;
			} catch {
				memoryLedger = null;
			}
		}
		return memoryLedger ? structuredClone(memoryLedger) : null;
	},
	commit: async (_userId, expectedVer, ledger) => {
		const current = memoryLedger === undefined ? JSON.parse(read(LEDGER_KEY()) ?? 'null') : memoryLedger;
		if (expectedVer === 0 ? !!current : current?.ver !== expectedVer) return false;
		memoryLedger = structuredClone(ledger);
		write(LEDGER_KEY(), JSON.stringify(ledger));
		return true;
	},
});

/** When the guest was last here (epoch ms): the start of the next absence. */
export const readSeenAt = (): number | null => {
	const value = Number(read(SEEN_KEY()));
	return Number.isFinite(value) && value > 0 ? value : null;
};
export const writeSeenAt = (nowMs: number): void => write(SEEN_KEY(), String(Math.floor(nowMs)));

/** Forgets the guest's server side (the ledger and the clock) so the next request starts it again from the game as it is (a New Game). */
export const forgetGuestLedger = (): void => {
	memoryLedger = undefined;
	write(LEDGER_KEY(), null);
	write(SEEN_KEY(), null);
	previous = null;
};

// ---- the "saved game" the engine reads --------------------------------------------------------------------------------------------------------

let previous: StoredSave | null = null;
let rev = 1;
let createdAt = 0;

/** A stored save built from the live game: the same parts the server keeps after it accepts an upload (small core, map apart, headline numbers), without the checks (a guest may do what it likes). */
export const buildStored = (game: GameState, gems: number | null, serverSavedAt: number): StoredSave => {
	const state = pickPersisted(game);
	const summary = summarize(state);
	if (gems !== null) summary.gems = gems;
	const split = splitBody(packBody(state), summary.tilesOwned);
	const idol = summary.derived.idol;
	const core = {
		...split.core,
		...(gems !== null ? { gems } : {}),
		// the Idols' combat bonuses ride in the stored save for the fight profile (profile.ts reads `idolFx`), as in `acceptSave`
		...(idol && (idol.damagePct || idol.hpArmorPct || idol.merchantSellPct)
			? { idolFx: { damagePct: idol.damagePct, hpArmorPct: idol.hpArmorPct, ...(idol.merchantSellPct ? { merchantSellPct: idol.merchantSellPct } : {}) } }
			: {}),
	};
	createdAt ||= serverSavedAt;
	return {
		rev: rev++,
		schema: SAVE_SCHEMA,
		core,
		worldHash: split.world.hash,
		world: split.world,
		summary,
		flags: [],
		auditRatio: 1,
		freshStart: true,
		everFlagged: false,
		testAccount: true,
		serverSavedAt,
		createdAt,
		lastArchiveAt: serverSavedAt,
	};
};

/** True when the game in `stored` is a New Game over the one landed before (the same run's play time went back). */
export const startedOver = (stored: StoredSave): boolean =>
	!!previous && stored.summary.rebirths === previous.summary.rebirths && stored.summary.playSeconds < previous.summary.playSeconds - 1;

/** The save repo the engine reads: the one stored save is whatever `setStored` last put there. Writing is not possible (a guest's game is only ever the browser's). */
export const localSaveRepo = (current: () => StoredSave | null): SaveRepo => ({
	load: async (_userId, options) => {
		const stored = current();
		return stored ? (options?.world ? stored : { ...stored, world: undefined }) : null;
	},
	commit: async () => false,
	archive: async () => undefined,
	pin: async () => undefined,
});

/**
 * What the server does when it accepts a save, for the guest: the lifetime counters are counted, the trades are settled, what the engine paid is marked as seen by the save, and a rebirth starts the next run (new spawn timers, rolls from ordinal 1).
 * Returns the ledger to write, or null when there is nothing to change. A guest without a ledger gets one seeded from the game.
 */
export const landSave = (ledger: Ledger | null, stored: StoredSave, nowMs: number): { ledger: Ledger; expectedVer: number } => {
	const nowSec = nowMs / 1000;
	const newRun = !!ledger && stored.summary.rebirths > ledger.rebirths;
	const first = !ledger;
	const counted = countSave(ledger?.stats ?? emptyStats(), {
		nowMs,
		playSeconds: stored.summary.playSeconds,
		tilesOwned: stored.summary.tilesOwned,
		rates: previous ? (previous.summary.rates as unknown as Record<string, number>) : null,
		newRun: newRun || first,
		gold: stored.summary.gold,
	});
	if (!ledger) {
		previous = stored;
		return {
			ledger: { ...seedLedger(stored, nowMs), ver: 1, stats: counted, legacy: { idols: stored.core.idolLevels as Record<string, number> } as Ledger['legacy'] },
			expectedVer: 0,
		};
	}
	counted.tradeSince = settleTrades(ledger, previous, stored.core, nowSec, newRun || !previous);
	const idols = (stored.core.idolLevels ?? {}) as Record<string, number>;
	const base: Ledger = {
		...ledger,
		ver: ledger.ver + 1,
		grantedSeen: ledger.granted,
		stats: counted,
		legacy: { ...ledger.legacy, idols },
		gemShop: { ...ledger.gemShop, spentSinceSave: 0 },
	};
	const next: Ledger = newRun
		? {
				...base,
				runId: ledger.runId + 1,
				rebirths: stored.summary.rebirths,
				anchorAt: nowMs,
				bank: emptyBank(nowSec),
				ordChest: 0,
				ordKill: 0,
				lastKey: null,
				lastResult: null,
				combat: null,
				attrs: ledger.attrs ? clearedAttrs(ledger.attrs) : ledger.attrs,
			}
		: base;
	previous = stored;
	return { ledger: next, expectedVer: ledger.ver };
};

// ---- identity -----------------------------------------------------------------------------------------------------------------------------------

/** The hero's name and class: kept in memory (the game store holds them), nobody else can have the name. */
export const localIdentityRepo = (info: () => IdentityInfo): IdentityRepo => {
	let changed: Partial<IdentityInfo> = {};
	return {
		load: async () => ({ ...info(), ...changed }),
		nameTaken: async () => false,
		apply: async (_userId, pending, nowSec) => {
			if (pending.kind === 'class') changed = { ...changed, playerClass: pending.value };
			else changed = { ...changed, characterName: pending.value, nameChangedAtSec: Math.floor(nowSec) };
			return 'ok';
		},
	};
};
