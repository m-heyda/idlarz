import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, patchTileAt, tileAt, store } from '../helpers';
import { BUILDINGS_FLAG } from '../../src/config/buildings';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { calculateResourceRates } from '../../src/utils/game/income';
import { PERSISTED_KEYS, pickPersisted, sanitizeSave } from '../../src/lib/sanitizeSave';
import { encodeSave, packBody, unpackBody } from '../../src/lib/saveFormat';
import { summarize } from '../../src/lib/cloudSave/summary';
import { minimumSpend } from '../../src/lib/cloudSave/netWorth';
import { BUILDINGS_ENTRY_ID, tileMenuItems } from '../../src/lib/tileMenuItems';
import { builtBuildings } from '../../src/lib/buildings';

/**
 * The guarantee of the dark release: with `BUILDINGS_FLAG.enabled` false (how it ships) the building system changes nothing a player, the server or the sim can see.
 * The flag-on behaviour is tested in buildings.test.ts; here every surface that could leak is checked with the flag off.
 */

test('the flag ships off', () => {
	assert.equal(BUILDINGS_FLAG.enabled, false);
});

test('flag off: the save body has exactly the keys it had before the building system', () => {
	freshGame();
	growTo(8);
	const body = packBody(pickPersisted(api()));
	const expected = new Set<string>([...PERSISTED_KEYS.filter((k) => !['tiles', 'level', 'previousLevel', 'activeChests'].includes(k)), 'land', 'extra']);
	assert.deepEqual(new Set(Object.keys(body)), expected);
	assert.equal('buildingUpgrade' in body, false);
	assert.equal('buildingUpgrade' in pickPersisted(api()), false);
	assert.equal(JSON.stringify(body.extra).includes('building'), false);
});

test('flag off: a building that somehow stands on a tile is neither saved, nor paid, nor priced', () => {
	freshGame();
	growTo(8);
	const spot = (() => {
		for (let y = CASTLE_Y - 4; y <= CASTLE_Y + 4; y++)
			for (let x = CASTLE_X - 4; x <= CASTLE_X + 4; x++) if (tileAt(api().tiles, x, y).isOwned && tileAt(api().tiles, x, y).biome !== 'castle') return { x, y };
		throw new Error('no tile');
	})();
	const state = () => pickPersisted(api());
	const ratesBefore = calculateResourceRates(api().tiles, api().characterStats, api().farmLevels, api().prestige).total;
	const textBefore = encodeSave(state(), 1);
	const summaryBefore = summarize(state());
	const spendBefore = minimumSpend(state());
	patchTileAt(spot.x, spot.y, { building: 'lumberyard', buildingLevel: 4 });
	assert.deepEqual(calculateResourceRates(api().tiles, api().characterStats, api().farmLevels, api().prestige).total, ratesBefore);
	assert.equal(encodeSave(state(), 1), textBefore, 'the save text is byte-identical');
	assert.deepEqual(summarize(state()), summaryBefore);
	assert.equal(minimumSpend(state()), spendBefore);
});

test('flag off: a save that carries buildings (written with the flag on) loads, minus them', () => {
	freshGame();
	growTo(8);
	const body = packBody(pickPersisted(api()));
	const [y, x0] = (body.land as [number, number, string][]).find(([row, x]) => !(x === CASTLE_X && row === CASTLE_Y))!;
	const x = x0 === CASTLE_X && y === CASTLE_Y ? x0 + 1 : x0;
	const biome = tileAt(api().tiles, x, y).biome;
	const withBuilding = {
		...body,
		extra: [...(body.extra as unknown[]), [x, y, { building: 'lumberyard', bl: 3 }]],
		buildingUpgrade: { x, y, toLevel: 4, remainingSec: 5 },
	};
	const result = unpackBody(withBuilding as never);
	assert.ok('raw' in result, 'the extra keys are accepted');
	if (!('raw' in result)) return;
	const loaded = sanitizeSave(result.raw);
	assert.ok(loaded.ok, loaded.ok ? '' : loaded.reason);
	if (!loaded.ok) return;
	assert.equal(builtBuildings(loaded.state.tiles).length, 0, `no building survives on the ${biome} tile`);
	assert.equal('buildingUpgrade' in loaded.state, false);
});

test('flag off: the actions refuse and the tile menu keeps the disabled placeholder', () => {
	freshGame();
	growTo(8);
	assert.equal(api().buildBuilding(CASTLE_X + 1, CASTLE_Y, 'lumberyard'), false);
	assert.equal(api().upgradeBuilding(CASTLE_X + 1, CASTLE_Y), false);
	assert.equal(api().moveBuilding(CASTLE_X + 1, CASTLE_Y, CASTLE_X + 2, CASTLE_Y), false);
	assert.equal(api().buildingUpgrade, null);
	const at = { x: CASTLE_X + 1, y: CASTLE_Y, t: tileAt(api().tiles, CASTLE_X + 1, CASTLE_Y) };
	const items = tileMenuItems({ x: at.x, y: at.y, biome: at.t.biome, game: store as never, queuePos: 0, lineOpen: false, hasChest: false });
	const entry = items.find((i) => i.id === BUILDINGS_ENTRY_ID);
	assert.equal(entry?.label, 'Buildings: coming soon');
	assert.equal(entry?.disabled, true);
});
