import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { useUiStore } from '../src/stores/uiStore';
import { ANIMALS, FARM, FARM_UPGRADES, INITIAL_RESOURCES, type FarmUpgradeId } from '../src/config/gameConfig';
import { calculateAnimalCost, farmCap, farmHasPurchase, farmUpgradeCost } from '../src/utils/gameUtils';

const ui = () => useUiStore.getState();

test('the menu opens on the last tab and remembers it between visits', () => {
	ui().closeMenu();
	ui().openMenu('merchant');
	assert.equal(ui().menuOpen, true);
	assert.equal(ui().menuTab, 'merchant');
	ui().closeMenu();
	assert.equal(ui().menuOpen, false);
	ui().toggleMenu(); // the header button: reopens where you left off
	assert.equal(ui().menuOpen, true);
	assert.equal(ui().menuTab, 'merchant');
	ui().setMenuTab('farm');
	assert.equal(ui().menuTab, 'farm');
	ui().toggleMenu();
	assert.equal(ui().menuOpen, false);
});

test('opening the menu without a tab keeps the current one', () => {
	ui().openMenu('stats');
	ui().closeMenu();
	ui().openMenu();
	assert.equal(ui().menuTab, 'stats');
	ui().closeMenu();
});

const res = (extra: Partial<typeof INITIAL_RESOURCES> = {}) => ({ ...INITIAL_RESOURCES, ...extra });

test('the farm dot lights for an affordable animal and not before', () => {
	const cheapest = Math.min(...ANIMALS.map((a) => calculateAnimalCost(a, 0)));
	assert.equal(farmHasPurchase(res({ food: 0 }), {}, {}), false);
	assert.equal(farmHasPurchase(res({ food: cheapest }), {}, {}), true);
	assert.equal(farmHasPurchase(res({ food: cheapest - 1 }), {}, {}), false);
});

const maxedUpgrades = () =>
	Object.fromEntries((Object.keys(FARM_UPGRADES) as FarmUpgradeId[]).map((k) => [k, FARM_UPGRADES[k].maxLevel]));

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
