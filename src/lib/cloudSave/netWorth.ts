import { BUILDINGS_FLAG } from '@/config/buildings';
import { CASTLE_UPGRADE } from '@/config/castle';
import { builtBuildings, buildingTotalCost } from '@/lib/buildings';
import { MERCHANT_RESOURCE_PRICES, MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/merchant';
import { MAX_OWNED_TILES } from '@/utils/world';
import { calculateTileCost } from '@/utils/game/costs';
import { economyTiles } from '@/utils/game/tiles';
import { effectiveTileDiscount } from '@/utils/game/rebirth';
import { merchantLevel, merchantUpgradeCost, sellPayout } from '@/utils/game/merchant';
import { castleLevelOf } from '@/lib/castleWard';
import type { PersistedGame } from '@/lib/sanitizeSave';
import type { Resources } from '@/types/game';
import type { GrantTotals } from '@/lib/offline/ledger';
import type { SaveSummary } from './summary';

/**
 * The spending check: what a save has *kept or bought* cannot be worth more than the game could have paid out.
 *
 *   required = gold held + stock held (at merchant prices) + the least gold the owned tiles and castle cost
 *   allowed  = income per second (gold + everything sellable) x play time x slack + a burst allowance
 *
 * `required` only counts prices that are fixed by the cost tables (tiles, castle levels), at the best
 * discount the state can claim, so it is a floor: an honest player is always far below it. `allowed` is generous
 * (clicks, chests and loot are not modelled, the slack covers them). A save that owns 55,000 tiles after 12 minutes
 * is orders of magnitude over it, however its rates look, because the price of tile 55,000 does not depend on them.
 */
const NETWORTH = {
	slack: 3,
	burstSec: 3600,
	floor: 50_000,
} as const;

const castleGoldSpent = (level: number): number => {
	let gold = 0;
	for (let i = 0; i < level - 1; i++) gold += CASTLE_UPGRADE.upgradeCosts[i]?.gold ?? 0;
	return gold;
};

/**
 * Gold the merchant levels cost (IDL-168). Every one starts again on a rebirth, so what the save holds was paid for in this run; Pack Rat is
 * left out because its bigger bag survives a rebirth (its levels were paid in earlier runs, against other play time).
 */
export const merchantGoldSpent = (upgrades: Record<string, number> | undefined): number => {
	let spent = 0;
	for (const id of Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[]) {
		if (id === 'packrat') continue;
		for (let level = 0; level < merchantLevel(upgrades, id); level++) spent += merchantUpgradeCost(id, level);
	}
	return spent;
};

/**
 * Gold the buildings cost at least (zero while the building system is off): each one's levels at the price of the very first tile count, the cheapest it could ever have been bought for.
 * A floor like the tile prices above, so only a forged map full of high-level buildings stands out.
 */
export const buildingGoldSpent = (state: PersistedGame): number =>
	BUILDINGS_FLAG.enabled ? builtBuildings(state.tiles).reduce((sum, b) => sum + (buildingTotalCost(b.level, 1).gold ?? 0), 0) : 0;

/** Gold the owned land and castle cost at least (gold part of each price only). */
export const minimumSpend = (state: PersistedGame): number => {
	const discount = effectiveTileDiscount(state.characterStats, state.prestige, state.merchantUpgrades, state.playerClass);
	const purchases = Math.min(economyTiles(state.tiles, state.freeTiles) - 1, MAX_OWNED_TILES);
	let spent = 0;
	for (let k = 1; k <= purchases; k++) spent += calculateTileCost(k, discount).gold;

	return spent + castleGoldSpent(castleLevelOf(state.tiles)) + merchantGoldSpent(state.merchantUpgrades) + buildingGoldSpent(state);
};

/** Gold the stock of sellable resources is worth at the merchant (with the player's own sell bonuses). */
export const stockValue = (resources: Resources, state: PersistedGame): number => {
	let value = 0;
	for (const [key, price] of Object.entries(MERCHANT_RESOURCE_PRICES) as [keyof Resources, number][]) {
		value += sellPayout(price, resources[key], state);
	}
	return value;
};

/** Gold-equivalent income per second at the save's own rates: gold plus every sellable resource at its merchant price. */
const incomePerSec = (summary: SaveSummary, state: PersistedGame): number => {
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

/** Gold-equivalent worth of everything the server ever granted this account (the sellable resources at merchant prices). */
const grantedValue = (granted: GrantTotals, state: PersistedGame): number => {
	let value = granted.gold;
	for (const [key, price] of Object.entries(MERCHANT_RESOURCE_PRICES) as [keyof Resources, number][]) {
		value += sellPayout(price, granted[key] ?? 0, state);
	}
	return value;
};

export const checkNetWorth = (state: PersistedGame, summary: SaveSummary, granted?: GrantTotals): NetWorthCheck => {
	const required = state.resources.gold + stockValue(state.resources, state) + minimumSpend(state);
	const perSec = incomePerSec(summary, state);
	const allowed = perSec * summary.playSeconds * NETWORTH.slack + perSec * NETWORTH.burstSec + NETWORTH.floor + (granted ? grantedValue(granted, state) : 0);
	const ratio = allowed > 0 ? required / allowed : Infinity;
	return { required, allowed, ratio, exceeds: ratio > 1 };
};
