// The gems of a deed tier (IDL-321, owner rule): every tier pays the same base, and each further tier of a deed pays a little more. Points are the score and the headline; gems are the extra the Claim button pays.
// Pure data. The two special testers are not tiers of a ladder and keep their own amounts.

/** Gems of the first tier of a deed */
export const TIER_GEMS_BASE = 50;
/** Gems added for each further tier of the same deed */
export const TIER_GEMS_STEP = 25;

/**
 * Gems paid for tier `index` (0-based) of a deed: 50, 75, 100, 125 ...
 *
 * @category Progression/Deeds
 * @order 7
 * @formula
 * gems(tier n) = 50 + 25 x (n - 1)      (n = 1 for the first tier of the deed)
 */
export const tierGems = (index: number): number => TIER_GEMS_BASE + TIER_GEMS_STEP * Math.max(0, index);
