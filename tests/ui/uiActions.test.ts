import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, openFight, store, gridCells } from '../helpers';
import { emptyBag } from '../../src/lib/inventory';
import { calculateResourceBreakdown, calculateResourceRates } from '../../src/utils/game/income';
import { useUiStore } from '../../src/stores/uiStore';
import { BUILDINGS_ENTRY_ID, tileMenuItems } from '../../src/lib/tileMenuItems';
import { buildOptions } from '../../src/lib/buildingMenu';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { BUILDINGS_FLAG } from '../../src/config/buildings';
import { PREF_DEFAULTS, readPref, writePref } from '../../src/lib/uiPrefs';
import { useGameStore } from '../../src/stores/gameStore';
import { patchTile } from '../../src/utils/world';
import type { BagSlot, Monster, Tile } from '../../src/types/game';

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
		monsters: monsters.map((m, i) => ({ id: i + 1, type: 'thistleBoar', level: 1, spawnLevel: 1, ...at, ageSec: 0, ...m })),
	});
};

test('dismissMonster removes the monster with no loot or XP', () => {
	withMonsters({}, { id: 2, type: 'bossGreatAuroch', level: 15, spawnLevel: 15 });
	const before = { ...api().resources };
	const bag = api().bag;
	assert.equal(api().dismissMonster(1), true);
	assert.deepEqual(
		api().monsters.map((m) => m.id),
		[2],
	);
	assert.deepEqual(api().resources, before);
	assert.equal(api().bag, bag);
	assert.equal(api().dismissMonster(1), false, 'already gone');
	assert.equal(api().dismissMonster(99), false, 'unknown id');
});

test('dismissing the monster that is being fought is allowed: the server ends that fight', () => {
	withMonsters({}, { id: 2 });
	openFight({ n: 1 });
	assert.equal(api().dismissMonster(1), true, 'the server ends the fight against a dismissed monster');
	assert.equal(api().monsters.length, 1);
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
	openFight();
	assert.equal(api().discardItem(0), false, 'not in a fight');
	assert.deepEqual(api().bag[0], { id: 'potion_minor', qty: 2 });
});

test('the income breakdown adds up to exactly what calculateResourceRates reports', () => {
	freshGame({ gold: 1e12, wood: 1e12, stone: 1e12 });
	growTo(14);
	const s = api();
	const rates = calculateResourceRates(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	const breakdown = calculateResourceBreakdown(s.tiles, s.characterStats, s.farmLevels, s.prestige, s.farmUpgrades);
	for (const key of Object.keys(rates.total) as (keyof typeof rates.total)[]) {
		const e = breakdown[key];
		assert.equal(e.base, rates.base[key], `${key} base`);
		assert.equal(e.modifier, rates.modifiers[key], `${key} modifier`);
		assert.equal(e.total, rates.total[key], `${key} total`);
		const parts = e.start + e.farm + e.biome + e.castleArea + e.castleXp;
		assert.ok(Math.abs(parts - e.base) < 1e-9, `${key}: the pieces add up to the base`);
		assert.ok(Math.abs(e.base * (1 + e.modifier) - e.total) < 1e-9, `${key}: base x (1 + modifier) = total`);
	}
	assert.ok(breakdown.gold.biome > 0 || breakdown.wood.biome > 0);
	assert.ok(breakdown.gold.castleMod > 0, 'the castle bonus is reported on its own');
});

test('ui store: dialogs close the menu, confirmations track their target, prefs fall back to defaults without storage', () => {
	const ui = useUiStore.getState();
	ui.openContextMenu({ x: 5, y: 6, title: 'a', items: [{ id: 'x', label: 'X', onSelect: () => undefined }] });
	assert.equal(useUiStore.getState().contextMenu?.title, 'a');
	ui.askDiscard(2); // opening a dialog closes the menu
	assert.equal(useUiStore.getState().contextMenu, null);
	assert.equal(useUiStore.getState().discardIndex, 2);
	ui.askDiscard(null);
	ui.askDismissMonster(4);
	assert.equal(useUiStore.getState().dismissMonsterId, 4);
	ui.askDismissMonster(null);
	ui.askDiscard(2);
	assert.equal(useUiStore.getState().discardIndex, 2);
	ui.askDiscard(null);
	// the test storage stub always answers null: every pref is its default, and writing does not throw
	assert.equal(readPref('showMinimap'), PREF_DEFAULTS.showMinimap);
	assert.doesNotThrow(() => writePref('showMinimap', false));
});

test('the farm panels and the minimap are remembered: defaults first, then what was folded stays folded after a reload', () => {
	assert.deepEqual(
		[PREF_DEFAULTS.farmAnimalsOpen, PREF_DEFAULTS.farmHudOpen, PREF_DEFAULTS.farmUpgradesOpen],
		[true, true, false],
		'a first visit sees the shop and the readout open and the upgrade drawer shut',
	);
	// a working storage on a real (non-dev) host for this test only
	const memory = new Map<string, string>();
	const g = globalThis as unknown as { window?: unknown };
	g.window = {
		location: { hostname: 'example.com' },
		localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) },
	};
	try {
		const ui = useUiStore.getState();
		ui.setPref('farmAnimalsOpen', false);
		ui.setPref('farmHudOpen', false);
		ui.setPref('farmUpgradesOpen', true);
		ui.setPref('showMinimap', false);
		useUiStore.setState({ ...PREF_DEFAULTS }); // a reload: the store is back to its defaults ...
		useUiStore.getState().loadPrefs(); // ... until the prefs are read after mount
		const after = useUiStore.getState();
		assert.equal(after.farmAnimalsOpen, false);
		assert.equal(after.farmHudOpen, false);
		assert.equal(after.farmUpgradesOpen, true);
		assert.equal(after.showMinimap, false, 'the minimap choice used to be written but never read back');
	} finally {
		delete g.window;
		useUiStore.setState({ ...PREF_DEFAULTS });
	}
});

test('with the building system off the tile right-click menu keeps a disabled "Buildings: coming soon" placeholder (IDL-259), and none on the castle', (t) => {
	const wasOn = BUILDINGS_FLAG.enabled;
	BUILDINGS_FLAG.enabled = false;
	t.after(() => {
		BUILDINGS_FLAG.enabled = wasOn;
	});
	freshGame();
	growTo(6);
	const at = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle')!;
	const context = (x: number, y: number, biome: Tile['biome'], over: object = {}) => ({
		x,
		y,
		biome,
		game: useGameStore as never,
		queuePos: 0,
		lineOpen: false,
		hasChest: false,
		...over,
	});
	const items = tileMenuItems(context(at.x, at.y, at.t.biome));
	const entry = items.find((item) => item.id === BUILDINGS_ENTRY_ID);
	assert.ok(entry, 'the entry is there');
	assert.equal(entry.label, 'Buildings: coming soon');
	assert.equal(entry.disabled, true);
	assert.equal(
		items.some((item) => /build here/i.test(item.label)),
		false,
		'the old "Build here..." entry is gone',
	);
	assert.ok(
		items.some((item) => item.id === 'highlight'),
		'the other entries are unchanged',
	);
	// it stays out of the way of a chest or a monster on the tile, as before for the other entries
	assert.ok(tileMenuItems(context(at.x, at.y, at.t.biome, { hasChest: true })).some((item) => item.id === BUILDINGS_ENTRY_ID));
	assert.equal(
		tileMenuItems(context(CASTLE_X, CASTLE_Y, 'castle')).some((item) => item.id === BUILDINGS_ENTRY_ID),
		false,
		'the castle takes no building',
	);
});

test('with the building system on the placeholder gives way to the real build menu of the tile', () => {
	freshGame();
	growTo(6);
	const at = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle')!;
	useGameStore.setState((s) => ({ tiles: patchTile(s.tiles, at.x, at.y, { biome: 'forest', hasChest: false }) }));
	const ctx = { x: at.x, y: at.y, biome: 'forest' as Tile['biome'], game: useGameStore as never, queuePos: 0, lineOpen: false, hasChest: false };
	const items = tileMenuItems(ctx);
	assert.equal(
		items.some((i) => i.id === BUILDINGS_ENTRY_ID),
		false,
		'no placeholder',
	);
	const here = items.find((i) => i.id === 'building-here');
	assert.ok(here, 'a single "Build here..." entry');
	assert.equal(here.label, 'Build here...');
	assert.equal(here.children, undefined, 'it opens the Build window, not a submenu');
	const { builds } = buildOptions(useGameStore as never, at.x, at.y);
	assert.deepEqual(
		builds.map((o) => o.def.id),
		['lumberyard', 'saptapper'],
		'the Producer and the Extractor of a forest',
	);
	assert.deepEqual(
		builds.map((o) => o.def.kind),
		['producer', 'extractor'],
	);
	here.onSelect();
	assert.deepEqual(useUiStore.getState().buildModal, { x: at.x, y: at.y }, 'selecting it opens the window for this tile');
	useUiStore.getState().closeBuildModal();
	// what already stands is no longer offered as a build, and can be moved here instead
	useGameStore.setState((s) => ({ tiles: patchTile(s.tiles, at.x, at.y, { building: 'lumberyard', buildingLevel: 1 }) }));
	const other = gridCells().find(({ t, x, y }) => t.isOwned && t.biome !== 'castle' && !(x === at.x && y === at.y))!;
	useGameStore.setState((s) => ({ tiles: patchTile(s.tiles, other.x, other.y, { biome: 'forest', hasChest: false }) }));
	const second = buildOptions(useGameStore as never, other.x, other.y);
	assert.deepEqual(
		second.builds.map((o) => o.def.id),
		['saptapper'],
		'the Extractor is not built yet',
	);
	assert.deepEqual(
		second.moves.map((o) => o.def.id),
		['lumberyard'],
		'a Move option for the one that stands',
	);
	assert.ok(items.some((i) => i.id === 'highlight'));
	assert.equal(
		tileMenuItems({ ...ctx, x: CASTLE_X, y: CASTLE_Y, biome: 'castle' }).some((i) => i.id.startsWith('building')),
		false,
		'nothing on the castle',
	);
});
