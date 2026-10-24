import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/config/combatConfig';
import {
	EQUIPMENT_LAYOUT,
	ITEM_CATALOG,
	RATTATUI_SET,
	STARTER_BAG_ITEMS,
	STARTER_EQUIPMENT,
} from '../src/config/itemCatalog';
import type { EquipmentSlot } from '../src/types/game';

const ALL_SLOTS: EquipmentSlot[] = [
	...EQUIPMENT_LAYOUT.left,
	...EQUIPMENT_LAYOUT.right,
	...EQUIPMENT_LAYOUT.bottom,
];

test('catalog keys equal item ids', () => {
	for (const [key, def] of Object.entries(ITEM_CATALOG)) assert.equal(def.id, key);
});

test('gear has a slot, consumables have healHp and stackMax', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.consumable) {
			assert.ok(def.consumable.healHp > 0, def.id);
			assert.ok((def.stackMax ?? 0) > 1, def.id);
			assert.equal(def.slot, undefined, def.id);
		} else {
			assert.ok(def.slot, `${def.id} needs a slot`);
			assert.equal(def.stackMax ?? 1, 1, def.id);
		}
		assert.ok(def.sellValue > 0, def.id);
	}
});

test('layout lists all 13 equipment slots exactly once', () => {
	assert.equal(ALL_SLOTS.length, 13);
	assert.equal(new Set(ALL_SLOTS).size, 13);
});

test('Rattatui pieces cover all 13 slots (the ring item covers ring1 and ring2)', () => {
	const covered = new Set<string>();
	for (const id of RATTATUI_SET.pieces) {
		const def = ITEM_CATALOG[id];
		assert.ok(def, id);
		assert.equal(def.set, RATTATUI_SET.id, id);
		if (def.slot === 'ring') {
			covered.add('ring1');
			covered.add('ring2');
		} else {
			covered.add(def.slot as string);
		}
	}
	assert.deepEqual([...covered].sort(), [...ALL_SLOTS].sort());
	assert.equal(RATTATUI_SET.size, 13);
	assert.equal(RATTATUI_SET.pieces.length, 12);
});

test('no weapon exceeds COMBAT.maxWeaponDamage and the starter weapon deals 2', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.slot === 'mainHand') assert.ok((def.stats?.damage ?? 0) <= COMBAT.maxWeaponDamage, def.id);
		else assert.equal(def.stats?.damage, undefined, `${def.id} is not a weapon`);
	}
	assert.equal(ITEM_CATALOG[STARTER_EQUIPMENT.mainHand!].stats?.damage, 2);
});

test('starter shield has armor 2', () => {
	assert.equal(ITEM_CATALOG[STARTER_EQUIPMENT.offHand!].stats?.armor, 2);
});

test('fang blade damage equals COMBAT.maxWeaponDamage', () => {
	assert.equal(ITEM_CATALOG.rattatui_fang_blade.stats?.damage, COMBAT.maxWeaponDamage);
});

test('starter bag items exist in the catalog', () => {
	for (const { id, qty } of STARTER_BAG_ITEMS) {
		assert.ok(ITEM_CATALOG[id], id);
		assert.ok(qty >= 1);
	}
});
