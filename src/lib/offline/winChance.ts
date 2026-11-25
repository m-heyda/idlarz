import { COMBAT } from '@/config/combatConfig';
import { armorAfterPen, armorReduction, mitigate } from '@/lib/combat';
import { modifiersOf, monsterDef, monsterStats, potionCooldownAgainst } from '@/lib/monsters';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import type { MonsterType } from '@/types/game';

// "Can I win this?": an estimate of the chance that the player beats a monster, worked out in closed form from the same numbers the fight
// engine runs on (the frozen PlayerProfile and monsterStats). O(1), no random numbers, so auto-battle can ask about every waiting monster
// on every request. It compares how long the player needs to kill the monster with how long the player lasts, then turns the ratio into a
// chance. tests/combat/winChance.test.ts holds it to the real fight simulation (lib/fightSim.ts).

/** How sharply the chance rises with the time-to-survive over time-to-kill ratio (1 = a coin flip; the fight is a race of many swings, so it is steep). */
const STEEPNESS = 6;

/** The potions the player could drink during the fight: `healHp` each, `count` of one kind. */
export interface PotionStock {
	healHp: number;
	count: number;
}

/** The Bestiary mastery bonuses against one monster (percent, `masteryBonusesFor`): the fight engine applies them, so the estimate counts them too (IDL-372). */
export interface MasteryEdge {
	damage: number;
	defense: number;
}

export interface WinEstimate {
	/** 0-1 */
	chance: number;
	/** Seconds the player needs to kill the monster, and seconds the player lasts (Infinity: the monster cannot hurt) */
	killSec: number;
	surviveSec: number;
}

/** The clock of a boss fight in seconds: the boss's own limit plus the gear's Boss Timer (IDL-176); undefined for a monster that has no clock. */
export const bossClockSec = (type: MonsterType, p: Pick<PlayerProfile, 'bossTimerSec'>): number | undefined => {
	const limit = monsterDef(type).timeLimitSec;
	return limit === undefined ? undefined : limit + (p.bossTimerSec ?? 0);
};

const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/** Expected damage of one swing after the monster's armor: crits and super crits weighted in. */
const expectedHit = (p: PlayerProfile, armor: number): number => {
	const crit = Math.min(1, Math.max(0, p.crit));
	const superCrit = Math.min(1, Math.max(0, p.superCrit));
	const multiplier = 1 - crit + crit * ((1 - superCrit) * COMBAT.crit.mult + superCrit * COMBAT.crit.superMult) * p.critExtra;
	return Math.max(1, p.hit * multiplier * (1 - armorReduction(armorAfterPen(armor, p.armorPenPct))));
};

/** Expected damage per second the monster does to this player (dodges, crits and armor in). */
const monsterDps = (p: PlayerProfile, type: MonsterType, level: number, elapsedSec = 0, fightSec = Infinity): number => {
	const m = monsterStats(type, level, elapsedSec);
	const crit = Math.min(1, Math.max(0, m.critChance / 100));
	const perHit = (1 - crit) * mitigate(m.attack, p.armor) + crit * mitigate(Math.round(m.attack * m.critMult), p.armor);
	const hits = m.attackSpeed * (1 - Math.min(1, Math.max(0, p.dodge)));
	const venom = modifiersOf(type).venom;
	// Venom: every landed hit adds a stack and refreshes the shared clock (`durationSec`), so with hits closer than the clock the stacks build up one per hit to the maximum and cost nothing before the first hit;
	// with hits farther apart than the clock a single stack is on for the share of the time the clock runs. The stacks are averaged over the fight.
	let stacks = 0;
	if (venom && hits > 0) {
		const gap = 1 / hits;
		if (gap >= venom.durationSec) stacks = Math.min(1, venom.durationSec * hits);
		else if (Number.isFinite(fightSec) && fightSec > 0) {
			for (let k = 1; k <= venom.maxStacks; k++) stacks += Math.max(0, fightSec - k * gap) / fightSec;
		} else stacks = venom.maxStacks;
	}
	return perHit * hits + (venom ? (stacks * venom.pctPerSec * p.maxHp) / 100 : 0);
};

/**
 * The player's chance against a monster of this type and level, starting with `hp` and with these potions to drink. A monster that
 * cannot be killed inside the fight's time limit (a boss's own clock, `COMBAT.maxFightSec`) is a certain loss.
 *
 * Win chance: a closed form from the frozen profile and `monsterStats`. If `killSec > limit` the chance is 0. The same estimate weights new spawns ({@link typeWeights}).
 * `limit` is min(180 s, the boss's own clock).
 *
 * @category Combat/Win chance
 * @formula
 * killSec    = monster HP / (attacks/s x expectedHit)           expectedHit: crits and super crits weighted, monster armor applied
 * surviveSec = (HP + potions that fit between cooldowns) / (monster dps - regen - leech)
 * chance     = min(logistic(6 x ln(surviveSec / killSec)), logistic(6 x ln(limit / killSec)))
 * mastery    = our damage x (1 + damage mastery / 100), the monster's damage x (1 - defense mastery / 100)
 */
export const estimateWin = (
	p: PlayerProfile,
	hp: number,
	type: MonsterType,
	level: number,
	potions: PotionStock[] = [],
	mastery?: MasteryEdge,
): WinEstimate => {
	const m = monsterStats(type, level);
	const dps = (p.attacksPerSec || 0) * expectedHit(p, m.armor) * (1 + Math.max(0, mastery?.damage ?? 0) / 100);
	if (!(dps > 0)) return { chance: 0, killSec: Infinity, surviveSec: 0 };
	const killSec = m.maxHp / dps;
	const limit = Math.min(COMBAT.maxFightSec, bossClockSec(type, p) ?? Infinity);
	if (killSec > limit) return { chance: 0, killSec, surviveSec: 0 };

	// what comes back while the fight lasts: regeneration, life leech, and the potions that fit between their shared cooldown
	const venomCut = 1 - (modifiersOf(type).venom?.regenCutPct ?? 0) / 100;
	const healPerSec = Math.max(0, p.hpRegen) * venomCut + (dps * Math.max(0, p.leechPct)) / 100;
	// one shared cooldown: the fight allows this many drinks in all, however many kinds are in the bag (the best potions go first)
	let drinks = Math.floor(killSec / potionCooldownAgainst(type, p.potionCooldownSec ?? COMBAT.potionCooldownSec)) + 1;
	let potionHp = 0;
	for (const potion of [...potions].sort((a, b) => b.healHp - a.healHp)) {
		const used = Math.min(potion.count, drinks);
		potionHp += potion.healHp * (p.potionPower ?? 1) * used;
		drinks -= used;
	}
	const net = monsterDps(p, type, level, killSec / 2, killSec) * (1 - Math.min(100, Math.max(0, mastery?.defense ?? 0)) / 100) - healPerSec; // Enrage: the attack speed of the middle of the fight stands for the whole
	const surviveSec = net <= 0 ? Infinity : (Math.max(0, hp) + potionHp) / net;
	if (!Number.isFinite(surviveSec)) return { chance: 1, killSec, surviveSec };

	// a fight that ends close to its clock is also at risk from the clock
	const survive = logistic(STEEPNESS * Math.log(Math.max(1e-9, surviveSec / killSec)));
	const inTime = Number.isFinite(limit) ? logistic(STEEPNESS * Math.log(limit / killSec)) : 1;
	return { chance: Math.min(survive, inTime), killSec, surviveSec };
};
