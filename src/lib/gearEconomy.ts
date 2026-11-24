import { aggregateStats } from '@/lib/inventory';
import { CHARACTER_STAT_CONFIG } from '@/config/character';
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

/** The % income bonus of the worn gear (the extra argument of `calculateResourceRates`). */
export const gearIncomePct = (equipment: Equipment): number => aggregateStats(equipment).incomePct;

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
export const gearBuildTimePct = (equipment: Equipment): number => aggregateStats(equipment).buildTimePct;

/** The % chest speed the worn gear gives (a legendary's perk); it joins the class and Idol chest speed in `chestIntervalSec`. */
export const gearChestSpeedPct = (equipment: Equipment): number => aggregateStats(equipment).chestSpeedPct;
