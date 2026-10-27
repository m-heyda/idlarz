import { ITEM_CATALOG } from '@/catalog';
import { addDrop } from '@/lib/inventory';
import { sellValueOf } from '@/lib/itemInstance';
import { sellPayout } from '@/utils/gameUtils';
import type { BagSlot, Drop } from '@/types/game';
import { isAutoSold } from './autoSell';

export interface Received {
	bag: BagSlot[];
	/** What actually went into the bag */
	stored: Drop[];
	/** Gold paid for drops that did not fit into the bag (their plain sell value) */
	convertedGold: number;
	/** Gear the auto-sell filter sold on the spot (with the merchant's Haggler bonus, like selling it by hand) */
	autoSold: { count: number; gold: number };
}

/** Hands drops to the player: the auto-sell filter takes what it matches, the rest goes into the bag, and what does not fit turns into gold. */
export const receiveDrops = (bag: BagSlot[], drops: readonly Drop[], autoSellUpTo: string | null, merchantUpgrades: Record<string, number>): Received => {
	let current = bag;
	const stored: Drop[] = [];
	let convertedGold = 0;
	const autoSold = { count: 0, gold: 0 };
	for (const drop of drops) {
		if (drop.kind === 'gear' && isAutoSold(drop.item, autoSellUpTo)) {
			autoSold.count++;
			autoSold.gold += sellPayout(sellValueOf(drop.item), 1, merchantUpgrades);
			continue;
		}
		const added = addDrop(current, drop);
		current = added.bag;
		if (drop.kind === 'gear') {
			if (added.overflow === 0) stored.push(drop);
			else convertedGold += sellValueOf(drop.item);
		} else {
			const qty = drop.qty - added.overflow;
			if (qty > 0) stored.push({ kind: 'consumable', id: drop.id, qty });
			convertedGold += added.overflow * (ITEM_CATALOG[drop.id]?.sellValue ?? 0);
		}
	}
	return { bag: current, stored, convertedGold, autoSold };
};
