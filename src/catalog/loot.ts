import { ITEMS } from './items';

// What drops where is loot config (lootConfig.ts) run by src/lib/loot; this file keeps the shop list.

/** Items the merchant sells, cheapest first. */
export const shopItems = (): { id: string; price: number }[] =>
	ITEMS.filter((def) => def.shop !== undefined)
		.map((def) => ({ id: def.id, price: def.shop as number }))
		.sort((a, b) => a.price - b.price);
