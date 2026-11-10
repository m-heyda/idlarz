import { COMBAT } from '@/config/combatConfig';
import { limitOf } from '@/lib/limits';
import { levelAtAge } from '@/lib/monsters';
import { EPS, type FightCtx } from '@/lib/offline/fightContext';
import { resumeHpOf, startFight, winnable } from '@/lib/offline/fightProfile';
import type { CombatState, QueueResult } from '@/lib/offline/fightTypes';
import type { Ledger } from '@/lib/offline/ledger';
import { isPlaced } from '@/lib/offline/placement';
import { bossOf, monsterTypeOf, normalsOf, type MonsterTicket } from '@/lib/offline/tickets';
import type { MonsterType } from '@/types/game';

// SERVER ONLY. Who the hero fights next: the monsters standing on the map, auto-battle's pick, the battle queue (docs/reference/combat.md) and
// the waiting between fights.

type Target = { ticket: MonsterTicket; type: MonsterType };

/** A placed monster by ticket number, with what it is (null: gone, or not on the map yet). */
export const placedTarget = (ledger: Ledger, n: number): Target | null => {
	const ticket = ledger.bank.monsters.find((monster) => monster.n === n && isPlaced(monster));
	return ticket ? { ticket, type: monsterTypeOf(ticket) } : null;
};

/**
 * The next monster to engage: placed normal monsters first (the weakest, or the oldest: COMBAT.auto.engageOrder), then the boss. One that
 * beat the player is left alone until its retry time has passed, so an unbeatable monster never blocks the easy ones.
 *
 * Starting a fight.
 *
 * - **Click** on a monster (`CombatCommand` `fight`): fights it at once whatever the HP, the retry time, and with auto-battle on or off. Refused with a fight open (it queues instead), at 0 HP, or while the server is `behind`.
 * - **Auto-battle** (switch, default off, locked until the first rebirth: `COMBAT.auto.minRebirths` = 1, {@link autoBattleUnlocked}): when HP is at least 80% of max (`resumeHpPct`) the server picks the next placed monster:
 *   weakest level first (`engageOrder`), normal monsters before a boss, skipping any monster whose win chance is below 0.5 (`minWinChance`) or whose retry time has not passed.
 *   A monster that beat the player (or timed out) waits 300 s (a boss 600 s) (`retryCooldownSec`, `bossRetryCooldownSec`). See also {@link engage}.
 * - **Dismiss** removes a monster for good (no loot), not allowed for the monster being fought ({@link dismissTicket}).
 *
 * @category Combat/A fight
 * @order 2
 * @see engage, queueTicket
 */
export const pickTarget = (
	ledger: Ledger,
	combat: CombatState,
	tSec: number,
	/** Auto-battle only: whether the player is expected to win against this monster (left out: no check) */
	winnable?: (type: MonsterType, level: number) => boolean,
): Target | null => {
	const levelOf = (ticket: MonsterTicket) => levelAtAge(ticket.spawnLevel ?? 1, tSec - ticket.at, {}, ticket.growCap);
	const ready = (ticket: MonsterTicket) =>
		isPlaced(ticket) && tSec >= (combat.retryAt[ticket.n] ?? 0) && (!winnable || winnable(monsterTypeOf(ticket), levelOf(ticket)));
	const normals = normalsOf(ledger.bank)
		.filter(ready)
		.sort((a, b) => (COMBAT.auto.engageOrder === 'weakest' ? levelOf(a) - levelOf(b) : 0) || a.n - b.n);
	if (normals[0]) return { ticket: normals[0], type: monsterTypeOf(normals[0]) };
	const boss = bossOf(ledger.bank);
	if (boss && ready(boss)) return { ticket: boss, type: monsterTypeOf(boss) };
	return null;
};

/** The soonest time a monster that is waiting out its retry cooldown becomes a target again (Infinity: none). */
export const nextRetry = (ledger: Ledger, combat: CombatState, tSec: number): number => {
	let soonest = Infinity;
	for (const ticket of ledger.bank.monsters) {
		const at = combat.retryAt[ticket.n] ?? 0;
		if (isPlaced(ticket) && at > tSec) soonest = Math.min(soonest, at);
	}
	return soonest;
};

/** Drops the queued monsters that are gone (or are the open fight's own) and says whether any is left. */
export const queueHasTarget = (ctx: FightCtx): boolean => {
	const c = ctx.c;
	c.queue = c.queue.filter((n) => placedTarget(ctx.ledger, n) !== null && n !== c.fight?.n);
	return c.queue.length > 0;
};

/**
 * A click while a fight is open: the monster joins the queue, or leaves it when it was already there.
 *
 * The battle queue: a click on another monster while a fight is open (or while resting for the next queued one) queues it; clicking it again removes it. Size `LIMITS.battleQueue` = 10 (hard 16).
 * The queue's head starts as soon as HP is back at 80%, ignoring retry time and win estimate; it works before the first rebirth; it is cleared by a defeat, timeout, retreat, rebirth or an absence, kept by a win.
 *
 * @category Combat/A fight
 * @order 3
 * @see engage, endFight
 */
export const queueTicket = (ctx: FightCtx, n: number): QueueResult => {
	const c = ctx.c;
	if (c.queue.includes(n)) {
		c.queue = c.queue.filter((queuedN) => queuedN !== n);
		return 'removed';
	}
	if (!placedTarget(ctx.ledger, n) || c.fight?.n === n) return 'refused';
	if (c.queue.length >= limitOf('battleQueue')) return 'full';
	c.queue.push(n);
	return 'queued';
};

/** A monster leaves the queue (an `unqueue` command): says whether it was in it. */
export const unqueueTicket = (ctx: FightCtx, n: number): boolean => {
	if (!ctx.c.queue.includes(n)) return false;
	ctx.c.queue = ctx.c.queue.filter((queuedN) => queuedN !== n);
	return true;
};

/**
 * The next fight: the queue's head (the player chose it, so no retry time and no win estimate stop it, but the hero must be back on his feet), then auto-battle's pick.
 *
 * @category Combat/A fight
 * @order 8
 */
export const engage = (ctx: FightCtx, t: number): boolean => {
	const c = ctx.c;
	if (queueHasTarget(ctx)) {
		if (c.hp < resumeHpOf(ctx.profileNow)) return false;
		const next = placedTarget(ctx.ledger, c.queue.shift()!)!;
		return startFight(ctx, t, next);
	}
	if (!c.autoBattle || c.hp < resumeHpOf(ctx.profileNow)) return false;
	const target = pickTarget(ctx.ledger, c, t, winnable(ctx));
	return target ? startFight(ctx, t, target) : false;
};

/** The player's pick (a click on a monster): works with auto-battle off, needs no HP threshold and ignores a monster's retry time. */
export const engageTicket = (ctx: FightCtx, t: number, n: number): boolean => {
	const c = ctx.c;
	if (c.fight || c.hp <= 0) return false;
	const target = placedTarget(ctx.ledger, n);
	if (!target) return false;
	c.queue = c.queue.filter((queuedN) => queuedN !== n); // a click that fights it now moves it out of the line
	return startFight(ctx, t, target);
};

/**
 * With no fight open: how long to rest from `t` before something can change (HP back above the resume line, the boss's retry time, or `now`).
 * Never less than one tick (or what is left of the request).
 */
export const restFor = (ctx: FightCtx, t: number, now: number): number => {
	const c = ctx.c;
	const idleRegen = COMBAT.regenPerSec + ctx.profileNow.hpRegen;
	let until = now;
	if (queueHasTarget(ctx) || (c.autoBattle && pickTarget(ctx.ledger, c, t, winnable(ctx)))) {
		const need = resumeHpOf(ctx.profileNow) - c.hp;
		if (need > 0 && idleRegen > 0) until = Math.min(until, t + need / idleRegen + EPS);
	} else if (c.autoBattle) {
		until = Math.min(until, nextRetry(ctx.ledger, c, t));
	}
	return Math.max(until - t, Math.min(COMBAT.tickSec, now - t));
};

/** The monsters waiting for their turn as the browser is shown them, first to fight first (one that is gone is not listed). */
export const queueView = (
	ledger: Ledger,
	c: CombatState,
	/** The win estimate for a monster, as a whole percent (the server's own, offline/winChance.ts) */
	winPctOf: (type: MonsterType, level: number) => number,
): { n: number; type: MonsterType; level: number; lucky: boolean; winPct: number }[] =>
	(c.queue ?? []).flatMap((n) => {
		const target = placedTarget(ledger, n);
		if (!target) return [];
		const level = levelAtAge(target.ticket.spawnLevel ?? 1, c.at - target.ticket.at, {}, target.ticket.growCap);
		return [{ n, type: target.type, level, lucky: !!target.ticket.lucky, winPct: winPctOf(target.type, level) }];
	});
