import { AFFIX_CATALOG, ITEM_CATALOG, LOOT_POOLS, LOOT_PROFILES, LOOT_SOURCES, RARITIES } from '@/catalog';
import type { AffixDef } from '@/catalog/affixes';
import type { LootProfile, LootSource, PoolDef } from '@/catalog/lootConfig';
import type { RarityDef } from '@/catalog/rarity';
import type { ItemDef } from '@/types/game';

/**
 * Everything the loot pipeline reads, as one injectable bundle. The game uses `LOOT_DATA`; tests and the simulator pass a
 * modified copy (a fake rarity, a broken pool) to prove the pipeline needs no code change for new content.
 */
export interface LootData {
	rarities: Record<string, RarityDef>;
	items: Record<string, ItemDef>;
	affixes: Record<string, AffixDef>;
	pools: Record<string, PoolDef>;
	profiles: Record<string, LootProfile>;
	sources: Record<string, LootSource>;
}

export const LOOT_DATA: LootData = {
	rarities: RARITIES,
	items: ITEM_CATALOG,
	affixes: AFFIX_CATALOG,
	pools: LOOT_POOLS,
	profiles: LOOT_PROFILES,
	sources: LOOT_SOURCES,
};
