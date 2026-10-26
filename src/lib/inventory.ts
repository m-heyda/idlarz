import { COMBAT } from '@/config/combatConfig';
import { ITEM_CATALOG, SETS, STARTER_BAG_ITEMS, STAT_KEYS, setBonusStats, setCounts, sumStats, type ItemStats, type StatKey, type StatTotals } from '@/catalog';
import type { BagSlot, Equipment, EquipmentSlot, ItemDef } from '@/types/game';

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

/** The gear slot an item goes into: rings take the first free ring slot (else replace the first), everything else its own slot. */
export const targetSlot = (def: ItemDef, equipment: Equipment): EquipmentSlot | null => {
	if (!def.slot) return null;
	if (def.slot === 'ring') return !equipment.ring1 ? 'ring1' : !equipment.ring2 ? 'ring2' : 'ring1';
	return def.slot;
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
	const target = def ? targetSlot(def, equipment) : null;
	if (!entry || !def || !target) return null;

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

/** What wearing a piece of gear would change: the slot it takes, what is in it now, and the change of every stat (set bonuses included). */
export interface ItemComparison {
	slot: EquipmentSlot;
	equippedId?: string;
	/** Only the stats that change; positive is better */
	deltas: ItemStats;
}

/** Compares a piece of gear with what is worn in the slot it would take; null for anything that is not gear. */
export const compareToEquipped = (itemId: string, equipment: Equipment): ItemComparison | null => {
	const def = ITEM_CATALOG[itemId];
	const slot = def ? targetSlot(def, equipment) : null;
	if (!def || !slot) return null;
	const before = aggregateStats(equipment);
	const after = aggregateStats({ ...equipment, [slot]: itemId });
	const deltas: ItemStats = {};
	for (const key of STAT_KEYS) {
		const delta = Math.round((after[key] - before[key]) * 100) / 100;
		if (delta) deltas[key] = delta;
	}
	return { slot, equippedId: equipment[slot], deltas };
};

export type StatRowStatus = 'new' | 'lost' | 'up' | 'down' | 'same';

/** One stat line of a comparison: what the worn piece gives (`was`), what the hovered piece would give (`now`). */
export interface StatRow {
	key: StatKey;
	was: number;
	now: number;
	delta: number;
	/** new: only the hovered piece has it, lost: only the worn piece has it */
	status: StatRowStatus;
}

/** A set whose piece count changes with the swap, and the bonus tiers that switch on (gained) or off (lost). */
export interface SetChange {
	setId: string;
	label: string;
	from: number;
	to: number;
	size: number;
	gained: { count: number; stats: ItemStats }[];
	lost: { count: number; stats: ItemStats }[];
}

export interface DetailedComparison {
	slot: EquipmentSlot;
	equippedId?: string;
	/** The two pieces side by side, stat by stat (own stats only, no set bonuses) */
	rows: StatRow[];
	setChanges: SetChange[];
	/** The whole character: every stat that changes, set bonuses included (same as `compareToEquipped().deltas`) */
	net: ItemStats;
	/** The equipment as it would be after the swap, for previewing set progress */
	after: Equipment;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The hover comparison: the hovered piece against the one worn in its slot, stat by stat with new / lost / up / down,
 * plus the set progress the swap changes. Pure; `compareToEquipped` stays the plain net-delta view.
 */
export const compareDetailed = (itemId: string, equipment: Equipment): DetailedComparison | null => {
	const base = compareToEquipped(itemId, equipment);
	const def = ITEM_CATALOG[itemId];
	if (!base || !def) return null;

	const wornStats = base.equippedId ? ITEM_CATALOG[base.equippedId]?.stats : undefined;
	const rows: StatRow[] = [];
	for (const key of STAT_KEYS) {
		const was = wornStats?.[key] ?? 0;
		const now = def.stats?.[key] ?? 0;
		if (!was && !now) continue;
		const delta = round2(now - was);
		const status: StatRowStatus = !was ? 'new' : !now ? 'lost' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
		rows.push({ key, was, now, delta, status });
	}

	const after: Equipment = { ...equipment, [base.slot]: itemId };
	const before = setCounts(equipment);
	const next = setCounts(after);
	const setChanges: SetChange[] = [];
	for (const setId of new Set([...Object.keys(before), ...Object.keys(next)])) {
		const from = before[setId] ?? 0;
		const to = next[setId] ?? 0;
		if (from === to) continue;
		const set = SETS[setId];
		const tiers = Object.entries(set.bonuses).map(([count, stats]) => ({ count: Number(count), stats }));
		setChanges.push({
			setId,
			label: set.label,
			from,
			to,
			size: set.size,
			gained: tiers.filter((t) => to >= t.count && from < t.count),
			lost: tiers.filter((t) => from >= t.count && to < t.count),
		});
	}

	return { slot: base.slot, equippedId: base.equippedId, rows, setChanges, net: base.deltas, after };
};
