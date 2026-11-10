import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../helpers';
import { ITEM_CATALOG, STARTER_EQUIPMENT_BY_CLASS } from '../../src/catalog';
import { WEAPON_ATTACK_SPEED } from '../../src/catalog/weapons';
import { STARTER_EQUIPMENT, starterEquipmentFor } from '../../src/config/itemCatalog';
import { PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';
import { rebirthKit } from '../../src/lib/inventory';
import { rebirthInventory, inventoryFromCore } from '../../src/lib/offline/inventory';
import { maxMana } from '../../src/lib/combat';

// A new hero starts with gear that fits the class: sword and shield (Warrior, Paladin), a bow (Ranger) or a staff (Mage). Applied on a new game, "A new chapter" and a rebirth, on the browser and on the server.

const mainHand = (equipment: ReturnType<typeof starterEquipmentFor>) => equipment.mainHand?.base;

test('each class has its starter weapons: sword and shield, a bow, a staff', () => {
	assert.equal(mainHand(starterEquipmentFor('warrior')), 'wooden_sword');
	assert.equal(starterEquipmentFor('warrior').offHand?.base, 'wooden_shield');
	assert.deepEqual(starterEquipmentFor('paladin'), starterEquipmentFor('warrior'));
	assert.equal(mainHand(starterEquipmentFor('ranger')), 'wooden_bow');
	assert.equal(starterEquipmentFor('ranger').offHand, undefined, 'a bow takes both hands');
	assert.equal(mainHand(starterEquipmentFor('mage')), 'wooden_staff');
	assert.equal(starterEquipmentFor('mage').offHand, undefined);
	assert.deepEqual(starterEquipmentFor(undefined), STARTER_EQUIPMENT, 'no class: the default kit');
	assert.deepEqual(starterEquipmentFor('not_a_class'), STARTER_EQUIPMENT);
	for (const id of PLAYER_CLASS_ORDER) assert.ok(STARTER_EQUIPMENT_BY_CLASS[id], id);
});

test("no class starts stronger: the bow and the staff match the sword's damage per second", () => {
	const dps = (id: string) => {
		const def = ITEM_CATALOG[id];
		return (def.stats?.damage ?? 0) * (WEAPON_ATTACK_SPEED[def.weaponType as keyof typeof WEAPON_ATTACK_SPEED] ?? 1);
	};
	const sword = dps('wooden_sword');
	for (const id of ['wooden_bow', 'wooden_staff']) {
		assert.ok(Math.abs(dps(id) - sword) / sword < 0.05, `${id} ${dps(id)} against the sword ${sword}`);
		assert.equal(ITEM_CATALOG[id].enabled, false, `${id} never drops: it is a starter piece`);
	}
});

test('a rebirth keeps the class kit, in the browser and on the server', () => {
	assert.equal(mainHand(rebirthKit(undefined, undefined, 0, 'ranger').equipment), 'wooden_bow');
	assert.equal(mainHand(rebirthKit(undefined, undefined, 0, 'mage').equipment), 'wooden_staff');
	assert.equal(mainHand(rebirthKit(undefined, undefined, 0).equipment), 'wooden_sword', 'no class given: as before');
	const inv = inventoryFromCore({ equipment: {}, bag: [], prestige: undefined } as never);
	assert.equal(mainHand(rebirthInventory(inv, undefined, undefined, 'mage').equipment), 'wooden_staff');
	assert.equal(mainHand(rebirthInventory(inv, undefined, undefined, 'ranger').equipment), 'wooden_bow');
	assert.equal(mainHand(rebirthInventory(inv, undefined, undefined).equipment), 'wooden_sword');
});

test('a brand-new game takes the class kit when the profile lands, and HP and mana follow it', () => {
	api().resetGame();
	assert.equal(api().applyProfileToFreshGame('Aria', 'mage'), true);
	assert.equal(api().equipment.mainHand?.base, 'wooden_staff');
	assert.equal(api().equipment.offHand, undefined);
	assert.equal(api().playerMp, maxMana(api().characterStats, api().equipment, 'mage'));

	api().resetGame();
	assert.equal(api().applyProfileToFreshGame('Robin', 'ranger'), true);
	assert.equal(api().equipment.mainHand?.base, 'wooden_bow');

	api().resetGame();
	assert.equal(api().applyProfileToFreshGame('Bran', 'warrior'), true);
	assert.equal(api().equipment.mainHand?.base, 'wooden_sword');
	assert.equal(api().equipment.offHand?.base, 'wooden_shield');
});
