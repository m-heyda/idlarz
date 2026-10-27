import type { PoolDef } from '@/catalog/lootConfig';
import { MAX_ITEM_LEVEL } from '@/catalog/stats';
import type { ItemDef } from '@/types/game';
import type { LootData } from './data';

export interface Candidate {
	def: ItemDef;
	weight: number;
}

/** Whether an item belongs to a pool: listed by id, naming the pool in its own `pools`, or carrying every required tag. */
export const inPool = (item: ItemDef, pool: PoolDef): boolean => {
	if (!pool.enabled || item.enabled === false) return false;
	if (pool.excludeIds?.includes(item.id)) return false;
	if (pool.excludeTags?.some((tag) => item.tags?.includes(tag))) return false;
	if (pool.includeIds?.includes(item.id)) return true;
	if (item.pools?.includes(pool.id)) return true;
	return !!pool.requireTags?.length && pool.requireTags.every((tag) => item.tags?.includes(tag));
};

export const poolMembers = (data: LootData, poolId: string): ItemDef[] => {
	const pool = data.pools[poolId];
	return pool ? Object.values(data.items).filter((item) => inPool(item, pool)) : [];
};

/** Relative chance of a member inside its pool: the pool's own weight if it has one, else the item's. */
export const weightIn = (item: ItemDef, pool: PoolDef): number => pool.weights?.[item.id] ?? item.poolWeight ?? 1;

/** Members that exist at this item level (item window and the pool's own minimum), with their weights. */
export const eligibleCandidates = (data: LootData, poolId: string, level: number): Candidate[] => {
	const pool = data.pools[poolId];
	if (!pool) return [];
	const out: Candidate[] = [];
	for (const def of Object.values(data.items)) {
		if (!inPool(def, pool)) continue;
		const min = Math.max(def.minItemLevel ?? 1, pool.minLevels?.[def.id] ?? 1);
		const max = def.maxItemLevel ?? MAX_ITEM_LEVEL;
		if (level < min || level > max) continue;
		const weight = weightIn(def, pool);
		if (weight > 0) out.push({ def, weight });
	}
	return out;
};
