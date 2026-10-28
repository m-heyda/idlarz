import { COMBAT } from '@/config/combatConfig';
import { armorReduction, mitigate } from '@/lib/combat';
import { monsterDef, monsterStats } from '@/lib/monsters';
import type { PlayerProfile } from '@/lib/offline/fightTypes';
import type { MonsterType } from '@/types/game';

// "Can I win this?": an estimate of the chance that the player beats a monster, worked out in closed form from the same numbers the fight
// engine runs on (the frozen PlayerProfile and monsterStats). O(1), no random numbers, so auto-battle can ask about every waiting monster
// on every request. It compares how long the player needs to kill the monster with how long the player lasts, then turns the ratio into a
// chance. tests/winChance.test.ts holds it to the real fight simulation (lib/fightSim.ts).

/** How sharply the chance rises with the time-to-survive over time-to-kill ratio (1 = a coin flip; the fight is a race of many swings, so it is steep). */
const STEEPNESS = 6;

/** The potions the player could drink during the fight: `healHp` each, `count` of one kind. */
export interface PotionStock {
	healHp: number;
	count: number;
}

export interface WinEstimate {
	/** 0-1 */
	chance: number;
	/** Seconds the player needs to kill the monster, and seconds the player lasts (Infinity: the monster cannot hurt) */
	killSec: number;
	surviveSec: number;
}

const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/** Expected damage of one swing after the monster's armor: crits and super crits weighted in. */
const expectedHit = (p: PlayerProfile, armor: number): number => {
	const crit = Math.min(1, Math.max(0, p.crit));
	const superCrit = Math.min(1, Math.max(0, p.superCrit));
	const multiplier = 1 - crit + crit * ((1 - superCrit) * COMBAT.crit.mult + superCrit * COMBAT.crit.superMult) * p.critExtra;
	return Math.max(1, p.hit * multiplier * (1 - armorReduction(armor)));
};

/** Expected damage per second the monster does to this player (dodges, crits and armor in). */
const monsterDps = (p: PlayerProfile, type: MonsterType, level: number): number => {
	const m = monsterStats(type, level);
	const crit = Math.min(1, Math.max(0, m.critChance / 100));
	const perHit = (1 - crit) * mitigate(m.attack, p.armor) + crit * mitigate(Math.round(m.attack * m.critMult), p.armor);
	return perHit * m.attackSpeed * (1 - Math.min(1, Math.max(0, p.dodge)));
};

/**
 * The player's chance against a monster of this type and level, starting with `hp` and with these potions to drink. A monster that
 * cannot be killed inside the fight's time limit (a boss's own clock, `COMBAT.maxFightSec`) is a certain loss.
 */
export const estimateWin = (p: PlayerProfile, hp: number, type: MonsterType, level: number, potions: PotionStock[] = []): WinEstimate => {
	const m = monsterStats(type, level);
	const dps = (p.attacksPerSec || 0) * expectedHit(p, m.armor);
	if (!(dps > 0)) return { chance: 0, killSec: Infinity, surviveSec: 0 };
	const killSec = m.maxHp / dps;
	const limit = Math.min(COMBAT.maxFightSec, monsterDef(type).timeLimitSec ?? Infinity);
	if (killSec > limit) return { chance: 0, killSec, surviveSec: 0 };

	// what comes back while the fight lasts: regeneration, life leech, and the potions that fit between their shared cooldown
	const healPerSec = Math.max(0, p.hpRegen) + (dps * Math.max(0, p.leechPct)) / 100;
	const potionHp = potions.reduce((sum, potion) => sum + potion.healHp * Math.min(potion.count, Math.floor(killSec / COMBAT.potionCooldownSec) + 1), 0);
	const net = monsterDps(p, type, level) - healPerSec;
	const surviveSec = net <= 0 ? Infinity : (Math.max(0, hp) + potionHp) / net;
	if (!Number.isFinite(surviveSec)) return { chance: 1, killSec, surviveSec };

	// a fight that ends close to its clock is also at risk from the clock
	const survive = logistic(STEEPNESS * Math.log(Math.max(1e-9, surviveSec / killSec)));
	const inTime = Number.isFinite(limit) ? logistic(STEEPNESS * Math.log(limit / killSec)) : 1;
	return { chance: Math.min(survive, inTime), killSec, surviveSec };
};
