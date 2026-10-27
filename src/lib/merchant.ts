import { MERCHANT_GOODS } from '@/config/gameConfig';
import { generateLoot } from '@/lib/loot';
import { sellValueOf } from '@/lib/itemInstance';
import type { Rng } from '@/lib/rng';
import type { ItemInstance, MerchantStock } from '@/types/game';

// The merchant's shuffling goods: a few pieces of gear rolled by the shared loot pipeline (source `merchant`), refreshed on a
// timer of play time or for gold. Pure; the store applies the results and saves the stock (the price is derived, never stored).

/** What a piece of gear costs at the merchant: far above what he pays for it, so buying and selling can never print gold. */
export const shopPriceOf = (item: ItemInstance): number => Math.ceil(sellValueOf(item) * MERCHANT_GOODS.priceFactor);

/** The gold a paid refresh costs: it grows with the world level, like what the goods are worth. */
export const refreshCost = (castleLevel: number): number => MERCHANT_GOODS.refreshBase * Math.max(1, Math.floor(castleLevel)) ** 2;

/** A new shelf of goods, rolled at the world (castle) level and stamped with the play time it was made. */
export const generateMerchantStock = (castleLevel: number, rng: Rng, playSeconds: number): MerchantStock => {
	const result = generateLoot({ sourceId: 'merchant', castleLevel }, rng);
	if (result.warnings.length) console.warn('[loot]', ...result.warnings);
	const offers = result.drops.flatMap((drop) => (drop.kind === 'gear' ? [drop.item] : []));
	return { at: playSeconds, offers: offers.slice(0, MERCHANT_GOODS.offers) };
};

/** Seconds of play until the shelf is reshuffled (0 once it is due). */
export const secondsToRotation = (stock: MerchantStock, playSeconds: number): number =>
	Math.max(0, MERCHANT_GOODS.rotateSec - (playSeconds - stock.at));

export const stockDue = (stock: MerchantStock | null, playSeconds: number): boolean => !stock || secondsToRotation(stock, playSeconds) <= 0;
