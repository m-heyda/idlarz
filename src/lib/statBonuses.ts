import { STAT_RULES } from '@/config/combatConfig';
import type { CharacterStats } from '@/types/game';

// What the five attributes give in combat. Pure functions of the attributes; `calculateCombatStats` (the derived values the
// Stats tab shows) and the combat rules (lib/combat.ts) both read these, so what the tooltip says is what happens.
// Every attribute starts at STAT_RULES.base: bonuses count the points ABOVE it, so a new character has none of them.

export type Attributes = Pick<CharacterStats, 'strength' | 'dexterity' | 'intelligence' | 'vitality' | 'charisma'>;

const above = (value: number): number => Math.max(0, value - STAT_RULES.base);

/** % more damage with physical weapons (swords, daggers, maces, mauls, axes, spears, bows, crossbows, bare hands). */
export const physicalDamagePercent = (s: Attributes): number => above(s.strength) * STAT_RULES.physicalDamagePerStrength;

/** % more damage with magic weapons (staves and wands): 1.2x the physical rate, so a mage's points are worth more. */
export const magicDamagePercent = (s: Attributes): number => above(s.intelligence) * STAT_RULES.magicDamagePerIntelligence;

/** Armor the attributes add to the gear's (it goes through the same armor / (armor + K) curve). */
export const statArmor = (s: Attributes): number =>
	above(s.dexterity) * STAT_RULES.armorPerDexterity + above(s.vitality) * STAT_RULES.armorPerVitality + above(s.strength) * STAT_RULES.armorPerStrength;

/** % extra on the crit and super crit multipliers of a fight click. */
export const critDamagePercent = (s: Attributes): number => {
	const per = STAT_RULES.critDamagePerPoint;
	return above(s.strength) * per.strength + above(s.dexterity) * per.dexterity + above(s.charisma) * per.charisma;
};

/** % attack speed: the attacks-per-second hook for the later speed-based combat (clicks do not use it yet). */
export const atkSpeedPercent = (s: Attributes): number => above(s.dexterity) * STAT_RULES.atkSpeedPerDexterity;

/** Mana a character has before gear. */
export const statMaxMana = (s: Attributes): number => STAT_RULES.mana.base + s.intelligence * STAT_RULES.mana.perIntelligence;

/** Mana per second before gear. */
export const statManaRegen = (s: Attributes): number => STAT_RULES.mana.regenBase + s.intelligence * STAT_RULES.mana.regenPerIntelligence;
