// Rebirth and the Ember shop.
// Part of the former gameConfig.ts (split in IDL-15); the values are unchanged.
import { Resources } from '@/types/game';

// Rebirth: restart with a permanent bonus paid in Embers. Available once the castle reaches `minCastleLevel`.
/**
 * Rebirth: restart with a permanent bonus paid in Embers. The rules live in `REBIRTH` and are checked by {@link rebirthStatus}, the one function the button, the dialog, the store and the server share.
 *
 * - **Requirements**: castle level >= 6 (`minCastleLevel`), economy tile count >= `400 + 50 x rebirths already done` (`minTiles`, `tilesPerRebirth`), no castle upgrade running, and at least 1 Ember of gain.
 * - **Embers gained**: see {@link emberGain}. **Income bonus**: see {@link emberIncomeBonus}.
 * - **What resets** (`rebirth` in `src/stores/game/rebirthSlice.ts`): map (new start ring), resources, castle, animals, buildings, chests, monsters and any open fight, click level, farm upgrades, all merchant upgrades except Pack Rat,
 *   the bag and worn gear (back to the starter kit; the Pack Rat bag size is kept), loot pity, attributes (all points are handed back to spend again), HP and mana refilled.
 * - **What is kept**: name, class, play time, gems, all Embers and shop levels, lifetime XP and level, the auto-sell setting, the merchant's shelf with its rotation clock and the refresh count (a rebirth is no free reshuffle).
 * - The server runs the rebirth first (`POST /api/rebirth`): it checks the stored save, wipes the ledger's inventory to the starter kit and pays at most its own computed gain; the browser takes the lower number.
 * - Auto-battle unlocks after the first rebirth (`COMBAT.auto.minRebirths`).
 *
 * @category Progression/Rebirth
 * @order 1
 * @see rebirthStatus, emberGain
 * @knownissue IDL-223 the gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision.
 */
export const REBIRTH = {
	minCastleLevel: 6,
	minTiles: 400, // the first rebirth also needs this much territory (300+ tiles come before castle level 6, so it has to be more than that)
	tilesPerRebirth: 50, // every rebirth done so far raises the territory the next one needs by this much (was 25: the medium-map decision, IDL-181)
	surplusPerTile: 0.02, // every tile above the requirement adds this to the tile term of the Embers (times the castle term)
	castleExponent: 1.3, // the castle term is (castle level - 5) ^ castleExponent: castle 10 pays about 1.6 x what a linear term did (IDL-183, decision IDL-132)
	gainScale: 3, // Embers = gainScale x (castle level - 5) ^ castleExponent x (sqrt(tiles / 10) + surplusPerTile x tiles over the requirement), rounded down
	/** Tiles the next rebirth needs, after `rebirths` of them */
	tilesNeeded: (rebirths: number) => REBIRTH.minTiles + REBIRTH.tilesPerRebirth * Math.max(0, rebirths),
	// income bonus = incomePerPoint x (Embers ever earned) ^ incomeExponent (spending points never lowers it). It was linear, +6 % per Ember,
	// which made the first rebirth worth about +130-200 % and every later one snowball. Now about +64 % after 22 Embers, +100 % after 47,
	// +134 % after 76, +220 % after 170 (balancing pass, measured with the sim; tests/economy/rebirth.test.ts pins the curve)
	incomePerPoint: 0.1,
	incomeExponent: 0.6,
	discountCapPercent: 45, // Charisma + Thrift together can never take more than this off a tile
	// Embers granted for a rebirth with this castle level and territory
	gain: (castleLevel: number, tiles: number, rebirths = 0) => {
		const surplus = Math.max(0, tiles - REBIRTH.tilesNeeded(rebirths));
		return Math.floor(
			REBIRTH.gainScale *
				Math.pow(Math.max(0, castleLevel - 5), REBIRTH.castleExponent) *
				(Math.sqrt(Math.max(0, tiles) / 10) + REBIRTH.surplusPerTile * surplus),
		);
	},
};

// The Ember shop: permanent upgrades bought with unspent Embers. The N+1-th level costs
// ceil(baseCost x costGrowth^N) points.
/**
 * The Ember shop: level N+1 costs `ceil(baseCost x costGrowth^N)` Embers ({@link emberUpgradeCost}); the upgrades have 10 levels, except Deep Pockets (+4 bag slots per level, 3 levels, 30 / 54 / 98 Embers; it reads through `limitOf('bagSize')`). Shop levels are permanent: nothing refunds Embers.
 * The save is valid only if `unspent + spent = earned` and `rebirths = 0` implies `earned = 0` (checked in `src/lib/sanitizeSave.ts`). Thrift shares the 45% tile-discount cap with Charisma and Bulk Discount; buildings take Thrift only.
 *
 * @category Progression/Ember shop
 * @order 1
 * @table ember-shop
 */
export const EMBER_UPGRADES = {
	thrift: {
		label: 'Thrift',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.02, // -2% tile and building cost per level
	},
	builders: {
		label: 'Master Builders',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // -5% castle build time per level
	},
	mastery: {
		label: 'Click Mastery',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 0.25, // +25% gold per click per level
	},
	provisions: {
		label: 'Provisions',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // levels of the starting bundle below
		bundle: { gold: 1500, wood: 400, stone: 400 } as Partial<Resources>, // per level, given at the start of every run
	},
	nightwatch: {
		label: 'Night Watch',
		maxLevel: 10,
		baseCost: 2,
		costGrowth: 1.4,
		effectPerLevel: 1, // +1 hour of away time the kingdom works for you, per level (base: LIMITS.offlineCapHours)
	},
	steward: {
		label: 'Steward',
		maxLevel: 10,
		baseCost: 3,
		costGrowth: 1.4,
		effectPerLevel: 0.05, // +5% of the normal income while you are away, per level (base: LIMITS.offlineEfficiency)
	},
	deeppockets: {
		label: 'Deep Pockets',
		maxLevel: 3,
		baseCost: 30,
		costGrowth: 1.8, // 30 / 54 / 98 Embers
		effectPerLevel: 4, // +4 bag slots per level (base: LIMITS.bagSize), kept through every rebirth
	},
} as const;

export type EmberUpgradeId = keyof typeof EMBER_UPGRADES;
