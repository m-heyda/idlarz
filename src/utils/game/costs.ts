// What buying a tile costs, and paying for it (part of the former utils/gameUtils.ts, split in IDL-15).
import { SCALING_CONFIG, TILE_RESOURCE_COST } from '@/config/economy';
import type { Resources, TileCost } from '@/types/game';

/**
 * Everything buying the next tile costs, given how many tiles are owned and the Charisma discount (percent).
 *
 * `discountPercent` removes that percent from the gold and from every extra part ({@link effectiveTileDiscount} computes it).
 *
 * @category Economy/Tiles
 * @order 3
 * @see tilePrice, effectiveTileDiscount, TILE_RESOURCE_COST
 */
export const calculateTileCost = (ownedTiles: number, discountPercent = 0): TileCost => {
	const keep = 1 - discountPercent / 100;
	const base = SCALING_CONFIG.costFormula(ownedTiles);
	const resources: Partial<Resources> = {};
	TILE_RESOURCE_COST.forEach(({ from, resource, share }) => {
		if (ownedTiles >= from) resources[resource] = Math.floor(base * share * keep);
	});
	return { gold: Math.floor(base * keep), resources };
};

/** Cost of a bundle of resources (gold included) as a flat partial-resources object. */
export const tileCostAsResources = (cost: TileCost): Partial<Resources> => ({
	...cost.resources,
	gold: cost.gold,
});

export const canAffordBundle = (resources: Resources, cost: Partial<Resources>): boolean =>
	Object.entries(cost).every(([resource, amount]) => resources[resource as keyof Resources] >= (amount || 0));

/** Returns a copy of `resources` with `cost` subtracted (callers check affordability first). */
export const subtractBundle = (resources: Resources, cost: Partial<Resources>): Resources => {
	const next = { ...resources };
	Object.entries(cost).forEach(([resource, amount]) => {
		next[resource as keyof Resources] -= amount || 0;
	});
	return next;
};
