/**
 * How the map grows: which biomes a new tile may turn into, and how likely it is to continue a neighbouring area. Every purchase is a
 * random roll (there is no biome picker); buildings are put on explored tiles afterwards (right-click).
 * Pure data - the logic is in src/utils/biomeRules.ts, the player-facing description in docs/02-mechanics.md.
 *
 * "purchased tiles" = tiles bought so far (the castle and the free starting ring do not count).
 */
export const BIOME_RULES = {
	/** The castle's 8 neighbours are owned from the start (new game and every rebirth), generated from these. */
	startRing: {
		weights: { plains: 5, forest: 3, hills: 2, lake: 2 } as Record<string, number>,
		copyPreviousPct: 50, // chance a ring tile continues the previous one, so the ring forms 2-4 patches
		minPlains: 3,
		maxOfOther: 3,
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
	},
};
