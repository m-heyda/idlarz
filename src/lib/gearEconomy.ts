import { aggregateStats } from '@/lib/inventory';
import { CHARACTER_STAT_CONFIG } from '@/config/character';
import { STAT_RULES } from '@/config/combatConfig';
import { classXpBucket } from '@/lib/classPassives';
import type { CharacterStats, Equipment } from '@/types/game';

/**
 * The economy effects of the worn gear (the set bonuses of catalog/sets.ts). One pure function of the equipment, used by the
 * browser and by the server: `summarize` (cloudSave/summary.ts) derives the server's rates, XP bonus, away-time limits and kill
 * rewards from the saved gear with it, so an effect pays out on the server's side exactly as it shows on the client.
 */
export interface GearEconomy {
	/** % more of every resource but XP */
	incomePct: number;
	/** % more XP from every source */
	xpPct: number;
	/** % more gold and XP from a kill */
	killRewardPct: number;
	/** Percentage points added to the share of the income paid while away */
	offlineEff: number;
	/** Hours added to the longest away time that is paid */
	offlineCapHours: number;
	/** % more gold per map click */
	clickPct: number;
}

export const NO_GEAR_ECONOMY: GearEconomy = { incomePct: 0, xpPct: 0, killRewardPct: 0, offlineEff: 0, offlineCapHours: 0, clickPct: 0 };

export const gearEconomy = (equipment: Equipment): GearEconomy => {
	const gear = aggregateStats(equipment);
	return {
		incomePct: gear.incomePct,
		xpPct: gear.xpPct,
		killRewardPct: gear.killRewardPct,
		offlineEff: gear.offlineEff,
		offlineCapHours: gear.offlineCapHours,
		clickPct: gear.clickPct,
	};
};

/** The % income bonus of the worn gear (the Income % of its set bonuses only; `gearIncome` is what `calculateResourceRates` takes). */
export const gearIncomePct = (equipment: Equipment): number => aggregateStats(equipment).incomePct;

/** What the worn gear gives the income: the set bonuses' Income % and the ladder's Farm Yield % (IDL-176, up to `STAT_RULES.farmYieldCap`). The extra argument of `calculateResourceBreakdown` and `calculateResourceRates`, which also take the plain Income % number. */
export interface GearIncome {
	incomePct: number;
	farmYieldPct: number;
}

/** The gear's contribution to the income, for the browser and the server alike (`summarize`, the offline grant and every store slice read it through here). */
export const gearIncome = (equipment: Equipment): GearIncome => {
	const gear = aggregateStats(equipment);
	return { incomePct: gear.incomePct, farmYieldPct: Math.min(STAT_RULES.farmYieldCap, Math.max(0, gear.farmYield)) };
};

/** The XP bonus in % that the worn gear's Intelligence and Charisma add, at the same rate as the points the player spends. */
const gearAttributeXpPct = (equipment: Equipment): number => {
	const gear = aggregateStats(equipment);
	const per = CHARACTER_STAT_CONFIG.xpGainPercentPerPoint;
	return gear.intelligence * per.intelligence + gear.charisma * per.charisma;
};

/** The total XP bonus in %: the attributes' (Intelligence, Charisma) plus the worn gear's and the class's (together held under the XP perk cap, {@link classXpBucket}). */
export const xpGainPct = (characterStats: Pick<CharacterStats, 'xpGainMultiplier'>, equipment: Equipment, playerClass?: unknown): number =>
	characterStats.xpGainMultiplier + gearAttributeXpPct(equipment) + classXpBucket(aggregateStats(equipment).xpPct, playerClass);

/** The % off every build timer that the worn gear gives (a legendary's perk, IDL-145); it joins the Dwarf Statue's share under the combined cap (`buildTimeReduction`). */
export const gearBuildTimePct = (equipment: Equipment): number => {
	const gear = aggregateStats(equipment);
	// the ladder gear's Build Speed (IDL-176) counts up to its own cap, then joins the legendary's build time; the 60 % build time cap still holds over everything
	return gear.buildTimePct + Math.min(STAT_RULES.buildSpeedCap, Math.max(0, gear.buildSpeed));
};

/** The percentage points of tile discount the worn gear gives (the ladder's Tile Discount, IDL-176), up to `STAT_RULES.tileDiscountGearCap`; `effectiveTileDiscount` adds them under the tile discount cap. */
export const gearTileDiscountPct = (equipment: Equipment | undefined): number =>
	equipment ? Math.min(STAT_RULES.tileDiscountGearCap, Math.max(0, aggregateStats(equipment).tileDiscount)) : 0;

/** The seconds the worn gear adds to every boss fight's clock (the ladder's Boss Timer, IDL-176), up to `STAT_RULES.bossTimerCapSec`. */
export const gearBossTimerSec = (equipment: Equipment): number => Math.min(STAT_RULES.bossTimerCapSec, Math.max(0, aggregateStats(equipment).bossTimer));

/** The % chest speed the worn gear gives (a legendary's perk); it joins the class and Idol chest speed in `chestIntervalSec`. */
export const gearChestSpeedPct = (equipment: Equipment): number => aggregateStats(equipment).chestSpeedPct;
