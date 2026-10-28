/**
 * How the map grows: which biomes a new tile may turn into, and how likely it is to continue a neighbouring area. Every purchase is a
 * random roll (there is no biome picker); buildings are put on explored tiles afterwards (right-click).
 * Pure data - the logic is in src/utils/biomeRules.ts, the player-facing description in docs/02-mechanics.md.
 *
 * "purchased tiles" = tiles bought so far (the castle and the four free starting tiles do not count).
 */
export const BIOME_RULES = {
	/** The four tiles north, east, south and west of the castle are owned from the start (new game and every rebirth), generated from these. */
	startRing: {
		// Only gentle biomes next to the castle (no hills or lakes: water starts just beyond). The four tiles do not touch each other, so there is no patch rule.
		weights: { plains: 5, forest: 3 } as Record<string, number>,
		minPlains: 2,
		maxOfOther: 2,
	},

	/** Purchases needed before a biome can turn up or be picked. Not listed = available from the start. */
	unlockAfterPurchases: { swamp: 6, tundra: 10 } as Record<string, number>,

	/** Biomes that may never touch (checked against all 8 neighbours). */
	conflicts: [
		['tundra', 'swamp'],
		['tundra', 'coast'],
		['hills', 'coast'],
	] as [string, string][],

	/** Biomes that only exist beside water (a lake or coast among the 8 neighbours). */
	needsWater: ['coast'] as string[],

	/** Never blocked by a neighbour (but still subject to unlocks). */
	neutral: ['plains'] as string[],

	/** Random purchases: chance (%) to copy a neighbouring biome instead of rolling from the weights. */
	cluster: {
		basePct: { forest: 60, hills: 55, lake: 50, swamp: 55, tundra: 65, plains: 45, coast: 40 } as Record<string, number>,
		perExtraNeighbourPct: 10, // +10 for every same-biome 4-neighbour beyond the first
		capPct: 90,
		neverCopy: [] as string[],
		/** A new tile beside a lone tile (no same-biome neighbour) joins it with this chance (%), so no biome stays a 1x1 speck. */
		buddyPct: 100,
	},
};
