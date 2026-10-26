import test from 'node:test';
import assert from 'node:assert/strict';
import {
	addToBag,
	aggregateStats,
	compareToEquipped,
	emptyBag,
	equipFromBag,
	moveSlot,
	removeFromBag,
	starterBag,
	unequip,
} from '../src/lib/inventory';
import { ITEM_CATALOG, RATTATUI_SET, STARTER_EQUIPMENT, emptyStats, setCounts, sumStats } from '../src/config/itemCatalog';
import type { BagSlot, Equipment } from '../src/types/game';

const deepFreeze = <T,>(o: T): T => {
	if (o && typeof o === 'object') {
		Object.values(o as object).forEach(deepFreeze);
		Object.freeze(o);
	}
	return o;
};

const fullOfGear = (): BagSlot[] => emptyBag().map(() => ({ id: 'wooden_sword', qty: 1 }));

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

test('addToBag reports overflow when all 36 slots are full', () => {
	const r = addToBag(fullOfGear(), 'rattatui_cap', 1);
	assert.equal(r.added, 0);
	assert.equal(r.overflow, 1);
	assert.equal(r.bag.filter(Boolean).length, 36);
	const unknown = addToBag(emptyBag(), 'nope', 2);
	assert.equal(unknown.overflow, 2);
	assert.equal(unknown.added, 0);
});

test('addToBag rejects object prototype names as item ids', () => {
	for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
		const r = addToBag(emptyBag(), id, 1);
		assert.equal(r.added, 0, id);
		assert.equal(r.overflow, 1, id);
		assert.ok(r.bag.every((s) => s === null), id);
	}
});

test('gear never stacks', () => {
	const r = addToBag(emptyBag(), 'wooden_sword', 3);
	assert.equal(r.added, 3);
	assert.deepEqual(r.bag.slice(0, 4), [
		{ id: 'wooden_sword', qty: 1 },
		{ id: 'wooden_sword', qty: 1 },
		{ id: 'wooden_sword', qty: 1 },
		null,
	]);
});

test('removeFromBag lowers a stack and clears an empty one', () => {
	const bag = addToBag(emptyBag(), 'potion_minor', 3).bag;
	assert.deepEqual(removeFromBag(bag, 0, 1)[0], { id: 'potion_minor', qty: 2 });
	assert.equal(removeFromBag(bag, 0, 3)[0], null);
	assert.deepEqual(removeFromBag(bag, 5), bag);
});

test('equipFromBag swaps with the equipped item and nothing is lost', () => {
	const bag = addToBag(emptyBag(), 'rattatui_fang_blade', 1).bag;
	const r = equipFromBag(bag, STARTER_EQUIPMENT, 0)!;
	assert.equal(r.equipment.mainHand, 'rattatui_fang_blade');
	assert.deepEqual(r.bag[0], { id: 'wooden_sword', qty: 1 });
	assert.equal(r.equipment.offHand, 'wooden_shield');
});

test('equipFromBag fills an empty slot and frees the bag slot', () => {
	const bag = addToBag(emptyBag(), 'rattatui_cap', 1).bag;
	const r = equipFromBag(bag, {}, 0)!;
	assert.equal(r.equipment.head, 'rattatui_cap');
	assert.equal(r.bag[0], null);
});

test('two rings go to ring1 then ring2, a third swaps ring1', () => {
	const bag = addToBag(emptyBag(), 'rattatui_ring', 3).bag;
	const eq: Equipment = {};
	let r = equipFromBag(bag, eq, 0)!;
	assert.equal(r.equipment.ring1, 'rattatui_ring');
	assert.equal(r.equipment.ring2, undefined);
	r = equipFromBag(r.bag, r.equipment, 1)!;
	assert.equal(r.equipment.ring2, 'rattatui_ring');
	r = equipFromBag(r.bag, r.equipment, 2)!;
	assert.equal(r.equipment.ring1, 'rattatui_ring');
	assert.equal(r.bag.filter((s) => s?.id === 'rattatui_ring').length, 1);
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
	assert.deepEqual(r.bag[0], { id: 'wooden_shield', qty: 1 });
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
	bag[0] = { id: 'wooden_sword', qty: 1 };
	bag[2] = { id: 'potion_minor', qty: 2 };
	moved = moveSlot(bag, 0, 2);
	assert.deepEqual(moved[0], { id: 'potion_minor', qty: 2 });
	assert.deepEqual(moved[2], { id: 'wooden_sword', qty: 1 });
	moved = moveSlot(bag, 0, 7);
	assert.equal(moved[0], null);
	assert.deepEqual(moved[7], { id: 'wooden_sword', qty: 1 });
	assert.deepEqual(moveSlot(bag, 0, 99), bag);
});

test('aggregateStats sums the starter kit to damage 2 armor 2', () => {
	assert.deepEqual(aggregateStats(STARTER_EQUIPMENT), { ...emptyStats(), damage: 2, armor: 2, setCount: 1 }); // the shield is a Woodland Set piece
	assert.deepEqual(aggregateStats({}), { ...emptyStats(), setCount: 0 });
});

test('aggregateStats adds gear stats and every set bonus threshold reached', () => {
	const six: Equipment = {
		head: 'rattatui_cap',
		shoulder: 'rattatui_shoulderpads',
		chest: 'rattatui_tunic',
		hands: 'rattatui_gloves',
		legs: 'rattatui_trousers',
		feet: 'rattatui_boots',
	};
	const gearOnly = (eq: Equipment) => sumStats(...Object.values(eq).map((id) => ITEM_CATALOG[id!].stats));
	const bonus = (...counts: number[]) => sumStats(...counts.map((c) => RATTATUI_SET.bonuses[c]));
	const a6 = aggregateStats(six);
	assert.equal(a6.setCount, 6);
	assert.deepEqual({ ...a6, setCount: undefined }, { ...sumStats(gearOnly(six), bonus(3, 6)), setCount: undefined });

	const full: Equipment = {
		...six,
		neck: 'rattatui_amulet',
		cape: 'rattatui_cloak',
		ring1: 'rattatui_ring',
		ring2: 'rattatui_ring',
		charm: 'rattatui_charm',
		mainHand: 'rattatui_fang_blade',
		offHand: 'rattatui_buckler',
	};
	const a13 = aggregateStats(full);
	assert.equal(a13.setCount, 13);
	assert.deepEqual({ ...a13, setCount: undefined }, { ...sumStats(gearOnly(full), bonus(3, 6, 13)), setCount: undefined });
});

test('two sets at once: each counts its own pieces', () => {
	const mixed: Equipment = { head: 'steel_helm', chest: 'steel_cuirass', hands: 'steel_gauntlets', legs: 'leather_leggings', feet: 'leather_boots', neck: 'wooden_pendant' };
	assert.deepEqual(setCounts(mixed), { knight: 3, woodland: 3 });
});

test('functions do not mutate their inputs', () => {
	const bag = deepFreeze(starterBag());
	const eq = deepFreeze({ ...STARTER_EQUIPMENT });
	addToBag(bag, 'potion_minor', 3);
	removeFromBag(bag, 0);
	moveSlot(bag, 0, 4);
	unequip(bag, eq, 'mainHand');
	const withGear = deepFreeze(addToBag(emptyBag(), 'rattatui_cap').bag);
	equipFromBag(withGear, eq, 0);
	aggregateStats(eq);
});

test('compareToEquipped: a better weapon shows the stat difference to the worn one', () => {
	const cmp = compareToEquipped('rattatui_fang_blade', STARTER_EQUIPMENT)!;
	assert.equal(cmp.slot, 'mainHand');
	assert.equal(cmp.equippedId, 'wooden_sword');
	const now = sumStats(ITEM_CATALOG.wooden_sword.stats);
	const next = sumStats(ITEM_CATALOG.rattatui_fang_blade.stats);
	for (const key of Object.keys(next) as (keyof typeof next)[]) {
		const expected = Math.round((next[key] - now[key]) * 100) / 100;
		assert.equal(cmp.deltas[key] ?? 0, expected, key);
	}
	// swapping back is the exact opposite
	const back = compareToEquipped('wooden_sword', { ...STARTER_EQUIPMENT, mainHand: 'rattatui_fang_blade' })!;
	for (const key of Object.keys(cmp.deltas) as (keyof typeof cmp.deltas)[]) assert.equal(back.deltas[key], -cmp.deltas[key]!);
});

test('compareToEquipped: an empty slot gains everything, rings pick the slot equipFromBag would, consumables have none', () => {
	const cap = compareToEquipped('rattatui_cap', {})!;
	assert.equal(cap.slot, 'head');
	assert.equal(cap.equippedId, undefined);
	assert.deepEqual(cap.deltas, Object.fromEntries(Object.entries(ITEM_CATALOG.rattatui_cap.stats!).filter(([, v]) => v)));

	assert.equal(compareToEquipped('rattatui_ring', {})!.slot, 'ring1');
	assert.equal(compareToEquipped('rattatui_ring', { ring1: 'rattatui_ring' })!.slot, 'ring2');
	const full = compareToEquipped('rattatui_ring', { ring1: 'rattatui_ring', ring2: 'rattatui_ring' })!;
	assert.equal(full.slot, 'ring1');
	assert.deepEqual(full.deltas, {}, 'the same ring over the same ring changes nothing');

	assert.equal(compareToEquipped('potion_minor', STARTER_EQUIPMENT), null);
	assert.equal(compareToEquipped('no_such_item', STARTER_EQUIPMENT), null);
});

test('compareToEquipped includes the set bonus the swap reaches', () => {
	const pieces = RATTATUI_SET.pieces;
	const [first, ...rest] = pieces;
	const wornAll = Object.fromEntries(rest.map((id) => [ITEM_CATALOG[id].slot === 'ring' ? 'ring1' : ITEM_CATALOG[id].slot, id])) as Equipment;
	const withSet = aggregateStats({ ...wornAll, [ITEM_CATALOG[first].slot === 'ring' ? 'ring1' : ITEM_CATALOG[first].slot!]: first });
	const without = aggregateStats(wornAll);
	const cmp = compareToEquipped(first, wornAll)!;
	for (const key of ['damage', 'armor', 'maxHp', 'critChance', 'superCrit', 'regen', 'luck'] as const) {
		assert.equal(cmp.deltas[key] ?? 0, Math.round((withSet[key] - without[key]) * 100) / 100, key);
	}
});
