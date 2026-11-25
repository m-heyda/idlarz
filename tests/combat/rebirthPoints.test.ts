import assert from 'node:assert/strict';
import test from 'node:test';
import { LEVELING } from '../../src/config/character';
import { attributeBudget } from '../../src/lib/offline/attrs';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { calculateLevel, cumulativeXp, rebirthPoints, reconcileCharacter, totalStatPoints } from '../../src/utils/game/character';
import { REBIRTH } from '../../src/config/rebirth';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { patchTile } from '../../src/utils/world';
import { api, freshGame, growTo, rawSnapshot, store } from '../helpers';

/** A game that can rebirth: the castle at the needed level and the needed tiles. */
const rebirthReady = () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }), castleUpgrade: null }) as never);
};

// IDL-100 / IDL-101: every rebirth adds a flat 20 attribute points to the pool, on top of what the level earned. One budget (`attributeBudget`) is read by the server's allocation check, the browser, the save sanitizer
// and `reconcileCharacter`; over-budget is clamped (a free respec), never refused.

test('20 points per rebirth on top of the level, and nothing for a bad count', () => {
	assert.equal(LEVELING.attributePointsPerRebirth, 20);
	for (const level of [1, 10, 30, 80, 100]) {
		assert.equal(attributeBudget(level), totalStatPoints(level), 'no rebirth: the level alone');
		assert.equal(attributeBudget(level, 5), totalStatPoints(level) + 100);
	}
	assert.deepEqual([0, 1, 2.9, -3, Number.NaN, Infinity].map(rebirthPoints), [0, 20, 40, 0, 0, 0]);
});

test('reconcileCharacter keeps the points a rebirth earned and still hands back an impossible total', () => {
	const xp = cumulativeXp(20);
	const level = calculateLevel(xp).level;
	const base = { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 };
	const withRebirthPoints = { ...api().characterStats, ...base, strength: 5 + totalStatPoints(level) + 40, availablePoints: 0 };
	// two rebirths pay for those 40 extra points
	assert.equal(reconcileCharacter(withRebirthPoints, xp, 2), withRebirthPoints);
	// the same character with no rebirth behind it holds more than it earned: every point goes back, none is lost
	const reset = reconcileCharacter(withRebirthPoints, xp, 0);
	assert.equal(reset.strength, 5);
	assert.equal(reset.availablePoints, totalStatPoints(level));
	// the clamp keeps the rebirth points when it does fire
	const tooMany = { ...withRebirthPoints, strength: withRebirthPoints.strength + 100 };
	const clamped = reconcileCharacter(tooMany, xp, 2);
	assert.equal(clamped.availablePoints, totalStatPoints(level) + 40);
});

test('a rebirth gives the new run its level points plus 20 more, all free to spend', () => {
	rebirthReady();
	const before = api();
	const level = calculateLevel(before.resources.xp).level;
	assert.equal(before.prestige.rebirths, 0);
	assert.equal(api().rebirth(), true);
	const after = api();
	assert.equal(after.prestige.rebirths, 1);
	assert.equal(after.characterStats.availablePoints, totalStatPoints(level) + 20);
	// and the save with that pool is accepted as it is, not wiped as "more points than the level pays for"
	const raw = rawSnapshot(store.getState());
	const loaded = sanitizeSave(raw);
	assert.equal(loaded.ok, true);
	if (loaded.ok) assert.equal(loaded.state.characterStats.availablePoints, totalStatPoints(level) + 20);
});

test('a save above the pool is a free respec, never refused', () => {
	rebirthReady();
	assert.equal(api().rebirth(), true);
	const level = calculateLevel(api().resources.xp).level;
	const raw = rawSnapshot(store.getState());
	raw.characterStats.availablePoints = totalStatPoints(level) + 20 + 50; // 50 points nobody earned
	const loaded = sanitizeSave(raw);
	assert.equal(loaded.ok, true, 'clamped, not refused');
	if (loaded.ok) assert.equal(loaded.state.characterStats.availablePoints, totalStatPoints(level) + 20);
});
