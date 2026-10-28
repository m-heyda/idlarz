import { COMBAT } from '@/config/combatConfig';
import { SPAWN_LIMIT } from '@/config/gameConfig';
import { chestIntervalSec, luckyRatChance } from '@/lib/luck';
import type { Rng } from '@/lib/rng';
import { wardTiles } from '@/lib/spawnLimits';

// The spawn bank. For a signed-in player the SERVER decides when a chest or a monster has appeared (from its own clock) and what is in
// it; the browser only places the picture on the map. A "ticket" is the server's record of one chest or monster that is waiting to be
// opened or killed: without a ticket a chest opens empty and a kill pays nothing, so forged chests and kills earn nothing.
//
// Everything here is pure and works in seconds, so the same maths runs for a few seconds of play and for eight hours away, and is
// unit-tested without a database.

/** Chests and monsters together that can wait at once, whatever the size of the map (keeps the stored row tiny). */
export const TICKET_CAP = 40;

/** What `kind` of ticket: a chest, a rat or the Rat King (a boss: one at a time). */
export type TicketKind = 'chest' | 'rat' | 'king';

export interface MonsterTicket {
	/** The ticket's number (unique for the run): the monster on the map carries it, a kill names it */
	n: number;
	/** When it appeared (epoch seconds, server clock): its age sets the level it may have grown to */
	at: number;
	/** A lucky rat (gold tint, bigger reward); decided here, never by the client */
	lucky: boolean;
}

export interface TicketBank {
	/** Seconds the timers have run towards the next chest / rat / king (they stop while the map is full) */
	chestAcc: number;
	ratAcc: number;
	kingAcc: number;
	/** The server clock (epoch seconds) the timers were last brought up to */
	accAt: number;
	/** Waiting chests: when each appeared */
	chests: number[];
	rats: MonsterTicket[];
	king: MonsterTicket | null;
	/** The number of the next monster ticket, and how many rats this run has had (the first one comes sooner) */
	nextN: number;
	ratsMinted: number;
}

/** What decides how many tickets there can be and how fast they come: the last accepted save's land and the player's Luck. */
export interface BankContext {
	luck: number;
	tilesOwned: number;
	buildingsOwned: number;
	castleLevel: number;
}

export const emptyBank = (nowSec: number): TicketBank => ({
	chestAcc: 0,
	ratAcc: 0,
	kingAcc: 0,
	accAt: nowSec,
	chests: [],
	rats: [],
	king: null,
	nextN: 1,
	ratsMinted: 0,
});

export const ticketCount = (bank: TicketBank): number => bank.chests.length + bank.rats.length + (bank.king ? 1 : 0);

/**
 * How many more tickets may wait: the same share of the free land as the client's own spawn limit (monsters and chests together),
 * estimated from the owned tiles because the server never opens the map, and never more than `TICKET_CAP` per kind.
 */
export const ticketCap = (ctx: BankContext): number => {
	const free = Math.max(0, ctx.tilesOwned - 1 - ctx.buildingsOwned - wardTiles(ctx.castleLevel));
	return Math.min(TICKET_CAP, Math.max(SPAWN_LIMIT.minAllowed, Math.floor(free * SPAWN_LIMIT.maxFraction)));
};

export const ticketRoom = (bank: TicketBank, ctx: BankContext): number => Math.max(0, ticketCap(ctx) - ticketCount(bank));

const ratThreshold = (bank: TicketBank): number => (bank.ratsMinted === 0 ? COMBAT.spawn.firstSec : COMBAT.spawn.intervalSec);

export interface Minted {
	chests: number[];
	rats: MonsterTicket[];
	king: MonsterTicket | null;
}

/**
 * Runs the timers for `dtSec` seconds and mints the tickets that come due, in the order they come (a chest every ~10 minutes
 * (shorter with Luck), a rat every 15, the first after 2, a King every 3 hours while none waits), as long as there is room.
 * With no room the chest and rat timers sit at 0, like the client's own timers. `rollFor(kind, n)` gives the random source of ticket
 * `n` (the server seals it with a secret; tests pass a seeded one) and decides whether a rat is lucky.
 *
 * `realDtSec` is the real time the `dtSec` stand for: an absence is credited at a share of its length (the efficiency), but the
 * tickets are stamped across the whole real stretch so that they have the ages they would have had.
 */
export const advanceBank = (
	bank: TicketBank,
	dtSec: number,
	ctx: BankContext,
	rollFor: (kind: TicketKind, n: number) => Rng,
	options: { realDtSec?: number } = {}
): { bank: TicketBank; minted: Minted } => {
	const next: TicketBank = { ...bank, chests: [...bank.chests], rats: [...bank.rats] };
	const minted: Minted = { chests: [], rats: [], king: null };
	const dt = Number.isFinite(dtSec) ? Math.max(0, dtSec) : 0;
	const scale = dt > 0 ? (options.realDtSec ?? dt) / dt : 1;
	const start = bank.accAt;
	const chestEvery = chestIntervalSec(ctx.luck);
	const ratsAllowed = ctx.tilesOwned >= COMBAT.spawn.minOwnedTiles;
	let used = 0;

	// every pass either mints a ticket (room shrinks) or uses up the time, so this ends
	for (let guard = 0; guard < 1000 && used < dt; guard++) {
		if (ticketRoom(next, ctx) <= 0) {
			next.chestAcc = 0;
			next.ratAcc = 0;
			break;
		}
		const chestLeft = Math.max(0, chestEvery - next.chestAcc);
		const ratLeft = ratsAllowed ? Math.max(0, ratThreshold(next) - next.ratAcc) : Infinity;
		const kingLeft = next.king || !ratsAllowed ? Infinity : Math.max(0, COMBAT.spawn.bossIntervalSec - next.kingAcc);
		const step = Math.min(chestLeft, ratLeft, kingLeft, dt - used);
		next.chestAcc += step;
		if (ratsAllowed) next.ratAcc += step;
		if (ratsAllowed && !next.king) next.kingAcc += step;
		used += step;
		const at = start + used * scale;

		if (next.chestAcc >= chestEvery - 1e-9 && ticketRoom(next, ctx) > 0) {
			next.chestAcc = 0;
			next.chests.push(at);
			minted.chests.push(at);
		}
		if (ratsAllowed && next.ratAcc >= ratThreshold(next) - 1e-9 && ticketRoom(next, ctx) > 0) {
			const n = next.nextN++;
			const lucky = rollFor('rat', n)() < luckyRatChance(ctx.luck);
			const ticket = { n, at, lucky };
			next.ratAcc = 0;
			next.ratsMinted++;
			next.rats.push(ticket);
			minted.rats.push(ticket);
		}
		if (ratsAllowed && !next.king && next.kingAcc >= COMBAT.spawn.bossIntervalSec - 1e-9 && ticketRoom(next, ctx) > 0) {
			const ticket = { n: next.nextN++, at, lucky: false };
			next.kingAcc = 0;
			next.king = ticket;
			minted.king = ticket;
		}
	}
	next.accAt = start + dt * scale;
	return { bank: next, minted };
};

/** Takes the oldest waiting chest (it was the first on the map). Null when none waits. */
export const takeChest = (bank: TicketBank): { bank: TicketBank; at: number } | null => {
	if (bank.chests.length === 0) return null;
	const [at, ...rest] = bank.chests;
	return { bank: { ...bank, chests: rest }, at };
};

/** Takes the monster ticket numbered `n` (a kill or a dismissal). Null when there is none. */
export const takeMonster = (bank: TicketBank, n: number): { bank: TicketBank; ticket: MonsterTicket; kind: 'rat' | 'king' } | null => {
	if (bank.king?.n === n) return { bank: { ...bank, king: null, kingAcc: 0 }, ticket: bank.king, kind: 'king' };
	const ticket = bank.rats.find((rat) => rat.n === n);
	if (!ticket) return null;
	return { bank: { ...bank, rats: bank.rats.filter((rat) => rat.n !== n) }, ticket, kind: 'rat' };
};

/** Seconds until the next ticket of any kind is due, or null when the map is full (nothing is coming until something is opened or killed). */
export const secondsToNext = (bank: TicketBank, ctx: BankContext): number | null => {
	if (ticketRoom(bank, ctx) <= 0) return null;
	const ratsAllowed = ctx.tilesOwned >= COMBAT.spawn.minOwnedTiles;
	const left = [Math.max(0, chestIntervalSec(ctx.luck) - bank.chestAcc)];
	if (ratsAllowed) left.push(Math.max(0, ratThreshold(bank) - bank.ratAcc));
	if (ratsAllowed && !bank.king) left.push(Math.max(0, COMBAT.spawn.bossIntervalSec - bank.kingAcc));
	return Math.min(...left);
};
