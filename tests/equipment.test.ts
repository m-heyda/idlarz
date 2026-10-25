import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { GRID_CENTER_X, GRID_CENTER_Y, REBIRTH } from '../src/config/gameConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { emptyBag } from '../src/lib/inventory';
import { maxHp, newFight } from '../src/lib/combat';
import type { BagSlot } from '../src/types/game';

const max = () => maxHp(api().characterStats, api().equipment);
const bagWith = (...ids: string[]): BagSlot[] => {
	const bag = emptyBag();
	ids.forEach((id, i) => (bag[i] = { id, qty: 1 }));
	return bag;
};

test('new game starts with sword and shield equipped, 2 potions and full HP', () => {
	freshGame();
	assert.deepEqual(api().equipment, STARTER_EQUIPMENT);
	assert.equal(api().bag.length, 36);
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
	assert.equal(api().playerHp, max());
	assert.equal(max(), 101);
	assert.deepEqual(api().monsters, []);
	assert.equal(api().nextMonsterId, 1);
	assert.equal(api().fight, null);
});

test('equipItem swaps with the equipped item and nothing is lost', () => {
	freshGame();
	store.setState({ bag: bagWith('rattatui_fang_blade') });
	assert.equal(api().equipItem(0), true);
	assert.equal(api().equipment.mainHand, 'rattatui_fang_blade');
	assert.deepEqual(api().bag[0], { id: 'wooden_sword', qty: 1 });
});

test('equipItem rejects potions, empty slots and bad indexes', () => {
	freshGame();
	assert.equal(api().equipItem(0), false); // potion
	assert.equal(api().equipItem(30), false);
	assert.equal(api().equipItem(-1), false);
	assert.equal(api().equipItem(1.5), false);
});

test('gear that raises max HP can be taken off again and playerHp follows the new max', () => {
	freshGame();
	store.setState({ bag: bagWith('rattatui_tunic') });
	api().equipItem(0);
	assert.equal(max(), 101 + ITEM_CATALOG.rattatui_tunic.stats!.maxHp!);
	store.setState({ playerHp: max() });
	assert.equal(api().unequipItem('chest'), true);
	assert.equal(api().playerHp, 101);
	assert.deepEqual(api().bag[0], { id: 'rattatui_tunic', qty: 1 });
});

test('unequipItem fails on an empty slot and when the bag is full', () => {
	freshGame();
	assert.equal(api().unequipItem('head'), false);
	store.setState({ bag: emptyBag().map(() => ({ id: 'wooden_sword', qty: 1 })) });
	assert.equal(api().unequipItem('offHand'), false);
	assert.equal(api().equipment.offHand, 'wooden_shield');
});

test('moveBagItem swaps slots and rejects bad indexes', () => {
	freshGame();
	assert.equal(api().moveBagItem(0, 5), true);
	assert.equal(api().bag[0], null);
	assert.deepEqual(api().bag[5], { id: 'potion_minor', qty: 2 });
	assert.equal(api().moveBagItem(0, 99), false);
	assert.equal(api().moveBagItem(3, 3), false);
});

test('equip actions are refused during a fight', () => {
	freshGame();
	store.setState({ bag: bagWith('rattatui_fang_blade'), fight: newFight({ id: 1, type: 'rat', tier: 1 }) });
	assert.equal(api().equipItem(0), false);
	assert.equal(api().unequipItem('offHand'), false);
	assert.equal(api().moveBagItem(0, 1), false);
	assert.equal(api().equipment.mainHand, 'wooden_sword');
	assert.equal(api().bag[0]?.id, 'rattatui_fang_blade');
});

test('rebirth keeps equipment and bag and refills HP', () => {
	freshGame();
	growTo(20);
	store.setState((s) => {
		const tiles = s.tiles.map((row) => [...row]);
		tiles[GRID_CENTER_Y][GRID_CENTER_X] = { ...tiles[GRID_CENTER_Y][GRID_CENTER_X], level: REBIRTH.minCastleLevel };
		return { tiles, bag: bagWith('rattatui_tunic', 'rattatui_cap'), playerHp: 10 };
	});
	api().equipItem(1);
	const gear = { ...api().equipment };
	const bag = api().bag.map((s) => (s ? { ...s } : null));
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().equipment, gear);
	assert.deepEqual(api().bag, bag);
	assert.equal(api().playerHp, max());
	assert.deepEqual(api().monsters, []);
	assert.equal(api().fight, null);
});
