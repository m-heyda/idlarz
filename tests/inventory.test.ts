import test from 'node:test';
import assert from 'node:assert/strict';
import {
	addDrop,
	addGear,
	addToBag,
	aggregateStats,
	compareDetailed,
	compareToEquipped,
	emptyBag,
	equipFromBag,
	gearOf,
	moveSlot,
	removeFromBag,
	slotItemId,
	slotQty,
	starterBag,
	stackOf,
	unequip,
} from '../src/lib/inventory';
import { ITEM_CATALOG, RATTATUI_SET, STARTER_EQUIPMENT, emptyStats, setCounts, sumStats } from '../src/config/itemCatalog';
import { plainItem as p, resolveItem } from '../src/lib/itemInstance';
import type { BagSlot, Equipment, ItemInstance } from '../src/types/game';

const deepFreeze = <T,>(o: T): T => {
	if (o && typeof o === 'object') {
		Object.values(o as object).forEach(deepFreeze);
		Object.freeze(o);
	}
	return o;
};

const fullOfGear = (): BagSlot[] => emptyBag().map(() => ({ item: p('wooden_sword') }));
const stats = (id: string) => resolveItem(p(id))!.stats;

test('emptyBag has 36 empty slots and starterBag holds the 2 starter potions', () => {
	assert.equal(emptyBag().length, 36);
	assert.ok(emptyBag().every((s) => s === null));
	const bag = starterBag();
	assert.equal(bag.length, 36);
	assert.deepEqual(bag[0], { id: 'potion_minor', qty: 2 });
});

test('addToBag stacks potions to 20 then spills into a new slot', () => {
	let bag = emptyBag();
	const first = addToBag(bag, 'potion_minor', 25);
	assert.equal(first.added, 25);
	assert.equal(first.overflow, 0);
	bag = first.bag;
	assert.deepEqual(bag[0], { id: 'potion_minor', qty: 20 });
	assert.deepEqual(bag[1], { id: 'potion_minor', qty: 5 });
	const more = addToBag(bag, 'potion_minor', 3);
	assert.deepEqual(more.bag[1], { id: 'potion_minor', qty: 8 });
});

test('addGear / addDrop report overflow when all 36 slots are full', () => {
	const r = addGear(fullOfGear(), p('rattatui_cap'));
	assert.equal(r.added, false);
	assert.equal(r.bag.filter(Boolean).length, 36);
	assert.equal(addDrop(fullOfGear(), { kind: 'gear', item: p('rattatui_cap') }).overflow, 1);
	assert.equal(addDrop(fullOfGear(), { kind: 'consumable', id: 'potion_minor', qty: 4 }).overflow, 4);
	const unknown = addToBag(emptyBag(), 'nope', 2);
	assert.equal(unknown.overflow, 2);
	assert.equal(unknown.added, 0);
});

test('addToBag takes consumables only, and rejects object prototype names as item ids', () => {
	for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'rattatui_cap']) {
		const r = addToBag(emptyBag(), id, 1);
		assert.equal(r.added, 0, id);
		assert.equal(r.overflow, 1, id);
		assert.ok(r.bag.every((s) => s === null), id);
	}
});

test('gear never stacks: each piece takes its own slot and keeps its own rolls', () => {
	const rolled: ItemInstance = { base: 'iron_sword', level: 9, rarity: 'rare', quality: 80, affixes: [{ id: 'damage_prefix', roll: 40 }, { id: 'critChance_suffix', roll: 90 }] };
	let bag = emptyBag();
	for (const item of [p('wooden_sword'), p('wooden_sword'), rolled]) bag = addGear(bag, item).bag;
	assert.deepEqual(bag.slice(0, 4), [{ item: p('wooden_sword') }, { item: p('wooden_sword') }, { item: rolled }, null]);
	assert.deepEqual(gearOf(bag[2]), rolled);
	assert.equal(stackOf(bag[2]), null);
	assert.equal(slotItemId(bag[2]), 'iron_sword');
	assert.equal(slotQty(bag[2]), 1);
	assert.equal(slotQty(null), 0);
	assert.equal(slotQty({ id: 'potion_minor', qty: 7 }), 7);
});

test('removeFromBag lowers a stack and clears an empty one; gear goes whole', () => {
	const bag = addToBag(emptyBag(), 'potion_minor', 3).bag;
	assert.deepEqual(removeFromBag(bag, 0, 1)[0], { id: 'potion_minor', qty: 2 });
	assert.equal(removeFromBag(bag, 0, 3)[0], null);
	assert.deepEqual(removeFromBag(bag, 5), bag);
	const withGear = addGear(emptyBag(), p('wooden_sword')).bag;
	assert.equal(removeFromBag(withGear, 0, 1)[0], null);
});

test('equipFromBag swaps with the equipped item and nothing is lost, rolls included', () => {
	const rolled: ItemInstance = { base: 'rattatui_fang_blade', level: 14, rarity: 'epic', quality: 70, affixes: [] };
	const bag = addGear(emptyBag(), rolled).bag;
	const r = equipFromBag(bag, STARTER_EQUIPMENT, 0)!;
	assert.deepEqual(r.equipment.mainHand, rolled);
	assert.deepEqual(r.bag[0], { item: p('wooden_sword') });
	assert.deepEqual(r.equipment.offHand, p('wooden_shield'));
});

test('equipFromBag fills an empty slot and frees the bag slot', () => {
	const bag = addGear(emptyBag(), p('rattatui_cap')).bag;
	const r = equipFromBag(bag, {}, 0)!;
	assert.deepEqual(r.equipment.head, p('rattatui_cap'));
	assert.equal(r.bag[0], null);
});

test('two rings go to ring1 then ring2, a third swaps ring1', () => {
	let bag = emptyBag();
	const rings = [1, 2, 3].map((n): ItemInstance => ({ ...p('rattatui_ring'), quality: 40 + n }));
	for (const ring of rings) bag = addGear(bag, ring).bag;
	const eq: Equipment = {};
	let r = equipFromBag(bag, eq, 0)!;
	assert.deepEqual(r.equipment.ring1, rings[0]);
	assert.equal(r.equipment.ring2, undefined);
	r = equipFromBag(r.bag, r.equipment, 1)!;
	assert.deepEqual(r.equipment.ring2, rings[1]);
	r = equipFromBag(r.bag, r.equipment, 2)!;
	assert.deepEqual(r.equipment.ring1, rings[2]);
	assert.equal(r.bag.filter((s) => gearOf(s)?.base === 'rattatui_ring').length, 1);
	assert.deepEqual(gearOf(r.bag[2]), rings[0], 'the displaced ring is back in the bag');
});

test('equipFromBag rejects consumables, empty slots and bad indexes', () => {
	const bag = starterBag();
	assert.equal(equipFromBag(bag, {}, 0), null);
	assert.equal(equipFromBag(bag, {}, 5), null);
	assert.equal(equipFromBag(bag, {}, -1), null);
	assert.equal(equipFromBag(bag, {}, 99), null);
});

test('unequip moves gear to the first free bag slot', () => {
	const r = unequip(emptyBag(), STARTER_EQUIPMENT, 'offHand')!;
	assert.equal(r.equipment.offHand, undefined);
	assert.deepEqual(r.bag[0], { item: p('wooden_shield') });
	assert.equal(unequip(emptyBag(), STARTER_EQUIPMENT, 'head'), null);
});

test('unequip refuses when the bag is full and loses nothing', () => {
	const bag = fullOfGear();
	assert.equal(unequip(bag, STARTER_EQUIPMENT, 'offHand'), null);
});

test('moveSlot merges stacks and swaps others', () => {
	let bag = emptyBag();
	bag[0] = { id: 'potion_minor', qty: 15 };
	bag[1] = { id: 'potion_minor', qty: 10 };
	let moved = moveSlot(bag, 0, 1);
	assert.deepEqual(moved[1], { id: 'potion_minor', qty: 20 });
	assert.deepEqual(moved[0], { id: 'potion_minor', qty: 5 });
	bag = emptyBag();
	bag[0] = { item: p('wooden_sword') };
	bag[2] = { id: 'potion_minor', qty: 2 };
	moved = moveSlot(bag, 0, 2);
	assert.deepEqual(moved[0], { id: 'potion_minor', qty: 2 });
	assert.deepEqual(moved[2], { item: p('wooden_sword') });
	moved = moveSlot(bag, 0, 7);
	assert.equal(moved[0], null);
	assert.deepEqual(moved[7], { item: p('wooden_sword') });
	assert.deepEqual(moveSlot(bag, 0, 99), bag);
	// two pieces of gear just swap
	bag = [{ item: p('wooden_sword') }, { item: p('wooden_club') }, ...emptyBag().slice(2)];
	moved = moveSlot(bag, 0, 1);
	assert.deepEqual([gearOf(moved[0])?.base, gearOf(moved[1])?.base], ['wooden_club', 'wooden_sword']);
});

test('aggregateStats sums the starter kit to damage 6 armor 2', () => {
	assert.deepEqual(aggregateStats(STARTER_EQUIPMENT), { ...emptyStats(), damage: 6, armor: 2, setCount: 1 }); // the shield is a Woodland Set piece
	assert.deepEqual(aggregateStats({}), { ...emptyStats(), setCount: 0 });
});

test('aggregateStats uses the item level, quality and affixes of what is worn', () => {
	const plain = aggregateStats({ mainHand: p('iron_sword') }).damage;
	const better: ItemInstance = { base: 'iron_sword', level: 30, rarity: 'rare', quality: 100, affixes: [{ id: 'damage_prefix', roll: 100 }, { id: 'critChance_suffix', roll: 100 }] };
	const total = aggregateStats({ mainHand: better });
	assert.ok(total.damage > plain * 1.5, `${total.damage} vs ${plain}`);
	assert.ok(total.critChance > 0);
	assert.equal(total.damage, resolveItem(better)!.stats.damage);
});

test('aggregateStats adds gear stats and every set bonus threshold reached', () => {
	const six: Equipment = {
		head: p('rattatui_cap'),
		shoulder: p('rattatui_shoulderpads'),
		chest: p('rattatui_tunic'),
		hands: p('rattatui_gloves'),
		legs: p('rattatui_trousers'),
		feet: p('rattatui_boots'),
	};
	const gearOnly = (eq: Equipment) => sumStats(...Object.values(eq).map((item) => resolveItem(item!)!.stats));
	const bonus = (...counts: number[]) => sumStats(...counts.map((c) => RATTATUI_SET.bonuses[c]));
	const a6 = aggregateStats(six);
	assert.equal(a6.setCount, 6);
	assert.deepEqual({ ...a6, setCount: undefined }, { ...sumStats(gearOnly(six), bonus(3, 6)), setCount: undefined });

	const full: Equipment = {
		...six,
		neck: p('rattatui_amulet'),
		cape: p('rattatui_cloak'),
		ring1: p('rattatui_ring'),
		ring2: p('rattatui_ring'),
		charm: p('rattatui_charm'),
		mainHand: p('rattatui_fang_blade'),
		offHand: p('rattatui_buckler'),
	};
	const a13 = aggregateStats(full);
	assert.equal(a13.setCount, 13);
	assert.deepEqual({ ...a13, setCount: undefined }, { ...sumStats(gearOnly(full), bonus(3, 6, 13)), setCount: undefined });
});

test('two sets at once: each counts its own pieces', () => {
	const mixed: Equipment = { head: p('steel_helm'), chest: p('steel_cuirass'), hands: p('steel_gauntlets'), legs: p('leather_leggings'), feet: p('leather_boots'), neck: p('wooden_pendant') };
	assert.deepEqual(setCounts(mixed), { knight: 3, woodland: 3 });
});

test('functions do not mutate their inputs', () => {
	const bag = deepFreeze(starterBag());
	const eq = deepFreeze({ ...STARTER_EQUIPMENT });
	addToBag(bag, 'potion_minor', 3);
	addGear(bag, p('rattatui_cap'));
	removeFromBag(bag, 0);
	moveSlot(bag, 0, 4);
	unequip(bag, eq, 'mainHand');
	const withGear = deepFreeze(addGear(emptyBag(), p('rattatui_cap')).bag);
	equipFromBag(withGear, eq, 0);
	aggregateStats(eq);
});

test('compareToEquipped: a better weapon shows the stat difference to the worn one', () => {
	const cmp = compareToEquipped(p('rattatui_fang_blade'), STARTER_EQUIPMENT)!;
	assert.equal(cmp.slot, 'mainHand');
	assert.deepEqual(cmp.equipped, p('wooden_sword'));
	const now = sumStats(stats('wooden_sword'));
	const next = sumStats(stats('rattatui_fang_blade'));
	for (const key of Object.keys(next) as (keyof typeof next)[]) {
		const expected = Math.round((next[key] - now[key]) * 100) / 100;
		assert.equal(cmp.deltas[key] ?? 0, expected, key);
	}
	// swapping back is the exact opposite
	const back = compareToEquipped(p('wooden_sword'), { ...STARTER_EQUIPMENT, mainHand: p('rattatui_fang_blade') })!;
	for (const key of Object.keys(cmp.deltas) as (keyof typeof cmp.deltas)[]) assert.equal(back.deltas[key], -cmp.deltas[key]!);
});

test('compareToEquipped sees item level: the same base at a higher level is an upgrade', () => {
	const low: ItemInstance = { ...p('iron_sword') };
	const high: ItemInstance = { ...low, level: 25 };
	const cmp = compareToEquipped(high, { mainHand: low })!;
	assert.ok(cmp.deltas.damage! > 0);
	assert.equal(compareToEquipped(low, { mainHand: low })!.deltas.damage, undefined);
});

test('compareToEquipped: an empty slot gains everything, rings pick the slot equipFromBag would, consumables have none', () => {
	const cap = compareToEquipped(p('rattatui_cap'), {})!;
	assert.equal(cap.slot, 'head');
	assert.equal(cap.equipped, undefined);
	assert.deepEqual(cap.deltas, Object.fromEntries(Object.entries(ITEM_CATALOG.rattatui_cap.stats!).filter(([, v]) => v)));

	assert.equal(compareToEquipped(p('rattatui_ring'), {})!.slot, 'ring1');
	assert.equal(compareToEquipped(p('rattatui_ring'), { ring1: p('rattatui_ring') })!.slot, 'ring2');
	const full = compareToEquipped(p('rattatui_ring'), { ring1: p('rattatui_ring'), ring2: p('rattatui_ring') })!;
	assert.equal(full.slot, 'ring1');
	assert.deepEqual(full.deltas, {}, 'the same ring over the same ring changes nothing');

	assert.equal(compareToEquipped({ ...p('wooden_sword'), base: 'potion_minor' }, STARTER_EQUIPMENT), null);
	assert.equal(compareToEquipped({ ...p('wooden_sword'), base: 'no_such_item' }, STARTER_EQUIPMENT), null);
});

test('compareToEquipped includes the set bonus the swap reaches', () => {
	const pieces = RATTATUI_SET.pieces;
	const [first, ...rest] = pieces;
	const wornAll = Object.fromEntries(rest.map((id) => [ITEM_CATALOG[id].slot === 'ring' ? 'ring1' : ITEM_CATALOG[id].slot, p(id)])) as Equipment;
	const withSet = aggregateStats({ ...wornAll, [ITEM_CATALOG[first].slot === 'ring' ? 'ring1' : ITEM_CATALOG[first].slot!]: p(first) });
	const without = aggregateStats(wornAll);
	const cmp = compareToEquipped(p(first), wornAll)!;
	for (const key of ['damage', 'armor', 'maxHp', 'critChance', 'superCrit', 'regen', 'luck'] as const) {
		assert.equal(cmp.deltas[key] ?? 0, Math.round((withSet[key] - without[key]) * 100) / 100, key);
	}
});

test('compareDetailed: stats are NEW, LOST, up or down against the worn piece, and an empty slot has no worn piece', () => {
	const cmp = compareDetailed(p('rattatui_fang_blade'), STARTER_EQUIPMENT)!;
	assert.equal(cmp.slot, 'mainHand');
	assert.deepEqual(cmp.equipped, p('wooden_sword'));
	const worn = stats('wooden_sword');
	const next = stats('rattatui_fang_blade');
	for (const row of cmp.rows) {
		assert.equal(row.was, worn[row.key] ?? 0, row.key);
		assert.equal(row.now, next[row.key] ?? 0, row.key);
		assert.equal(row.delta, Math.round((row.now - row.was) * 100) / 100, row.key);
		const expected = !row.was ? 'new' : !row.now ? 'lost' : row.delta > 0 ? 'up' : row.delta < 0 ? 'down' : 'same';
		assert.equal(row.status, expected, row.key);
	}
	assert.deepEqual(cmp.net, compareToEquipped(p('rattatui_fang_blade'), STARTER_EQUIPMENT)!.deltas);
	assert.deepEqual(cmp.after.mainHand, p('rattatui_fang_blade'));

	// swapping to something that lacks a stat the worn piece has marks it as lost
	const back = compareDetailed(p('wooden_sword'), { ...STARTER_EQUIPMENT, mainHand: p('rattatui_fang_blade') })!;
	const lostKeys = Object.keys(next).filter((k) => !(worn as Record<string, number>)[k]);
	for (const key of lostKeys) assert.equal(back.rows.find((r) => r.key === key)?.status, 'lost', key);

	const empty = compareDetailed(p('rattatui_cap'), {})!;
	assert.equal(empty.equipped, undefined);
	assert.ok(empty.rows.length > 0 && empty.rows.every((r) => r.status === 'new'));

	assert.equal(compareDetailed({ ...p('wooden_sword'), base: 'potion_minor' }, STARTER_EQUIPMENT), null);
	assert.equal(compareDetailed({ ...p('wooden_sword'), base: 'no_such_item' }, STARTER_EQUIPMENT), null);
});

test('compareDetailed reports the set tiers a swap switches on and off', () => {
	const pieces = RATTATUI_SET.pieces;
	const slotOf = (id: string) => (ITEM_CATALOG[id].slot === 'ring' ? 'ring1' : ITEM_CATALOG[id].slot!);
	const lowest = Math.min(...Object.keys(RATTATUI_SET.bonuses).map(Number));
	const wornIds = pieces.filter((id) => ITEM_CATALOG[id].slot !== 'ring').slice(0, lowest - 1);
	const wornSome = Object.fromEntries(wornIds.map((id) => [slotOf(id), p(id)])) as Equipment;
	const next = pieces.find((id) => ITEM_CATALOG[id].slot !== 'ring' && !wornIds.includes(id))!;

	const gain = compareDetailed(p(next), wornSome)!;
	const change = gain.setChanges.find((c) => c.setId === RATTATUI_SET.id)!;
	assert.equal(change.from, lowest - 1);
	assert.equal(change.to, lowest);
	assert.deepEqual(change.gained.map((t) => t.count), [lowest]);
	assert.equal(change.lost.length, 0);
});

test('compareDetailed gives the headline stat, attack speed and DPS of a weapon against the worn one', () => {
	const cmp = compareDetailed(p('iron_sword'), STARTER_EQUIPMENT)!;
	assert.deepEqual(cmp.primary, { key: 'damage', was: 6, now: 12, delta: 6 });
	assert.equal(cmp.swing?.speed.now, ITEM_CATALOG.iron_sword.attackSpeed);
	assert.equal(cmp.swing?.speed.was, ITEM_CATALOG.wooden_sword.attackSpeed);
	assert.equal(cmp.swing?.dps.delta, Math.round((12 * 1.2 - 6 * 1.2) * 100) / 100);
});

test('compareDetailed: armor pieces headline armor, jewellery has no headline, an empty slot compares against nothing', () => {
	assert.equal(compareDetailed(p('steel_helm'), {})?.primary?.key, 'armor');
	assert.equal(compareDetailed(p('steel_helm'), {})?.primary?.was, 0);
	assert.equal(compareDetailed(p('steel_ring'), {})?.primary, null);
	assert.equal(compareDetailed(p('steel_helm'), {})?.swing, null);
});
