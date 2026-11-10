// Bounds and caps that later upgrades and the rebirth system are meant to raise (more bag room, longer monster growth, a bigger
// merchant shelf, ...). These are the BASE values; read them through `limitOf(key, ctx)` (lib/limits.ts), which adds whatever bonuses
// are registered for that key, so a new effect is one entry in `LIMIT_BONUSES` and no call site changes.

/**
 * Limits that upgrades raise. These are base values; code reads them through {@link limitOf}, which adds the bonuses registered in `LIMIT_BONUSES` (today: Pack Rat and the Deep Pockets Ember upgrade raise the bag size; Night Watch and set bonuses the away hours;
 * Steward and set bonuses the away efficiency). `HARD_LIMITS` is the most a save may hold, so raising a limit later never invalidates a save and a forged save cannot go beyond it.
 *
 * @category Progression/Limits
 * @order 1
 * @table limits
 * @see limitOf
 */
export const LIMITS = {
	/** Levels a monster may grow above the level it spawned at */
	monsterGrowthLevels: 10,
	/** Seconds of map time per level of growth */
	monsterGrowthIntervalSec: 1800,
	/** Monsters that can wait in the battle queue while a fight is open (docs/reference/combat.md) */
	battleQueue: 10,
	/** Pieces of gear on the merchant's shelf */
	merchantOffers: 6,
	/** Seconds of play time until the shelf is reshuffled */
	merchantRotateSec: 1800,
	/** Gold of the first paid shelf refresh (each one after it costs this much more, see MERCHANT_GOODS.refresh) */
	merchantRefreshBase: 10_000,
	/** Bag slots (the Pack Rat merchant bonus and the Deep Pockets Ember upgrade add to it; the belt bag slots will too). 60 since IDL-162, it was 36 */
	bagSize: 60,
	/** Hours of away time the server pays out when the player comes back (the Night Watch Ember upgrade adds to it) */
	offlineCapHours: 8,
	/** Share of the normal income (and chest/monster arrivals) an away hour pays (the Steward Ember upgrade adds to it) */
	offlineEfficiency: 0.5,
	/** Shorter absences pay nothing and show no welcome-back window (a reload, a lunch break) */
	offlineMinGapSec: 300,
	/** Crafts one request may queue or do at once: effectively unlimited (a billion), so thousands or millions can be queued in one go */
	craftBatchCap: 1_000_000_000,
	/** Batches (one per recipe request) that can run side by side in the crafting queue */
	craftQueueSlots: 3,
	/** Hours a batch may run without a claim (it stops there and waits; the next claim restarts the clock) */
	craftOfflineHours: 8,
	/** Speed multiplier on the seconds one craft takes (2 = twice as fast) */
	craftSpeed: 1,
} as const;

export type LimitKey = keyof typeof LIMITS;

/**
 * What a SAVE may ever hold for the limits it validates against a ceiling, however far upgrades have raised them: raising a limit
 * later (within these) never makes an old or a new save invalid, and a forged one cannot go beyond them.
 */
export const HARD_LIMITS = {
	monsterGrowthLevels: 40,
	merchantOffers: 12,
	battleQueue: 16,
	/** The most bag slots a save may hold: base 60 + Pack Rat 48 + Deep Pockets 12 = 120 today, the rest is room for the belt bag slots (IDL-154) */
	bagSize: 200,
	offlineCapHours: 72,
	offlineEfficiency: 1,
	craftBatchCap: 1_000_000_000,
	craftQueueSlots: 5,
	craftOfflineHours: 72,
	craftSpeed: 4,
} as const;
