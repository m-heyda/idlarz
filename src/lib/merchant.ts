import { MERCHANT_GOODS } from '@/config/gameConfig';
import { LOOT_SOURCES } from '@/catalog/lootConfig';
import { limitOf, type LimitContext } from '@/lib/limits';
import { generateLoot, resolveSourceLevel } from '@/lib/loot';
import { sellValueOf } from '@/lib/itemInstance';
import { mulberry32, type Rng } from '@/lib/rng';
import type { ItemInstance, MerchantStock } from '@/types/game';

// The merchant's shuffling goods: a few pieces of gear rolled by the shared loot pipeline (source `merchant`), refreshed on a
// timer of play time or for gold. Pure; the store applies the results and saves the stock (the price is derived, never stored).

/** What a piece of gear costs at the merchant: far above what he pays for it, so buying and selling can never print gold. */
export const shopPriceOf = (item: ItemInstance): number => Math.ceil(sellValueOf(item) * MERCHANT_GOODS.priceFactor);

/**
 * The gold the next paid refresh costs, when `refreshesBought` have been bought this run: 5k, 10k ... 50k for the first ten, then
 * every further one 50k more than the one before (100k, 150k ...).
 */
export const refreshCost = (refreshesBought: number, ctx: LimitContext = {}): number => {
	const { stepRefreshes, bigStep } = MERCHANT_GOODS.refresh;
	const base = limitOf('merchantRefreshBase', ctx);
	const n = Math.max(0, Math.floor(refreshesBought));
	return n < stepRefreshes ? base * (n + 1) : base * stepRefreshes + bigStep * (n - stepRefreshes + 1);
};

/**
 * The item level the goods are built around and the one they may never pass. The world (castle) level sets how far the shelf can
 * go; the gear the player wears (its average item level) holds it down, so it never sells much better than what is already worn.
 */
export const shelfLevels = (castleLevel: number, averageLevel: number): { centre: number; max: number } => {
	const worn = Math.max(1, Math.round(averageLevel));
	const world = resolveSourceLevel(LOOT_SOURCES.merchant.level!, castleLevel);
	return { centre: Math.min(world, worn + MERCHANT_GOODS.centreAboveAverage), max: worn + MERCHANT_GOODS.maxAboveAverage };
};

/** A new shelf of goods, rolled at the world (castle) level and the player's gear, and stamped with the play time it was made. */
export const generateMerchantStock = (
	castleLevel: number,
	averageLevel: number,
	rng: Rng,
	playSeconds: number,
	ctx: LimitContext = {}
): MerchantStock => {
	const { centre, max } = shelfLevels(castleLevel, averageLevel);
	const result = generateLoot({ sourceId: 'merchant', castleLevel, level: centre, maxItemLevel: max }, rng);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	const offers = result.drops.flatMap((drop) => (drop.kind === 'gear' ? [drop.item] : []));
	return { at: playSeconds, offers: offers.slice(0, limitOf('merchantOffers', ctx)) };
};

/**
 * The generator for a shelf the clock reshuffles: seeded by the play time it is made at, so the timed rotation never takes
 * numbers from `Math.random` (the rest of the game's randomness, spawns and chests, is the same with or without a shelf).
 */
export const rotationRng = (playSeconds: number): Rng => mulberry32(Math.floor(playSeconds * 1000) ^ 0x5bd1e995);

/** Seconds of play until the shelf is reshuffled (0 once it is due). */
export const secondsToRotation = (stock: MerchantStock, playSeconds: number, ctx: LimitContext = {}): number =>
	Math.max(0, limitOf('merchantRotateSec', ctx) - (playSeconds - stock.at));

export const stockDue = (stock: MerchantStock | null, playSeconds: number, ctx: LimitContext = {}): boolean =>
	!stock || secondsToRotation(stock, playSeconds, ctx) <= 0;
