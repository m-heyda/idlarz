import { CLASS_PASSIVES, NO_CLASS_PASSIVES, PLAYER_CLASSES, type ClassPassives, type PlayerClassId } from '@/config/playerClasses';
import { PERK_CAPS } from '@/catalog/perkCaps';
import type { CombatBonus } from '@/lib/combat';

/**
 * The passives of a hero class (`CLASS_PASSIVES`, `src/config/playerClasses.ts`): one combat and one economy bonus each (the Mage's combat one is mana and Spell Power together).
 *
 * | Where it lands | How |
 * | --- | --- |
 * | Armor, max mana, Spell Power (healing) | added to the character's own number before it is used ({@link armorOf}, `maxMana`, {@link healAmount}) |
 * | Crit chance, HP regeneration | added to the merchant's `CombatBonus` (`withClassBonus`), so they count in fights, in the idle regeneration and in the win chance |
 * | Tile discount | added to Charisma, Thrift and Bulk Discount, inside the tile-discount cap ({@link effectiveTileDiscount}) |
 * | Offline efficiency | added to the Steward and the set bonuses, under the hard limit (`offlineEfficiency`) |
 * | XP gain | added to the gear's XP bucket, under the XP perk-family cap ({@link classXpBucket}) |
 * | Chest speed | the chest interval is divided by `1 + chestSpeed / 100` ({@link chestIntervalSec}) |
 *
 * No class passive has a multiplier bucket of its own. The class is read from the profile row (the save route stamps it over the upload, see
 * `acceptSave`), never from a number the browser sends, and the server runs the fight profile and the economy summary on it.
 *
 * @category Progression/Class passives
 * @order 1
 * @table class-passives
 */
export const classPassives = (playerClass: unknown): ClassPassives =>
	typeof playerClass === 'string' && Object.hasOwn(CLASS_PASSIVES, playerClass) ? CLASS_PASSIVES[playerClass as PlayerClassId] : NO_CLASS_PASSIVES;

/** The class named by a stored save or profile (anything else is no class). */
export const classOf = (core: Record<string, unknown>): PlayerClassId | undefined =>
	typeof core.playerClass === 'string' && Object.hasOwn(PLAYER_CLASSES, core.playerClass) ? (core.playerClass as PlayerClassId) : undefined;

/** The merchant's combat bonus with the class's crit chance and regeneration added. */
export const withClassBonus = (bonus: CombatBonus, playerClass: unknown): CombatBonus => {
	const passives = classPassives(playerClass);
	if (!passives.critPct && !passives.hpRegen) return bonus;
	return { ...bonus, critPct: bonus.critPct + passives.critPct, regen: bonus.regen + passives.hpRegen };
};

/**
 * The gear's XP bucket with the class's XP added, held under the XP perk-family cap: the class counts like gear, it never lifts the bucket above `PERK_CAPS.xpPct`.
 *
 * @category Progression/Class passives
 * @order 2
 * @formula
 * xp bucket = min(PERK_CAPS.xpPct, gear XP% + class XP%)          then + the attributes' XP gain
 */
export const classXpBucket = (gearXpPct: number, playerClass: unknown): number => Math.min(PERK_CAPS.xpPct, gearXpPct + classPassives(playerClass).xpPct);

/** Short readable lines for the Character window and the income panel: what the class adds, combat then economy. */
export const describeClassPassives = (playerClass: unknown): { combat: string[]; economy: string[] } => {
	const p = classPassives(playerClass);
	const combat: string[] = [];
	if (p.armor) combat.push(`+${p.armor} armor`);
	if (p.hpRegen) combat.push(`+${p.hpRegen} HP/s regeneration`);
	if (p.critPct) combat.push(`+${p.critPct}% crit chance`);
	if (p.maxMana) combat.push(`+${p.maxMana} max mana`);
	if (p.spellPowerPct) combat.push(`+${p.spellPowerPct}% spell power`);
	const economy: string[] = [];
	if (p.tileDiscountPct) economy.push(`-${p.tileDiscountPct}% tile cost`);
	if (p.offlineEffPct) economy.push(`+${p.offlineEffPct}% offline efficiency`);
	if (p.chestSpeedPct) economy.push(`+${p.chestSpeedPct}% chest speed`);
	if (p.xpPct) economy.push(`+${p.xpPct}% XP gain`);
	return { combat, economy };
};
