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
	 * Multiplier on every recipe's `xp` when a craft is paid out (owner 2026-11-11, a quick fix): crafting is an end-game system, so for now it levels very slowly: a Minor Healing Potion (recipe xp 6)
	 * gives 0.12 XP, level 10 takes tens of thousands of potions. Raise it when legendaries and other big sources of crafting XP exist, or flip the whole thing again (IDL-270); the recipe values and
	 * the level curve stay as designed.
	 */
	xpScale: 0.02,
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

/**
 * Gear crafting (IDL-241, docs/plan/17-crafting.md sections 2 and 7): the knobs of the `craft` loot source. A gear recipe is a grade and a slot; the server rolls the result at claim time through
 * the loot pipeline (`LOOT_SOURCES.craft`, profile `craft`, pool `equipment_craft`), sealed on the lifetime craft counter `craft.ord`.
 *
 * - **Grades**: G1-G4 (`ceilingGrade`); a recipe unlocks at the crafting level of its grade (`unlock` in `src/catalog/recipes.ts`: G1 1, G2 8, G3 15, G4 25, owner 2026-11-07).
 * - **Item level**: inside the grade's window, rising with the crafting level from the grade's unlock to the next grade's (`gradeLevel`), +-1 around the centre. Never above the window, so a Hide recipe always makes Hide gear.
 * - **Rarity**: the profile's weights among the rarities the grade carries (`GRADE_INFO`), Luck multiplying rare and better (`rarityLuckMultiplier`); the crafting level caps it (`rarityCeiling`: up to rare, epic from 50, never legendary).
 * - **Pity**, per grade, kept in `craft.pity` across rebirths: every craft that misses the grade's best rarity adds `pity.perMiss` to a multiplier on that rarity's weight (up to `pity.maxMultiplier`), a hit resets it. A grade with one rarity has none.
 * - **Intelligence** leans the quality and every affix magnitude toward the top (`rollLeaning`): bias = (Intelligence - 5) x `qualityPerInt`, at most `qualityBiasCap`. It never touches the rarity or the affix count.
 *
 * @category Progression/Crafting
 * @order 2
 * @table craft-gear
 */
export const CRAFT_GEAR = {
	ceilingGrade: 'G4',
	/** The crafting level a grade after the last recipe grade unlocks at (G5, 35): the item level window of G4 is climbed until then */
	nextUnlock: 35,
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
	/** Seconds one craft takes, by grade */
	timeSec: { G1: 20, G2: 30, G3: 45, G4: 60 },
} as const;
