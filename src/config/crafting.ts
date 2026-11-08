// Crafting: the crafting level curve and the per-request limits. First draft (docs/plan/crafting-v0.md): level 10 in the first days of
// potion crafting. Recipes themselves are data in src/catalog/recipes.ts. Crafting level is kept on rebirth (like the character level).
//
// The curve is written as ANCHORS like LEVELING (config/character.ts): the total crafting XP at which a level is reached. Between two
// anchors every step to the next level is the one before times a constant ratio (see lib/crafting.ts). Retune the anchors, not the code.
export const CRAFTING = {
	maxLevel: 100,
	firstStepXp: 20,
	/** [level, total crafting XP needed to reach it], increasing, ending at maxLevel. Level 10 is ~250 minor potions' worth of XP. */
	anchors: [
		[10, 1_500],
		[30, 40_000],
		[60, 1_000_000],
		[100, 30_000_000],
	] as readonly (readonly [number, number])[],
	/** Most crafts one request may do (docs/plan/17-crafting.md section 5) */
	maxCount: 10,
	/** One craft request per second per player */
	minGapMs: 1000,
	/** Most of one component the stock holds */
	componentCap: 999,
};
