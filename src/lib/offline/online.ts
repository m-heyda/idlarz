import { GEMS_CAP } from '@/config/economy';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { rollChestLoot } from '@/lib/chests';
import { rollGemFind } from '@/lib/luck';
import type { Rng } from '@/lib/rng';
import { clearBuffsOnRebirth } from '@/lib/buffs';
import { applyUse } from '@/lib/offline/consumables';
import { combatView, dismissTicket, runCombat, type CombatEnv } from '@/lib/offline/fight';
import type { CombatCommand, QueueResult } from '@/lib/offline/fightTypes';
import { addTotals, type GrantTotals, type Ledger } from '@/lib/offline/ledger';
import { applyOp, needsNoFight, receiveInto, sellContextOf, type InventoryOp } from '@/lib/offline/inventory';
import { sealedRng } from '@/lib/offline/seal';
import { recordChest } from '@/lib/offline/stats';
import { UNCLAIMED_SEC, bankContext, lookAtMap, mapLoader, publicTickets, withLedger, type ServiceDeps, type StepOutcome } from '@/lib/offline/service';
import { advanceBank, secondsToNext, takeChestAt, type TicketBank } from '@/lib/offline/tickets';
import { applyCancel, applyClaim, applyClaimAll, applyCraft, applyWithdraw, type CraftEnv } from '@/lib/offline/craft';
import type { ChestReward, CraftReply, FightReply, Inventory, InventoryReply, RebirthReply, SyncResult } from '@/lib/offline/types';
import { rebirthInventory } from '@/lib/offline/inventory';
import { judgeRebirth } from '@/lib/cloudSave/serverRebirth';

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

/** The answer with the player's things attached when the browser's copy (`invVer`) is not the current one. */
const withInventory = <T>(value: T, inv: Inventory | null, invVer: number | undefined): T =>
	inv && inv.ver !== invVer && typeof value === 'object' && value !== null ? { ...value, inv } : value;

const onlineStep = async <T>(deps: ServiceDeps, userId: string, key: string | null, nowMs: number, body: Body<T>, invVer?: number): Promise<Online<T>> => {
	const loadMap = mapLoader(deps, userId);
	const done = await withLedger(deps, userId, nowMs, async (ledger, stored): Promise<StepOutcome<{ claimFirst: true } | { claimFirst: false; value: T }>> => {
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
		return {
			ledger: { ...out.ledger, anchorAt: nowMs, ...(key ? { lastKey: key, lastResult: out.value } : {}) },
			result: { claimFirst: false, value: out.value },
			skipWrite: !key,
		};
	});
	if (done.kind === 'no_save') return done;
	return done.result.claimFirst ? { kind: 'claim_first' } : { kind: 'ok', value: withInventory(done.result.value, done.ledger.inv, invVer) };
};

/** Carries the player's combat up to now, then the monsters it killed are paid and gone: the tickets in the answer are the ones that remain. */
const withCombat = (ctx: StepContext, since: number | undefined, ask: Parameters<typeof runCombat>[2] = {}) => {
	const ran = runCombat(ctx.ledger, ctx.env, { ...ask, ack: since });
	const view = combatView(ran.ledger, ctx.env, since ?? ran.ledger.combat?.eventNo ?? 0, ran.behind, secondsToNext(ran.ledger.bank, bankContext(ctx.stored)));
	return { ledger: ran.ledger, view, queued: ran.queued };
};

/** The chests and monsters that have appeared by now, when the next one is due, and the state of the player's combat. */
export const syncTickets = (deps: ServiceDeps, userId: string, nowMs: number, since?: number, invVer?: number): Promise<Online<SyncResult>> =>
	onlineStep(
		deps,
		userId,
		null,
		nowMs,
		(ctx) => {
			const { ledger, view } = withCombat(ctx, since);
			return {
				ledger,
				value: {
					tickets: publicTickets(ledger.bank, ledger.ordChest),
					serverNowSec: ctx.nowSec,
					gemsTotal: ledger.gems,
					nextInSec: secondsToNext(ledger.bank, bankContext(ctx.stored)),
					combat: view,
				},
			};
		},
		invVer,
	);

/**
 * Opens the waiting chest that stands on tile (x, y); a tile without one gives `no_ticket`. The reward is sealed on the number of
 * chests opened this run, so reloading or retrying cannot roll it again.
 */
export const redeemChest = (
	deps: ServiceDeps,
	userId: string,
	key: string,
	spot: { x: number; y: number },
	nowMs: number,
	invVer?: number,
): Promise<Online<ChestReward>> =>
	onlineStep(
		deps,
		userId,
		key,
		nowMs,
		({ ledger, stored, bank, nowSec }): { ledger: Ledger; value: ChestReward } => {
			const taken = takeChestAt(bank, spot.x, spot.y);
			if (!taken) {
				return {
					ledger: { ...ledger, bank },
					value: { ok: false, reason: 'no_ticket', tickets: publicTickets(bank, ledger.ordChest), serverNowSec: nowSec, gemsTotal: ledger.gems },
				};
			}
			const { luck, goldFind } = stored.summary.derived;
			const ordChest = ledger.ordChest + 1;
			const rng = sealedRng(deps.secret, userId, ledger.runId, 'chest', ordChest);
			const rolled = rollChestLoot(
				{ rates: stored.summary.rates, luck, goldFind, bag: ledger.inv!.bag, castleLevel: stored.summary.castleLevel, autoSellUpTo: ledger.inv!.autoSellUpTo },
				rng,
			);
			// an XP chest pays like every other XP the player earns: with the XP bonus (kills and the passive XP already do)
			const loot = rolled.kind === 'xp' ? { ...rolled, xp: Math.floor(rolled.xp * (1 + stored.summary.xpGainPct / 100)) } : rolled;
			const gems = rollGemFind(luck, rng);

			const granted: Partial<GrantTotals> = { gems };
			if (loot.kind === 'gold' || loot.kind === 'boost') granted.gold = loot.gold;
			else if (loot.kind === 'bundle') for (const item of loot.items) granted[item.resource] = (granted[item.resource] ?? 0) + item.amount;
			else if (loot.kind === 'xp') granted.xp = loot.xp;
			// an item goes into the server's bag (or is sold by the auto-sell filter); the gold of the ones that did not fit is the player's too
			let inv = ledger.inv!;
			let received: { convertedGold: number; autoSold: { count: number; gold: number } } | undefined;
			if (loot.kind === 'item') {
				const result = receiveInto(inv, [loot.drop], sellContextOf(stored.core));
				inv = result.inv;
				received = { convertedGold: result.received.convertedGold, autoSold: result.received.autoSold };
				granted.gold = (granted.gold ?? 0) + received.convertedGold + received.autoSold.gold;
			}
			const next: Ledger = {
				...ledger,
				bank: taken.bank,
				ordChest,
				stats: recordChest(ledger.stats),
				inv,
				gems: Math.min(GEMS_CAP, ledger.gems + gems),
				granted: addTotals(ledger.granted, granted),
			};
			return {
				ledger: next,
				value: {
					ok: true,
					loot,
					gems,
					gemsTotal: next.gems,
					tickets: publicTickets(taken.bank, ordChest),
					serverNowSec: nowSec,
					...(received ? { received } : {}),
				},
			};
		},
		invVer,
	);

/**
 * One of the player's own changes to what they carry (equip, move, sell, buy ...): applied to the ledger's inventory by the same pure functions
 * the browser previews it with. Changes that swap or sell gear are refused while a fight is open (the combat is brought up to now first, so a
 * fight that already ended does not block). A sale's gold is recorded as granted, so the save that holds it passes the checks. The answer is
 * always the inventory as it stands.
 */
export const inventoryStep = (deps: ServiceDeps, userId: string, key: string, op: InventoryOp, nowMs: number): Promise<Online<InventoryReply>> =>
	onlineStep(deps, userId, key, nowMs, (ctx): { ledger: Ledger; value: InventoryReply } => {
		const ran = runCombat(ctx.ledger, ctx.env);
		const ledger = ran.ledger;
		if (op.action === 'use') {
			const used = applyUse(ledger, ctx.env, op.index);
			if (!used.ok) return { ledger, value: { ok: false, gold: 0, count: 0, inv: ledger.inv!, serverNowSec: ctx.nowSec, message: used.message } };
			return { ledger: used.ledger, value: { ok: true, gold: 0, count: 0, inv: used.ledger.inv!, serverNowSec: ctx.nowSec, buffs: used.buffs } };
		}
		const blocked = needsNoFight(op) && !!ledger.combat?.fight;
		const result = blocked ? null : applyOp(ledger.inv!, op, sellContextOf(ctx.stored.core));
		if (!result || !result.ok) return { ledger, value: { ok: false, gold: 0, count: 0, inv: ledger.inv!, serverNowSec: ctx.nowSec } };
		const next: Ledger = { ...ledger, inv: result.inv, granted: result.gold > 0 ? addTotals(ledger.granted, { gold: result.gold }) : ledger.granted };
		return { ledger: next, value: { ok: true, gold: result.gold, count: result.count, inv: result.inv, serverNowSec: ctx.nowSec } };
	});

/** A crafting request: queue (or do) crafts of a recipe, or claim / cancel a running batch by its slot. */
export type CraftRequest =
	| { action?: 'craft'; recipeId: string; count: number }
	| { action: 'claim'; slot: number | 'all' }
	| { action: 'cancel'; slot: number }
	| { action: 'withdraw'; id: string; qty: number };

/**
 * One crafting request (docs/plan/crafting-v0.md): `count` crafts of a recipe are queued as a timed batch (a recipe without a time is done at
 * once), or a batch is claimed (the finished crafts reach the bag or the stock, with their XP) or cancelled (the unfinished part is refunded).
 * The components come out of the ledger's stock; the browser has already paid the resources and the server counts their gold value in
 * `craft.spent`. The answer is always the bag and the crafting state as they stand.
 */
export const craftStep = (deps: ServiceDeps, userId: string, key: string, request: CraftRequest, nowMs: number): Promise<Online<CraftReply>> =>
	onlineStep(deps, userId, key, nowMs, (ctx): { ledger: Ledger; value: CraftReply } => {
		const ledger = ctx.ledger;
		// count 0 only looks: the overlay asks for the crafting state when it opens
		if ('recipeId' in request && request.count === 0)
			return { ledger, value: { ok: true, crafted: 0, inv: ledger.inv!, craft: ledger.craft, serverNowSec: ctx.nowSec } };
		// what a gear craft is rolled with: the sealing secret and the Luck and Intelligence of the last accepted save
		const env: CraftEnv = { secret: deps.secret, userId, luck: ctx.stored.summary.derived.luck, intelligence: ctx.stored.summary.derived.intelligence ?? 0 };
		const result =
			'recipeId' in request
				? applyCraft(ledger.inv!, ledger.craft, request.recipeId, request.count, nowMs)
				: request.action === 'claim'
					? request.slot === 'all'
						? applyClaimAll(ledger.inv!, ledger.craft, nowMs, env)
						: applyClaim(ledger.inv!, ledger.craft, request.slot, nowMs, env)
					: request.action === 'withdraw'
						? applyWithdraw(ledger.inv!, ledger.craft, request.id, request.qty, nowMs)
						: applyCancel(ledger.inv!, ledger.craft, request.slot, nowMs, env);
		const value: CraftReply = {
			ok: result.ok,
			...(result.reason ? { reason: result.reason } : {}),
			crafted: result.ok ? (result.crafted ?? 0) : 0,
			...(result.ok && result.queued ? { queued: result.queued } : {}),
			...(result.ok && result.moved ? { moved: result.moved } : {}),
			...(result.ok && result.refund ? { refund: result.refund } : {}),
			inv: result.inv,
			craft: result.craft,
			serverNowSec: ctx.nowSec,
		};
		return { ledger: result.ok ? { ...ledger, inv: result.inv, craft: result.craft } : ledger, value };
	});

/**
 * The server runs the rebirth (IDL-102): from the last STORED save it checks the requirements, computes the Embers and wipes the bag, the gear
 * and the pity to the starter kit (Pack Rat kept), all in one ledger write, BEFORE the browser starts over and uploads the new run. A modified
 * client can no longer sell the old gear in the seconds before the rebirth save lands, and the save that follows is capped at exactly the
 * Embers the server computed here (`settleEmbers`). Idempotent twice over: the same key replays the same answer, and a second call for the same
 * rebirth (another key) neither wipes again nor pays again, it answers with what the first one recorded in `inv.rebirth`.
 * The browser uploads its save first, so the stored save the server judges is the one the player is looking at.
 */
export const rebirthStep = (deps: ServiceDeps, userId: string, key: string, nowMs: number): Promise<Online<RebirthReply>> =>
	onlineStep(deps, userId, key, nowMs, (ctx): { ledger: Ledger; value: RebirthReply } => {
		const inv = ctx.ledger.inv!;
		const judged = judgeRebirth(ctx.stored.summary, ctx.stored.core.merchantUpgrades as Record<string, number> | undefined);
		// already run for this very rebirth: the record is the answer (the wipe and the gain happen once)
		if (judged.ok && inv.rebirth?.to === judged.to)
			return { ledger: ctx.ledger, value: { ok: true, to: inv.rebirth.to, gain: inv.rebirth.gain, inv, serverNowSec: ctx.nowSec } };
		if (!judged.ok) return { ledger: ctx.ledger, value: { ok: false, reason: judged.reason, to: 0, gain: 0, inv, serverNowSec: ctx.nowSec } };
		const wiped: Inventory = {
			...rebirthInventory(inv, ctx.stored.core.merchantUpgrades, ctx.stored.core.prestige),
			rebirth: { to: judged.to, gain: judged.gain },
		};
		return {
			ledger: { ...ctx.ledger, inv: wiped, buffs: clearBuffsOnRebirth() },
			value: { ok: true, to: judged.to, gain: judged.gain, inv: wiped, serverNowSec: ctx.nowSec },
		};
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
export const fightStep = (
	deps: ServiceDeps,
	userId: string,
	key: string | null,
	request: FightRequest,
	nowMs: number,
	invVer?: number,
): Promise<Online<FightReply>> =>
	onlineStep(
		deps,
		userId,
		key,
		nowMs,
		(ctx): Promise<{ ledger: Ledger; value: FightReply }> | { ledger: Ledger; value: FightReply } => {
			const reply = (ledger: Ledger, view: FightReply['combat'], accepted: boolean, queued?: QueueResult): { ledger: Ledger; value: FightReply } => ({
				ledger,
				value: {
					combat: view,
					tickets: publicTickets(ledger.bank, ledger.ordChest),
					serverNowSec: ctx.nowSec,
					gemsTotal: ledger.gems,
					accepted,
					...(queued ? { queued } : {}),
				},
			});
			if (request.action === 'dismiss') {
				const ran = runCombat(ctx.ledger, ctx.env, { ack: request.since });
				const dismissed = dismissTicket(ran.ledger, ctx.env, request.n);
				const view = combatView(
					dismissed.ledger,
					ctx.env,
					request.since ?? dismissed.ledger.combat?.eventNo ?? 0,
					ran.behind,
					secondsToNext(dismissed.ledger.bank, bankContext(ctx.stored)),
				);
				return reply(dismissed.ledger, view, dismissed.ok);
			}
			const ask =
				request.action === 'use'
					? { commands: [request.command] }
					: request.action === 'auto'
						? { autoBattle: request.autoBattle, autoUse: request.autoUse }
						: {};
			const before = ctx.ledger.combat?.eventNo ?? 0;
			const { ledger, view, queued } = withCombat(ctx, request.since, ask);
			// a hotkey is "accepted" when it did something (an event was added after the fight was brought up to date); a click on a monster, when it
			// opened a fight against that monster (an automatic engage does not count: it is another monster or was there before)
			const done = (event: { no: number; kind: string; n?: number }) =>
				event.no > before &&
				(request.action === 'use' && request.command.kind === 'fight'
					? event.kind === 'engage' && event.n === request.command.n
					: event.kind === 'potion' || event.kind === 'heal' || event.kind === 'stun' || event.kind === 'resist');
			// a click (or the × of the panel) that joined or left the queue is accepted too
			const accepted = request.action !== 'use' || queued === 'queued' || queued === 'removed' || (ledger.combat?.log.some(done) ?? false);
			return reply(ledger, view, accepted, queued);
		},
		invVer,
	);
