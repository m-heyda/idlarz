import { RARITIES } from '@/catalog';
import type { BagSlot, Equipment, EquipmentSlot, ItemInstance } from '@/types/game';
import { REBIRTH } from '@/config/rebirth';
import { gearOf } from '@/lib/inventory';

/**
 * Carrying epic and legendary gear through a rebirth. Pure rules shared by the server (`rebirthStep` picks from the LEDGER's inventory, never from items the browser sends)
 * and the browser (which builds the same new bag from the same picks).
 *
 * - **Slots**: the rebirth being done is number N (`prestige.rebirths + 1`); it lets the player keep `min(N, REBIRTH.keepSlotsMax)` pieces (1 on the first, 2 on the second, up to 15).
 * - **Eligible**: a piece of gear whose rarity ranks at least `REBIRTH.keepMinRarity` (Epic: so Epic, Legendary, or the disabled-for-now Unique), from the bag or worn. Epic and legendary pieces share the same slots. Until the epic rule it was Legendary and up.
 * - **Where it lands**: in the new run's bag (the first free slots); the player equips it again.
 * - A pick names a place (`{ from: 'bag', index }` or `{ from: 'equip', slot }`), never an item: instances have no ids.
 *
 * @category Progression/Rebirth
 * @order 5
 * @formula
 * keep slots = min(15, rebirth number being done)
 */
export type KeepRef = { from: 'bag'; index: number } | { from: 'equip'; slot: EquipmentSlot };

/** The most pieces any rebirth can carry over. */
export const KEEP_SLOTS_MAX = REBIRTH.keepSlotsMax;

/** How many pieces the rebirth numbered `rebirthNumber` (1 = the first) may carry over. */
export const keepSlots = (rebirthNumber: number): number => Math.max(0, Math.min(KEEP_SLOTS_MAX, Math.floor(rebirthNumber)));

/** True for a piece of gear at `REBIRTH.keepMinRarity` (Epic) or above. */
export const isKeepable = (item: ItemInstance | null | undefined): boolean => {
	if (!item) return false;
	const rarity = RARITIES[item.rarity as keyof typeof RARITIES];
	return !!rarity && rarity.order >= RARITIES[REBIRTH.keepMinRarity].order;
};

/** Same place, same pick (the key the picker compares picks by). */
export const refKey = (ref: KeepRef): string => (ref.from === 'bag' ? `bag:${ref.index}` : `equip:${ref.slot}`);

/** Every piece the player could keep: bag first (in bag order), then the worn gear. */
export const keepCandidates = (bag: readonly BagSlot[], equipment: Equipment): { ref: KeepRef; item: ItemInstance }[] => {
	const out: { ref: KeepRef; item: ItemInstance }[] = [];
	bag.forEach((slot, index) => {
		const item = gearOf(slot);
		if (item && isKeepable(item)) out.push({ ref: { from: 'bag', index }, item });
	});
	(Object.keys(equipment) as EquipmentSlot[]).forEach((slot) => {
		const item = equipment[slot];
		if (item && isKeepable(item)) out.push({ ref: { from: 'equip', slot }, item });
	});
	return out;
};

/** The picks as pieces of gear, or why they do not stand: a place that holds nothing keepable, a place named twice, or more picks than slots. */
export const resolveKeep = (
	inv: { bag: readonly BagSlot[]; equipment: Equipment },
	refs: readonly KeepRef[],
	slots: number,
): { ok: true; items: ItemInstance[] } | { ok: false; reason: 'too_many' | 'not_keepable' | 'duplicate' } => {
	if (refs.length > slots) return { ok: false, reason: 'too_many' };
	const seen = new Set<string>();
	const items: ItemInstance[] = [];
	for (const ref of refs) {
		const key = refKey(ref);
		if (seen.has(key)) return { ok: false, reason: 'duplicate' };
		seen.add(key);
		const item = ref.from === 'bag' ? gearOf(inv.bag[ref.index] ?? null) : (inv.equipment[ref.slot] ?? null);
		if (!item || !isKeepable(item)) return { ok: false, reason: 'not_keepable' };
		items.push(item);
	}
	return { ok: true, items };
};

/** The new run's bag with the kept pieces in its first free slots (the bag grows only if it is somehow too small, which a 60-slot base never is). */
export const placeKept = (bag: readonly BagSlot[], items: readonly ItemInstance[]): BagSlot[] => {
	const next = bag.map((slot) => slot);
	for (const item of items) {
		const free = next.indexOf(null);
		if (free === -1) next.push({ item });
		else next[free] = { item };
	}
	return next;
};

/** Reads the `keep` of a request body: a short list of well-formed picks, or null when anything is off. */
export const parseKeep = (raw: unknown): KeepRef[] | null => {
	if (raw === undefined) return [];
	if (!Array.isArray(raw) || raw.length > KEEP_SLOTS_MAX) return null;
	const out: KeepRef[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== 'object') return null;
		const e = entry as Record<string, unknown>;
		if (e.from === 'bag' && typeof e.index === 'number' && Number.isInteger(e.index) && e.index >= 0 && e.index < 1000)
			out.push({ from: 'bag', index: e.index });
		else if (e.from === 'equip' && typeof e.slot === 'string' && /^[a-zA-Z0-9]{1,20}$/.test(e.slot)) out.push({ from: 'equip', slot: e.slot as EquipmentSlot });
		else return null;
	}
	return out;
};
