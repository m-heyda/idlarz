import { INGREDIENT_BY_JUNK } from '@/catalog/ingredients';
import type { Ledger } from '@/lib/offline/ledger';
import { stashIn } from '@/lib/offline/reward';

// SERVER ONLY. Stacks of an ingredient that the player already held in the bag when the ingredients moved to the Crafting bag (IDL-358, IDL-374: Wet Clay, Vial of Blood, Dark Horn ...) are junk stacks under the old ids. New drops go straight to the Crafting bag, so these
// old stacks are the only ones left; every request moves them over, which is a quick pass over the bag that finds nothing once it has run.

/**
 * Moves every bag stack of an ingredient (by its old junk id, see `INGREDIENT_BY_JUNK`) into the Crafting bag stock, up to the stock cap per ingredient; what does not fit stays in the bag. The bag version moves on, so the browser fetches the new bag.
 * Returns the same ledger when there is nothing to move.
 */
export const moveIngredientStacks = (ledger: Ledger): Ledger => {
	const inv = ledger.inv;
	if (!inv) return ledger;
	const add: Record<string, number> = {};
	for (const slot of inv.bag) {
		if (!slot || !('id' in slot)) continue;
		const def = INGREDIENT_BY_JUNK.get(slot.id);
		if (def && slot.qty > 0) add[def.id] = (add[def.id] ?? 0) + slot.qty;
	}
	if (Object.keys(add).length === 0) return ledger;
	const { stock, stored } = stashIn(ledger.craft.stock, add);
	// the part of each stack that fits leaves the bag, slot by slot in bag order; the rest (a full Crafting bag) stays
	const left: Record<string, number> = { ...stored };
	const bag = inv.bag.map((slot) => {
		if (!slot || !('id' in slot)) return slot;
		const def = INGREDIENT_BY_JUNK.get(slot.id);
		const room = def ? (left[def.id] ?? 0) : 0;
		if (!def || room <= 0) return slot;
		const take = Math.min(room, slot.qty);
		left[def.id] = room - take;
		return take >= slot.qty ? null : { ...slot, qty: slot.qty - take };
	});
	if (Object.keys(stored).length === 0) return ledger;
	return { ...ledger, craft: { ...ledger.craft, stock }, inv: { ...inv, ver: inv.ver + 1, bag } };
};
