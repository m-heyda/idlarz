import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { gearOf, removeFromBag, slotQty } from '@/lib/inventory';
import { sellValueOf } from '@/lib/itemInstance';
import { sellPayout, type SellContext } from '@/utils/game/merchant';
import type { BagSlot, ItemInstance } from '@/types/game';

/** What the gear junk rule may look at besides the piece itself. */
export interface JunkContext {
	/** What is worn now: a piece is only compared with the piece worn in its own slot (absent: nothing is worn, so the rule never fires) */
	equipment?: Partial<Record<string, ItemInstance | undefined>>;
}

/** A piece more than this many item levels below what you wear in the same slot can count as junk (placeholder, balance pass). */
export const JUNK_LEVEL_MARGIN = 5;

/** The worn slots a bag piece would take the place of: its own slot, both ring slots for a ring, none for anything that is not gear. */
const slotsOf = (item: ItemInstance): string[] => {
	const slot = ITEM_CATALOG[item.base]?.slot;
	if (!slot) return [];
	return slot === 'ring' ? ['ring1', 'ring2'] : [slot];
};

/** The rank of a piece's rarity (higher is rarer; an unknown id ranks 0). */
const rank = (item: ItemInstance): number => (RARITIES as Record<string, { order: number } | undefined>)[item.rarity]?.order ?? 0;

/** Whether `item` is clearly worse than the worn piece `than`: more than `JUNK_LEVEL_MARGIN` item levels lower and not better in rarity, number of affixes or sell value (the worth of its stats). Better on any one count makes it a possible upgrade. */
const clearlyWorse = (item: ItemInstance, than: ItemInstance): boolean =>
	item.level < than.level - JUNK_LEVEL_MARGIN &&
	rank(item) <= rank(than) &&
	item.affixes.length <= than.affixes.length &&
	sellValueOf(item) <= sellValueOf(than);

/** The average item level of the worn gear, rounded down (0 with nothing worn). Not the junk rule any more (it compares slot by slot); the achievements read it. */
export const wornLevelOf = (equipment: Partial<Record<string, ItemInstance | undefined>>): number => {
	const worn = Object.values(equipment).filter((item): item is ItemInstance => !!item);
	return worn.length === 0 ? 0 : Math.floor(worn.reduce((sum, item) => sum + item.level, 0) / worn.length);
};

/**
 * Whether a piece of **gear** in the bag counts as junk for the "Sell junk" button: the player marked it (`item.junk`, the right-click menu), or it is clearly worse than the piece worn in the same slot (`clearlyWorse`: more than `JUNK_LEVEL_MARGIN`
 * item levels lower and not better in rarity, affix count or sell value). A ring is compared with both worn rings and must be worse than both. An empty slot has nothing to compare with, so the piece is never junk (it may be your next upgrade). The rule
 * never touches set pieces, epic or legendary pieces or crafted gear (the mark overrides all of that: it is the player's own call). Worn gear is never in the bag.
 *
 * @category Loot/Junk
 * @order 1
 * @see isJunkStack, junkSale
 */
export const isJunk = (item: ItemInstance, ctx?: JunkContext): boolean => {
	if (item.junk) return true;
	if (item.crafted || item.rarity === 'epic' || item.rarity === 'legendary' || ITEM_CATALOG[item.base]?.set) return false;
	const slots = slotsOf(item);
	if (slots.length === 0 || !ctx?.equipment) return false;
	return slots.every((slot) => {
		const worn = ctx.equipment?.[slot];
		return !!worn && clearlyWorse(item, worn);
	});
};

/** The piece with the player's junk mark set or cleared (the field is left out, not false, when clear). */
export const withJunkMark = (item: ItemInstance, junk: boolean): ItemInstance => {
	const copy: ItemInstance = { ...item };
	if (junk) copy.junk = true;
	else delete copy.junk;
	return copy;
};

/** The junk test for one player: the rule against what they wear now. */
export const junkFor =
	(equipment: Partial<Record<string, ItemInstance | undefined>>) =>
	(item: ItemInstance): boolean =>
		isJunk(item, { equipment });

/** Whether a bag stack is a junk material (`ItemDef.junk`, the materials monsters drop: bones, feathers, crystals ...). Potions and every other stack are not. */
export const isJunkStack = (id: string): boolean => ITEM_CATALOG[id]?.junk === true;

/** The Sell junk button's number: junk materials (every unit) plus the gear the rule names, in the bag now. */
export const countJunk = (bag: readonly BagSlot[], junk: (item: ItemInstance) => boolean = (item) => isJunk(item)): number =>
	bag.reduce((sum, slot) => {
		if (!slot) return sum;
		if ('item' in slot) return sum + (junk(slot.item) ? 1 : 0);
		return sum + (isJunkStack(slot.id) ? slot.qty : 0);
	}, 0);

/** The gold the Sell junk button would pay for this bag now (what `junkSale` pays, through the merchant's Haggler and Idol bonuses): the number the button shows. */
export const junkGold = (bag: BagSlot[], sellCtx: SellContext, junk: (item: ItemInstance) => boolean = (item) => isJunk(item)): number =>
	junkSale(bag, sellCtx, junk).gold;

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
	junk: (item: ItemInstance) => boolean = (item) => isJunk(item),
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
