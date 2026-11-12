/* eslint-disable @typescript-eslint/no-unused-vars -- the gear part of the junk rule has no body until it is decided */
import { ITEM_CATALOG } from '@/catalog';
import { gearOf, removeFromBag, slotQty } from '@/lib/inventory';
import { sellValueOf } from '@/lib/itemInstance';
import { sellPayout, type SellContext } from '@/utils/game/merchant';
import type { BagSlot, ItemInstance } from '@/types/game';

/** What the junk rule may look at besides the piece itself. Empty today; it grows with the rule (average worn level, the player's own marks, locked items). */
export interface JunkContext {
	// TODO(junk): the gear rule has not been decided yet: a player flag per item, rarity rules, item level under the worn average, protection for set pieces, crafted and locked items.
	readonly _reserved?: never;
}

/**
 * Whether a piece of **gear** in the bag counts as junk for the "Sell junk" button. False for everything until the gear rule is decided (a player flag, a rarity rule, item level under the worn average); worn gear is never in the bag, and set
 * pieces and locked items will be protected when they exist.
 *
 * @category Loot/Junk
 * @order 1
 * @see isJunkStack, junkSale
 */
export const isJunk = (_item: ItemInstance, _ctx?: JunkContext): boolean => {
	// TODO(junk): decide which gear is junk. Until then no gear is.
	return false;
};

/** Whether a bag stack is a junk material (`ItemDef.junk`, the materials monsters drop: bones, feathers, crystals ...). Potions and every other stack are not. */
export const isJunkStack = (id: string): boolean => ITEM_CATALOG[id]?.junk === true;

/** The Sell junk button's number: junk materials (every unit) plus the gear the rule names, in the bag now. */
export const countJunk = (bag: readonly BagSlot[], junk: (item: ItemInstance) => boolean = isJunk): number =>
	bag.reduce((sum, slot) => {
		if (!slot) return sum;
		if ('item' in slot) return sum + (junk(slot.item) ? 1 : 0);
		return sum + (isJunkStack(slot.id) ? slot.qty : 0);
	}, 0);

/**
 * What the Sell junk button does to a bag: every junk stack goes whole and every piece of gear the rule names goes, each paid at its sell value through the merchant's Haggler and Idol bonuses. The one function the server and the browser both run,
 * so their previews agree. `junk` is a parameter so a test can flip the gear rule.
 *
 * @category Loot/Junk
 * @order 2
 */
export const junkSale = (
	bag: BagSlot[],
	sellCtx: SellContext,
	junk: (item: ItemInstance) => boolean = isJunk,
): { bag: BagSlot[]; gold: number; count: number } => {
	let next = bag;
	let gold = 0;
	let count = 0;
	bag.forEach((slot, index) => {
		const gear = gearOf(slot);
		if (gear) {
			if (!junk(gear)) return;
			gold += sellPayout(sellValueOf(gear), 1, sellCtx);
			count += 1;
			next = removeFromBag(next, index, 1);
		} else if (slot && 'id' in slot && isJunkStack(slot.id)) {
			const qty = slotQty(slot);
			gold += sellPayout(ITEM_CATALOG[slot.id].sellValue, qty, sellCtx);
			count += qty;
			next = removeFromBag(next, index, qty);
		}
	});
	return { bag: next, gold, count };
};
