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
	componentCap: 1_000_000,
};
