import { GEMS_CAP } from '@/config/gameConfig';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { rollChestLoot } from '@/lib/chests';
import { rollGemFind } from '@/lib/luck';
import type { Rng } from '@/lib/rng';
import { combatView, dismissTicket, runCombat, type CombatEnv } from '@/lib/offline/fight';
import type { CombatCommand } from '@/lib/offline/fightTypes';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { sealedRng } from '@/lib/offline/seal';
import { UNCLAIMED_SEC, bankContext, lookAtMap, mapLoader, publicTickets, withLedger, type ServiceDeps } from '@/lib/offline/service';
import { advanceBank, secondsToNext, takeChest, type TicketBank } from '@/lib/offline/tickets';
import type { ChestReward, FightReply, SyncResult } from '@/lib/offline/types';

// The server's side of play while the player is here: spawns, chests and fights. The server mints the tickets from its own clock, puts
// the monsters on the map, rolls the contents from a secret and runs every fight (see fight.ts). Each call is one compare-and-swap on the
// ledger, carries an idempotency key (a repeated request gets the stored answer) and refuses to work when an absence has not been claimed
// yet (the client claims first, see claimOffline), so time spent away is never credited at full speed.

/** The most time one online call will run the spawn timers forward. */
const MAX_ONLINE_STRETCH_SEC = 7200;

export type Online<T> = { kind: 'no_save' } | { kind: 'claim_first' } | { kind: 'ok'; value: T };

/** What a step gets: the ledger with its bank brought up to now (and the monsters placed), the save, and the clock. */
interface StepContext {
	ledger: Ledger;
	stored: StoredSave;
	bank: TicketBank;
	nowSec: number;
	env: CombatEnv;
	/** Looks at the land again (for monsters the step itself made appear) */
	place: (bank: TicketBank) => Promise<TicketBank>;
}

type Body<T> = (ctx: StepContext) => { ledger: Ledger; value: T } | Promise<{ ledger: Ledger; value: T }>;

const onlineStep = async <T>(deps: ServiceDeps, userId: string, key: string | null, nowMs: number, body: Body<T>): Promise<Online<T>> => {
	const loadMap = mapLoader(deps, userId);
	const done = await withLedger(deps, userId, nowMs, async (ledger, stored): Promise<{ ledger: Ledger; result: { claimFirst: true } | { claimFirst: false; value: T } }> => {
		if (key && ledger.lastKey === key && ledger.lastResult) return { ledger, result: { claimFirst: false, value: ledger.lastResult as T } };
		const anchorMs = Math.max(ledger.anchorAt, stored.serverSavedAt);
		if ((nowMs - anchorMs) / 1000 > UNCLAIMED_SEC) return { ledger, result: { claimFirst: true } };

		const nowSec = nowMs / 1000;
		const rollFor = (kind: string, n: number): Rng => sealedRng(deps.secret, userId, ledger.runId, kind, n);
		const place = (bank: TicketBank) => lookAtMap(loadMap, bank, stored, rollFor);
		const dt = Math.min(MAX_ONLINE_STRETCH_SEC, Math.max(0, nowSec - ledger.bank.accAt));
		const looked = await place(ledger.bank);
		const advanced = { ...advanceBank(looked, dt, bankContext(stored), rollFor).bank, accAt: nowSec };
		const bank = await place(advanced);
		const env: CombatEnv = { secret: deps.secret, userId, stored, nowSec };
		const out = await body({ ledger: { ...ledger, bank }, stored, bank, nowSec, env, place });
		// a poll (no key) keeps the record of the last keyed request: its answer may still have to be replayed for a retry
		return { ledger: { ...out.ledger, anchorAt: nowMs, ...(key ? { lastKey: key, lastResult: out.value } : {}) }, result: { claimFirst: false, value: out.value } };
	});
	if (done.kind === 'no_save') return done;
	return done.result.claimFirst ? { kind: 'claim_first' } : { kind: 'ok', value: done.result.value };
};

/** Carries the player's combat up to now, then the monsters it killed are paid and gone: the tickets in the answer are the ones that remain. */
const withCombat = (ctx: StepContext, since: number | undefined, ask: Parameters<typeof runCombat>[2] = {}) => {
	const ran = runCombat(ctx.ledger, ctx.env, { ...ask, ack: since });
	const view = combatView(ran.ledger, ctx.env, since ?? ran.ledger.combat?.eventNo ?? 0, ran.behind, secondsToNext(ran.ledger.bank, bankContext(ctx.stored)));
	return { ledger: ran.ledger, view };
};

/** The chests and monsters that have appeared by now, when the next one is due, and the state of the player's combat. */
export const syncTickets = (deps: ServiceDeps, userId: string, nowMs: number, since?: number): Promise<Online<SyncResult>> =>
	onlineStep(deps, userId, null, nowMs, (ctx) => {
		const { ledger, view } = withCombat(ctx, since);
		return {
			ledger,
			value: { tickets: publicTickets(ledger.bank, ledger.ordChest), serverNowSec: ctx.nowSec, gemsTotal: ledger.gems, nextInSec: secondsToNext(ledger.bank, bankContext(ctx.stored)), combat: view },
		};
	});

/** Opens one waiting chest. The reward is sealed on the number of chests opened this run, so reloading or retrying cannot roll it again. */
export const redeemChest = (deps: ServiceDeps, userId: string, key: string, nowMs: number): Promise<Online<ChestReward>> =>
	onlineStep(deps, userId, key, nowMs, ({ ledger, stored, bank, nowSec }): { ledger: Ledger; value: ChestReward } => {
		const taken = takeChest(bank);
		if (!taken) {
			return { ledger: { ...ledger, bank }, value: { ok: false, reason: 'no_ticket', tickets: publicTickets(bank, ledger.ordChest), serverNowSec: nowSec, gemsTotal: ledger.gems } };
		}
		const { luck, goldFind } = stored.summary.derived;
		const ordChest = ledger.ordChest + 1;
		const rng = sealedRng(deps.secret, userId, ledger.runId, 'chest', ordChest);
		const rolled = rollChestLoot({ rates: stored.summary.rates, luck, goldFind, bag: [], castleLevel: stored.summary.castleLevel, autoSellUpTo: null }, rng);
		// an XP chest pays like every other XP the player earns: with the XP bonus (kills and the passive XP already do)
		const loot = rolled.kind === 'xp' ? { ...rolled, xp: Math.floor(rolled.xp * (1 + stored.summary.xpGainPct / 100)) } : rolled;
		const gems = rollGemFind(luck, rng);

		const granted: Partial<GrantTotals> = { gems };
		if (loot.kind === 'gold' || loot.kind === 'boost') granted.gold = loot.gold;
		else if (loot.kind === 'bundle') for (const item of loot.items) granted[item.resource] = (granted[item.resource] ?? 0) + item.amount;
		else if (loot.kind === 'xp') granted.xp = loot.xp;
		const next: Ledger = { ...ledger, bank: taken.bank, ordChest, gems: Math.min(GEMS_CAP, ledger.gems + gems), granted: addTotals(ledger.granted, granted) };
		return { ledger: next, value: { ok: true, loot, gems, gemsTotal: next.gems, tickets: publicTickets(taken.bank, ordChest), serverNowSec: nowSec } };
	});

export type FightRequest =
	| { action: 'sync'; since?: number }
	| { action: 'use'; command: CombatCommand; since?: number }
	| { action: 'auto'; autoBattle?: boolean; autoUse?: boolean; since?: number }
	| { action: 'dismiss'; n: number; since?: number };

/**
 * Everything the browser can ask about combat. `sync` carries the fight forward and answers; `use` is a hotkey (a potion or a skill) or a
 * click on a monster (`fight`: starts the fight against it, with auto-battle on or off) and
 * `auto` flips auto-battle or auto-use, both applied at the server's clock after the fight is brought up to date; `dismiss` takes a
 * monster off the map with no reward (and ends the fight against it).
 */
export const fightStep = (deps: ServiceDeps, userId: string, key: string | null, request: FightRequest, nowMs: number): Promise<Online<FightReply>> =>
	onlineStep(deps, userId, key, nowMs, (ctx): Promise<{ ledger: Ledger; value: FightReply }> | { ledger: Ledger; value: FightReply } => {
		const reply = (ledger: Ledger, view: FightReply['combat'], accepted: boolean): { ledger: Ledger; value: FightReply } => ({
			ledger,
			value: { combat: view, tickets: publicTickets(ledger.bank, ledger.ordChest), serverNowSec: ctx.nowSec, gemsTotal: ledger.gems, accepted },
		});
		if (request.action === 'dismiss') {
			const ran = runCombat(ctx.ledger, ctx.env, { ack: request.since });
			const dismissed = dismissTicket(ran.ledger, ctx.env, request.n);
			const view = combatView(dismissed.ledger, ctx.env, request.since ?? dismissed.ledger.combat?.eventNo ?? 0, ran.behind, secondsToNext(dismissed.ledger.bank, bankContext(ctx.stored)));
			return reply(dismissed.ledger, view, dismissed.ok);
		}
		const ask = request.action === 'use' ? { commands: [request.command] } : request.action === 'auto' ? { autoBattle: request.autoBattle, autoUse: request.autoUse } : {};
		const before = ctx.ledger.combat?.eventNo ?? 0;
		const { ledger, view } = withCombat(ctx, request.since, ask);
		// a hotkey is "accepted" when it did something (an event was added after the fight was brought up to date); a click on a monster, when it
		// opened a fight against that monster (an automatic engage does not count: it is another monster or was there before)
		const done = (event: { no: number; kind: string; n?: number }) =>
			event.no > before &&
			(request.action === 'use' && request.command.kind === 'fight'
				? event.kind === 'engage' && event.n === request.command.n
				: event.kind === 'potion' || event.kind === 'heal' || event.kind === 'stun' || event.kind === 'resist');
		const accepted = request.action !== 'use' || (ledger.combat?.log.some(done) ?? false);
		return reply(ledger, view, accepted);
	});
