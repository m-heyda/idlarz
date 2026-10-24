import type { DropSource, ItemDef } from '@/types/game';
import { ITEMS } from './items';

// Loot pools are read off the items: an item lists the sources it can drop from (`drops`) and its weight there.

export interface PoolEntry {
	id: string;
	weight: number;
}

/** The weighted pool of a source at a monster tier, optionally restricted (e.g. to consumables or to gear). */
export const lootPool = (source: DropSource, tier = 1, filter?: (def: ItemDef) => boolean): PoolEntry[] =>
	ITEMS.flatMap((def) => {
		const rule = def.drops?.[source];
		if (!rule || rule.weight <= 0) return [];
		if (rule.minTier !== undefined && tier < rule.minTier) return [];
		if (rule.maxTier !== undefined && tier > rule.maxTier) return [];
		if (filter && !filter(def)) return [];
		return [{ id: def.id, weight: rule.weight }];
	});

export const isConsumable = (def: ItemDef): boolean => def.kind === 'consumable';
export const isGear = (def: ItemDef): boolean => def.kind !== 'consumable';

/** Picks an entry by weight. A pool of one costs no random number. */
export const pickWeighted = (pool: PoolEntry[], rng: () => number): string | undefined => {
	if (pool.length === 0) return undefined;
	if (pool.length === 1) return pool[0].id;
	let r = rng() * pool.reduce((sum, entry) => sum + entry.weight, 0);
	for (const entry of pool) {
		r -= entry.weight;
		if (r < 0) return entry.id;
	}
	return pool[pool.length - 1].id;
};

/** Items the merchant sells, cheapest first. */
export const shopItems = (): { id: string; price: number }[] =>
	ITEMS.filter((def) => def.shop !== undefined)
		.map((def) => ({ id: def.id, price: def.shop as number }))
		.sort((a, b) => a.price - b.price);
