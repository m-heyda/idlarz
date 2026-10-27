import { HARD_LIMITS, LIMITS, type LimitKey } from '@/config/limits';
import { merchantEffect, type MerchantUpgrades } from '@/utils/gameUtils';
import type { PrestigeState } from '@/types/game';

/** What can raise a limit: the merchant bonuses now, the rebirth (Legacy) effects later. Pass what you have; the rest counts as none. */
export interface LimitContext {
	merchantUpgrades?: MerchantUpgrades;
	prestige?: PrestigeState;
	/** Validation only: use the hard ceilings (`HARD_LIMITS`) where there are any instead of the current value */
	hardCap?: boolean;
}

/**
 * Extra amount per limit. Add an entry here (an upgrade, a Legacy effect, ...) and every reader of `limitOf` follows. Kept as plain
 * data so a test can register a bonus and prove that all the places that read the limit react to it.
 */
export const LIMIT_BONUSES: { [K in LimitKey]?: (ctx: LimitContext) => number } = {
	bagSize: (ctx) => merchantEffect(ctx.merchantUpgrades, 'packrat'),
};

/** The current value of a limit: its base plus the registered bonuses. */
export const limitOf = (key: LimitKey, ctx: LimitContext = {}): number =>
	ctx.hardCap && key in HARD_LIMITS ? HARD_LIMITS[key as keyof typeof HARD_LIMITS] : LIMITS[key] + (LIMIT_BONUSES[key]?.(ctx) ?? 0);
