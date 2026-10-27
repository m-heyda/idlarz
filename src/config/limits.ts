// Bounds and caps that later upgrades and the rebirth system are meant to raise (more bag room, longer monster growth, a bigger
// merchant shelf, ...). These are the BASE values; read them through `limitOf(key, ctx)` (lib/limits.ts), which adds whatever bonuses
// are registered for that key, so a new effect is one entry in `LIMIT_BONUSES` and no call site changes.

export const LIMITS = {
	/** Levels a monster may grow above the level it spawned at */
	monsterGrowthLevels: 10,
	/** Seconds of map time per level of growth */
	monsterGrowthIntervalSec: 1800,
	/** Pieces of gear on the merchant's shelf */
	merchantOffers: 6,
	/** Seconds of play time until the shelf is reshuffled */
	merchantRotateSec: 1800,
	/** Gold of a paid shelf refresh at castle level 1 (times the castle level squared) */
	merchantRefreshBase: 2000,
	/** Bag slots (the Pack Rat bonus adds to it) */
	bagSize: 36,
} as const;

export type LimitKey = keyof typeof LIMITS;

/**
 * What a SAVE may ever hold for the limits it validates against a ceiling, however far upgrades have raised them: raising a limit
 * later (within these) never makes an old or a new save invalid, and a forged one cannot go beyond them.
 */
export const HARD_LIMITS = {
	monsterGrowthLevels: 40,
	merchantOffers: 12,
} as const;
