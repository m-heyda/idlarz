// Bounds and caps that later upgrades and the rebirth system are meant to raise (more bag room, longer monster growth, a bigger
// merchant shelf, ...). These are the BASE values; read them through `limitOf(key, ctx)` (lib/limits.ts), which adds whatever bonuses
// are registered for that key, so a new effect is one entry in `LIMIT_BONUSES` and no call site changes.

/**
 * Limits that upgrades raise. These are base values; code reads them through {@link limitOf}, which adds the bonuses registered in `LIMIT_BONUSES` (today: Pack Rat and the Deep Pockets Ember upgrade raise the bag size; Night Watch and set bonuses the away hours;
 * Steward and set bonuses the away efficiency). `HARD_LIMITS` is the most a save may hold, so raising a limit later never invalidates a save and a forged save cannot go beyond it.
 *
 * @category Progression/Limits
 * @order 1
 * @see limitOf
 */
export const LIMITS = {
	/** Levels a monster may grow above the level it spawned at */
	monsterGrowthLevels: 10,
	/** Seconds of map time per level of growth (900: twice as fast as the first 1,800, owner 2026-11-24, so a monster reaches its growth cap in 2.5 hours) */
	monsterGrowthIntervalSec: 900,
	/** Monsters that can wait in the battle queue while a fight is open (@category Combat) */
	battleQueue: 10,
	/** Pieces of gear on the merchant's shelf */
	merchantOffers: 6,
	/** Seconds of play time until the shelf is reshuffled */
	merchantRotateSec: 1800,
	/** Gold of the first paid shelf refresh (each one after it costs this much more, see MERCHANT_GOODS.refresh) */
	merchantRefreshBase: 10_000,
	/** Bag slots (the Pack Rat merchant bonus and the Deep Pockets Ember upgrade add to it; the worn belt's bag slots too). 60 since IDL-162, it was 36 */
	bagSize: 60,
	/** Hours of away time the server pays out when the player comes back (the Night Watch Ember upgrade adds to it) */
	offlineCapHours: 8,
	/** Share of the normal income (and chest/monster arrivals) an away hour pays (the Steward Ember upgrade adds to it) */
	offlineEfficiency: 0.5,
	/** Shorter absences pay nothing and show no welcome-back window (a reload, a lunch break) */
	offlineMinGapSec: 300,
	/** Crafts one request of gear, a potion or a trade good may queue: 25 (it was effectively unlimited, a billion, so one request could queue months). The ceiling stays a billion: a released limit only grows */
	craftBatchCap: 25,
	/** Crafts one request of a component (planks, ingots, nails, extracts, cut gems) may queue: they take seconds each, so a batch is never more than a few hours */
	craftComponentBatchCap: 1_000,
	/** Hours one batch may take in all (a request is refused above it; a recipe that takes long has a smaller batch than the caps above) */
	craftMaxBatchHours: 12,
	/** Batches (one per recipe request) that can run side by side in the crafting queue */
	craftQueueSlots: 3,
	/** Hours a batch may run without a claim (it stops there and waits; the next claim restarts the clock) */
	craftOfflineHours: 8,
	/** Speed multiplier on the seconds one craft takes (2 = twice as fast) */
	craftSpeed: 1,
	/** The level an Idol can be taken to (docs/plan/18): the Ember shop's Idol Mastery will raise it, up to the hard limit */
	idolMaxLevel: 5,
	/** The level a Producer or Extractor can be taken to (the Master Masonry Ember upgrade raises it; the castle level still gates every level) */
	buildingMaxLevel: 5,
	/** The highest castle level (the Castle Expansion Ember upgrade raises it, one level per upgrade level) */
	castleMaxLevel: 10,
	/** Builders: how many castle or building upgrades can run at once (1 for everyone; the Gem shop's Additional builder (up to 3) and the Ember shop's Extra Builder add to it, see `builderCount`) */
	builders: 1,
	/** Copies of one Producer or Extractor on the map (1 for everyone; the Ember shop's Building Slots, two levels, and the Gem shop's Building Slot add one each, 4 at most). Idols stay one per map. */
	buildingCopies: 1,
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
	/** The most bag slots a save may hold: base 60 + Pack Rat 48 + Deep Pockets 12 + belt up to 3 = 123 today, the rest is room to grow; `limitOf('bagSize')` never goes past it */
	bagSize: 200,
	offlineCapHours: 72,
	offlineEfficiency: 1,
	craftBatchCap: 1_000_000_000,
	craftComponentBatchCap: 100_000,
	craftMaxBatchHours: 72,
	craftQueueSlots: 5,
	craftOfflineHours: 72,
	craftSpeed: 4,
	/** Idol levels have no design limit (price and timers grow exponentially); 100 is what a save and the ledger may hold */
	idolMaxLevel: 100,
	/** Building levels a save may hold (base 5, the Ember shop adds up to 10 more) */
	buildingMaxLevel: 15,
	/** Castle levels a save may hold (base 10, the Ember shop adds up to 5 more) */
	castleMaxLevel: 15,
	/** Builders a save may hold timers for: 1 + the Gem shop's one + the Ember shop's, with room to grow */
	builders: 8,
	/** Copies of one Producer or Extractor a save may hold: 1 + two Ember levels + the Gem shop's slot */
	buildingCopies: 4,
} as const;
