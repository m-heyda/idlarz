def edit(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s,(p,a)
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
edit('src/lib/inventory.ts',[
("/** Equips the gear in a bag slot, sending whatever was in that gear slot back into the freed bag slot. */",
"""/**
 * Bag slots the worn gear adds to the bag (a belt's `bagSlots`). Read from the authored item, not the rolled instance, so the size of the
 * bag never depends on a quality roll: a save and the server always agree on it.
 */
export const gearBagSlots = (equipment: Equipment): number =>
	Object.values(equipment).reduce((sum, item) => sum + (item ? (ITEM_CATALOG[item.base]?.stats?.bagSlots ?? 0) : 0), 0);

/**
 * The bag after the gear's bag slots changed from `before` to `after`: padded with empty slots, or cut at the end. Null when the slots to
 * cut hold something (a belt cannot come off while the bag slots it gives are in use: nothing is ever lost).
 */
const refitBag = (bag: BagSlot[], before: Equipment, after: Equipment): BagSlot[] | null => {
	const size = bag.length + gearBagSlots(after) - gearBagSlots(before);
	if (size >= bag.length) return [...bag, ...Array.from({ length: size - bag.length }, () => null)];
	return bag.slice(size).every((slot) => slot === null) ? bag.slice(0, size) : null;
};

/** Equips the gear in a bag slot, sending whatever was in that gear slot back into the freed bag slot. */"""),
("""	nextBag[index] = displaced ? { item: displaced } : null;
	return { bag: nextBag, equipment: { ...equipment, [target]: item } };""","""	nextBag[index] = displaced ? { item: displaced } : null;
	const nextEquipment = { ...equipment, [target]: item };
	const fitted = refitBag(nextBag, equipment, nextEquipment);
	return fitted ? { bag: fitted, equipment: nextEquipment } : null;"""),
("""	delete nextEquipment[slot];
	return { bag: nextBag, equipment: nextEquipment };""","""	delete nextEquipment[slot];
	const fitted = refitBag(nextBag, equipment, nextEquipment);
	return fitted ? { bag: fitted, equipment: nextEquipment } : null;"""),
])
edit('src/lib/beltEffects.ts',[("""/**
 * Bag slots the worn gear adds to the bag. Read from the authored item (not the rolled instance), so the size of the bag never depends on
 * a quality roll: a save and the server always agree on it.
 */
export const gearBagSlots = (equipment: Equipment): number =>
	Object.values(equipment).reduce((sum, item) => sum + (item ? (ITEM_CATALOG[item.base]?.stats?.bagSlots ?? 0) : 0), 0);
""",""),("import { ITEM_CATALOG } from '@/catalog';\n","")])
edit('src/lib/offline/inventory.ts',[
("""/** The inventory a save holds: what a ledger starts from the first time, and again for a New Game. */""","""/** The bag size a character with this Pack Rat level and this gear is entitled to (a belt adds slots while it is worn). */
const sizeFor = (packrat: number, equipment: Equipment): number => sizeAt(packrat) + gearBagSlots(equipment);

/** The inventory a save holds: what a ledger starts from the first time, and again for a New Game. */"""),
("""	const packrat = packratOf(core.merchantUpgrades);
	return {
		ver: 1,
		packrat,
		bag: padBag(bag, sizeAt(packrat)),
		equipment: isRecord(core.equipment) ? (core.equipment as Equipment) : {},""","""	const packrat = packratOf(core.merchantUpgrades);
	const equipment = isRecord(core.equipment) ? (core.equipment as Equipment) : {};
	return {
		ver: 1,
		packrat,
		bag: padBag(bag, sizeFor(packrat, equipment)),
		equipment,"""),
("	const size = sizeAt(packrat);\n	return inv.bag.length >= size","	const size = sizeFor(packrat, inv.equipment);\n	return inv.bag.length >= size"),
("		bag: padBag(inv.bag, sizeAt(packrat)),\n		equipment: inv.equipment,","		bag: padBag(inv.bag, sizeFor(packrat, inv.equipment)),\n		equipment: inv.equipment,"),
])
edit('src/lib/sanitizeSave.ts',[
("	const bagSize = limitOf('bagSize', { merchantUpgrades });\n","	const baseBagSize = limitOf('bagSize', { merchantUpgrades });\n	let bagSize = baseBagSize; // plus what a worn belt adds, once the gear is read\n"),
("		bag = [...starterBag(), ...Array.from({ length: bagSize - COMBAT.bagSize }, () => null)];","		bag = [...starterBag(), ...Array.from({ length: baseBagSize - COMBAT.bagSize }, () => null)];"),
("		if (!Array.isArray(raw.bag) || raw.bag.length !== bagSize) return fail('bag size');","		bagSize += gearBagSlots(equipment);\n		if (!Array.isArray(raw.bag) || raw.bag.length !== bagSize) return fail('bag size');"),
])
