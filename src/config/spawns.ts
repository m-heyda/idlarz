// Chests, monster spawn limits and Luck.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.

/**
 * Monsters and chests together never take more than `maxFraction` of the free tiles (see src/lib/spawnLimits.ts); the spawn
 * timers pause at that limit. `minAllowed` keeps a tiny early map playable: one rat and one chest can always coexist.
 */
export const SPAWN_LIMIT = {
	maxFraction: 0.3,
	minAllowed: 2,
};

// Chests: one spawns every `intervalSec` (timer pauses while SPAWN_LIMIT is reached) on a random owned tile.
// Reward = passive gold/s x a random time between minMinutes and maxMinutes, plus a small bonus per Luck.
/**
 * Chests. The server mints and places them (see {@link ticketCap} and {@link advanceBank}); data is `CHEST`, `LUCK` and `SPAWN_LIMIT` in `src/config/spawns.ts`, rolls are in `src/lib/chests.ts` and `src/lib/luck.ts`.
 *
 * - **Timer**: one chest ticket every 600 s of server time, faster with Luck ({@link chestIntervalSec}).
 * - **Room**: monsters and chests together never exceed 30% of the free tiles (minimum 2), and at most 40 tickets wait in all, chests, monsters and the boss counted together
 *   (`ticketCap` on the server, which estimates free land from the owned-tile count; `spawnCap` in the browser, which counts it from the map).
 * - **Where** (`CHEST.placement`, {@link chestSpots}): every eligible owned tile weighs 1, +3 if it touches unowned land, +1 per 4 tiles of Chebyshev distance from the castle, x0.3 if another chest is within 2 tiles.
 * - **What is inside** ({@link rewardWeights}, {@link rollChestLoot}): relative weights gold 50, bundle 25, xp 12, boost 10, item 8 (`CHEST.rewards`). Each Luck point moves 1% of the gold weight (at most 60%) into boost (80%) and item (20%).
 *   - gold: `gold/s x U(10..60 min) x (1 + 0.005 x Luck) x (1 + Gold Find %)`; boost is the same x1.5.
 *   - bundle: 1-2 of wood/stone/coal/food, each 10-30 min of its income, at least 25.
 *   - xp: 10-30 min of XP income, at least 60.
 *   - item: one roll of the `chest` loot source (82% gear, else a potion; 1.9% a legendary weapon instead), see {@link generateLoot}.
 *   - on top of any chest, a gem roll: `min(15%, 3% + 0.06% x Luck)`, 5-50 gems skewed low ({@link gemChance}).
 *
 * @category Economy/Chests and Luck
 * @order 1
 * @formula
 * interval = 600 x max(0.6, 1 / (1 + 0.004 x Luck))       seconds between chest tickets
 */
export const CHEST = {
	intervalSec: 600,
	minMinutes: 10,
	maxMinutes: 60,
	luckBonusPerPoint: 0.005,

	// Where chests appear: every eligible tile weighs 1, plus these bonuses (see src/lib/chests.ts)
	placement: {
		frontierBonus: 3, // a tile touching land you have not bought yet
		distanceStep: 4, // +1 per this many tiles (Chebyshev) from the castle, so far land is worth visiting
		nearbyRadius: 2, // another chest this close makes a tile much less likely ...
		nearbyFactor: 0.3, // ... times this
	},

	// What a chest holds: relative chances (they need not sum to 100)
	rewards: { gold: 50, bundle: 25, xp: 12, boost: 10, item: 8 } as Record<'gold' | 'bundle' | 'xp' | 'boost' | 'item', number>,
	boostMultiplier: 1.5, // the "lucky chest": gold x this
	bundle: {
		resources: ['wood', 'stone', 'coal', 'food'] as ('wood' | 'stone' | 'coal' | 'food')[],
		count: [1, 2] as [number, number], // how many of them
		minutes: [10, 30] as [number, number], // of that resource's income each
		floor: 25, // at least this much, so a slow resource still pays something
	},
	xp: { minutes: [10, 30] as [number, number], floor: 60 },
	luckRewardBonusPerPoint: 0.01, // each Luck point shifts this share of the gold weight into boost and item chances
};

// What Luck (the Charisma attribute + the merchant's Lucky Charm + gear) does besides the gold bonuses above. Read through the
// functions of src/lib/luck.ts, which are also what the Character window shows.
/**
 * Luck = Charisma + Lucky Charm + gear Luck. Other effects (`LUCK`):
 *
 * - rare-and-better rarity weights x `min(1.6, 1 + 0.004 x Luck)` ({@link rarityLuckMultiplier});
 * - monster gear roll chance x `(1 + 0.002 x Luck)` ({@link dropChanceMultiplier});
 * - golden ("lucky") monster chance `min(10%, 2% + 0.05% x Luck)` ({@link goldenMonsterChance});
 * - gem find on a chest ({@link gemChance}).
 *
 * @category Economy/Chests and Luck
 * @order 2
 */
export const LUCK = {
	/** Chests come this much faster per Luck point (interval / (1 + n x Luck)), never faster than `chestIntervalFloor` x the base interval */
	chestSpeedPerPoint: 0.004,
	chestIntervalFloor: 0.6,
	/** Weights of rare-and-better gear grow by this much per point, capped at x`rarityCap` (the other weights stay, the roll is normalised) */
	rarityPerPoint: 0.004,
	rarityCap: 1.6,
	/** Rarities from this rank up (`RarityDef.order`: 2 = Rare) count as "rare and better" */
	rarityFromOrder: 2,
	/** Monster gear drop chance grows by this much per point */
	dropChancePerPoint: 0.002,
	/** A bonus roll on every chest (it never replaces the normal reward): chance, and how many gems (skewed to the low end) */
	gem: { base: 0.03, perPoint: 0.0006, cap: 0.15, min: 5, max: 50 },
	/** A newly arrived rat is a golden "lucky" one with this chance: same stats, bigger reward */
	goldenMonster: { base: 0.02, perPoint: 0.0005, cap: 0.1, rewardMultiplier: 3, extraGearRolls: 1 },
};
