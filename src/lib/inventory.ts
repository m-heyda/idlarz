import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG, STARTER_BAG_ITEMS, setBonusStats, setCounts, sumStats, type StatTotals } from '@/catalog';
import type { BagSlot, Equipment, EquipmentSlot } from '@/types/game';

// Pure bag / equipment operations. Nothing here mutates its arguments; every function returns fresh arrays and objects.

export const emptyBag = (): BagSlot[] => Array.from({ length: COMBAT.bagSize }, () => null);

export const starterBag = (): BagSlot[] =>
	STARTER_BAG_ITEMS.reduce((bag, { id, qty }) => addToBag(bag, id, qty).bag, emptyBag());

const stackMax = (id: string) => ITEM_CATALOG[id]?.stackMax ?? 1;

const validIndex = (bag: BagSlot[], index: number) =>
	Number.isInteger(index) && index >= 0 && index < bag.length;

/** Adds `qty` of an item: tops up existing stacks first, then uses the first empty slots. Whatever does not fit is `overflow`. */
export const addToBag = (
	bag: BagSlot[],
	id: string,
	qty = 1
): { bag: BagSlot[]; added: number; overflow: number } => {
	const next = bag.map((slot) => (slot ? { ...slot } : null));
	if (!ITEM_CATALOG[id] || !Number.isInteger(qty) || qty < 1) return { bag: next, added: 0, overflow: Math.max(0, qty) };

	const max = stackMax(id);
	let left = qty;
	if (max > 1) {
		for (const slot of next) {
			if (left === 0) break;
			if (slot && slot.id === id && slot.qty < max) {
				const take = Math.min(max - slot.qty, left);
				slot.qty += take;
				left -= take;
			}
		}
	}
	for (let i = 0; i < next.length && left > 0; i++) {
		if (next[i] === null) {
			const take = Math.min(max, left);
			next[i] = { id, qty: take };
			left -= take;
		}
	}
	return { bag: next, added: qty - left, overflow: left };
};

export const removeFromBag = (bag: BagSlot[], index: number, qty = 1): BagSlot[] => {
	const next = bag.map((slot) => (slot ? { ...slot } : null));
	const slot = validIndex(next, index) ? next[index] : null;
	if (!slot) return next;
	if (slot.qty <= qty) next[index] = null;
	else slot.qty -= qty;
	return next;
};

/** Swaps two bag slots; two stacks of the same consumable merge up to the stack limit. */
export const moveSlot = (bag: BagSlot[], from: number, to: number): BagSlot[] => {
	const next = bag.map((slot) => (slot ? { ...slot } : null));
	if (!validIndex(next, from) || !validIndex(next, to) || from === to) return next;
	const a = next[from];
	const b = next[to];
	if (a && b && a.id === b.id && stackMax(a.id) > 1) {
		const max = stackMax(a.id);
		const total = a.qty + b.qty;
		b.qty = Math.min(total, max);
		next[from] = total > max ? { id: a.id, qty: total - max } : null;
		return next;
	}
	next[from] = b;
	next[to] = a;
	return next;
};

/** Equips the gear in a bag slot, sending whatever was in that gear slot back into the freed bag slot. */
export const equipFromBag = (
	bag: BagSlot[],
	equipment: Equipment,
	index: number
): { bag: BagSlot[]; equipment: Equipment } | null => {
	if (!validIndex(bag, index)) return null;
	const entry = bag[index];
	const def = entry ? ITEM_CATALOG[entry.id] : undefined;
	if (!entry || !def || !def.slot) return null;

	let target: EquipmentSlot;
	if (def.slot === 'ring') {
		target = !equipment.ring1 ? 'ring1' : !equipment.ring2 ? 'ring2' : 'ring1';
	} else {
		target = def.slot;
	}

	const displaced = equipment[target];
	const nextBag = bag.map((slot) => (slot ? { ...slot } : null));
	nextBag[index] = displaced ? { id: displaced, qty: 1 } : null;
	return { bag: nextBag, equipment: { ...equipment, [target]: entry.id } };
};

/** Moves an equipped item into the first free bag slot; null if the slot is empty or the bag is full. */
export const unequip = (
	bag: BagSlot[],
	equipment: Equipment,
	slot: EquipmentSlot
): { bag: BagSlot[]; equipment: Equipment } | null => {
	const id = equipment[slot];
	if (!id) return null;
	const free = bag.findIndex((s) => s === null);
	if (free < 0) return null;
	const nextBag = bag.map((s) => (s ? { ...s } : null));
	nextBag[free] = { id, qty: 1 };
	const nextEquipment = { ...equipment };
	delete nextEquipment[slot];
	return { bag: nextBag, equipment: nextEquipment };
};

/** The one place gear is summed: stats of everything equipped plus the set bonuses reached (all via the catalog's stat table). */
export const aggregateStats = (equipment: Equipment): StatTotals & { setCount: number } => {
	const worn = Object.values(equipment).map((id) => (id ? ITEM_CATALOG[id]?.stats : undefined));
	const counts = setCounts(equipment);
	const total = sumStats(...worn, setBonusStats(counts));
	return { ...total, setCount: Math.max(0, ...Object.values(counts)) };
};
