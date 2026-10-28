import { STARTING_GEMS } from '@/config/gameConfig';
import type { CombatState } from '@/lib/offline/fightTypes';
import { emptyBank, type MonsterTicket, type TicketBank } from '@/lib/offline/tickets';
import type { Resources } from '@/types/game';

// The ledger: the server's own small record of a player, next to the save. The save is what the client says; the ledger is what the
// server knows - when the player was last here, which chests and monsters have really appeared, how many gems they hold and how much
// the server ever handed out. One row per player, written only by the server (service role), read by nobody else.

/** Everything the server ever granted (income while away, chest and kill rewards): the save checks allow gains up to this much more. */
export type GrantTotals = Resources & { gems: number };

export const zeroTotals = (): GrantTotals => ({ gold: 0, wood: 0, stone: 0, coal: 0, food: 0, meat: 0, eggs: 0, milk: 0, hide: 0, xp: 0, gems: 0 });

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
	/** The idempotency key and result of the last claim or redemption: a repeated request (a lost response) gets the same answer */
	lastKey: string | null;
	lastResult: unknown;
	/** The player's combat: HP and mana, cooldowns, the open fight (null until the first combat request seeds it from the save) */
	combat: CombatState | null;
}

export const newLedger = (nowMs: number, rebirths = 0): Ledger => ({
	ver: 0,
	runId: 1,
	rebirths,
	anchorAt: nowMs,
	bank: emptyBank(nowMs / 1000),
	ordChest: 0,
	ordKill: 0,
	granted: zeroTotals(),
	grantedSeen: zeroTotals(),
	gems: STARTING_GEMS,
	lastKey: null,
	lastResult: null,
	combat: null,
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
	const rats: MonsterTicket[] = [];
	let king: MonsterTicket | null = null;
	let n = 1;
	for (const monster of sorted) {
		const ticket = { n: n++, at: savedSec - Math.max(0, num(monster.ageSec)), lucky: false };
		if (monster.type === 'ratKing') king = king ?? ticket;
		else rats.push(ticket);
	}
	ledger.bank = {
		...emptyBank(nowMs / 1000),
		chests: Array.from({ length: Math.max(0, Math.floor(num(source.summary.derived.chests))) }, () => savedSec),
		rats,
		king,
		nextN: n,
		ratsMinted: Math.max(rats.length, num(source.core.nextMonsterId, 1) > 1 ? 1 : 0),
		chestAcc: Math.max(0, num(source.core.chestSpawnTimer)),
		ratAcc: Math.max(0, num(source.core.monsterSpawnTimer)),
		kingAcc: Math.max(0, num(source.core.bossSpawnTimer)),
	};
	ledger.anchorAt = source.serverSavedAt;
	ledger.gems = Math.max(0, Math.min(Math.floor(num(source.summary.gems, STARTING_GEMS)), STARTING_GEMS));
	return ledger;
};
