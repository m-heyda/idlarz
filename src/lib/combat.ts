import { ITEM_CATALOG } from '@/catalog';
import { COMBAT, STAT_RULES } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import { atkSpeedPercent, critDamagePercent, magicDamagePercent, physicalDamagePercent, statArmor, statManaRegen, type Attributes } from '@/lib/statBonuses';
import type { CharacterStats, Equipment } from '@/types/game';

// Pure combat rules: what a character's gear and attributes make of damage, speed, armor and HP. The server's fight engine
// (lib/offline/fight.ts) runs fights on them; the character window shows the same numbers.

export const maxHp = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(COMBAT.baseHp + characterStats.hp + aggregateStats(equipment).maxHp);

export type DamageType = 'physical' | 'magic';

/** Magic weapons (staves, wands) scale with Intelligence; everything else, bare hands included, with Strength. */
export const weaponDamageType = (equipment: Equipment): DamageType => {
	const base = equipment.mainHand?.base;
	const type = base ? ITEM_CATALOG[base]?.weaponType : undefined;
	return type && STAT_RULES.magicWeaponTypes.includes(type) ? 'magic' : 'physical';
};

/** The damage multiplier the attributes give with the worn weapon (1 for a character with no bonus, or when no attributes are given). */
export const damageMultiplier = (equipment: Equipment, stats?: Attributes): number => {
	if (!stats) return 1;
	const percent = weaponDamageType(equipment) === 'magic' ? magicDamagePercent(stats) : physicalDamagePercent(stats);
	return 1 + percent / 100;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Damage of one swing (before crits): the gear's total damage times the attribute bonus of the weapon's type (1 without a weapon). */
export const damagePerHit = (equipment: Equipment, stats?: Attributes): number =>
	Math.max(1, round1(aggregateStats(equipment).damage * damageMultiplier(equipment, stats)));

/** Attacks per second: the weapon's speed (1 bare-handed) and the Dexterity bonus. The fight swings at exactly this speed. */
export const attacksPerSecond = (equipment: Equipment, stats?: Attributes): number => {
	const base = equipment.mainHand ? (ITEM_CATALOG[equipment.mainHand.base]?.attackSpeed ?? 1) : 1;
	return Math.round(base * (1 + (stats ? atkSpeedPercent(stats) : 0) / 100) * 100) / 100;
};

/** Damage per second at that speed: what the damage readout is built on. */
export const damagePerSecond = (equipment: Equipment, stats?: Attributes): number =>
	Math.round(damagePerHit(equipment, stats) * attacksPerSecond(equipment, stats) * 100) / 100;

export type CritKind = 'none' | 'crit' | 'super';

const clampPct = (pct: number, max: number) => Math.max(0, Math.min(max, pct)) / 100;

/** Chance (0-1) that a swing crits, and that a crit becomes a super crit: character crit plus gear. */
export const critOdds = (characterStats: CharacterStats, equipment: Equipment): { crit: number; superCrit: number } => {
	const gear = aggregateStats(equipment);
	return {
		crit: clampPct((characterStats.critChance || 0) + gear.critChance, COMBAT.crit.maxCritChance),
		superCrit: clampPct(COMBAT.crit.superBase + gear.superCrit, COMBAT.crit.maxSuperChance),
	};
};

/**
 * One swing: `hit` damage, times the crit or super crit multiplier when the roll says so (high rolls crit, so a stubbed rng() of 0 never
 * does). Two random numbers at most (the second only on a crit). The server's fight engine and `rollHit` share it.
 */
export const swing = (hit: number, odds: { crit: number; superCrit: number }, critExtra: number, rng: () => number): { damage: number; crit: CritKind } => {
	if (!(rng() >= 1 - odds.crit)) return { damage: hit, crit: 'none' };
	if (rng() >= 1 - odds.superCrit) return { damage: Math.max(1, round1(hit * COMBAT.crit.superMult * critExtra)), crit: 'super' };
	return { damage: Math.max(1, round1(hit * COMBAT.crit.mult * critExtra)), crit: 'crit' };
};

/** One swing of this character with this gear (the attributes' extra crit damage included). */
export const rollHit = (characterStats: CharacterStats, equipment: Equipment, rng: () => number): { damage: number; crit: CritKind } =>
	swing(damagePerHit(equipment, characterStats), critOdds(characterStats, equipment), 1 + critDamagePercent(characterStats) / 100, rng);

/** HP a swing of `damage` gives back through Life Leech. */
export const leechHeal = (damage: number, equipment: Equipment): number => (damage * lifeLeechPercent(equipment)) / 100;

/** Armor against monster hits: the gear's plus (when the attributes are given) what Dexterity, Vitality and Strength add. */
export const armorOf = (equipment: Equipment, stats?: Attributes): number => aggregateStats(equipment).armor + (stats ? statArmor(stats) : 0);

/** Mana: the attributes' pool plus the gear's. */
export const maxMana = (characterStats: CharacterStats, equipment: Equipment): number =>
	Math.round(characterStats.mp + aggregateStats(equipment).maxMana);

/** Mana per second, in and out of fights. */
export const manaRegenPerSec = (stats: Attributes, equipment: Equipment): number => statManaRegen(stats) + aggregateStats(equipment).manaRegen;

/** The gear's Life Leech in %, never above the cap. */
export const lifeLeechPercent = (equipment: Equipment): number => Math.min(STAT_RULES.lifeLeechCap, Math.max(0, aggregateStats(equipment).lifeLeech));

/**
 * The share (0-0.75) of a hit that `armor` takes away: armor / (armor + K) up to 50 %, then every further point counts half as much,
 * so no amount of armor makes anything unkillable (the asymptote is 75 %).
 */
export const armorReduction = (armor: number): number => {
	if (!(armor > 0)) return 0;
	const raw = armor / (armor + COMBAT.armorK);
	const { armorSoftCap: cap, armorSoftSlope: slope } = COMBAT;
	return raw <= cap ? raw : cap + (raw - cap) * slope;
};

export const mitigate = (rawDamage: number, armor: number): number =>
	Math.max(1, Math.round(rawDamage * (1 - armorReduction(armor))));

/** HP regeneration outside fights: the base rate plus the gear's regen stat. */
export const regen = (hp: number, max: number, dtSec: number, gearRegenPerSec = 0): number => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return hp;
	return Math.min(max, hp + (COMBAT.regenPerSec + gearRegenPerSec) * dtSec);
};

/** Chance (0-1) that a monster's hit misses: the gear's Dodge, capped. */
export const dodgeChance = (equipment: Equipment): number =>
	Math.max(0, Math.min(COMBAT.maxDodge, aggregateStats(equipment).dodge)) / 100;
