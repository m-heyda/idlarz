import { COMBAT } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import {
	armorOf,
	attacksPerSecond,
	critOdds,
	damagePerClick,
	dodgeChance,
	lifeLeechPercent,
	manaRegenPerSec,
	maxHp,
	maxMana,
} from '@/lib/combat';
import { critDamagePercent } from '@/lib/statBonuses';
import { effectiveTileDiscount, legacyEffect, merchantLuck, type MerchantUpgrades } from '@/utils/gameUtils';
import type { CharacterStats, Equipment, PrestigeState } from '@/types/game';

/** Everything that decides the numbers shown for the character: the attributes, the worn gear, the merchant bonuses and the rebirth state. */
export interface StatContext {
	characterStats: CharacterStats;
	equipment: Equipment;
	prestige?: PrestigeState;
	merchantUpgrades?: MerchantUpgrades;
}

/**
 * The character's real numbers, each one built from every source the game applies (attributes, gear, merchant bonuses, rebirth),
 * with the same functions the fights and the economy use. The Character window shows exactly this, so a new source (a new gear stat,
 * a Legacy effect) is added where it is applied and appears here, instead of being patched into each screen.
 */
export const effectiveStats = ({ characterStats, equipment, prestige, merchantUpgrades }: StatContext) => {
	const gear = aggregateStats(equipment);
	const odds = critOdds(characterStats, equipment);
	const critExtra = 1 + critDamagePercent(characterStats) / 100;
	const armor = armorOf(equipment, characterStats);
	return {
		maxHp: maxHp(characterStats, equipment),
		maxMana: maxMana(characterStats, equipment),
		hpRegen: COMBAT.regenPerSec + gear.regen,
		manaRegen: manaRegenPerSec(characterStats, equipment),
		damage: damagePerClick(equipment, characterStats),
		attacksPerSecond: attacksPerSecond(equipment, characterStats),
		armor,
		/** % of the damage of a monster's hit the armor takes away */
		armorReduction: (armor / (armor + COMBAT.armorK)) * 100,
		dodge: dodgeChance(equipment) * 100,
		lifeLeech: lifeLeechPercent(equipment),
		/** % chance that a click crits */
		critChance: odds.crit * 100,
		/** What a crit multiplies the click by */
		critMultiplier: COMBAT.crit.mult * critExtra,
		/** % chance that a crit becomes a super crit */
		superCritChance: odds.superCrit * 100,
		superCritMultiplier: COMBAT.crit.superMult * critExtra,
		luck: characterStats.luck + merchantLuck(merchantUpgrades) + gear.luck,
		goldFind: gear.goldFind,
		spellPower: gear.spellPower,
		xpGain: characterStats.xpGainMultiplier,
		/** % off tiles and buildings: the attributes, the rebirth Thrift and the merchant's Bulk Discount, capped */
		tileDiscount: effectiveTileDiscount(characterStats, prestige, merchantUpgrades),
		/** % more gold per click from rebirth (Click Mastery) and % faster castle builds (Master Builders) */
		clickMastery: legacyEffect(prestige, 'mastery') * 100,
		buildTimeReduction: legacyEffect(prestige, 'builders') * 100,
	};
};

export type EffectiveStats = ReturnType<typeof effectiveStats>;
