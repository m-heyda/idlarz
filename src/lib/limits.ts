import { HARD_LIMITS, LIMITS, type LimitKey } from '@/config/limits';
import { classPassives } from '@/lib/classPassives';
import { emberEffect, emberOwned } from '@/utils/game/emberEffects';
import { merchantEffect, type MerchantUpgrades } from '@/utils/game/merchant';
import type { GemCraft } from '@/config/gemShop';
import type { PrestigeState } from '@/types/game';

/** What can raise a limit: the merchant bonuses now, the rebirth (Embers) effects later. Pass what you have; the rest counts as none. */
export interface LimitContext {
	merchantUpgrades?: MerchantUpgrades;
	prestige?: PrestigeState;
	/** What the worn gear's set bonuses add to the away-time limits (lib/gearEconomy.ts) */
	gear?: { offlineEff: number; offlineCapHours: number };
	/** Bag slots the worn belt gives (the `bagSlots` stat): the server keeps the most it has ever held (`Inventory.beltSlots`) */
	beltSlots?: number;
	/** The hero class: the Paladin adds offline efficiency (lib/classPassives.ts) */
	playerClass?: unknown;
	/** Builders the Gem shop's "Builder #2" gave (0 or 1; the server's ledger holds the record, the game state mirrors it as `gemBuilders`) */
	gemBuilders?: number;
	/** What the Gem shop's crafting items gave (Master Workbench, Overnight Orders, Bulk Discount; see `gemCraftOf`) */
	gemCraft?: GemCraft;
	/** Validation only: use the hard ceilings (`HARD_LIMITS`) where there are any instead of the current value */
	hardCap?: boolean;
}

/**
 * Extra amount per limit. Add an entry here (an upgrade, an Ember effect, ...) and every reader of `limitOf` follows. Kept as plain
 * data so a test can register a bonus and prove that all the places that read the limit react to it.
 */
export const LIMIT_BONUSES: { [K in LimitKey]?: (ctx: LimitContext) => number } = {
	bagSize: (ctx) =>
		merchantEffect(ctx.merchantUpgrades, 'packrat') +
		merchantEffect(ctx.merchantUpgrades, 'packrat2') +
		emberEffect(ctx.prestige, 'deeppockets') +
		Math.max(0, Math.floor(ctx.beltSlots ?? 0)),
	// Eternal Vigil (one-time) takes the away time to the hard limit and the efficiency to 100%; Night Watch and Steward are the cheaper steps before it
	offlineCapHours: (ctx) =>
		emberEffect(ctx.prestige, 'nightwatch') +
		(emberOwned(ctx.prestige, 'vigil') ? HARD_LIMITS.offlineCapHours - LIMITS.offlineCapHours : 0) +
		(ctx.gear?.offlineCapHours ?? 0),
	offlineEfficiency: (ctx) =>
		emberEffect(ctx.prestige, 'steward') +
		(emberOwned(ctx.prestige, 'vigil') ? HARD_LIMITS.offlineEfficiency - LIMITS.offlineEfficiency : 0) +
		((ctx.gear?.offlineEff ?? 0) + classPassives(ctx.playerClass).offlineEffPct) / 100,
	craftQueueSlots: (ctx) => emberEffect(ctx.prestige, 'craftslots'),
	craftSpeed: (ctx) => emberEffect(ctx.prestige, 'workbench') + (ctx.gemCraft?.speed ?? 0),
	craftOfflineHours: (ctx) => emberEffect(ctx.prestige, 'nightshift') + (ctx.gemCraft?.hours ?? 0),
	builders: (ctx) => Math.min(1, Math.max(0, Math.floor(ctx.gemBuilders ?? 0))) + emberEffect(ctx.prestige, 'extrabuilder'),
	// the three level caps of the Ember shop (the castle level still gates Producers, Extractors and the first five Idol levels)
	idolMaxLevel: (ctx) => emberEffect(ctx.prestige, 'idolcap'),
	buildingMaxLevel: (ctx) => emberEffect(ctx.prestige, 'buildcap'),
	castleMaxLevel: (ctx) => emberEffect(ctx.prestige, 'castlecap'),
};

/** The limits `limitOf` cuts at the hard ceiling (the others are cut where they are read, e.g. `craftLimit`, `offlineCapHours`) */
const CLAMPED: ReadonlySet<string> = new Set(['bagSize', 'idolMaxLevel', 'buildingMaxLevel', 'castleMaxLevel']);

/**
 * The current value of a limit: its base plus the registered bonuses.
 *
 * @category Progression/Limits
 * @order 2
 * @formula
 * limit = LIMITS[key] + LIMIT_BONUSES[key](context)           or HARD_LIMITS[key] with ctx.hardCap
 * bagSize = min(HARD_LIMITS.bagSize, 60 + Pack Rat (old +8, new +4 per level) + Deep Pockets (+8 per level) + belt bag slots)
 * castleMaxLevel = min(15, 10 + Castle Expansion level)      buildingMaxLevel = min(15, 5 + Master Masonry level)      idolMaxLevel = min(100, 5 + Idol Mastery level)
 */
export const limitOf = (key: LimitKey, ctx: LimitContext = {}): number => {
	if (ctx.hardCap && key in HARD_LIMITS) return HARD_LIMITS[key as keyof typeof HARD_LIMITS];
	const value = LIMITS[key] + (LIMIT_BONUSES[key]?.(ctx) ?? 0);
	// the bag has several uncapped sources (a belt next to Pack Rat and Deep Pockets) and the level caps come from the Ember shop: they never go past the ceiling a save may hold
	return CLAMPED.has(key) ? Math.min(value, HARD_LIMITS[key as keyof typeof HARD_LIMITS]) : value;
};
