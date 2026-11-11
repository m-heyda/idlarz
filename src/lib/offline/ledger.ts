import { zeroResources } from '@/catalog/resourceKeys';
import { STARTING_GEMS } from '@/config/economy';
import type { ActiveBuff } from '@/lib/buffs';
import type { CombatState } from '@/lib/offline/fightTypes';
import { inventoryFromCore } from '@/lib/offline/inventory';
import { emptyCraft } from '@/lib/crafting';
import type { CraftQueueEntry, CraftState, Inventory } from '@/lib/offline/types';
import { emptyStats, type LifetimeStats } from '@/lib/offline/stats';
import { emptyBank, type MonsterTicket, type TicketBank } from '@/lib/offline/tickets';
import type { Resources } from '@/types/game';

// The ledger: the server's own small record of a player, next to the save. The save is what the client says; the ledger is what the
// server knows - when the player was last here, which chests and monsters have really appeared, how many gems they hold and how much
// the server ever handed out. One row per player, written only by the server (service role), read by nobody else.

/**
 * What the account keeps across rebirths (the ledger's `legacy` column, null until something was kept): `idols` is the level of each Idol by biome, the server's trusted record (a save can claim more, it is clamped to this plus one verified step, see `settleIdols`).
 * A New Game or a season reset starts it again (`resetLedger`); a rebirth keeps it.
 */
export interface Legacy {
	idols: Record<string, number>;
}

export const emptyLegacy = (): Legacy => ({ idols: {} });

export const isEmptyLegacy = (l: Legacy): boolean => Object.keys(l.idols).length === 0;

/** Reads the stored column back: a missing column, null or anything malformed reads as nothing kept. */
export const legacyFromJson = (raw: unknown): Legacy => {
	const out = emptyLegacy();
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
	const idols = (raw as Record<string, unknown>).idols;
	if (typeof idols === 'object' && idols !== null && !Array.isArray(idols))
		for (const [biome, level] of Object.entries(idols))
			if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 100) out.idols[biome] = level;
	return out;
};

/** Everything the server ever granted (income while away, chest and kill rewards): the save checks allow gains up to this much more. */
export type GrantTotals = Resources & { gems: number };

export const zeroTotals = (): GrantTotals => ({ ...zeroResources(), gems: 0 });

export const addTotals = (a: GrantTotals, b: Partial<GrantTotals>): GrantTotals => {
	const out = { ...a };
	(Object.keys(b) as (keyof GrantTotals)[]).forEach((key) => {
		out[key] = (out[key] ?? 0) + (b[key] ?? 0);
	});
	return out;
};

export const subtractTotals = (a: GrantTotals, b: GrantTotals): GrantTotals => {
	const out = { ...a };
	(Object.keys(b) as (keyof GrantTotals)[]).forEach((key) => {
		out[key] = Math.max(0, (a[key] ?? 0) - (b[key] ?? 0));
	});
	return out;
};

/** True for the state of a player who never crafted (stored as null, so the column stays empty for most rows). */
export const isEmptyCraft = (c: CraftState): boolean =>
	c.xp === 0 && c.ord === 0 && c.spent === 0 && Object.keys(c.stock).length === 0 && Object.keys(c.pity).length === 0 && c.queue.length === 0;

/** Reads the stored column back: a missing column, null or anything malformed reads as zeros. */
export const craftFromJson = (raw: unknown): CraftState => {
	const out = emptyCraft();
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
	const r = raw as Record<string, unknown>;
	const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
	const counts = (v: unknown): Record<string, number> => {
		const res: Record<string, number> = {};
		if (typeof v === 'object' && v !== null && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) if (n(x) > 0) res[k] = Math.floor(n(x));
		return res;
	};
	const queue: CraftQueueEntry[] = [];
	if (Array.isArray(r.queue))
		for (const e of r.queue as unknown[]) {
			if (typeof e !== 'object' || e === null) continue;
			const q = e as Record<string, unknown>;
			const count = Math.floor(n(q.count));
			if (typeof q.recipeId === 'string' && q.recipeId.length <= 40 && count > 0 && n(q.startedAt) > 0 && n(q.timeSec) > 0)
				queue.push({ recipeId: q.recipeId, count, startedAt: n(q.startedAt), timeSec: n(q.timeSec) });
		}
	return { xp: n(r.xp), ord: Math.floor(n(r.ord)), stock: counts(r.stock), pity: counts(r.pity), spent: n(r.spent), last: n(r.last), queue };
};

/**
 * The ledger: one row per player, written only by the server (`player_ledger`; the only SQL logic is the atomic save function, the compare-and-swap on `ver` is in TypeScript). It holds the run id and rebirth count, the away-time anchor,
 * the **ticket bank** (timers and waiting chests and monsters), the kill and chest counters that seal the rolls, `granted` and `grantedSeen` (what the server paid), the gem balance, the last idempotency key and result,
 * `combat` (HP, mana, cooldowns, the open fight, queue, switches, retry times, event log), `inv` (bag, gear, pity, auto-sell, Pack Rat size), `stats` (lifetime counters: kills per monster type, chests, tiles bought, income earned; see `stats.ts`) and `resetAt`.
 *
 * - **Idempotency**: a repeated request with the same key replays the stored answer; two browsers cannot both claim (compare-and-swap).
 * - **Tickets**: a chest or monster exists only as a ticket the server minted from its own clock. Opening a chest names a tile; no ticket on that tile, no reward. Timers and caps: {@link advanceBank} and {@link ticketCap}.
 *   The browser draws exactly the tickets the server lists (`reconcileTickets` in `src/lib/offline/reconcile.ts`).
 * - **Tables** (`supabase/schema.sql`, `supabase/migrations/*`): `profiles`, `player_saves` (small row: `core`, typed columns, `rev`, `flags`), `player_worlds` (the map, written only when it changed, by hash), `player_stats` (leaderboard row, trusted only),
 *   `save_history`, `player_ledger`, `rebirth_history`, `app_settings` (season reset marker). The only write path for a save is `save_player_state`, executable by the service role.
 *
 * @category Saves & Server/The ledger
 * @order 1
 * @see sealedRng, computeOfflineGrant
 */
export interface Ledger {
	/** Compare-and-swap counter: a write only lands if nobody else wrote since this was read (0 = the row does not exist yet) */
	ver: number;
	/** Counts the player's runs (a rebirth or a new game starts the next): sealed rolls never repeat across runs */
	runId: number;
	/** The rebirth count of the save that opened this run (a higher one in a later save starts a new run) */
	rebirths: number;
	/** Epoch ms: away time is counted from the later of this and the last accepted save */
	anchorAt: number;
	bank: TicketBank;
	/** How many chest and kill rewards have been rolled this run: the next one is sealed on this number */
	ordChest: number;
	ordKill: number;
	granted: GrantTotals;
	/** What `granted` was when the last save was accepted: the difference is what that save may contain on top of its income */
	grantedSeen: GrantTotals;
	/** The authoritative gem balance: whatever a save says, the server's number wins */
	gems: number;
	/** Epoch ms: when this player's game was last reset (a New Game, a season reset) or the ledger was created. Older than the global last reset (or null) = due a reset at the next login. */
	resetAt: number | null;
	/** The idempotency key and result of the last claim or redemption: a repeated request (a lost response) gets the same answer */
	lastKey: string | null;
	lastResult: unknown;
	/** The player's combat: HP and mana, cooldowns, the open fight (null until the first combat request seeds it from the save) */
	combat: CombatState | null;
	/** The bag, the worn gear, the loot pity and the auto-sell filter: the server's, not the save's (null only in rows from before the inventory moved here; the first request seeds it from the save) */
	inv: Inventory | null;
	/** Crafting: level XP, craft counter, component stock (migration crafting_ledger; zeros for a row without the column) */
	craft: CraftState;
	/** The potion buffs running (migration player_ledger_buffs): family, stat, percent and the second each ends; an empty list is stored as null */
	buffs: ActiveBuff[];
	/** Lifetime counters (migration new_chapter_columns, IDL-69): kills per type, chests, tiles bought, income earned; null in the column until something was counted */
	stats: LifetimeStats;
	/** What the account keeps across rebirths: the Idol levels (migration new_chapter_columns added the column; null until an Idol was learned) */
	legacy: Legacy;
}

export const newLedger = (nowMs: number, rebirths = 0): Ledger => ({
	ver: 0,
	runId: 1,
	rebirths,
	anchorAt: nowMs,
	resetAt: nowMs,
	bank: emptyBank(nowMs / 1000),
	ordChest: 0,
	ordKill: 0,
	granted: zeroTotals(),
	grantedSeen: zeroTotals(),
	gems: STARTING_GEMS,
	lastKey: null,
	lastResult: null,
	combat: null,
	inv: null,
	craft: emptyCraft(),
	buffs: [],
	stats: emptyStats(),
	legacy: emptyLegacy(),
});

/**
 * The ledger of a player who starts over (a New Game, or a season reset): everything back to a new game's values (anchor and spawn timers
 * at `nowMs`, nothing granted, no bag, no fight) except the gems, and the next run id so sealed rolls never repeat. `ver` is the old one:
 * the caller's compare-and-swap writes it one higher.
 */
export const resetLedger = (old: Ledger | null, nowMs: number): Ledger => ({
	...newLedger(nowMs, 0),
	ver: old?.ver ?? 0,
	runId: (old?.runId ?? 0) + 1,
	gems: old?.gems ?? STARTING_GEMS,
});

/** Storage of the ledger: Supabase in the app, a Map in tests. */
export interface LedgerRepo {
	load(userId: string): Promise<Ledger | null>;
	/** Stores `ledger` if the row is still at `expectedVer` (0 = it must not exist yet); false when someone else wrote first. */
	commit(userId: string, expectedVer: number, ledger: Ledger): Promise<boolean>;
}

/** The part of a stored save a new ledger is seeded from (the first time an account has one). */
export interface LedgerSeedSource {
	core: Record<string, unknown>;
	serverSavedAt: number;
	summary: { gems: number; rebirths: number; derived: { chests: number } };
}

const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

/**
 * A ledger for an account that already has a game: the monsters and chests standing on its map become tickets (so they can still be
 * fought and opened), the spawn timers carry over, and the gems start at what the save holds, but never above the starting gift,
 * because until now nothing in the game could have earned more.
 */
export const seedLedger = (source: LedgerSeedSource, nowMs: number): Ledger => {
	const ledger = newLedger(nowMs, source.summary.rebirths);
	const savedSec = source.serverSavedAt / 1000;
	const monsters = (Array.isArray(source.core.monsters) ? source.core.monsters : []) as { id?: number; type?: string; ageSec?: number }[];
	const sorted = [...monsters].sort((a, b) => num(a.id) - num(b.id));
	const waiting: MonsterTicket[] = [];
	let n = 1;
	for (const monster of sorted) {
		const isBoss = monster.type === 'ratKing' || (monster.type && monster.type.startsWith('boss'));
		const ticket: MonsterTicket = { n: n++, at: savedSec - Math.max(0, num(monster.ageSec)), kind: isBoss ? 'boss' : 'normal', lucky: false };
		if (isBoss && waiting.some((t) => t.kind === 'boss')) continue; // one boss at a time
		waiting.push(ticket);
	}
	// the chests standing on the saved map become numbered tickets; the server finds them a tile at the first look at the map
	const chestCount = Math.max(0, Math.floor(num(source.summary.derived.chests)));
	const chests = Array.from({ length: chestCount }, (_, i) => ({ n: n + i, at: savedSec }));
	ledger.bank = {
		...emptyBank(nowMs / 1000),
		chests,
		monsters: waiting,
		nextN: n + chestCount,
		monstersMinted: Math.max(waiting.filter((t) => t.kind === 'normal').length, num(source.core.nextMonsterId, 1) > 1 ? 1 : 0),
		chestAcc: Math.max(0, num(source.core.chestSpawnTimer)),
		monsterAcc: Math.max(0, num(source.core.monsterSpawnTimer)),
		bossAcc: Math.max(0, num(source.core.bossSpawnTimer)),
	};
	ledger.anchorAt = source.serverSavedAt;
	ledger.inv = inventoryFromCore(source.core);
	ledger.gems = Math.max(0, Math.min(Math.floor(num(source.summary.gems, STARTING_GEMS)), STARTING_GEMS));
	return ledger;
};
