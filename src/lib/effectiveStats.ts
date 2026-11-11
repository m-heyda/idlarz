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
import { potionCooldownSec, potionPower, potionSlotCount } from '@/lib/potionBelt';
import { critDamagePercent } from '@/lib/statBonuses';
import { classPassives, withClassBonus } from '@/lib/classPassives';
import { gearEconomy, xpGainPct } from '@/lib/gearEconomy';
import { chestRateBonusPct, gemChance, goldenMonsterChance, rarityLuckMultiplier } from '@/lib/luck';
import { offlineCapHours, offlineEfficiency } from '@/lib/offline/limits';
import { NO_IDOL_ECONOMY, type IdolEconomy } from '@/lib/idolEconomy';
import { buildTimeReduction } from '@/lib/buildings';
import { effectiveTileDiscount, emberEffect } from '@/utils/game/rebirth';
import { merchantCombat, merchantLuck, type MerchantUpgrades } from '@/utils/game/merchant';
import type { CharacterStats, Equipment, PrestigeState } from '@/types/game';

/** Everything that decides the numbers shown for the character: the attributes, the worn gear, the merchant bonuses and the rebirth state. */
export interface StatContext {
	characterStats: CharacterStats;
	equipment: Equipment;
	prestige?: PrestigeState;
	merchantUpgrades?: MerchantUpgrades;
	/** The hero class: its passives are part of every number below */
	playerClass?: unknown;
	/** What the standing Idols add (lib/idolEconomy.ts): part of Luck, XP gain, kill rewards, away income, damage, max HP and armor and the build-time cut */
	idol?: IdolEconomy;
}

/**
 * The character's real numbers, each one built from every source the game applies (attributes, gear, merchant bonuses, rebirth),
 * with the same functions the fights and the economy use. The Character window shows exactly this, so a new source (a new gear stat,
 * an Ember effect) is added where it is applied and appears here, instead of being patched into each screen.
 */
export const effectiveStats = ({ characterStats, equipment, prestige, merchantUpgrades, playerClass, idol = NO_IDOL_ECONOMY }: StatContext) => {
	const idolPct = (pct: number) => 1 + pct / 100;
	const gear = aggregateStats(equipment);
	const bonus = withClassBonus(merchantCombat(merchantUpgrades), playerClass);
	const passives = classPassives(playerClass);
	const odds = critOdds(characterStats, equipment, bonus);
	const critExtra = 1 + critDamagePercent(characterStats) / 100;
	const armor = armorOf(equipment, characterStats, playerClass) * idolPct(idol.hpArmorPct);
	const luck = characterStats.luck + merchantLuck(merchantUpgrades) + gear.luck + idol.luck;
	const economy = gearEconomy(equipment);
	const limits = { prestige, merchantUpgrades, gear: { ...economy, offlineEff: economy.offlineEff + idol.offlineEffPts }, playerClass };
	return {
		maxHp: Math.round(maxHp(characterStats, equipment) * idolPct(idol.hpArmorPct)),
		maxMana: maxMana(characterStats, equipment, playerClass),
		hpRegen: COMBAT.regenPerSec + gear.regen + bonus.regen,
		manaRegen: manaRegenPerSec(characterStats, equipment),
		damage: damagePerHit(equipment, characterStats, bonus) * idolPct(idol.damagePct),
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
		/** The belt's numbers: the shared potion cooldown in seconds, % more healing from a potion and the potion stacks on the hotkey bar (lib/potionBelt.ts) */
		potionCooldownSec: potionCooldownSec(gear),
		potionPower: (potionPower(gear) - 1) * 100,
		potionSlots: potionSlotCount(gear),
		luck,
		/** % more chests than without Luck */
		chestRateBonus: chestRateBonusPct(luck, passives.chestSpeedPct + idol.chestSpeedPct),
		/** % better odds for rare-and-better gear from Luck */
		rarityLuckBonus: (rarityLuckMultiplier(luck) - 1) * 100,
		/** % chance that a chest also holds 5-50 gems */
		gemChance: gemChance(luck) * 100,
		/** % chance that a newly arrived rat is a lucky one */
		goldenMonsterChance: goldenMonsterChance(luck) * 100,
		/** Hours of away time the kingdom works for you (base + Night Watch) and the % of the normal income it pays (base + Steward) */
		offlineCapHours: offlineCapHours(limits),
		offlineEfficiency: offlineEfficiency(limits) * 100,
		goldFind: gear.goldFind,
		spellPower: gear.spellPower + passives.spellPowerPct,
		xpGain: xpGainPct(characterStats, equipment, playerClass) + idol.xpPct,
		/** % off TILES (not buildings): Charisma, the rebirth Thrift and the merchant's Bulk Discount, capped. Building cost takes the Ember Thrift only (calculateBuildingCost) */
		tileDiscount: effectiveTileDiscount(characterStats, prestige, merchantUpgrades, playerClass),
		/** % more gold per click from rebirth (Click Mastery) and % faster castle builds (Master Builders) */
		clickMastery: emberEffect(prestige, 'mastery') * 100,
		buildTimeReduction: buildTimeReduction(prestige, idol.buildTimePct) * 100,
		/** Set bonuses of the worn gear: % more income (every resource but XP), % more gold and XP from kills, % more gold per click */
		gearIncome: economy.incomePct,
		killRewards: economy.killRewardPct + idol.killRewardPct,
		gearClick: economy.clickPct,
	};
};
