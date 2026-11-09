// Rebirth and the Ember shop: effects, costs, gain and the rebirth requirements (part of the former utils/gameUtils.ts, split in IDL-15).
import { CASTLE_X, CASTLE_Y } from '@/config/castle';
import { EMBER_UPGRADES, REBIRTH, type EmberUpgradeId } from '@/config/rebirth';
import { INITIAL_RESOURCES } from '@/config/economy';
import type { CharacterStats, GameState, PrestigeState, Resources } from '@/types/game';
import { getTile } from '@/utils/world';
import { merchantEffect, type MerchantUpgrades } from '@/utils/game/merchant';
import { economyTiles } from '@/utils/game/tiles';

export const EMPTY_PRESTIGE: PrestigeState = { rebirths: 0, legacyPoints: 0, legacyEarned: 0, upgrades: {} };

const emberLevel = (prestige: PrestigeState | undefined, id: EmberUpgradeId): number => prestige?.upgrades?.[id] ?? 0;

/** Effect of a shop upgrade as a fraction (or, for Provisions, as a number of starting bundles). */
export const emberEffect = (prestige: PrestigeState | undefined, id: EmberUpgradeId): number => emberLevel(prestige, id) * EMBER_UPGRADES[id].effectPerLevel;

/**
 * Cost in Embers of buying the next level of an upgrade, given its current level.
 *
 * @category Progression/Ember shop
 * @order 2
 * @formula
 * cost of level N+1 = ceil(baseCost x 1.4^N) Embers
 */
export const emberUpgradeCost = (id: EmberUpgradeId, currentLevel: number): number =>
	Math.ceil(EMBER_UPGRADES[id].baseCost * Math.pow(EMBER_UPGRADES[id].costGrowth, currentLevel));

/** Points spent on shop levels so far. */
export const emberSpent = (upgrades: PrestigeState['upgrades']): number => {
	let spent = 0;
	(Object.keys(EMBER_UPGRADES) as EmberUpgradeId[]).forEach((id) => {
		for (let level = 0; level < (upgrades[id] ?? 0); level++) spent += emberUpgradeCost(id, level);
	});
	return spent;
};

/**
 * The income bonus (0.5 = +50 %) that `earned` Embers ever earned give: linear when `incomeExponent` is 1, flatter when it is below 1.
 *
 * Folded into the income modifier of every resource ({@link calculateResourceBreakdown}). Spending Embers never lowers it, because it counts the Embers ever earned.
 *
 * @category Progression/Rebirth
 * @order 3
 * @formula
 * income bonus = 0.1 x (Embers ever earned)^0.6          multiplier = 1 + bonus
 * @table ember-income-examples
 */
export const emberIncomeBonus = (earned: number): number => REBIRTH.incomePerPoint * Math.pow(Math.max(0, earned), REBIRTH.incomeExponent);

export const emberIncomeMultiplier = (prestige: PrestigeState | undefined): number => 1 + emberIncomeBonus(prestige?.legacyEarned ?? 0);

/**
 * Percent off tile cost: Charisma plus Thrift, capped.
 *
 * The tile discount in percent: Charisma (0.5% per point, at most 25%) + Thrift (2% per level, Ember shop) + Bulk Discount (1% per level, merchant), capped at 45% (`REBIRTH.discountCapPercent`).
 * Buildings take Thrift only.
 *
 * @category Economy/Tiles
 * @order 4
 * @formula
 * discount% = min(45, min(25, 0.5 x Charisma) + 2 x Thrift level + 1 x Bulk Discount level)
 */
export const effectiveTileDiscount = (
	stats: Pick<CharacterStats, 'tileCostDiscount'>,
	prestige: PrestigeState | undefined,
	merchant?: MerchantUpgrades,
): number => Math.min(stats.tileCostDiscount + emberEffect(prestige, 'thrift') * 100 + merchantEffect(merchant, 'bulk'), REBIRTH.discountCapPercent);

/** Resources a new run starts with: the usual start plus the Provisions bundles. */
export const startingResources = (prestige: PrestigeState | undefined): Resources => {
	const out: Resources = { ...INITIAL_RESOURCES };
	const bundles = emberEffect(prestige, 'provisions');
	Object.entries(EMBER_UPGRADES.provisions.bundle).forEach(([resource, amount]) => {
		out[resource as keyof Resources] += (amount || 0) * bundles;
	});
	return out;
};

/**
 * Embers a rebirth gives: the castle and territory formula, plus the Ancestral Tithe's bonus.
 *
 * `REBIRTH.gain`: `gainScale` 3, `castleExponent` 1.3, `surplusPerTile` 0.02. The Ancestral Tithe merchant upgrade adds +5% per level.
 *
 * @category Progression/Rebirth
 * @order 2
 * @formula
 * base = floor(3 x (castle level - 5)^1.3 x (sqrt(tiles / 10) + 0.02 x max(0, tiles - tilesNeeded)))
 * gain = floor(base x (1 + 0.05 x Ancestral Tithe level))
 * @table ember-gain-examples
 */
export const emberGain = (castleLevel: number, tiles: number, merchant?: MerchantUpgrades, rebirths = 0): number =>
	Math.floor(REBIRTH.gain(castleLevel, tiles, rebirths) * (1 + merchantEffect(merchant, 'tithe')));

interface RebirthRequirement {
	id: 'castle' | 'tiles' | 'idle';
	label: string;
	/** What the player has now / needs (for 'idle': 1 when no castle upgrade is running, 0 while one is) */
	current: number;
	needed: number;
	met: boolean;
}

interface RebirthStatus {
	castleLevel: number;
	/** Purchased tiles + 1: the free starting ring does not count (economyTiles) */
	ownedTiles: number;
	/** Embers a rebirth would give right now */
	gain: number;
	requirements: RebirthRequirement[];
	canRebirth: boolean;
}

/**
 * Can the player rebirth, and if not what is missing. The header button, the rebirth window and the store's `rebirth`
 * all read this one function, so what the tooltip promises is what the action checks.
 *
 * @category Progression/Rebirth
 * @order 4
 * @formula
 * can rebirth = castle level >= 6  and  economyTiles >= 400 + 50 x rebirths  and  no castle upgrade running  and  Embers gained >= 1
 */
export const rebirthStatus = (state: Pick<GameState, 'tiles' | 'freeTiles' | 'castleUpgrade' | 'merchantUpgrades' | 'prestige'>): RebirthStatus => {
	const castleTile = getTile(state.tiles, CASTLE_X, CASTLE_Y);
	const castleLevel = castleTile && castleTile.biome === 'castle' ? (castleTile.level ?? 1) : 0; // 0: no castle (lost)
	const ownedTiles = economyTiles(state.tiles, state.freeTiles);
	const tilesNeeded = REBIRTH.tilesNeeded(state.prestige.rebirths);
	const gain = emberGain(castleLevel, ownedTiles, state.merchantUpgrades, state.prestige.rebirths);
	const idle = !state.castleUpgrade;
	const requirements: RebirthRequirement[] = [
		{
			id: 'castle',
			label: `Castle level ${REBIRTH.minCastleLevel}`,
			current: castleLevel,
			needed: REBIRTH.minCastleLevel,
			met: castleLevel >= REBIRTH.minCastleLevel,
		},
		{
			id: 'tiles',
			label: `${tilesNeeded} tiles`,
			current: ownedTiles,
			needed: tilesNeeded,
			met: ownedTiles >= tilesNeeded,
		},
		{ id: 'idle', label: 'No castle upgrade in progress', current: idle ? 1 : 0, needed: 1, met: idle },
	];
	return { castleLevel, ownedTiles, gain, requirements, canRebirth: requirements.every((r) => r.met) && gain >= 1 };
};
