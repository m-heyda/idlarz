import { GEMS_CAP } from '@/config/gameConfig';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { rollChestLoot } from '@/lib/chests';
import { rollKillLoot } from '@/lib/loot';
import { rollGemFind } from '@/lib/luck';
import { levelAtAge, maxSpawnLevel } from '@/lib/monsters';
import type { Rng } from '@/lib/rng';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { sealedRng } from '@/lib/offline/seal';
import { bankContext, publicTickets, withLedger, type ServiceDeps } from '@/lib/offline/service';
import { advanceBank, secondsToNext, takeChest, takeMonster, type TicketBank } from '@/lib/offline/tickets';
import type { ChestReward, KillReward, SyncResult } from '@/lib/offline/types';

// The server's side of play while the player is here: spawns, chests and kills. The server mints the tickets from its own clock and
// rolls the contents from a secret. Each call is one compare-and-swap on the ledger, carries an idempotency key (a repeated request
// gets the stored answer) and refuses to work when an absence has not been claimed yet (the client claims first, see claimOffline),
// so time spent away is never credited at full speed.

/** An online call is refused with `claim_first` when more than this long passed since the player was last seen. */
const UNCLAIMED_SEC = 900;
/** The most time one online call will run the spawn timers forward. */
const MAX_ONLINE_STRETCH_SEC = 7200;

export type Online<T> = { kind: 'no_save' } | { kind: 'claim_first' } | { kind: 'ok'; value: T };

type Body<T> = (ledger: Ledger, stored: StoredSave, bank: TicketBank) => { ledger: Ledger; value: T };

const onlineStep = async <T>(deps: ServiceDeps, userId: string, key: string | null, nowMs: number, body: Body<T>): Promise<Online<T>> => {
	const done = await withLedger(deps, userId, nowMs, (ledger, stored): { ledger: Ledger; result: { claimFirst: true } | { claimFirst: false; value: T } } => {
		if (key && ledger.lastKey === key && ledger.lastResult) return { ledger, result: { claimFirst: false, value: ledger.lastResult as T } };
		const anchorMs = Math.max(ledger.anchorAt, stored.serverSavedAt);
		if ((nowMs - anchorMs) / 1000 > UNCLAIMED_SEC) return { ledger, result: { claimFirst: true } };

		const nowSec = nowMs / 1000;
		const rollFor = (kind: string, n: number): Rng => sealedRng(deps.secret, userId, ledger.runId, kind, n);
		const dt = Math.min(MAX_ONLINE_STRETCH_SEC, Math.max(0, nowSec - ledger.bank.accAt));
		const bank = { ...advanceBank(ledger.bank, dt, bankContext(stored), rollFor).bank, accAt: nowSec };
		const out = body(ledger, stored, bank);
		return { ledger: { ...out.ledger, anchorAt: nowMs, lastKey: key, lastResult: key ? out.value : null }, result: { claimFirst: false, value: out.value } };
	});
	if (done.kind === 'no_save') return done;
	return done.result.claimFirst ? { kind: 'claim_first' } : { kind: 'ok', value: done.result.value };
};

/** The chests and monsters that have appeared by now, and when the next one is due. */
export const syncTickets = (deps: ServiceDeps, userId: string, nowMs: number): Promise<Online<SyncResult>> =>
	onlineStep(deps, userId, null, nowMs, (ledger, stored, bank) => ({
		ledger: { ...ledger, bank },
		value: { tickets: publicTickets(bank), serverNowSec: nowMs / 1000, gemsTotal: ledger.gems, nextInSec: secondsToNext(bank, bankContext(stored)) },
	}));

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

/** What the last accepted save says the player owns (for "prefer a piece you do not have") and their bad-luck counters. */
const rollInputs = (stored: StoredSave): { owned: string[]; pity: Record<string, number> } => {
	const equipment = asRecord(stored.core.equipment) as Record<string, { base?: string } | undefined>;
	const bag = Array.isArray(stored.core.bag) ? (stored.core.bag as ({ item?: { base?: string }; id?: string } | null)[]) : [];
	const owned = [...Object.values(equipment).map((item) => item?.base), ...bag.map((slot) => slot?.item?.base ?? slot?.id)].filter((id): id is string => typeof id === 'string');
	const pity: Record<string, number> = {};
	for (const [id, misses] of Object.entries(asRecord(stored.core.lootPity))) if (typeof misses === 'number' && Number.isFinite(misses)) pity[id] = misses;
	return { owned, pity };
};

/** Opens one waiting chest. The reward is sealed on the number of chests opened this run, so reloading or retrying cannot roll it again. */
export const redeemChest = (deps: ServiceDeps, userId: string, key: string, nowMs: number): Promise<Online<ChestReward>> =>
	onlineStep(deps, userId, key, nowMs, (ledger, stored, bank): { ledger: Ledger; value: ChestReward } => {
		const nowSec = nowMs / 1000;
		const taken = takeChest(bank);
		if (!taken) {
			return { ledger: { ...ledger, bank }, value: { ok: false, reason: 'no_ticket', tickets: publicTickets(bank), serverNowSec: nowSec, gemsTotal: ledger.gems } };
		}
		const { luck, goldFind } = stored.summary.derived;
		const ordChest = ledger.ordChest + 1;
		const rng = sealedRng(deps.secret, userId, ledger.runId, 'chest', ordChest);
		const loot = rollChestLoot({ rates: stored.summary.rates, luck, goldFind, bag: [], castleLevel: stored.summary.castleLevel, autoSellUpTo: null }, rng);
		const gems = rollGemFind(luck, rng);

		const granted: Partial<GrantTotals> = { gems };
		if (loot.kind === 'gold' || loot.kind === 'boost') granted.gold = loot.gold;
		else if (loot.kind === 'bundle') for (const item of loot.items) granted[item.resource] = (granted[item.resource] ?? 0) + item.amount;
		else if (loot.kind === 'xp') granted.xp = loot.xp;
		const next: Ledger = { ...ledger, bank: taken.bank, ordChest, gems: Math.min(GEMS_CAP, ledger.gems + gems), granted: addTotals(ledger.granted, granted) };
		return { ledger: next, value: { ok: true, loot, gems, gemsTotal: next.gems, tickets: publicTickets(taken.bank), serverNowSec: nowSec } };
	});

/**
 * Pays one kill against the ticket numbered `n`, or (with `dismiss`) takes the ticket away without a reward. The level the reward is
 * rolled at is the one the client says, never higher than a monster of that ticket's age could have reached on this land.
 */
export const redeemKill = (deps: ServiceDeps, userId: string, key: string, request: { n: number; level: number; dismiss?: boolean }, nowMs: number): Promise<Online<KillReward>> =>
	onlineStep(deps, userId, key, nowMs, (ledger, stored, bank): { ledger: Ledger; value: KillReward } => {
		const nowSec = nowMs / 1000;
		const taken = takeMonster(bank, request.n);
		if (!taken) {
			return { ledger: { ...ledger, bank }, value: { ok: false, reason: 'no_ticket', tickets: publicTickets(bank), serverNowSec: nowSec, gemsTotal: ledger.gems } };
		}
		if (request.dismiss) {
			return { ledger: { ...ledger, bank: taken.bank }, value: { ok: true, dismissed: true, tickets: publicTickets(taken.bank), serverNowSec: nowSec, gemsTotal: ledger.gems } };
		}
		const type = taken.kind === 'king' ? 'ratKing' : 'rat';
		const reachable = levelAtAge(maxSpawnLevel(type, stored.summary.castleLevel, stored.summary.tilesOwned), nowSec - taken.ticket.at);
		const level = Math.max(1, Math.min(reachable, Math.floor(Number.isFinite(request.level) ? request.level : 1)));
		const ordKill = ledger.ordKill + 1;
		const rng = sealedRng(deps.secret, userId, ledger.runId, 'kill', ordKill);
		const { luck, goldFind } = stored.summary.derived;
		const { owned, pity } = rollInputs(stored);
		const loot = rollKillLoot(
			{ type, level },
			{ goldPerSec: stored.summary.rates.gold, xpPerSec: stored.summary.rates.xp * (1 + stored.summary.xpGainPct / 100), luck, goldFind, owned, pity, lucky: taken.ticket.lucky },
			rng
		);
		const next: Ledger = { ...ledger, bank: taken.bank, ordKill, granted: addTotals(ledger.granted, { gold: loot.gold, xp: loot.xp }) };
		return {
			ledger: next,
			value: { ok: true, dismissed: false, level, lucky: taken.ticket.lucky, gold: loot.gold, xp: loot.xp, items: loot.items, pity: loot.pity, tickets: publicTickets(taken.bank), serverNowSec: nowSec, gemsTotal: ledger.gems },
		};
	});
