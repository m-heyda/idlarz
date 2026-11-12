import type { BagSlot, ItemInstance } from '@/types/game';

/** What the junk rule may look at besides the piece itself. Empty today; it grows with the rule (average worn level, the player's own marks, locked items). */
export interface JunkContext {
	// TODO(junk): the rule has not been decided yet (IDL-312): a player flag per item, rarity rules, item level under the worn average, protection for set pieces, crafted and locked items.
	readonly _reserved?: never;
}

/**
 * Whether a piece of gear in the bag counts as junk for the "Sell junk" button. **This is the one place that defines junk.** It is false for everything until the rule is decided (IDL-312), so the button sells nothing yet; the server
 * (`sellJunk` with `rule: 'junk'`) and the browser both ask it, so they always agree. Never junk, whatever the rule says: worn gear (it is not in the bag), potions and other stacks (they are not gear), and, once they exist, set pieces and items the
 * player locked.
 *
 * @category Loot/Junk
 * @order 1
 * @see countJunk
 */
export const isJunk = (_item: ItemInstance, _ctx?: JunkContext): boolean => {
	// TODO(junk): decide what junk is (IDL-312). Until then nothing is junk.
	return false;
};

/** How many pieces in the bag are junk now (the number the Bag's Sell junk button shows). Stacks are never junk. */
export const countJunk = (bag: readonly BagSlot[], junk: (item: ItemInstance) => boolean = isJunk): number =>
	bag.reduce((sum, slot) => sum + (slot && 'item' in slot && junk(slot.item) ? 1 : 0), 0);
