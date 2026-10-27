import type { ItemInstance } from '@/types/game';
import { LOOT_DATA, type LootData } from './data';

/** Whether the auto-sell filter takes a piece of gear: its rarity ranks at or below the chosen one. `upTo` null keeps everything. */
export const isAutoSold = (item: ItemInstance, upTo: string | null, data: LootData = LOOT_DATA): boolean => {
	if (upTo === null) return false;
	const limit = data.rarities[upTo];
	const rarity = data.rarities[item.rarity];
	return !!limit && !!rarity && rarity.order <= limit.order;
};
