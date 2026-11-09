import { ITEM_CATALOG } from '@/catalog';
import { COMBAT, STAT_RULES } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import { atkSpeedPercent, critDamagePercent, magicDamagePercent, physicalDamagePercent, statArmor, statManaRegen, type Attributes } from '@/lib/statBonuses';
import type { CharacterStats, Equipment } from '@/types/game';

// Pure combat rules: what a character's gear and attributes make of damage, speed, armor and HP. The server's fight engine
// (lib/offline/fight.ts) runs fights on them; the character window shows the same numbers.

/**
 * The player's numbers (all pure functions in `src/lib/combat.ts`, used by the server engine and the UI):
 *
 * | Number | Formula |
 * | --- | --- |
 * | Max HP | `round((85 + 3 x Vitality + 0.25 x Charisma + gear Max HP) x (1 + set Max HP% / 100))`, 101 for a new character ({@link maxHp}) |
 * | Damage per hit | `max(1, round1(gear damage x (1 + attribute% / 100 + merchant% / 100) x (1 + set damage% / 100)))` ({@link damagePerHit}) |
 * | Attribute damage % | Strength: 2% per point above 5 (physical weapons, bare hands). Intelligence: 2.4% per point above 5 (staff, wand) (`STAT_RULES`, `src/lib/statBonuses.ts`) |
 * | Attacks per second | `weapon speed x (1 + (0.25% x (Dexterity - 5) + Quick Hands%) / 100)`, 1 bare-handed ({@link attacksPerSecond}; speeds in {@link WEAPON_ATTACK_SPEED}) |
 * | Crit chance | `0.25 x Dexterity + 0.5 x Charisma + gear + Keen Eye`, capped at 75% ({@link critOdds}) |
 * | Super-crit chance | `5% + gear Super Crit + Deadly Aim`, capped at 50%, rolled only when a hit already crit |
 * | Crit multipliers | crit x2, super crit x5, each times `1 + (Str-5 x 1 + Dex-5 x 0.5 + Cha-5 x 0.5) / 100` ({@link swing}) |
 * | Armor | gear armor + 0.5 x (Dex-5) + 0.5 x (Vit-5) + 0.25 x (Str-5) ({@link armorOf}) |
 * | Dodge | gear Dodge, capped at 40% ({@link dodgeChance}) |
 * | Life leech | gear + Vampiric Fang, capped at 15% of damage dealt ({@link lifeLeechPercent}) |
 * | HP regen | 1 HP/s with no fight open (`COMBAT.regenPerSec`); during a fight only gear Regen + Second Wind ({@link regen}) |
 * | Mana | max `20 + 4 x Intelligence + gear`; regen `0.5 + 0.05 x Intelligence + gear` per second (`STAT_RULES.mana`) |
 *
 * A new character has 40 mana.
 *
 * @category Combat/Player numbers
 * @order 1
 * @see armorReduction, damagePerHit, critOdds
 */
export const maxHp = (characterStats: CharacterStats, equipment: Equipment): number => {
	const gear = aggregateStats(equipment);
	return Math.round((COMBAT.baseHp + characterStats.hp + gear.maxHp) * (1 + gear.maxHpPct / 100));
};

/**
 * Auto-battle (the server picking the next monster) is a reward for the first rebirth; a click on a monster starts a fight from the start.
 *
 * @category Combat/A fight
 * @order 4
 */
export const autoBattleUnlocked = (rebirths: number): boolean => rebirths >= COMBAT.auto.minRebirths;

export type DamageType = 'physical' | 'magic';

/** Magic weapons (staves, wands) scale with Intelligence; everything else, bare hands included, with Strength. */
export const weaponDamageType = (equipment: Equipment): DamageType => {
	const base = equipment.mainHand?.base;
	const type = base ? ITEM_CATALOG[base]?.weaponType : undefined;
	return type && STAT_RULES.magicWeaponTypes.includes(type) ? 'magic' : 'physical';
};

/**
 * What the merchant's upgrades add to the fight (see `merchantCombat` in utils/game/merchant.ts), every number in the unit of its readout (percent,
 * percentage points, HP per second). Each function below takes it as an optional last argument: without it nothing changes.
 */
export interface CombatBonus {
	/** % more attacks per second */
	atkSpeedPct: number;
	/** Percentage points of crit chance, and of the chance that a crit becomes a super crit */
	critPct: number;
	superCritPct: number;
	/** % more damage with physical weapons and with magic weapons */
	physPct: number;
	magicPct: number;
	/** % of the damage dealt that comes back as HP (the cap still applies to the total) */
	leechPct: number;
	/** HP per second, in and out of fights */
	regen: number;
}

export const NO_COMBAT_BONUS: CombatBonus = { atkSpeedPct: 0, critPct: 0, superCritPct: 0, physPct: 0, magicPct: 0, leechPct: 0, regen: 0 };

/** The damage multiplier the attributes give with the worn weapon (1 for a character with no bonus, or when no attributes are given). */
export const damageMultiplier = (equipment: Equipment, stats?: Attributes, bonus?: CombatBonus): number => {
	const magic = weaponDamageType(equipment) === 'magic';
	const percent = (stats ? (magic ? magicDamagePercent(stats) : physicalDamagePercent(stats)) : 0) + (bonus ? (magic ? bonus.magicPct : bonus.physPct) : 0);
	return 1 + percent / 100;
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Damage of one swing (before crits): the gear's total damage times the attribute bonus of the weapon's type (1 without a weapon) and the set's percent damage.
 *
 * @category Combat/Player numbers
 * @order 4
 */
export const damagePerHit = (equipment: Equipment, stats?: Attributes, bonus?: CombatBonus): number => {
	const gear = aggregateStats(equipment);
	return Math.max(1, round1(gear.damage * damageMultiplier(equipment, stats, bonus) * (1 + gear.damagePct / 100)));
};

/**
 * Attacks per second: the weapon's speed (1 bare-handed), the Dexterity bonus and the merchant's. The fight swings at exactly this speed.
 *
 * @category Combat/Player numbers
 * @order 5
 */
export const attacksPerSecond = (equipment: Equipment, stats?: Attributes, bonus?: CombatBonus): number => {
	const base = equipment.mainHand ? (ITEM_CATALOG[equipment.mainHand.base]?.attackSpeed ?? 1) : 1;
	return Math.round(base * (1 + ((stats ? atkSpeedPercent(stats) : 0) + (bonus?.atkSpeedPct ?? 0)) / 100) * 100) / 100;
};

/** Damage per second at that speed: what the damage readout is built on. */
export const damagePerSecond = (equipment: Equipment, stats?: Attributes, bonus?: CombatBonus): number =>
	Math.round(damagePerHit(equipment, stats, bonus) * attacksPerSecond(equipment, stats, bonus) * 100) / 100;

export type CritKind = 'none' | 'crit' | 'super';

const clampPct = (pct: number, max: number) => Math.max(0, Math.min(max, pct)) / 100;

/**
 * Chance (0-1) that a swing crits, and that a crit becomes a super crit: character crit plus gear.
 *
 * @category Combat/Player numbers
 * @order 6
 */
export const critOdds = (characterStats: CharacterStats, equipment: Equipment, bonus?: CombatBonus): { crit: number; superCrit: number } => {
	const gear = aggregateStats(equipment);
	return {
		crit: clampPct((characterStats.critChance || 0) + gear.critChance + (bonus?.critPct ?? 0), COMBAT.crit.maxCritChance),
		superCrit: clampPct(COMBAT.crit.superBase + gear.superCrit + (bonus?.superCritPct ?? 0), COMBAT.crit.maxSuperChance),
	};
};

/**
 * One swing: `hit` damage, times the crit or super crit multiplier when the roll says so (high rolls crit, so a stubbed rng() of 0 never
 * does). Two random numbers at most (the second only on a crit). The server's fight engine and `rollHit` share it.
 *
 * @category Combat/Player numbers
 * @order 7
 * @formula
 * crit    = hit x 2 x critExtra          super crit (rolled only after a crit) = hit x 5 x critExtra
 * critExtra = 1 + (Str-5 x 1 + Dex-5 x 0.5 + Cha-5 x 0.5) / 100
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
export const leechHeal = (damage: number, equipment: Equipment, bonus?: CombatBonus): number => (damage * lifeLeechPercent(equipment, bonus)) / 100;

/**
 * Armor against monster hits: the gear's plus (when the attributes are given) what Dexterity, Vitality and Strength add.
 *
 * @category Combat/Player numbers
 * @order 8
 */
export const armorOf = (equipment: Equipment, stats?: Attributes): number => aggregateStats(equipment).armor + (stats ? statArmor(stats) : 0);

/** Mana: the attributes' pool plus the gear's. */
export const maxMana = (characterStats: CharacterStats, equipment: Equipment): number => Math.round(characterStats.mp + aggregateStats(equipment).maxMana);

/** Mana per second, in and out of fights. */
export const manaRegenPerSec = (stats: Attributes, equipment: Equipment): number => statManaRegen(stats) + aggregateStats(equipment).manaRegen;

/**
 * The Life Leech in %, the gear's and the merchant's together, never above the cap.
 *
 * @category Combat/Player numbers
 * @order 10
 */
export const lifeLeechPercent = (equipment: Equipment, bonus?: CombatBonus): number =>
	Math.min(STAT_RULES.lifeLeechCap, Math.max(0, aggregateStats(equipment).lifeLeech + (bonus?.leechPct ?? 0)));

/**
 * The share (0-0.75) of a hit that `armor` takes away: armor / (armor + K) up to 50 %, then every further point counts half as much,
 * so no amount of armor makes anything unkillable (the asymptote is 75 %).
 *
 * Armor reduction: `r = armor / (armor + 40)`; up to 50% the reduction is `r`, above that every extra point counts half, so the ceiling is 75%
 * (`COMBAT.armorK`, `armorSoftCap`, `armorSoftSlope`). A monster hit does `max(1, round(attack x (1 - reduction)))` ({@link mitigate}). The same curve is used for the player's armor and for monster armor.
 *
 * @category Combat/Player numbers
 * @order 2
 * @formula
 * r         = armor / (armor + 40)
 * reduction = r                         if r <= 0.5
 *           = 0.5 + (r - 0.5) x 0.5     above that       (ceiling 0.75)
 */
export const armorReduction = (armor: number): number => {
	if (!(armor > 0)) return 0;
	const raw = armor / (armor + COMBAT.armorK);
	const { armorSoftCap: cap, armorSoftSlope: slope } = COMBAT;
	return raw <= cap ? raw : cap + (raw - cap) * slope;
};

/**
 * Damage of one monster hit after armor: `max(1, round(raw x (1 - armorReduction(armor))))`.
 *
 * @category Combat/Player numbers
 * @order 12
 */
export const mitigate = (rawDamage: number, armor: number): number => Math.max(1, Math.round(rawDamage * (1 - armorReduction(armor))));

/**
 * HP regeneration outside fights: the base rate plus the gear's regen stat.
 *
 * @category Combat/Player numbers
 * @order 11
 */
export const regen = (hp: number, max: number, dtSec: number, gearRegenPerSec = 0): number => {
	if (!Number.isFinite(dtSec) || dtSec <= 0) return hp;
	return Math.min(max, hp + (COMBAT.regenPerSec + gearRegenPerSec) * dtSec);
};

/**
 * Chance (0-1) that a monster's hit misses: the gear's Dodge, capped.
 *
 * @category Combat/Player numbers
 * @order 9
 */
export const dodgeChance = (equipment: Equipment): number => Math.max(0, Math.min(COMBAT.maxDodge, aggregateStats(equipment).dodge)) / 100;
