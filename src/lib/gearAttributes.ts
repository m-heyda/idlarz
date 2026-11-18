import { aggregateStats } from '@/lib/inventory';
import type { Attributes } from '@/lib/statBonuses';
import type { CharacterStats, Equipment } from '@/types/game';
import { calculateCombatStats } from '@/utils/game/character';

// The five attributes (Strength, Dexterity, Intelligence, Vitality, Charisma) can also roll on gear as affixes. The points the player spends are
// the character's own (`characterStats`, the ledger's allocation); the gear's come on top while it is worn and are never stored. Every combat
// and crafting rule reads the attributes through these two functions, so the tooltip and the fight agree.

/** What the worn gear adds to each attribute (all zeros with no attribute affix on it). */
export const gearAttributes = (equipment: Equipment): Attributes => {
	const gear = aggregateStats(equipment);
	return { strength: gear.strength, dexterity: gear.dexterity, intelligence: gear.intelligence, vitality: gear.vitality, charisma: gear.charisma };
};

const hasAny = (a: Attributes): boolean => a.strength !== 0 || a.dexterity !== 0 || a.intelligence !== 0 || a.vitality !== 0 || a.charisma !== 0;

/** The attributes with the worn gear's added. With no attribute gear it returns the same object, so nothing changes for a character without any. */
export const attributesWithGear = <T extends Attributes>(stats: T, equipment: Equipment): T => {
	const gear = gearAttributes(equipment);
	if (!hasAny(gear)) return stats;
	return {
		...stats,
		strength: stats.strength + gear.strength,
		dexterity: stats.dexterity + gear.dexterity,
		intelligence: stats.intelligence + gear.intelligence,
		vitality: stats.vitality + gear.vitality,
		charisma: stats.charisma + gear.charisma,
	};
};

/**
 * The character with the worn gear's attributes counted: the five attributes and everything derived from them (max HP and mana pools, armor, crit chance, Luck, XP gain...) worked out again from the totals.
 * With no attribute gear it returns the same object.
 *
 * Gear attributes count in combat (damage, crit damage, armor, attack speed, max HP and mana, Heal), in Luck and XP gain, and in the quality bias of crafted gear (Intelligence).
 * The economy (income, tile discount) reads the points the player spent only.
 *
 * @category Loot/Affixes
 * @order 2
 * @formula
 * attribute total = spent points (start value 5 included) + sum of the worn gear's attribute affixes
 */
export const withGearAttributes = (stats: CharacterStats, equipment: Equipment): CharacterStats => {
	const total = attributesWithGear(stats, equipment);
	if (total === stats) return stats;
	return Object.assign(total, calculateCombatStats(total));
};
