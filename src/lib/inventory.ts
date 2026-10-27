import { COMBAT } from '@/config/combatConfig';
import { EQUIPMENT_LAYOUT, ITEM_CATALOG, RARITIES, SETS, STARTER_BAG_ITEMS, STAT_KEYS, setBonusStats, setCounts, sumStats, weaponDps, type ItemStats, type StatKey, type StatTotals } from '@/catalog';
import { resolveItem } from '@/lib/itemInstance';
import type { BagSlot, Drop, Equipment, EquipmentSlot, ItemDef, ItemInstance } from '@/types/game';

// Pure bag / equipment operations. Nothing here mutates its arguments; every function returns fresh arrays and objects.
// A bag slot holds one piece of gear (an instance) or a stack of a consumable; equipment holds instances.

export const emptyBag = (): BagSlot[] => Array.from({ length: COMBAT.bagSize }, () => null);

export const starterBag = (): BagSlot[] =>
	STARTER_BAG_ITEMS.reduce((bag, { id, qty }) => addToBag(bag, id, qty).bag, emptyBag());

/** The gear in a slot, or null (empty slot or a consumable stack). */
export const gearOf = (slot: BagSlot): ItemInstance | null => (slot && 'item' in slot ? slot.item : null);

/** The consumable stack in a slot, or null. */
export const stackOf = (slot: BagSlot): { id: string; qty: number } | null => (slot && 'id' in slot ? slot : null);

/** The catalog id of whatever is in the slot: the base of a piece of gear, the id of a stack. */
export const slotItemId = (slot: BagSlot): string | undefined => (slot && 'item' in slot ? slot.item.base : slot?.id);

/** How many items a slot holds: 1 for gear, the stack size for a consumable. */
export const slotQty = (slot: BagSlot): number => (slot && 'item' in slot ? 1 : (slot?.qty ?? 0));

const stackMax = (id: string) => ITEM_CATALOG[id]?.stackMax ?? 1;

const copySlot = (slot: BagSlot): BagSlot => (slot ? ('item' in slot ? { item: slot.item } : { ...slot }) : null);

const validIndex = (bag: BagSlot[], index: number) =>
	Number.isInteger(index) && index >= 0 && index < bag.length;

/** Adds `qty` of a consumable: tops up existing stacks first, then uses the first empty slots. Whatever does not fit is `overflow`. Gear goes in with `addGear`. */
export const addToBag = (
	bag: BagSlot[],
	id: string,
	qty = 1
): { bag: BagSlot[]; added: number; overflow: number } => {
	const next = bag.map(copySlot);
	const def = ITEM_CATALOG[id];
	if (!def || def.kind !== 'consumable' || !Number.isInteger(qty) || qty < 1) return { bag: next, added: 0, overflow: Math.max(0, qty) };

	const max = stackMax(id);
	let left = qty;
	for (const slot of next) {
		if (left === 0) break;
		const stack = stackOf(slot);
		if (stack && stack.id === id && stack.qty < max) {
			const take = Math.min(max - stack.qty, left);
			stack.qty += take;
			left -= take;
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

/** Puts a piece of gear in the first empty slot; `added` is false when the bag is full. */
export const addGear = (bag: BagSlot[], item: ItemInstance): { bag: BagSlot[]; added: boolean } => {
	const next = bag.map(copySlot);
	const free = next.findIndex((slot) => slot === null);
	if (free < 0) return { bag: next, added: false };
	next[free] = { item };
	return { bag: next, added: true };
};

/** Adds whatever a drop holds; `overflow` is how many of it did not fit (1 for gear). */
export const addDrop = (bag: BagSlot[], drop: Drop): { bag: BagSlot[]; overflow: number } => {
	if (drop.kind === 'gear') {
		const r = addGear(bag, drop.item);
		return { bag: r.bag, overflow: r.added ? 0 : 1 };
	}
	const r = addToBag(bag, drop.id, drop.qty);
	return { bag: r.bag, overflow: r.overflow };
};

export const removeFromBag = (bag: BagSlot[], index: number, qty = 1): BagSlot[] => {
	const next = bag.map(copySlot);
	const slot = validIndex(next, index) ? next[index] : null;
	if (!slot) return next;
	const stack = stackOf(slot);
	if (!stack || stack.qty <= qty) next[index] = null;
	else stack.qty -= qty;
	return next;
};

/** Swaps two bag slots; two stacks of the same consumable merge up to the stack limit. */
export const moveSlot = (bag: BagSlot[], from: number, to: number): BagSlot[] => {
	const next = bag.map(copySlot);
	if (!validIndex(next, from) || !validIndex(next, to) || from === to) return next;
	const a = stackOf(next[from]);
	const b = stackOf(next[to]);
	if (a && b && a.id === b.id && stackMax(a.id) > 1) {
		const max = stackMax(a.id);
		const total = a.qty + b.qty;
		b.qty = Math.min(total, max);
		next[from] = total > max ? { id: a.id, qty: total - max } : null;
		return next;
	}
	const held = next[from];
	next[from] = next[to];
	next[to] = held;
	return next;
};

const KIND_ORDER: Record<string, number> = { weapon: 0, offhand: 1, armor: 2, accessory: 3 };
const SLOT_ORDER = [...EQUIPMENT_LAYOUT.bottom, ...EQUIPMENT_LAYOUT.left, ...EQUIPMENT_LAYOUT.right];

/** Sort key of a piece of gear: its kind, then the slot (both rings count as one, in the order of the equipment panel), then the better item first. */
const gearOrder = (item: ItemInstance): (number | string)[] => {
	const def = ITEM_CATALOG[item.base];
	const slot = def?.slot === 'ring' ? 'ring1' : def?.slot;
	const slotIndex = slot ? SLOT_ORDER.indexOf(slot) : -1;
	return [KIND_ORDER[def?.kind ?? ''] ?? 9, slotIndex < 0 ? 99 : slotIndex, -((RARITIES as Record<string, { order: number } | undefined>)[item.rarity]?.order ?? 0), -item.level, -item.quality, item.base];
};

const compareKeys = (a: (number | string)[], b: (number | string)[]): number => {
	for (let i = 0; i < a.length; i++) {
		if (a[i] === b[i]) continue;
		return typeof a[i] === 'string' ? (a[i] as string).localeCompare(b[i] as string) : (a[i] as number) - (b[i] as number);
	}
	return 0;
};

/**
 * Tidies the bag from the left: consumables first (same ones merged into full stacks, in catalog order), then the gear by kind,
 * slot, rarity, item level and quality (best first), then the empty slots. The same number of slots, nothing lost, and organising
 * an organised bag changes nothing.
 */
export const organizeBag = (bag: BagSlot[]): BagSlot[] => {
	const totals = new Map<string, number>();
	const gear: ItemInstance[] = [];
	for (const slot of bag) {
		const item = gearOf(slot);
		const stack = stackOf(slot);
		if (item) gear.push(item);
		else if (stack) totals.set(stack.id, (totals.get(stack.id) ?? 0) + stack.qty);
	}
	const catalogIndex = (id: string) => Object.keys(ITEM_CATALOG).indexOf(id);
	const stacks: BagSlot[] = [];
	for (const [id, total] of [...totals].sort((a, b) => catalogIndex(a[0]) - catalogIndex(b[0]) || a[0].localeCompare(b[0]))) {
		const max = stackMax(id);
		for (let left = total; left > 0; left -= max) stacks.push({ id, qty: Math.min(left, max) });
	}
	const sorted: BagSlot[] = gear
		.map((item) => ({ item, key: gearOrder(item) }))
		.sort((a, b) => compareKeys(a.key, b.key))
		.map(({ item }) => ({ item }));
	const organized = [...stacks, ...sorted];
	return Array.from({ length: bag.length }, (_, i) => organized[i] ?? null);
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
	const item = gearOf(bag[index]);
	const def = item ? ITEM_CATALOG[item.base] : undefined;
	const target = def ? targetSlot(def, equipment) : null;
	if (!item || !def || !target) return null;

	const displaced = equipment[target];
	const nextBag = bag.map(copySlot);
	nextBag[index] = displaced ? { item: displaced } : null;
	return { bag: nextBag, equipment: { ...equipment, [target]: item } };
};

/** Moves an equipped item into the first free bag slot; null if the slot is empty or the bag is full. */
export const unequip = (
	bag: BagSlot[],
	equipment: Equipment,
	slot: EquipmentSlot
): { bag: BagSlot[]; equipment: Equipment } | null => {
	const item = equipment[slot];
	if (!item) return null;
	const free = bag.findIndex((s) => s === null);
	if (free < 0) return null;
	const nextBag = bag.map(copySlot);
	nextBag[free] = { item };
	const nextEquipment = { ...equipment };
	delete nextEquipment[slot];
	return { bag: nextBag, equipment: nextEquipment };
};

/** The average item level of what is worn (empty slots do not count; 0 with nothing on): the number shown as "Item level" and the one the merchant's goods are held to. */
export const averageItemLevel = (equipment: Equipment): number => {
	const levels = Object.values(equipment).flatMap((item) => (item ? [item.level] : []));
	return levels.length ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 0;
};

/** The one place gear is summed: stats of everything equipped (base at its level and quality, plus affixes) plus the set bonuses reached. */
export const aggregateStats = (equipment: Equipment): StatTotals & { setCount: number } => {
	const worn = Object.values(equipment).map((item) => (item ? resolveItem(item)?.stats : undefined));
	const counts = setCounts(equipment);
	const total = sumStats(...worn, setBonusStats(counts));
	return { ...total, setCount: Math.max(0, ...Object.values(counts)) };
};

/** What wearing a piece of gear would change: the slot it takes, what is in it now, and the change of every stat (set bonuses included). */
export interface ItemComparison {
	slot: EquipmentSlot;
	equipped?: ItemInstance;
	/** Only the stats that change; positive is better */
	deltas: ItemStats;
}

/** Compares a piece of gear with what is worn in the slot it would take; null for anything that is not gear. */
export const compareToEquipped = (item: ItemInstance, equipment: Equipment): ItemComparison | null => {
	const def = ITEM_CATALOG[item.base];
	const slot = def ? targetSlot(def, equipment) : null;
	if (!def || !slot || !resolveItem(item)) return null;
	const before = aggregateStats(equipment);
	const after = aggregateStats({ ...equipment, [slot]: item });
	const deltas: ItemStats = {};
	for (const key of STAT_KEYS) {
		const delta = Math.round((after[key] - before[key]) * 100) / 100;
		if (delta) deltas[key] = delta;
	}
	return { slot, equipped: equipment[slot], deltas };
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

/** The headline number of a card (weapon damage, or armor) with the worn piece's value, like the big Armor line of an action-RPG card. */
export interface PrimaryRow {
	key: 'damage' | 'armor';
	was: number;
	now: number;
	delta: number;
}

/** A weapon's swing: attacks per second and damage per second, the hovered piece against the worn one. */
export interface SwingRow {
	speed: { was: number; now: number; delta: number };
	dps: { was: number; now: number; delta: number };
}

export interface DetailedComparison {
	slot: EquipmentSlot;
	equipped?: ItemInstance;
	/** The two pieces side by side, stat by stat (own stats only, no set bonuses) */
	rows: StatRow[];
	/** The headline stat (weapon damage or armor); its row is also in `rows` */
	primary: PrimaryRow | null;
	/** Attack speed and DPS when the hovered piece is a weapon */
	swing: SwingRow | null;
	setChanges: SetChange[];
	/** The whole character: every stat that changes, set bonuses included (same as `compareToEquipped().deltas`) */
	net: ItemStats;
	/** The equipment as it would be after the swap, for previewing set progress */
	after: Equipment;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Which stat is the headline of an item card: damage for a weapon, else armor if it has any. */
export const primaryKeyOf = (def: Pick<ItemDef, 'kind' | 'stats'>): 'damage' | 'armor' | null =>
	def.kind === 'weapon' ? 'damage' : def.stats?.armor ? 'armor' : null;

/**
 * The hover comparison: the hovered piece against the one worn in its slot, stat by stat with new / lost / up / down,
 * plus the set progress the swap changes. Pure; `compareToEquipped` stays the plain net-delta view.
 */
export const compareDetailed = (item: ItemInstance, equipment: Equipment): DetailedComparison | null => {
	const base = compareToEquipped(item, equipment);
	const resolved = resolveItem(item);
	if (!base || !resolved) return null;
	const def = resolved.def;
	const stats = resolved.stats;

	const worn = base.equipped ? resolveItem(base.equipped) : null;
	const wornStats = worn?.stats;
	const rows: StatRow[] = [];
	for (const key of STAT_KEYS) {
		const was = wornStats?.[key] ?? 0;
		const now = stats[key] ?? 0;
		if (!was && !now) continue;
		const delta = round2(now - was);
		const status: StatRowStatus = !was ? 'new' : !now ? 'lost' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
		rows.push({ key, was, now, delta, status });
	}

	const after: Equipment = { ...equipment, [base.slot]: item };
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

	const wornDef = worn?.def;
	const primaryKey = primaryKeyOf({ kind: def.kind, stats });
	const primary: PrimaryRow | null = primaryKey
		? { key: primaryKey, was: wornStats?.[primaryKey] ?? 0, now: stats[primaryKey] ?? 0, delta: round2((stats[primaryKey] ?? 0) - (wornStats?.[primaryKey] ?? 0)) }
		: null;
	let swing: SwingRow | null = null;
	if (def.kind === 'weapon' && def.attackSpeed) {
		const wasSpeed = wornDef?.kind === 'weapon' ? (wornDef.attackSpeed ?? 0) : 0;
		const wasDps = wornDef?.kind === 'weapon' && wornStats ? weaponDps({ stats: wornStats, attackSpeed: wornDef.attackSpeed }) : 0;
		const nowDps = weaponDps({ stats, attackSpeed: def.attackSpeed });
		swing = {
			speed: { was: wasSpeed, now: def.attackSpeed, delta: round2(def.attackSpeed - wasSpeed) },
			dps: { was: wasDps, now: nowDps, delta: round2(nowDps - wasDps) },
		};
	}

	return { slot: base.slot, equipped: base.equipped, rows, primary, swing, setChanges, net: base.deltas, after };
};
