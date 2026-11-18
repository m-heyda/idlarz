/**
 * How the map grows: which biomes a new tile may turn into, and how likely it is to continue a neighbouring area. Every purchase is a
 * random roll (there is no biome picker); buildings are put on explored tiles afterwards (right-click).
 * Pure data - the logic is in src/utils/biomeRules.ts, the player-facing description in docs/reference/economy.md.
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

	/**
	 * Rebirths a biome needs before it can turn up (the count of completed rebirths, `prestige.rebirths`). Not listed = no rebirth needed. The map resets on every
	 * rebirth, so a run only ever holds the biomes of its own rebirth count or fewer.
	 */
	unlockAfterRebirths: { jungle: 1, fields: 2, orchard: 3, blight: 4, battlefield: 5 } as Record<string, number>,

	/**
	 * How far from the castle (Chebyshev, `castleDistance`) a rebirth biome may first turn up; nearer tiles are never that biome (not rolled, not copied from a neighbour).
	 * Not listed = no distance rule. Numbers from docs/plan/12-rebirth-biomes.md section 3.
	 */
	minCastleDistance: { jungle: 10, fields: 14, orchard: 18, blight: 22, battlefield: 22 } as Record<string, number>,

	/** How the weighted roll leans with the castle distance d of the tile (the cluster-copy chance is not affected). */
	distanceWeights: {
		/** Biomes without a `minCastleDistance` keep weight x1 up to `basicFadeFrom`, then fall linearly to x`basicFloor` at `basicFadeTo` and beyond. */
		basicFadeFrom: 10,
		basicFadeTo: 30,
		basicFloor: 0.25,
		/** A biome with a `minCastleDistance` weighs x(d - min + 1) / `rampTiles` of `newMaxWeight` (so 1/8 of it at its minimum), capped at `newMaxWeight`. */
		newMaxWeight: 3,
		rampTiles: 8,
	},

	/** Biomes that may never touch (checked against all 8 neighbours). */
	conflicts: [
		['tundra', 'swamp'],
		['tundra', 'coast'],
		['hills', 'coast'],
		// docs/plan/12-rebirth-biomes.md section 9 (decided): the rebirth biomes keep away from the neighbours they clash with
		['blight', 'lake'],
		['blight', 'coast'],
		['blight', 'orchard'],
		['battlefield', 'swamp'],
		['jungle', 'tundra'],
	] as [string, string][],

	/** Biomes that only exist beside water (a lake or coast among the 8 neighbours). */
	needsWater: ['coast'] as string[],

	/** Never blocked by a neighbour (but still subject to unlocks). */
	neutral: ['plains'] as string[],

	/** Random purchases: chance (%) to copy a neighbouring biome instead of rolling from the weights. */
	cluster: {
		basePct: {
			forest: 60,
			hills: 55,
			lake: 50,
			swamp: 55,
			tundra: 65,
			plains: 45,
			coast: 40,
			jungle: 55,
			fields: 55,
			orchard: 55,
			blight: 60,
			battlefield: 55,
		} as Record<string, number>,
		perExtraNeighbourPct: 10, // +10 for every same-biome 4-neighbour beyond the first
		capPct: 90,
		neverCopy: [] as string[],
		/** A new tile beside a lone tile (no same-biome neighbour) joins it with this chance (%), so no biome stays a 1x1 speck. */
		buddyPct: 100,
	},
};
