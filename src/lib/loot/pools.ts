import type { PoolDef } from '@/catalog/lootConfig';
import { MAX_ITEM_LEVEL } from '@/catalog/stats';
import { gradeAllowed, type Grade } from '@/catalog/items/grades';
import type { ItemDef } from '@/types/game';
import type { LootData } from './data';

export interface Candidate {
	def: ItemDef;
	weight: number;
}

/** Whether an item belongs to a pool: listed by id, naming the pool in its own `pools`, or carrying every required tag. */
const inPool = (item: ItemDef, pool: PoolDef): boolean => {
	if (!pool.enabled || item.enabled === false) return false;
	if (item.craftOnly && pool.id !== 'equipment_craft') return false; // made at the workbench only
	if (pool.excludeIds?.includes(item.id)) return false;
	if (pool.maxGrade && !gradeAllowed(item, pool.maxGrade)) return false;
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
const weightIn = (item: ItemDef, pool: PoolDef): number => pool.weights?.[item.id] ?? item.poolWeight ?? 1;

/**
 * Members that exist at this item level (item window and the pool's own minimum), with their weights.
 *
 * @category Loot/Pipeline
 * @order 7
 */
export const eligibleCandidates = (data: LootData, poolId: string, level: number, maxGrade?: Grade): Candidate[] => {
	let byKey = eligibleCache.get(data);
	if (!byKey) eligibleCache.set(data, (byKey = new Map()));
	const key = `${poolId}|${level}|${maxGrade ?? ''}`;
	let found = byKey.get(key);
	if (!found) byKey.set(key, (found = scanEligible(data, poolId, level, maxGrade)));
	return found;
};

/**
 * The scan of every item for a pool at a level, kept per `LootData` object: the catalog is fixed once the data is built (a test or a projection that edits items builds its own copy
 * first), and a simulation of millions of kills asks the same few (pool, level) questions again and again, which made the scan most of its time. Callers only read the list.
 */
const eligibleCache = new WeakMap<LootData, Map<string, Candidate[]>>();

const scanEligible = (data: LootData, poolId: string, level: number, maxGrade?: Grade): Candidate[] => {
	const pool = data.pools[poolId];
	if (!pool) return [];
	const out: Candidate[] = [];
	for (const def of Object.values(data.items)) {
		if (!inPool(def, pool)) continue;
		if (maxGrade && !gradeAllowed(def, maxGrade)) continue;
		const min = Math.max(def.dropLevels?.[0] ?? def.minItemLevel ?? 1, pool.minLevels?.[def.id] ?? 1);
		const max = def.dropLevels?.[1] ?? def.maxItemLevel ?? MAX_ITEM_LEVEL;
		if (level < min || level > max) continue;
		const weight = weightIn(def, pool);
		if (weight > 0) out.push({ def, weight });
	}
	return out;
};
