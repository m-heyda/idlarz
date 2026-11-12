import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeBuildTimers, timerLabel } from '../../src/lib/buildTimers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { BUILDINGS } from '../../src/catalog/buildings';

const base = { prestige: undefined, buildTimePct: 0, buildingAt: () => undefined };

test('no construction running: no rows', () => {
	assert.deepEqual(activeBuildTimers({ ...base, castleUpgrade: null, buildingUpgrades: [] }), []);
});

test('the castle upgrade is a row with its time, target level and progress', () => {
	const [row] = activeBuildTimers({ ...base, castleUpgrade: { toLevel: 2, remainingSec: 900 }, buildingUpgrades: [] });
	assert.equal(row.kind, 'castle');
	assert.equal(row.title, 'Castle');
	assert.equal(row.toLevel, 2);
	assert.equal(row.label, timerLabel(900));
	assert.equal(row.x, CASTLE_X);
	assert.equal(row.y, CASTLE_Y);
	assert.ok(row.progress > 0 && row.progress < 1);
});

test('several buildings at once give one row each, soonest finished first, named by the tile', () => {
	const def = BUILDINGS[0];
	const rows = activeBuildTimers({
		...base,
		castleUpgrade: { toLevel: 2, remainingSec: 5000 },
		buildingUpgrades: [
			{ x: 3, y: 4, toLevel: 2, remainingSec: 300 },
			{ x: 5, y: 6, toLevel: 3, remainingSec: 60 },
		],
		buildingAt: () => def.id,
	});
	assert.deepEqual(
		rows.map((r) => r.key),
		['building:5,6', 'building:3,4', 'castle'],
	);
	assert.equal(rows[0].title, def.label);
	assert.equal(rows[0].art, def.art);
});

test('a timer never reads less than one second while it runs', () => {
	assert.equal(timerLabel(0), '1s');
	assert.equal(timerLabel(0.2), '1s');
});
