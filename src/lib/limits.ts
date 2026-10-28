import { HARD_LIMITS, LIMITS, type LimitKey } from '@/config/limits';
import { emberEffect, merchantEffect, type MerchantUpgrades } from '@/utils/gameUtils';
import type { PrestigeState } from '@/types/game';

/** What can raise a limit: the merchant bonuses now, the rebirth (Embers) effects later. Pass what you have; the rest counts as none. */
export interface LimitContext {
	merchantUpgrades?: MerchantUpgrades;
	prestige?: PrestigeState;
	/** What the worn gear's set bonuses add to the away-time limits (lib/gearEconomy.ts) */
	gear?: { offlineEff: number; offlineCapHours: number };
	/** Validation only: use the hard ceilings (`HARD_LIMITS`) where there are any instead of the current value */
	hardCap?: boolean;
}

/**
 * Extra amount per limit. Add an entry here (an upgrade, an Ember effect, ...) and every reader of `limitOf` follows. Kept as plain
 * data so a test can register a bonus and prove that all the places that read the limit react to it.
 */
export const LIMIT_BONUSES: { [K in LimitKey]?: (ctx: LimitContext) => number } = {
	bagSize: (ctx) => merchantEffect(ctx.merchantUpgrades, 'packrat'),
	offlineCapHours: (ctx) => emberEffect(ctx.prestige, 'nightwatch') + (ctx.gear?.offlineCapHours ?? 0),
	offlineEfficiency: (ctx) => emberEffect(ctx.prestige, 'steward') + (ctx.gear?.offlineEff ?? 0) / 100,
};

/** The current value of a limit: its base plus the registered bonuses. */
export const limitOf = (key: LimitKey, ctx: LimitContext = {}): number =>
	ctx.hardCap && key in HARD_LIMITS ? HARD_LIMITS[key as keyof typeof HARD_LIMITS] : LIMITS[key] + (LIMIT_BONUSES[key]?.(ctx) ?? 0);
