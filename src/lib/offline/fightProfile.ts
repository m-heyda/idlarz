import { ITEM_CATALOG } from '@/catalog';
import { quickHealOf } from '@/catalog/buffs';
import { COMBAT } from '@/config/combatConfig';
import { autoUseUnlocked } from '@/lib/combat';
import { prestigeOfCore } from '@/lib/offline/prestigeOfCore';
import { levelAtAge, monsterStats } from '@/lib/monsters';
import { pushEvent, type FightCtx } from '@/lib/offline/fightContext';
import type { CombatState, PlayerProfile } from '@/lib/offline/fightTypes';
import { bagCountOf } from '@/lib/offline/inventory';
import { recordEncounter } from '@/lib/offline/stats';
import type { MonsterTicket } from '@/lib/offline/tickets';
import type { Inventory } from '@/lib/offline/types';
import { bossClockSec, estimateWin, type MasteryEdge, type PotionStock } from '@/lib/offline/winChance';
import { masteryBonusesFor } from '@/lib/mastery';
import type { Ledger } from '@/lib/offline/ledger';
import type { MonsterType } from '@/types/game';

// SERVER ONLY. The numbers a fight is judged on: the player's profile (frozen into a fight when it starts), the monster's stats at its level,
// the HP the hero must be back at before auto-battle or the queue starts the next fight, and the win estimate auto-battle gates on.

/** The potions auto-use would drink (none with auto-use off or not bought yet), for the win estimate. */
export const potionsForEstimate = (inv: Inventory, c: CombatState, autoUseOwned: boolean): PotionStock[] =>
	c.autoUse && autoUseOwned
		? Object.keys(ITEM_CATALOG)
				.filter((id) => quickHealOf(ITEM_CATALOG[id]) > 0)
				.map((id) => ({ healHp: quickHealOf(ITEM_CATALOG[id]), count: bagCountOf(inv, id) }))
		: [];

/**
 * Whether auto-battle expects to beat a monster: the estimate (offline/winChance.ts) with the HP it would start with (at least the resume
 * line, so a player who is still resting is not judged on a low HP) and the potions auto-use would drink. A click on a monster skips this.
 */
export const winnableBy =
	(profile: PlayerProfile, hp: number, potions: PotionStock[], masteryOf?: MasteryOf) =>
	(type: MonsterType, level: number): boolean =>
		estimateWin(profile, Math.max(hp, resumeHpOf(profile)), type, level, potions, masteryOf?.(type)).chance >= COMBAT.auto.minWinChance;

/**
 * The win estimate of one monster as a whole percent (0-100), judged like {@link winnableBy} (HP at least the resume line, the potions auto-use would
 * drink). The Next strip shows it as a bucket ({@link winBucketOf}) with the exact value on hover; the browser never recomputes it.
 */
export const winPctBy =
	(profile: PlayerProfile, hp: number, potions: PotionStock[], masteryOf?: MasteryOf) =>
	(type: MonsterType, level: number): number =>
		Math.round(estimateWin(profile, Math.max(hp, resumeHpOf(profile)), type, level, potions, masteryOf?.(type)).chance * 100);

/** The mastery edge the ledger's claimed tiers give against a monster type (what the fight itself applies), for the estimates above. */
export const masteryOfLedger =
	(ledger: Ledger): MasteryOf =>
	(type) => {
		const totals = masteryBonusesFor(type, ledger.stats.masteryClaimed, ledger.stats.biomeClaimed);
		return { damage: totals.damage, defense: totals.defense };
	};

/** Asks for the mastery edge against a monster type */
export type MasteryOf = (type: MonsterType) => MasteryEdge;

/** What auto-battle checks a monster against: the numbers it would fight with and the potions auto-use would drink. */
export const winnable = (ctx: FightCtx) =>
	winnableBy(
		ctx.profileNow,
		ctx.c.hp,
		potionsForEstimate(ctx.ledger.inv!, ctx.c, autoUseUnlocked(ctx.ledger.rebirths, prestigeOfCore(ctx.env.stored.core))),
		masteryOfLedger(ctx.ledger),
	);

/** The HP at which a rested hero starts the next fight (auto-battle's pick or the queue's head). */
export const resumeHpOf = (profile: PlayerProfile): number => (profile.maxHp * COMBAT.auto.resumeHpPct) / 100;

/** Opens the fight against a monster: the start of both an automatic and a chosen fight. The player's profile is frozen into it. */
export const startFight = (ctx: FightCtx, t: number, target: { ticket: MonsterTicket; type: MonsterType }): boolean => {
	const c = ctx.c;
	// the first fight with a type discovers it (stats.seen): the "?" on the map and in the combat window turns into the monster
	ctx.ledger = { ...ctx.ledger, stats: recordEncounter(ctx.ledger.stats, target.type, ctx.env.nowSec * 1000) };
	const level = levelAtAge(target.ticket.spawnLevel ?? 1, t - target.ticket.at, {}, target.ticket.growCap);
	const stats = monsterStats(target.type, level);
	const profile: PlayerProfile = ctx.profileNow;
	c.hp = Math.min(c.hp, profile.maxHp);
	c.mp = Math.min(c.mp, profile.maxMp);
	c.ord++;
	c.fight = {
		n: target.ticket.n,
		type: target.type,
		level,
		lucky: target.ticket.lucky,
		monsterHp: stats.maxHp,
		monsterMaxHp: stats.maxHp,
		playerTimer: 0,
		monsterTimer: 0,
		stunLeft: 0,
		elapsed: 0,
		// a boss's clock, plus the seconds the gear's Boss Timer adds (IDL-176)
		timeLeftSec: bossClockSec(target.type, profile) ?? null,
		ord: c.ord,
		seq: 0,
		profile,
		x: target.ticket.x ?? 0,
		y: target.ticket.y ?? 0,
	};
	pushEvent(ctx, t, 'engage', { n: target.ticket.n, type: target.type, level });
	return true;
};
