import { COMBAT, FALLBACK_BOSS, FALLBACK_MONSTER, MONSTERS } from '@/config/combatConfig';
import { SPAWN_LIMIT } from '@/config/spawns';
import { chestIntervalSec, goldenMonsterChance } from '@/lib/luck';
import type { Rng } from '@/lib/rng';
import type { MonsterType } from '@/types/game';
import { freeLand } from '@/lib/spawnLimits';

// The spawn bank. For a signed-in player the SERVER decides when a chest or a monster has appeared (from its own clock) and what is in
// it; the browser only places the picture on the map. A "ticket" is the server's record of one chest or monster that is waiting to be
// opened or killed: without a ticket a chest opens empty and a kill pays nothing, so forged chests and kills earn nothing.
//
// Everything here is pure and works in seconds, so the same maths runs for a few seconds of play and for eight hours away, and is
// unit-tested without a database.

/** Chests and monsters together that can wait at once, whatever the size of the map (keeps the stored row tiny). */
export const TICKET_CAP = 40;

/** What `kind` of ticket: a chest, a normal monster or a boss (one at a time). Also the name that seals the ticket's random rolls. */
export type TicketKind = 'chest' | 'monster' | 'boss';

/** Which list of the monster a ticket stands for: a normal monster or the boss (fixed when the ticket is minted; the exact monster is chosen with its tile). */
export type MonsterKind = 'normal' | 'boss';

/** A waiting chest. Like a monster it has a number and (once the server found a tile for it, see placement.ts) a tile: the browser draws it there and opens it by naming that tile. */
export interface ChestTicket {
	n: number;
	/** When it appeared (epoch seconds, server clock) */
	at: number;
	x?: number;
	y?: number;
}

export interface MonsterTicket {
	/** The ticket's number (unique for the run): the monster on the map carries it, a kill names it */
	n: number;
	/** When it appeared (epoch seconds, server clock): its age sets the level it has grown to */
	at: number;
	/** A normal monster or the boss */
	kind: MonsterKind;
	/** A golden monster (gold tint, bigger reward); decided here, never by the client */
	lucky: boolean;
	/** Where it stands and the level it appeared at: set by the server when it finds a tile (see placement.ts); a ticket without them is not on the map yet */
	x?: number;
	y?: number;
	spawnLevel?: number;
	/** Growth levels it may gain, when the player was weak enough at placement for the server to cap it (left out: the full growth limit) */
	growCap?: number;
	/** Which monster it is, chosen with the tile (placement.ts). Left out until it has a tile: see `monsterTypeOf` */
	type?: MonsterType;
}

/** The monster a ticket stands for: its own `type` when it has a valid one, else the plains monster or boss of its kind. */
export const monsterTypeOf = (ticket: Pick<MonsterTicket, 'type' | 'kind'>): MonsterType =>
	ticket.type && ticket.type in MONSTERS ? ticket.type : ticket.kind === 'boss' ? FALLBACK_BOSS : FALLBACK_MONSTER;

export interface TicketBank {
	/** Seconds the timers have run towards the next chest / monster / boss (they stop while the map is full) */
	chestAcc: number;
	monsterAcc: number;
	bossAcc: number;
	/** The server clock (epoch seconds) the timers were last brought up to */
	accAt: number;
	/** Waiting chests */
	chests: ChestTicket[];
	/** Waiting monsters of every kind (normal ones and at most one boss), placed or not */
	monsters: MonsterTicket[];
	/** The number of the next ticket, and how many normal monsters this run has had (the first one comes sooner) */
	nextN: number;
	monstersMinted: number;
	/** How many tiles a normal monster / the boss may stand on right now (from the last look at the map: `sitesKey` says which land that was). Monsters stop coming when they are all taken; unknown (never looked) means none come yet. `chest` counts the tiles a chest may stand on (absent in rows from before chests were placed here). */
	sites?: { monster: number; boss: number; chest?: number };
	sitesKey?: string;
}

/** What decides how many tickets there can be and how fast they come: the last accepted save's land and the player's Luck. */
export interface BankContext {
	luck: number;
	tilesOwned: number;
	buildingsOwned: number;
	/** Owned lake tiles (from the save summary's `derived.lakesOwned`; 0 when absent): they cannot hold a monster or chest */
	lakesOwned: number;
	castleLevel: number;
}

export const emptyBank = (nowSec: number): TicketBank => ({
	chestAcc: 0,
	monsterAcc: 0,
	bossAcc: 0,
	accAt: nowSec,
	chests: [],
	monsters: [],
	nextN: 1,
	monstersMinted: 0,
});

/** The boss waiting in the bank, if any (there is at most one). */
export const bossOf = (bank: Pick<TicketBank, 'monsters'>): MonsterTicket | null => bank.monsters.find((ticket) => ticket.kind === 'boss') ?? null;

/** The waiting normal monsters. */
export const normalsOf = (bank: Pick<TicketBank, 'monsters'>): MonsterTicket[] => bank.monsters.filter((ticket) => ticket.kind === 'normal');

const ticketCount = (bank: TicketBank): number => bank.chests.length + bank.monsters.length;

/**
 * How many more tickets may wait: the same share of the free land as the client's own spawn limit (monsters and chests together),
 * (`freeLand`, the client's own formula) estimated from the save's counts because the server never opens the map, and never more than `TICKET_CAP` per kind.
 *
 * The room for new tickets: monsters and chests together hold at most 30% of the free land, at least 2, at most 40 tickets in all.
 *
 * @category Monsters/Spawning
 * @order 5
 */
export const ticketCap = (ctx: BankContext): number => {
	const free = freeLand(ctx.tilesOwned, 1, ctx.lakesOwned, ctx.buildingsOwned, ctx.castleLevel);
	return Math.min(TICKET_CAP, Math.max(SPAWN_LIMIT.minAllowed, Math.floor(free * SPAWN_LIMIT.maxFraction)));
};

const ticketRoom = (bank: TicketBank, ctx: BankContext): number => Math.max(0, ticketCap(ctx) - ticketCount(bank));

const monsterThreshold = (bank: TicketBank): number => (bank.monstersMinted === 0 ? COMBAT.spawn.firstSec : COMBAT.spawn.intervalSec);

/** Monsters waiting (normal monsters and the boss), placed or not. */
const monsterCount = (bank: TicketBank): number => bank.monsters.length;

/** Whether another normal monster / the boss can come: the map has a tile for it that no waiting monster has taken. */
const monsterSiteFree = (bank: TicketBank): boolean => !!bank.sites && monsterCount(bank) < bank.sites.monster;
const bossSiteFree = (bank: TicketBank): boolean => !!bank.sites && monsterCount(bank) < bank.sites.boss;

export interface Minted {
	chests: ChestTicket[];
	monsters: MonsterTicket[];
	boss: MonsterTicket | null;
}

/**
 * Runs the timers for `dtSec` seconds and mints the tickets that come due, in the order they come (a chest every ~10 minutes
 * (shorter with Luck), a normal monster every 15, the first after 2, a boss every 3 hours while none waits), as long as there is room.
 * With no room the chest and monster timers sit at 0, like the client's own timers. `rollFor(kind, n)` gives the random source of ticket
 * `n` (the server seals it with a secret; tests pass a seeded one) and decides whether a monster is golden.
 *
 * `realDtSec` is the real time the `dtSec` stand for: an absence is credited at a share of its length (the efficiency), but the
 * tickets are stamped across the whole real stretch so that they have the ages they would have had.
 *
 * Where and when monsters appear (server only).
 *
 * - **Timers** (`COMBAT.spawn`): the first normal monster 120 s after the run starts, then one per 900 s; one boss at a time, 10,800 s after the last one left (or after the start). The timers pause when the map has no room or no free tile for it.
 * - **Room**: monsters and chests together hold at most 30% of the free tiles, at least 2, at most 40 tickets ({@link ticketCap}, `SPAWN_LIMIT`, `TICKET_CAP`).
 * - **Golden (lucky) monsters**: chance `min(10%, 2% + 0.05% x Luck)` per new normal monster; a kill pays x3 gold, XP and hide and adds one guaranteed gear roll (`LUCK.goldenMonster`). Bosses are never golden.
 *
 * @category Monsters/Spawning
 * @order 1
 */
export const advanceBank = (
	bank: TicketBank,
	dtSec: number,
	ctx: BankContext,
	rollFor: (kind: TicketKind, n: number) => Rng,
	options: { realDtSec?: number } = {},
): { bank: TicketBank; minted: Minted } => {
	const next: TicketBank = { ...bank, chests: [...bank.chests], monsters: [...bank.monsters] };
	const minted: Minted = { chests: [], monsters: [], boss: null };
	const dt = Number.isFinite(dtSec) ? Math.max(0, dtSec) : 0;
	const scale = dt > 0 ? (options.realDtSec ?? dt) / dt : 1;
	const start = bank.accAt;
	const chestEvery = chestIntervalSec(ctx.luck);
	let used = 0;

	// every pass either mints a ticket (room shrinks) or uses up the time, so this ends
	for (let guard = 0; guard < 1000 && used < dt; guard++) {
		const monstersAllowed = monsterSiteFree(next);
		const bossAllowed = !bossOf(next) && bossSiteFree(next);
		if (ticketRoom(next, ctx) <= 0) {
			next.chestAcc = 0;
			next.monsterAcc = 0;
			break;
		}
		const chestLeft = Math.max(0, chestEvery - next.chestAcc);
		const monsterLeft = monstersAllowed ? Math.max(0, monsterThreshold(next) - next.monsterAcc) : Infinity;
		const bossLeft = bossAllowed ? Math.max(0, COMBAT.spawn.bossIntervalSec - next.bossAcc) : Infinity;
		const step = Math.min(chestLeft, monsterLeft, bossLeft, dt - used);
		next.chestAcc += step;
		if (monstersAllowed) next.monsterAcc += step;
		else next.monsterAcc = 0; // no free tile: the monster timer waits at 0, like with no room
		if (bossAllowed) next.bossAcc += step;
		used += step;
		const at = start + used * scale;

		if (next.chestAcc >= chestEvery - 1e-9 && ticketRoom(next, ctx) > 0) {
			next.chestAcc = 0;
			const chest = { n: next.nextN++, at };
			next.chests.push(chest);
			minted.chests.push(chest);
		}
		if (monstersAllowed && next.monsterAcc >= monsterThreshold(next) - 1e-9 && ticketRoom(next, ctx) > 0) {
			const n = next.nextN++;
			const lucky = rollFor('monster', n)() < goldenMonsterChance(ctx.luck);
			const ticket: MonsterTicket = { n, at, kind: 'normal', lucky };
			next.monsterAcc = 0;
			next.monstersMinted++;
			next.monsters.push(ticket);
			minted.monsters.push(ticket);
		}
		if (bossAllowed && !bossOf(next) && bossSiteFree(next) && next.bossAcc >= COMBAT.spawn.bossIntervalSec - 1e-9 && ticketRoom(next, ctx) > 0) {
			const ticket: MonsterTicket = { n: next.nextN++, at, kind: 'boss', lucky: false };
			next.bossAcc = 0;
			next.monsters.push(ticket);
			minted.boss = ticket;
		}
	}
	next.accAt = start + dt * scale;
	return { bank: next, minted };
};

/** Takes the chest standing on this tile. Null when there is none: a click on a tile without a real chest opens nothing. */
export const takeChestAt = (bank: TicketBank, x: number, y: number): { bank: TicketBank; ticket: ChestTicket } | null => {
	const ticket = bank.chests.find((chest) => chest.x === x && chest.y === y);
	if (!ticket) return null;
	return { bank: { ...bank, chests: bank.chests.filter((chest) => chest.n !== ticket.n) }, ticket };
};

/** Takes the monster ticket numbered `n` (a kill or a dismissal). Null when there is none. */
export const takeMonster = (bank: TicketBank, n: number): { bank: TicketBank; ticket: MonsterTicket; kind: MonsterKind } | null => {
	const ticket = bank.monsters.find((monster) => monster.n === n);
	if (!ticket) return null;
	const rest = bank.monsters.filter((monster) => monster.n !== n);
	return { bank: { ...bank, monsters: rest, ...(ticket.kind === 'boss' ? { bossAcc: 0 } : {}) }, ticket, kind: ticket.kind };
};

/** Seconds until the next ticket of any kind is due, or null when the map is full (nothing is coming until something is opened or killed). */
export const secondsToNext = (bank: TicketBank, ctx: BankContext): number | null => {
	if (ticketRoom(bank, ctx) <= 0) return null;
	const left = [Math.max(0, chestIntervalSec(ctx.luck) - bank.chestAcc)];
	if (monsterSiteFree(bank)) left.push(Math.max(0, monsterThreshold(bank) - bank.monsterAcc));
	if (!bossOf(bank) && bossSiteFree(bank)) left.push(Math.max(0, COMBAT.spawn.bossIntervalSec - bank.bossAcc));
	return Math.min(...left);
};

/**
 * Reads a bank as stored in `player_ledger.bank`. Rows written before the new chapter kept normal monsters in a `rats` list and the boss in a
 * `king` slot (with `ratAcc`, `kingAcc`, `ratsMinted` and `sites.rat` / `sites.king`); they are turned into the single `monsters` list here, so this
 * can be deployed before the reset and no in-flight monster is lost. TEMPORARY: delete this reader after the new chapter reset (IDL-253) has run and no old row is left.
 */
export const upgradeStoredBank = (raw: unknown, nowSec = 0): TicketBank => {
	const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const base = emptyBank(nowSec);
	if (!('rats' in row) && !('king' in row) && !('ratAcc' in row) && !('ratsMinted' in row)) return { ...base, ...(row as Partial<TicketBank>) };
	const { rats, king, ratAcc, kingAcc, ratsMinted, sites, ...rest } = row as Record<string, unknown> & {
		sites?: { rat?: number; king?: number; chest?: number };
	};
	const old = Array.isArray(rats) ? (rats as MonsterTicket[]) : [];
	const monsters: MonsterTicket[] = [
		...old.map((ticket) => ({ ...ticket, kind: 'normal' as const })),
		...(king && typeof king === 'object' ? [{ ...(king as MonsterTicket), kind: 'boss' as const }] : []),
	];
	return {
		...base,
		...(rest as Partial<TicketBank>),
		monsters,
		monsterAcc: typeof ratAcc === 'number' ? ratAcc : 0,
		bossAcc: typeof kingAcc === 'number' ? kingAcc : 0,
		monstersMinted: typeof ratsMinted === 'number' ? ratsMinted : monsters.length > 0 ? 1 : 0,
		...(sites ? { sites: { monster: sites.rat ?? 0, boss: sites.king ?? 0, ...(sites.chest !== undefined ? { chest: sites.chest } : {}) } } : {}),
	};
};
