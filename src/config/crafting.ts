// Crafting: the crafting level curve and the per-request limits. First draft (docs/plan/crafting-v0.md): level 10 in the first days of
// potion crafting. Recipes themselves are data in src/catalog/recipes.ts. Crafting level is kept on rebirth (like the character level).
//
// The curve is written as ANCHORS like LEVELING (config/character.ts): the total crafting XP at which a level is reached. Between two
// anchors every step to the next level is the one before times a constant ratio (see lib/crafting.ts). Retune the anchors, not the code.
/**
 * Crafting: the crafting level curve and the per-request limits. First draft, see `docs/plan/crafting-v0.md`. The curve is written as anchors like {@link LEVELING}: the total crafting XP at which a level is reached; between two anchors every step
 * is the one before times a constant ratio (`src/lib/crafting.ts`). Recipes are data in `src/catalog/recipes.ts`. The crafting level is kept on rebirth (like the character level). Batch cap, queue slots, offline run hours and speed are limits
 * ({@link LIMITS}: `craftBatchCap`, `craftQueueSlots`, `craftOfflineHours`, `craftSpeed`).
 *
 * @category Progression/Crafting
 * @order 1
 */
export const CRAFTING = {
	maxLevel: 80,
	firstStepXp: 20,
	/**
	 * Multiplier on every recipe's `xp` when a craft is paid out. 0.2 since the crafting rebalance (IDL-396, the "Days per level" table of docs/generated/craft-sim.md; it was 0.005 after two cuts, which with the gold cost of the late recipes put level 60 out of reach): with the batch cap of 25, the
	 * gear times of `CRAFT_GEAR.timeSec` and the lower cost of G4+ gear, a player who crafts every day reaches level 60 in about six weeks, one who visits once a day in about the same, level 80 stays a months-long goal. The recipe values and the level curve stay as designed.
	 */
	xpScale: 0.2,
	/** The most seconds one craft of a component takes (planks, ingots, nails, extracts, cut gems): material work is quick, only gear and the rare goods are slow (`craftTimeSec`) */
	componentMaxSec: 10,
	/** [level, total crafting XP needed to reach it], increasing, ending at maxLevel. Level 10 is ~1,250 minor potions' worth of XP (the curve was 5x faster in the first draft). */
	anchors: [
		[10, 7_500],
		[30, 200_000],
		[60, 5_000_000],
		[80, 30_000_000],
	] as readonly (readonly [number, number])[],
	// The batch cap, queue slots, offline run hours and speed are limits (config/limits.ts: craftBatchCap, craftQueueSlots, craftOfflineHours,
	// craftSpeed), read through `craftLimit` in lib/crafting.ts.
	/** One craft request per second per player */
	minGapMs: 1000,
	/** Most of one thing (a component, a potion or a trade good) the crafting stash holds; the stash is counters, not bag slots, and a rebirth keeps it */
	componentCap: 10_000_000,
};

/**
 * What a merchant pays for a piece the player crafted, as a share of its normal sell value (`sellValueOf`, `instance.crafted`). Crafting is for gear and levels, never a gold source: since the rebalance the late recipes cost a twentieth of what they did, so the pieces
 * are worth a twentieth to the merchant too and the gate "a craft costs more than its piece sells for" (tests/crafting/gearRecipes.test.ts) keeps its margin. Drops and shop pieces are unaffected.
 *
 * @category Economy/Crafting
 * @order 11
 */
export const CRAFTED_SELL_FACTOR = 0.05;

/**
 * The enchant craft (IDL-120): at the workbench a piece of gear in the bag gets one affix **rerolled** (a new affix of another group, a fresh roll) or **added** (up to the most its rarity carries). It takes Ichor from the crafting stash
 * (distilled at the workbench from the Corrupted Core of the Blight's Core Siphon; without it the button says "Needs Ichor: distil it from Corrupted Core"). Intelligence leans the new roll up like a gear craft does, and the roll is sealed on its own counter (`craft.ordEnchant`), so it never shifts the pieces
 * the gear crafts roll. Named legendaries cannot be enchanted.
 *
 * @category Economy/Crafting
 * @order 9
 */
export const ENCHANT = { ichor: { reroll: 3, add: 10 } } as const;

/**
 * The time-shift potion (IDL-355): each moves the clock `seconds` forward (an hour of income at the away efficiency, building and castle timers an hour shorter) and at most `perDay` can be drunk a day (UTC day), so a stack is no way to skip the game.
 *
 * @category Economy/Crafting
 * @order 7
 */
export const TIME_SHIFT = { seconds: 3600, perDay: 3 } as const;

/**
 * The most the crafting discounts can take off the resources of a recipe together (Ember shop Thrifty Hands up to 15% and the Gem shop's Bulk Discount 10%, `craftCostFactor`), and the headroom the gear recipe values carry for it: a gear recipe is priced
 * 1 / (1 - `CRAFT_DISCOUNT_MAX`) higher than the sell-value gate needs, so even with every discount a craft still costs more than the piece sells for (tests/crafting/gearRecipes.test.ts, "no gold printer").
 *
 * @category Economy/Crafting
 * @order 5
 */
export const CRAFT_DISCOUNT_MAX = 0.25;
export const CRAFT_COST_HEADROOM = 1 / (1 - CRAFT_DISCOUNT_MAX);

/**
 * Gear crafting (IDL-241, docs/plan/17-crafting.md): the knobs of the `craft` loot source. A gear recipe is a grade and a slot; the server rolls the result at claim time through
 * the loot pipeline (`LOOT_SOURCES.craft`, profile `craft`, pool `equipment_craft`), sealed on the lifetime craft counter `craft.ord`.
 *
 * - **Grades**: G1-G8 (`ceilingGrade`): eight tiers of every item type; a recipe unlocks at the crafting level of its grade (`unlock` in `src/catalog/recipes.ts`: G1 1, G2 8, G3 15, G4 25, G5 35, G6 50, G7 65, G8 80, owner 2026-11-07). G1-G6 are live grades (they drop); G7 and G8 are craft-only (`CRAFT_ONLY_GRADES`: nothing drops them). G9 comes through the legendary recipes.
 * - **Type**: a weapon or off-hand recipe also names the weapon type (sword, mace, bow, shield, tome ...), so only bases of that type roll; the other slots have one type each.
 * - **Item level**: inside the grade's window, rising with the crafting level from the grade's unlock to the next grade's (`gradeLevel`), +-1 around the centre. Never above the window, so a Hide recipe always makes Hide gear.
 * - **Rarity**: the profile's weights among the rarities the grade carries (`GRADE_INFO`), Luck multiplying rare and better (`rarityLuckMultiplier`); the crafting level caps it (`rarityCeiling`: up to rare, epic from 50, never legendary).
 * - **Pity**, per grade, kept in `craft.pity` across rebirths: every craft that misses the grade's best rarity adds `pity.perMiss` to a multiplier on that rarity's weight (up to `pity.maxMultiplier`), a hit resets it. A grade with one rarity has none.
 * - **Intelligence** leans the quality and every affix magnitude toward the top (`rollLeaning`): bias = (Intelligence - 5) x `qualityPerInt`, at most `qualityBiasCap`. It never touches the rarity or the affix count.
 *
 * @category Progression/Crafting
 * @order 2
 */
export const CRAFT_GEAR = {
	ceilingGrade: 'G8',
	/** The crafting level a grade after the last recipe grade unlocks at (G9, 95): the item level window of G8 is climbed until then (the crafting cap is 80, so G8 starts at its bottom) */
	nextUnlock: 95,
	/** Best rarity by crafting level: the highest `from` that is at or below the level applies */
	rarityCeiling: [
		{ from: 1, rarity: 'rare' },
		{ from: 50, rarity: 'epic' },
	] as readonly { from: number; rarity: string }[],
	pity: { perMiss: 0.05, maxMultiplier: 1.5 },
	qualityPerInt: 0.01,
	qualityBiasCap: 1,
	/** Intelligence of a new character: the points above it count */
	baseIntelligence: 5,
	/** Seconds one craft takes, by grade: 2, 5, 10, 15, 20, 25, 30 and 30 minutes (a regular piece of top gear is about half an hour; a batch of 25 is at most 12 hours, `LIMITS.craftMaxBatchHours`) */
	timeSec: { G1: 120, G2: 300, G3: 600, G4: 900, G5: 1200, G6: 1500, G7: 1800, G8: 1800 },
} as const;
