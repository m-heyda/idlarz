import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store, gridCells } from './helpers';
import { emptyBag } from '../src/lib/inventory';
import { calculateResourceBreakdown, calculateResourceRates } from '../src/utils/gameUtils';
import { useUiStore } from '../src/stores/uiStore';
import { PREF_DEFAULTS, readPref, writePref } from '../src/lib/uiPrefs';
import type { BagSlot, Monster } from '../src/types/game';

const spot = () => {
	const found = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle');
	if (found) return { x: found.x, y: found.y };
	throw new Error('no owned tile');
};

const withMonsters = (...monsters: Partial<Monster>[]) => {
	freshGame();
	growTo(6);
	const at = spot();
	store.setState({
		monsters: monsters.map((m, i) => ({ id: i + 1, type: 'rat', tier: 1, ...at, ageSec: 0, ...m })),
		nextMonsterId: monsters.length + 1,
	});
};

test('dismissMonster removes the monster with no loot or XP', () => {
	withMonsters({}, { id: 2, type: 'ratKing' });
	const before = { ...api().resources };
	const bag = api().bag;
	assert.equal(api().dismissMonster(1), true);
	assert.deepEqual(api().monsters.map((m) => m.id), [2]);
	assert.deepEqual(api().resources, before);
	assert.equal(api().bag, bag);
	assert.equal(api().dismissMonster(1), false, 'already gone');
	assert.equal(api().dismissMonster(99), false, 'unknown id');
});

test('dismissMonster refuses the monster that is being fought', () => {
	withMonsters({}, { id: 2 });
	assert.equal(api().startFight(1), true);
	assert.equal(api().dismissMonster(1), false);
	assert.equal(api().monsters.length, 2);
	assert.equal(api().dismissMonster(2), true, 'another monster can still go');
});

test('discardItem throws bag items away without paying gold, and never touches equipment', () => {
	freshGame();
	const bag: BagSlot[] = emptyBag();
	bag[0] = { id: 'potion_minor', qty: 5 };
	bag[1] = { id: 'wooden_sword', qty: 1 };
	store.setState({ bag });
	const gold = api().resources.gold;
	const equipment = api().equipment;
	assert.equal(api().discardItem(0), true);
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 4 }, 'one by default');
	assert.equal(api().discardItem(0, 4), true);
	assert.equal(api().bag[0], null, 'the whole stack clears the slot');
	assert.equal(api().discardItem(1), true);
	assert.equal(api().bag[1], null);
	assert.equal(api().resources.gold, gold, 'no gold for it');
	assert.equal(api().equipment, equipment);
});

test('discardItem rejects empty slots, bad amounts and anything during a fight', () => {
	withMonsters({});
	const bag: BagSlot[] = emptyBag();
	bag[0] = { id: 'potion_minor', qty: 2 };
	store.setState({ bag });
	assert.equal(api().discardItem(5), false);
	assert.equal(api().discardItem(-1), false);
	assert.equal(api().discardItem(0, 3), false, 'more than the stack');
	assert.equal(api().discardItem(0, 0), false);
	assert.equal(api().startFight(1), true);
	assert.equal(api().discardItem(0), false, 'not in a fight');
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
});

test('the income breakdown adds up to exactly what calculateResourceRates reports', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(14);
	const at = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')!; // the land is rolled: a lake cannot take a farm
	assert.equal(api().buildOnTile(at.x, at.y, 'farm'), true);
	const s = api();
	const rates = calculateResourceRates(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	const breakdown = calculateResourceBreakdown(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	for (const key of Object.keys(rates.total) as (keyof typeof rates.total)[]) {
		const e = breakdown[key];
		assert.equal(e.base, rates.base[key], `${key} base`);
		assert.equal(e.modifier, rates.modifiers[key], `${key} modifier`);
		assert.equal(e.total, rates.total[key], `${key} total`);
		const parts = e.start + e.farm + e.biome + e.building + e.castleArea + e.castleXp;
		assert.ok(Math.abs(parts - e.base) < 1e-9, `${key}: the pieces add up to the base`);
		assert.ok(Math.abs(e.base * (1 + e.modifier) - e.total) < 1e-9, `${key}: base x (1 + modifier) = total`);
	}
	assert.ok(breakdown.food.building > 0, 'the farm shows up as a building share');
	assert.ok(breakdown.gold.biome > 0 || breakdown.wood.biome > 0);
	assert.ok(breakdown.gold.castleMod > 0, 'the castle bonus is reported on its own');
});

test('ui store: dialogs close the menu, confirmations track their target, prefs fall back to defaults without storage', () => {
	const ui = useUiStore.getState();
	ui.openContextMenu({ x: 5, y: 6, title: 'a', items: [{ id: 'x', label: 'X', onSelect: () => undefined }] });
	assert.equal(useUiStore.getState().contextMenu?.title, 'a');
	ui.openBuildDialog(2, 3); // opening a dialog closes the menu
	assert.equal(useUiStore.getState().contextMenu, null);
	assert.deepEqual(useUiStore.getState().buildDialog, { x: 2, y: 3 });
	ui.closeBuildDialog();
	assert.equal(useUiStore.getState().buildDialog, null);
	ui.askDismissMonster(4);
	assert.equal(useUiStore.getState().dismissMonsterId, 4);
	ui.askDismissMonster(null);
	ui.askDiscard(2);
	assert.equal(useUiStore.getState().discardIndex, 2);
	ui.askDiscard(null);
	// the test storage stub always answers null: every pref is its default, and writing does not throw
	assert.equal(readPref('showAdmin'), PREF_DEFAULTS.showAdmin);
	assert.doesNotThrow(() => writePref('showMinimap', false));
});
