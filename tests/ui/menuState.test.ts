import test from 'node:test';
import assert from 'node:assert/strict';
import '../helpers';
import { useWindowStore, DEFAULT_WINDOW_POS, WIN_IDS } from '../../src/stores/windowStore';
import { ANIMALS, FARM, FARM_UPGRADES, type FarmUpgradeId } from '../../src/config/farm';
import { INITIAL_RESOURCES } from '../../src/config/economy';
import { calculateAnimalCost, farmCap, farmHasPurchase, farmUpgradeCost } from '../../src/utils/game/farm';

const win = () => useWindowStore.getState();
const closeAll = () => WIN_IDS.forEach((id) => win().closeWindow(id));

test('several windows can be open at once, the last opened is in front', () => {
	closeAll();
	win().openWindow('merchant');
	win().openWindow('farm');
	win().openWindow('castle');
	assert.deepEqual(win().order, ['merchant', 'farm', 'castle']);
	win().closeWindow('farm');
	assert.deepEqual(win().order, ['merchant', 'castle']);
	closeAll();
	assert.deepEqual(win().order, []);
});

test('clicking a window brings it to the front, and opening an open one does the same', () => {
	closeAll();
	win().openWindow('equipment');
	win().openWindow('character');
	win().openWindow('merchant');
	win().focusWindow('equipment');
	assert.deepEqual(win().order, ['character', 'merchant', 'equipment']);
	win().openWindow('character');
	assert.deepEqual(win().order, ['merchant', 'equipment', 'character']);
	win().focusWindow('farm'); // a closed window is not opened by a click
	assert.equal(win().order.includes('farm'), false);
	closeAll();
});

test('the header button: opens, brings a buried window forward, and closes the front one', () => {
	closeAll();
	win().toggleWindow('merchant');
	win().toggleWindow('farm');
	win().toggleWindow('merchant'); // behind the farm: comes forward, stays open
	assert.deepEqual(win().order, ['farm', 'merchant']);
	win().toggleWindow('merchant'); // in front: closes
	assert.deepEqual(win().order, ['farm']);
	closeAll();
});

test('dragging moves one window only, and a window keeps its place while closed', () => {
	closeAll();
	win().moveWindow('merchant', 300, 220);
	assert.deepEqual(win().positions.merchant, { x: 300, y: 220 });
	assert.deepEqual(win().positions.farm, DEFAULT_WINDOW_POS.farm);
	win().openWindow('merchant');
	win().closeWindow('merchant');
	win().openWindow('merchant');
	assert.deepEqual(win().positions.merchant, { x: 300, y: 220 });
	closeAll();
});

const res = (extra: Partial<typeof INITIAL_RESOURCES> = {}) => ({ ...INITIAL_RESOURCES, ...extra });

test('the farm dot lights for an affordable animal and not before', () => {
	const cheapest = Math.min(...ANIMALS.map((a) => calculateAnimalCost(a, 0)));
	assert.equal(farmHasPurchase(res({ food: 0 }), {}, {}), false);
	assert.equal(farmHasPurchase(res({ food: cheapest }), {}, {}), true);
	assert.equal(farmHasPurchase(res({ food: cheapest - 1 }), {}, {}), false);
});

const maxedUpgrades = () => Object.fromEntries((Object.keys(FARM_UPGRADES) as FarmUpgradeId[]).map((k) => [k, FARM_UPGRADES[k].maxLevel]));

test('a kind at the pen cap no longer lights the dot', () => {
	const upgrades = maxedUpgrades(); // nothing left to upgrade, so only animals can light it
	const cap = farmCap(upgrades);
	const full = Object.fromEntries(ANIMALS.map((a) => [a.id, cap]));
	assert.equal(farmHasPurchase(res({ food: 1e12 }), full, upgrades), false);
	const room = { ...full, [ANIMALS[0].id]: cap - 1 };
	assert.equal(farmHasPurchase(res({ food: 1e12 }), room, upgrades), true);
	assert.equal(farmCap({}), FARM.baseCap);
});

test('an affordable farm upgrade lights the dot even when no animal is', () => {
	const cap = farmCap({});
	const full = Object.fromEntries(ANIMALS.map((a) => [a.id, cap]));
	const id = Object.keys(FARM_UPGRADES)[0] as FarmUpgradeId;
	const cost = farmUpgradeCost(id, 0);
	const exact = res(cost as Partial<typeof INITIAL_RESOURCES>);
	assert.equal(farmHasPurchase(exact, full, {}), true);
	// one short of any ingredient: not affordable
	const [short] = Object.keys(cost) as (keyof typeof cost)[];
	assert.equal(farmHasPurchase({ ...exact, [short]: (cost[short] ?? 1) - 1 }, full, {}), false);
});

test('the crafting window opens and closes like the others', () => {
	closeAll();
	win().toggleWindow('crafting');
	assert.deepEqual(win().order, ['crafting']);
	win().toggleWindow('crafting');
	assert.deepEqual(win().order, []);
});
