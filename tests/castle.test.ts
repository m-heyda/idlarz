import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, tileAt, rawSnapshot } from './helpers';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, MAX_CATCHUP_SEC } from '../src/config/gameConfig';
import { castleModifier, castleUpgradeDuration } from '../src/utils/gameUtils';
import { sanitizeSave } from '../src/lib/sanitizeSave';

const castleLevel = () => tileAt(api().tiles, CASTLE_X, CASTLE_Y).level ?? 1;

/** Pays for and waits out one castle upgrade with the real actions. */
const upgradeOnce = () => {
	const cost = tileAt(api().tiles, CASTLE_X, CASTLE_Y).upgradeCost!;
	setResources({ ...(cost as Record<string, number>) });
	assert.equal(api().upgradeCastle(), true);
	setResources({ gold: 1e12, wood: 1e12, stone: 1e12, coal: 1e12, food: 1e12, meat: 1e12 });
	const seconds = castleUpgradeDuration(castleLevel());
	for (let t = 0; t <= seconds + MAX_CATCHUP_SEC; t += MAX_CATCHUP_SEC) api().tick(MAX_CATCHUP_SEC * 1000);
};

test('castleModifier doubles up to the doubling level, then grows by a fixed step', () => {
	const base = CASTLE_UPGRADE.baseResourceMultiplier;
	for (let level = 1; level <= CASTLE_UPGRADE.doublingUntil; level++) {
		assert.ok(Math.abs(castleModifier(level) - base * 2 ** (level - 1)) < 1e-9);
	}
	for (let level = CASTLE_UPGRADE.doublingUntil + 1; level <= CASTLE_UPGRADE.maxLevel; level++) {
		assert.ok(Math.abs(castleModifier(level) - castleModifier(level - 1) - CASTLE_UPGRADE.lateLevelStep) < 1e-9);
	}
	assert.ok(castleModifier(CASTLE_UPGRADE.maxLevel) < castleModifier(CASTLE_UPGRADE.doublingUntil) * 4);
});

test('every level has a cost row and a build time', () => {
	assert.ok(CASTLE_UPGRADE.upgradeCosts.length >= CASTLE_UPGRADE.maxLevel - 1);
	assert.ok(CASTLE_UPGRADE.durationsSec.length >= CASTLE_UPGRADE.maxLevel - 1);
	for (let level = 1; level < CASTLE_UPGRADE.maxLevel; level++) {
		assert.ok(castleUpgradeDuration(level) > 0, `level ${level}`);
		const row = CASTLE_UPGRADE.upgradeCosts[level - 1] as Record<string, number>;
		assert.ok(row.gold > 0, `level ${level}`);
		if (level > 1) {
			const prev = CASTLE_UPGRADE.upgradeCosts[level - 2] as Record<string, number>;
			assert.ok(row.gold >= prev.gold, 'costs never go down');
		}
	}
});

test('the castle can be taken all the way to the last level, the rates follow, and the save stays valid', () => {
	freshGame();
	for (let target = 2; target <= CASTLE_UPGRADE.maxLevel; target++) {
		upgradeOnce();
		assert.equal(castleLevel(), target);
		assert.ok(api().resourceRates.modifiers.gold >= castleModifier(target) - 1e-9);
		assert.equal(api().castleUpgrade, null);
	}
	assert.equal(tileAt(api().tiles, CASTLE_X, CASTLE_Y).upgradeCost, undefined);
	assert.equal(api().upgradeCastle(), false); // already at the last level
	const saved = rawSnapshot();
	assert.equal(sanitizeSave(saved).ok, true);
	saved.tiles[CASTLE_Y][CASTLE_X].level = CASTLE_UPGRADE.maxLevel + 1;
	assert.equal(sanitizeSave(saved).ok, false);
	// xp bonus keeps growing with the level
	assert.ok(api().resourceRates.base.xp >= 0.25 + CASTLE_UPGRADE.xpBonus * (CASTLE_UPGRADE.maxLevel - 1));
});

test('a castle upgrade in a save must be exactly the next level', () => {
	freshGame();
	const cost = tileAt(api().tiles, CASTLE_X, CASTLE_Y).upgradeCost as Record<string, number>;
	setResources({ ...cost });
	assert.equal(api().upgradeCastle(), true);
	const saved = rawSnapshot();
	assert.equal(sanitizeSave(saved).ok, true);
	saved.castleUpgrade.toLevel = 4;
	assert.equal(sanitizeSave(saved).ok, false);
	saved.castleUpgrade = { toLevel: 2, remainingSec: castleUpgradeDuration(1) + 1 };
	assert.equal(sanitizeSave(saved).ok, false);
	assert.equal(castleLevel(), 1);
	assert.equal(CASTLE_X, 25);
});
