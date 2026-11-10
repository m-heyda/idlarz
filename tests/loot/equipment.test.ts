import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, openFight, store } from '../helpers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { REBIRTH } from '../../src/config/rebirth';
import { LIMITS } from '../../src/config/limits';
import { totalStatPoints } from '../../src/utils/game/character';
import { ITEM_CATALOG } from '../../src/catalog';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { emptyBag, gearOf, rebirthKit } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { maxHp } from '../../src/lib/combat';
import type { BagSlot } from '../../src/types/game';
import { patchTile } from '../../src/utils/world';

const max = () => maxHp(api().characterStats, api().equipment);
const bagWith = (...ids: string[]): BagSlot[] => {
	const bag = emptyBag();
	ids.forEach((id, i) => (bag[i] = { item: plainItem(id) }));
	return bag;
};

test('new game starts with sword and shield equipped, 2 potions and full HP', () => {
	freshGame();
	assert.deepEqual(api().equipment, STARTER_EQUIPMENT);
	assert.equal(api().bag.length, LIMITS.bagSize);
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
	assert.equal(api().playerHp, max());
	assert.equal(max(), 101);
	assert.deepEqual(api().monsters, []);
	assert.equal(api().combat.fight, null);
});

test('equipItem swaps with the equipped item and nothing is lost', () => {
	freshGame();
	store.setState({ bag: bagWith('obsidian_blade') });
	assert.equal(api().equipItem(0), true);
	assert.deepEqual(api().equipment.mainHand, plainItem('obsidian_blade'));
	assert.deepEqual(api().bag[0], { item: plainItem('wooden_sword') });
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
	store.setState({ bag: bagWith('obsidian_cuirass') });
	api().equipItem(0);
	assert.equal(max(), 101 + ITEM_CATALOG.obsidian_cuirass.stats!.maxHp!);
	store.setState({ playerHp: max() });
	assert.equal(api().unequipItem('chest'), true);
	assert.equal(api().playerHp, 101);
	assert.deepEqual(api().bag[0], { item: plainItem('obsidian_cuirass') });
});

test('unequipItem fails on an empty slot and when the bag is full', () => {
	freshGame();
	assert.equal(api().unequipItem('head'), false);
	store.setState({ bag: emptyBag().map(() => ({ item: plainItem('wooden_sword') })) });
	assert.equal(api().unequipItem('offHand'), false);
	assert.deepEqual(api().equipment.offHand, plainItem('wooden_shield'));
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
	store.setState({ bag: bagWith('obsidian_blade') });
	openFight();
	assert.equal(api().equipItem(0), false);
	assert.equal(api().unequipItem('offHand'), false);
	assert.equal(api().moveBagItem(0, 1), false);
	assert.deepEqual(api().equipment.mainHand, plainItem('wooden_sword'));
	assert.equal(gearOf(api().bag[0])?.base, 'obsidian_blade');
});

test('rebirth wipes the gear and the bag (starter kit again) and refills HP', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => {
		const tiles = patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel });
		return { tiles, bag: bagWith('obsidian_cuirass', 'obsidian_helm'), playerHp: 10 };
	});
	api().equipItem(1);
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().equipment, STARTER_EQUIPMENT);
	assert.deepEqual(api().bag, rebirthKit({}).bag);
	assert.equal(api().lootPity && Object.keys(api().lootPity).length, 0);
	assert.equal(api().playerHp, max());
	assert.deepEqual(api().monsters, []);
	assert.equal(api().combat.fight, null);
});

test('a rebirth gives every attribute point back to spend (respec) and keeps the level', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }), resources: { ...s.resources, xp: 5e6 } }));
	api().tick(1000);
	const level = api().level.level;
	assert.ok(level > 5);
	assert.equal(api().addStatPoint('strength'), true);
	assert.equal(api().rebirth(), true);
	const stats = api().characterStats;
	assert.equal(stats.strength, INITIAL_CHARACTER_STATS.strength, 'spent points are back');
	assert.equal(stats.availablePoints, totalStatPoints(level), 'all the points of the level are free again');
	assert.equal(api().level.level, level);
});
