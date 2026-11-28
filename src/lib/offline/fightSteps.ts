import { SKILLS, type SkillId } from '@/catalog/skills';
import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG } from '@/catalog';
import { quickHealOf } from '@/catalog/buffs';
import { prestigeOfCore } from '@/lib/offline/prestigeOfCore';
import { armorAfterPen, armorReduction, autoUseUnlocked, leechHealAmount, mitigate, swing } from '@/lib/combat';
import { isBoss, modifiersOf, monsterStats, potionCooldownAgainst } from '@/lib/monsters';
import { masteryBonusesFor, type MasteryTotals } from '@/lib/mastery';
import { EPS, levelNow, maxHpNow, pushEvent, regenGain, rngFor, stockOf, type FightCtx } from '@/lib/offline/fightContext';
import type { CombatCommand, PlayerProfile, QueueResult } from '@/lib/offline/fightTypes';
import { engageTicket, queueTicket, restFor, unqueueTicket } from '@/lib/offline/fightTargets';
import { takeOne } from '@/lib/offline/inventory';
import { payKill } from '@/lib/offline/reward';
import { recordDeath } from '@/lib/offline/stats';

// SERVER ONLY. What happens inside a fight, one tick at a time: the swings of both sides, the skills, the potions, the end of a fight, the
// resting between fights and the player's commands. Each takes the request's `FightCtx` and changes its combat record (and its ledger: a kill
// pays, a potion leaves the bag).

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The mastery bonuses against the monster of an open fight, worked out once per fight (the claimed tiers cannot change while it runs). */
const masteryByFight = new WeakMap<object, MasteryTotals>();
const masteryOf = (ctx: FightCtx, f: NonNullable<FightCtx['c']['fight']>): MasteryTotals => {
	let totals = masteryByFight.get(f);
	if (!totals) {
		totals = masteryBonusesFor(f.type, ctx.ledger.stats.masteryClaimed, ctx.ledger.stats.biomeClaimed);
		masteryByFight.set(f, totals);
	}
	return totals;
};

const tickCooldowns = (ctx: FightCtx, dt: number): void => {
	const c = ctx.c;
	c.cd = { heal: Math.max(0, c.cd.heal - dt), stun: Math.max(0, c.cd.stun - dt), potion: Math.max(0, c.cd.potion - dt) };
};

/** The profile a potion is judged on: the open fight's frozen numbers, else the saved ones. */
const profileOf = (ctx: FightCtx): PlayerProfile => (ctx.c.fight ? ctx.c.fight.profile : ctx.profileNow);

/** What a potion restores for this hero: its HP times the belt's Potion Power. */
const potionHeal = (ctx: FightCtx, id: string): number => quickHealOf(ITEM_CATALOG[id]) * (profileOf(ctx).potionPower ?? 1);

/** How long a Burn lasts after the critical hit that lit it (seconds) */
export const BURN_SEC = 3;

export const drink = (ctx: FightCtx, t: number, id: string): boolean => {
	const c = ctx.c;
	const healHp = potionHeal(ctx, id);
	if (!healHp || stockOf(ctx, id) < 1 || c.hp >= maxHpNow(ctx) - EPS) return false;
	if (c.fight && c.cd.potion > 0) return false;
	const healed = Math.min(healHp, maxHpNow(ctx) - c.hp);
	c.hp += healed;
	// Potion refund (a legendary's handler): in a fight the potion may stay in the bag, rolled from the fight's sealed stream (only drawn when the perk is worn, so no other fight changes)
	const refund = profileOf(ctx).potionRefundPct ?? 0;
	const refunded = !!c.fight && refund > 0 && rngFor(ctx, c.fight)() * 100 < refund;
	if (!refunded) ctx.ledger = { ...ctx.ledger, inv: takeOne(ctx.ledger.inv!, id) ?? ctx.ledger.inv! };
	if (c.fight) c.cd.potion = potionCooldownAgainst(c.fight.type, profileOf(ctx).potionCooldownSec ?? COMBAT.potionCooldownSec);
	pushEvent(ctx, t, 'potion', { id, amount: Math.round(healed) });
	return true;
};

export const cast = (ctx: FightCtx, t: number, id: SkillId): boolean => {
	const c = ctx.c;
	const skill = SKILLS[id];
	if (!skill || levelNow(ctx) < skill.unlockLevel || c.cd[id] > 0 || c.mp < skill.manaCost) return false;
	if (skill.fightOnly && !c.fight) return false;
	if (id === 'heal') {
		const profile = c.fight ? c.fight.profile : ctx.profileNow;
		if (c.hp >= maxHpNow(ctx) - EPS) return false;
		const healed = Math.min(profile.heal, maxHpNow(ctx) - c.hp);
		c.hp += healed;
		pushEvent(ctx, t, 'heal', { amount: Math.round(healed) });
	} else if (c.fight) {
		const stats = monsterStats(c.fight.type, c.fight.level);
		if (stats.stunResist > 0 && rngFor(ctx, c.fight)() * 100 < stats.stunResist) pushEvent(ctx, t, 'resist');
		else {
			c.fight.stunLeft = skill.stunSec ?? 0;
			pushEvent(ctx, t, 'stun', { amount: skill.stunSec ?? 0 });
		}
	}
	c.mp -= skill.manaCost;
	c.cd[id] = skill.cooldownSec;
	return true;
};

/**
 * Auto-use's rules for one tick: a potion below the HP line, Heal below its line, Stun whenever it is ready. It drinks the best-fitting potion by what the potion restores for this hero (the belt's Potion Power included) and waits out the shared cooldown the belt shortens (`profile.potionCooldownSec`); it picks among every healing potion in the bag, not only the ones on the hotkey bar.
 *
 * @category Combat/Potions and skills
 * @order 3
 */
export const autoUse = (ctx: FightCtx, t: number): void => {
	const c = ctx.c;
	const hpPct = (c.hp / maxHpNow(ctx)) * 100;
	if (c.cd.potion <= 0 && hpPct < COMBAT.auto.potionBelowHpPct) {
		const missing = maxHpNow(ctx) - c.hp;
		const options = ctx.potionIds.filter((id) => stockOf(ctx, id) > 0).sort((a, b) => potionHeal(ctx, a) - potionHeal(ctx, b));
		const fit = options.find((id) => potionHeal(ctx, id) >= missing) ?? options[options.length - 1];
		if (fit) drink(ctx, t, fit);
	}
	if (hpPct < COMBAT.auto.healBelowHpPct) cast(ctx, t, 'heal');
	if (COMBAT.auto.stunWhenReady && c.fight && c.fight.stunLeft <= 0) cast(ctx, t, 'stun');
};

/**
 * Closes the open fight as `defeated`, `timeout` or `retreat`: a defeat sets HP to 30% of max, a defeat or timeout starts the monster's retry cooldown (300 s, a boss 600 s) and the queue is cleared; the monster stays on the map.
 *
 * **Defeat streak**: auto-battle stays on after a defeat. Each defeat adds one to `CombatState.defeatStreak`; a win resets it; at `COMBAT.auto.pauseAfterDefeats` (3) defeats in a row auto-battle is switched off, a `paused` event is logged (the browser says 'Auto-battle paused: 3 defeats in a row') and the count starts again. A timeout or a retreat neither adds nor resets. The player turns the switch back on.
 *
 * @category Combat/A fight
 * @order 7
 */
export const endFight = (ctx: FightCtx, t: number, kind: 'defeated' | 'timeout' | 'retreat'): void => {
	const c = ctx.c;
	const f = c.fight!;
	pushEvent(ctx, t, kind, { n: f.n, type: f.type, level: f.level });
	if (kind !== 'retreat') {
		if (kind === 'defeated') {
			ctx.ledger = { ...ctx.ledger, stats: recordDeath(ctx.ledger.stats, f.type) };
			c.hp = Math.round(f.profile.maxHp * COMBAT.knockoutHpFraction);
			c.defeatStreak = (c.defeatStreak ?? 0) + 1;
			if (c.defeatStreak >= COMBAT.auto.pauseAfterDefeats) {
				c.defeatStreak = 0;
				if (c.autoBattle) {
					c.autoBattle = false;
					pushEvent(ctx, t, 'paused');
				}
			}
		}
		c.retryAt[f.n] = t + (isBoss(f.type) ? COMBAT.auto.bossRetryCooldownSec : COMBAT.auto.retryCooldownSec);
	}
	c.fight = null;
	c.queue = []; // the hero lost, ran out the clock or left: the plan is off (a win keeps the queue)
};

/**
 * Venom for one tick: every poison stack costs `venom.pctPerSec` % of the hero's max HP per second, and the hero's regeneration is cut by `venom.regenCutPct` % while it lasts (applied in `fightStep` before the HP cap). The damage is reported as one `poison` event per second of the fight and when the poison runs out. No random numbers.
 */
const tickPoison = (
	ctx: FightCtx,
	t: number,
	dt: number,
	f: NonNullable<FightCtx['c']['fight']>,
	venom: NonNullable<ReturnType<typeof modifiersOf>['venom']>,
): void => {
	const c = ctx.c;
	const poison = f.poison!;
	const live = Math.min(dt, poison.leftSec);
	const damage = (poison.stacks * venom.pctPerSec * f.profile.maxHp * live) / 100;
	c.hp = Math.max(0, c.hp - damage);
	f.hurt = (f.hurt ?? 0) + damage;
	poison.acc += damage;
	poison.leftSec -= live;
	const over = poison.leftSec <= EPS;
	if (poison.acc >= 1 && (over || Math.floor(f.elapsed) > Math.floor(f.elapsed - dt))) {
		pushEvent(ctx, t, 'poison', { amount: round1(poison.acc) });
		poison.acc = 0;
	}
	if (over) delete f.poison;
};

/**
 * One tick of the open fight. Returns when the fight ended.
 *
 * One tick of the open fight, in the order of the numbered list on {@link runCombat}.
 *
 * @category Combat/A fight
 * @order 6
 */
export const fightStep = (ctx: FightCtx, t: number, dt: number): void => {
	const { c, env } = ctx;
	const f = c.fight!;
	const p = f.profile;
	f.elapsed += dt;
	const monster = monsterStats(f.type, f.level, f.elapsed);
	// A fight opened before a balance change keeps its old max HP in the ledger: follow the monster's current max, keeping the share of HP left
	if (monster.maxHp > 0 && f.monsterMaxHp !== monster.maxHp) {
		if (f.monsterMaxHp > 0) f.monsterHp = Math.min(monster.maxHp, (f.monsterHp * monster.maxHp) / f.monsterMaxHp);
		f.monsterMaxHp = monster.maxHp;
	}
	const venom = modifiersOf(f.type).venom;
	// Venom cuts the regeneration for the part of the tick the poison is on, before the HP cap, so a hero at full HP loses nothing to the cut
	const cut = venom && f.poison ? (venom.regenCutPct / 100) * (Math.min(dt, f.poison.leftSec) / dt) : 0;
	c.hp = Math.min(p.maxHp, c.hp + (p.hpRegen * dt + regenGain(c, t - dt, dt)) * (1 - cut));
	c.mp = Math.min(p.maxMp, c.mp + p.mpRegen * dt);
	tickCooldowns(ctx, dt);
	if (f.timeLeftSec !== null) f.timeLeftSec = Math.max(0, f.timeLeftSec - dt);
	if (c.autoUse && autoUseUnlocked(ctx.ledger.rebirths, prestigeOfCore(ctx.env.stored.core))) autoUse(ctx, t);

	const stunned = Math.min(f.stunLeft, dt);
	f.stunLeft -= stunned;

	// Burn (a legendary's handler): the flames work first, so a monster they finish is not swung at
	if (f.burn) {
		const burned = Math.min(dt, f.burn.leftSec);
		f.monsterHp = Math.max(0, f.monsterHp - f.burn.perSec * burned);
		f.burn.leftSec -= burned;
		if (f.burn.leftSec <= EPS) delete f.burn;
	}

	// the player's swings
	f.playerTimer += dt;
	const period = 1 / Math.max(0.05, p.attacksPerSec);
	while (f.playerTimer >= period - EPS && f.monsterHp > 0) {
		f.playerTimer -= period;
		const rolled = swing(p.hit, { crit: p.crit, superCrit: p.superCrit }, p.critExtra, rngFor(ctx, f));
		const kind = rolled.crit === 'none' ? 'hit' : rolled.crit;
		// Bestiary mastery: a permanent bonus against this monster (and its biome once the goal is claimed), `masteryBonusesFor`
		const raw = rolled.damage * (1 + masteryOf(ctx, f).damage / 100);
		const armor = armorAfterPen(monster.armor, p.armorPenPct);
		const damage = armor > 0 ? Math.max(1, round1(raw * (1 - armorReduction(armor)))) : raw;
		f.monsterHp = Math.max(0, f.monsterHp - damage);
		if (p.leechPct > 0) c.hp = Math.min(p.maxHp, c.hp + leechHealAmount(damage, p.leechPct));
		// a critical hit sets the monster alight for BURN_SEC; a new one refreshes it with its own hit (never stacks)
		if (p.burnPct && rolled.crit !== 'none') f.burn = { leftSec: BURN_SEC, perSec: (damage * p.burnPct) / 100 };
		pushEvent(ctx, t, kind, { amount: damage });
	}
	if (f.monsterHp <= 0) {
		const paid = payKill(env.secret, env.userId, ctx.ledger, env.stored, f.n, t, { elapsedSec: f.elapsed, flawless: !(f.hurt && f.hurt > 0) });
		if (!paid) return endFight(ctx, t, 'retreat');
		ctx.ledger = paid.ledger;
		// Heal on Kill: a share of max HP comes back the moment the monster dies
		if (p.healOnKillPct) c.hp = Math.min(p.maxHp, c.hp + (p.maxHp * p.healOnKillPct) / 100);
		pushEvent(ctx, t, 'won', {
			n: f.n,
			type: f.type,
			level: paid.payout.level,
			reward: {
				gold: paid.payout.gold,
				xp: paid.payout.xp,
				hide: paid.payout.hide,
				items: paid.payout.items,
				stored: paid.payout.stored,
				convertedGold: paid.payout.convertedGold,
				autoSold: paid.payout.autoSold,
				pity: paid.payout.pity,
				lucky: paid.payout.lucky,
			},
		});
		c.fight = null;
		c.defeatStreak = 0;
		return;
	}

	// Venom: the poison costs HP every tick and cuts the regeneration that ticked above (the cut is taken back out of what this tick gave)
	if (venom && f.poison) tickPoison(ctx, t, dt, f, venom);

	// the monster's swings (a stunned monster does not wind up)
	f.monsterTimer += dt - stunned;
	const every = 1 / Math.max(0.01, monster.attackSpeed);
	while (f.monsterTimer >= every - EPS && c.hp > 0) {
		f.monsterTimer -= every;
		const rng = rngFor(ctx, f);
		if (p.dodge > 0 && rng() >= 1 - p.dodge) {
			pushEvent(ctx, t, 'dodged');
			continue;
		}
		const crit = monster.critChance > 0 && rng() >= 1 - monster.critChance / 100;
		const amount = round1(mitigate(crit ? Math.round(monster.attack * monster.critMult) : monster.attack, p.armor) * (1 - masteryOf(ctx, f).defense / 100));
		c.hp = Math.max(0, c.hp - amount);
		f.hurt = (f.hurt ?? 0) + amount;
		pushEvent(ctx, t, 'hurt', { amount, crit });
		// Thorns: a share of what the hit did comes back on the monster; the kill is paid on the next step, so no more swings from a dead monster
		if (p.thornsPct) {
			f.monsterHp = Math.max(0, f.monsterHp - (amount * p.thornsPct) / 100);
			if (f.monsterHp <= 0) break;
		}
		if (venom) f.poison = { stacks: Math.min(venom.maxStacks, (f.poison?.stacks ?? 0) + 1), leftSec: venom.durationSec, acc: f.poison?.acc ?? 0 };
	}
	if (c.hp <= 0) endFight(ctx, t, 'defeated');
	else if (f.timeLeftSec === 0 || f.elapsed >= (f.timeLeftSec === null ? COMBAT.maxRegularFightSec : COMBAT.maxFightSec)) endFight(ctx, t, 'timeout');
};

/** One stretch of resting with no fight open: HP and mana come back, the cooldowns run. Returns how long it lasted. */
export const idleStep = (ctx: FightCtx, t: number, now: number): number => {
	const { c, profileNow } = ctx;
	const dt = restFor(ctx, t, now);
	c.hp = Math.min(profileNow.maxHp, c.hp + (COMBAT.regenPerSec + profileNow.hpRegen) * dt + regenGain(c, t, dt));
	c.mp = Math.min(profileNow.maxMp, c.mp + profileNow.mpRegen * dt);
	tickCooldowns(ctx, dt);
	return dt;
};

/**
 * One thing the player asked for by hand, at the clock's time `t`: a potion, a skill, a click on a monster or a monster taken out of the
 * queue. Returns what a click did to the queue (undefined: nothing to report). A click does nothing while the server is `behind` (the fight
 * the browser sees is not the one the click was made on).
 */
export const applyCommand = (ctx: FightCtx, t: number, command: CombatCommand, behind: boolean): QueueResult | undefined => {
	const c = ctx.c;
	if (command.kind === 'potion') drink(ctx, t, command.id);
	else if (command.kind === 'fight') {
		if (!behind) {
			if (c.fight || c.hp <= 0 || c.queue.length > 0) {
				// a fight is open (or the hero is resting before the queue's next one): the click joins the line
				if (c.fight || c.queue.length > 0) return queueTicket(ctx, command.n);
			} else engageTicket(ctx, t, command.n);
		}
	} else if (command.kind === 'unqueue') {
		if (unqueueTicket(ctx, command.n)) return 'removed';
	} else cast(ctx, t, command.id);
	return undefined;
};
