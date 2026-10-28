import { COMBAT } from '@/config/combatConfig';
import { aggregateStats } from '@/lib/inventory';
import {
	armorOf,
	armorReduction as armorReductionOf,
	attacksPerSecond,
	critOdds,
	damagePerHit,
	dodgeChance,
	lifeLeechPercent,
	manaRegenPerSec,
	maxHp,
	maxMana,
} from '@/lib/combat';
import { critDamagePercent } from '@/lib/statBonuses';
import { chestRateBonusPct, gemChance, luckyRatChance, rarityLuckMultiplier } from '@/lib/luck';
import { offlineCapHours, offlineEfficiency } from '@/lib/offline/limits';
import { effectiveTileDiscount, legacyEffect, merchantCombat, merchantLuck, type MerchantUpgrades } from '@/utils/gameUtils';
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
	const bonus = merchantCombat(merchantUpgrades);
	const odds = critOdds(characterStats, equipment, bonus);
	const critExtra = 1 + critDamagePercent(characterStats) / 100;
	const armor = armorOf(equipment, characterStats);
	const luck = characterStats.luck + merchantLuck(merchantUpgrades) + gear.luck;
	const limits = { prestige, merchantUpgrades };
	return {
		maxHp: maxHp(characterStats, equipment),
		maxMana: maxMana(characterStats, equipment),
		hpRegen: COMBAT.regenPerSec + gear.regen + bonus.regen,
		manaRegen: manaRegenPerSec(characterStats, equipment),
		damage: damagePerHit(equipment, characterStats, bonus),
		attacksPerSecond: attacksPerSecond(equipment, characterStats, bonus),
		armor,
		/** % of the damage of a monster's hit the armor takes away */
		armorReduction: armorReductionOf(armor) * 100,
		dodge: dodgeChance(equipment) * 100,
		lifeLeech: lifeLeechPercent(equipment, bonus),
		/** % chance that a click crits */
		critChance: odds.crit * 100,
		/** What a crit multiplies the click by */
		critMultiplier: COMBAT.crit.mult * critExtra,
		/** % chance that a crit becomes a super crit */
		superCritChance: odds.superCrit * 100,
		superCritMultiplier: COMBAT.crit.superMult * critExtra,
		luck,
		/** % more chests than without Luck */
		chestRateBonus: chestRateBonusPct(luck),
		/** % better odds for rare-and-better gear from Luck */
		rarityLuckBonus: (rarityLuckMultiplier(luck) - 1) * 100,
		/** % chance that a chest also holds 5-50 gems */
		gemChance: gemChance(luck) * 100,
		/** % chance that a newly arrived rat is a lucky one */
		luckyRatChance: luckyRatChance(luck) * 100,
		/** Hours of away time the kingdom works for you (base + Night Watch) and the % of the normal income it pays (base + Steward) */
		offlineCapHours: offlineCapHours(limits),
		offlineEfficiency: offlineEfficiency(limits) * 100,
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
