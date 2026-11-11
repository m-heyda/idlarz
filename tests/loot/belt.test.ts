import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EQUIPMENT_LAYOUT, EQUIPMENT_SLOT_LABEL } from '../../src/catalog';
import { EQUIPMENT_PIXEL_ICONS } from '../../src/config/pixelIcons';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { addGear, aggregateStats, emptyBag, equipFromBag, unequip } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { parseOp } from '../../src/lib/offline/inventory';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { freshGame, growTo, rawSnapshot } from '../helpers';

/** A plain instance at a rarity the grade allows (plainItem is common, which the ladder's grades above G2 do not roll) */
const rare = (id: string) => ({ ...plainItem(id), rarity: 'rare' });

// The belt slot (IDL-139): the 14th equipment slot. Its items are disabled until the belt stats land; the slot works for any instance.

test('the belt is in the Character window layout, has a label and an empty-slot icon', () => {
	assert.ok(EQUIPMENT_LAYOUT.right.includes('belt'));
	assert.equal(EQUIPMENT_SLOT_LABEL.belt, 'Belt');
	assert.ok(EQUIPMENT_PIXEL_ICONS.belt);
});

test('a belt equips into the belt slot, shows in the stats and unequips back into the bag', () => {
	const belt = rare('obsidian_belt');
	const bag = addGear(emptyBag(), belt).bag;
	const worn = equipFromBag(bag, {}, 0)!;
	assert.deepEqual(worn.equipment.belt, belt);
	assert.ok(aggregateStats(worn.equipment).maxHp > 0, 'the belt counts in the totals');
	const off = unequip(worn.bag, worn.equipment, 'belt')!;
	assert.equal(off.equipment.belt, undefined);
	assert.deepEqual(off.bag[0] && 'item' in off.bag[0] ? off.bag[0].item : null, belt);
});

test('a save with and without a belt round-trips, and a belt in the wrong slot is dropped', () => {
	freshGame();
	growTo(8);
	const plain = rawSnapshot();
	assert.equal(sanitizeSave(plain).ok, true, 'an old save has no belt key');
	const withBelt = rawSnapshot();
	withBelt.equipment = { ...STARTER_EQUIPMENT, belt: rare('obsidian_belt') };
	const result = sanitizeSave(withBelt);
	assert.ok(result.ok, result.ok ? '' : result.reason);
	if (result.ok) assert.deepEqual(result.state.equipment.belt, withBelt.equipment.belt);
	const wrong = rawSnapshot();
	wrong.equipment = { ...STARTER_EQUIPMENT, head: rare('obsidian_belt') };
	const wrongRead = sanitizeSave(wrong);
	assert.ok(wrongRead.ok && wrongRead.state.equipment.head === undefined, 'a belt in the head slot is dropped, the save loads');
	const wrongBack = rawSnapshot();
	wrongBack.equipment = { ...STARTER_EQUIPMENT, belt: plainItem('obsidian_helm') };
	const wrongBackRead = sanitizeSave(wrongBack);
	assert.ok(wrongBackRead.ok && wrongBackRead.state.equipment.belt === undefined, 'a helm in the belt slot is dropped, the save loads');
});

test('the server accepts unequipping the belt slot and refuses an unknown one', () => {
	assert.deepEqual(parseOp({ action: 'unequip', slot: 'belt' }), { action: 'unequip', slot: 'belt' });
	assert.equal(parseOp({ action: 'unequip', slot: 'tail' }), null);
});
