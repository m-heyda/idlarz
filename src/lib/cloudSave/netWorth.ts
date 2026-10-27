import { BUILDING_COST, CASTLE_UPGRADE, MERCHANT_RESOURCE_PRICES } from '@/config/gameConfig';
import { MAX_OWNED_TILES } from '@/utils/world';
import {
	buildingCostFactor,
	calculateTileCost,
	countBuildings,
	economyTiles,
	effectiveTileDiscount,
	legacyEffect,
	sellPayout,
} from '@/utils/gameUtils';
import { castleLevelOf } from '@/lib/castleWard';
import type { PersistedGame } from '@/lib/sanitizeSave';
import type { Resources } from '@/types/game';
import type { SaveSummary } from './summary';

/**
 * The spending check: what a save has *kept or bought* cannot be worth more than the game could have paid out.
 *
 *   required = gold held + stock held (at merchant prices) + the least gold the owned tiles, buildings and castle cost
 *   allowed  = income per second (gold + everything sellable) x play time x slack + a burst allowance
 *
 * `required` only counts prices that are fixed by the cost tables (tiles, buildings, castle levels), at the best
 * discount the state can claim, so it is a floor: an honest player is always far below it. `allowed` is generous
 * (clicks, chests and loot are not modelled, the slack covers them). A save that owns 55,000 tiles after 12 minutes
 * is orders of magnitude over it, however its rates look, because the price of tile 55,000 does not depend on them.
 */
export const NETWORTH = {
	slack: 3,
	burstSec: 3600,
	floor: 50_000,
} as const;

const castleGoldSpent = (level: number): number => {
	let gold = 0;
	for (let i = 0; i < level - 1; i++) gold += CASTLE_UPGRADE.upgradeCosts[i]?.gold ?? 0;
	return gold;
};

/** Gold the owned land, buildings and castle cost at least (gold part of each price only). */
export const minimumSpend = (state: PersistedGame): number => {
	const discount = effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades);
	const purchases = Math.min(economyTiles(state.tiles, state.freeTiles) - 1, MAX_OWNED_TILES);
	let spent = 0;
	for (let k = 1; k <= purchases; k++) spent += calculateTileCost(k, discount).gold;

	const factorKeep = 1 - legacyEffect(state.prestige, 'thrift');
	const buildingGold = BUILDING_COST.base.gold ?? 0;
	const buildings = countBuildings(state.tiles);
	for (let k = 0; k < buildings; k++) spent += Math.floor(buildingGold * buildingCostFactor(k) * factorKeep);

	return spent + castleGoldSpent(castleLevelOf(state.tiles));
};

/** Gold the stock of sellable resources is worth at the merchant (with the player's own sell bonuses). */
const stockValue = (resources: Resources, state: PersistedGame): number => {
	let value = 0;
	for (const [key, price] of Object.entries(MERCHANT_RESOURCE_PRICES) as [keyof Resources, number][]) {
		value += sellPayout(price, resources[key], state);
	}
	return value;
};

/** Gold-equivalent income per second at the save's own rates: gold plus every sellable resource at its merchant price. */
export const incomePerSec = (summary: SaveSummary, state: PersistedGame): number => {
	let perSec = summary.rates.gold;
	for (const [key, price] of Object.entries(MERCHANT_RESOURCE_PRICES) as [keyof Resources, number][]) {
		perSec += sellPayout(price, summary.rates[key], state);
	}
	return perSec;
};

export interface NetWorthCheck {
	required: number;
	allowed: number;
	/** required / allowed: over 1 is flagged. Stored with the save so the slack can be tuned on real data. */
	ratio: number;
	exceeds: boolean;
}

export const checkNetWorth = (state: PersistedGame, summary: SaveSummary): NetWorthCheck => {
	const required = state.resources.gold + stockValue(state.resources, state) + minimumSpend(state);
	const perSec = incomePerSec(summary, state);
	const allowed = perSec * summary.playSeconds * NETWORTH.slack + perSec * NETWORTH.burstSec + NETWORTH.floor;
	const ratio = allowed > 0 ? required / allowed : Infinity;
	return { required, allowed, ratio, exceeds: ratio > 1 };
};
