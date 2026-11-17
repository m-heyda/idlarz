import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, tileAt, rawSnapshot, landAt } from '../helpers';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { MAX_CATCHUP_SEC } from '../../src/config/economy';
import { castleModifier, castleUpgradeDuration } from '../../src/utils/game/castle';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { limitOf } from '../../src/lib/limits';
import { castleRangeRadius } from '../../src/lib/castleWard';
import { emberSpent } from '../../src/utils/game/rebirth';

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

test('build times are pinned (balancing pass: the old timers halved); changing one must update this on purpose', () => {
	// levels 11 to 15 (Castle Expansion): 4.5 d, 6 d, 8 d, 11 d, 14 d
	const hours = [0.5, 2, 6, 12, 24, 36, 48, 60, 84, 108, 144, 192, 264, 336];
	assert.deepEqual(
		CASTLE_UPGRADE.durationsSec,
		hours.map((h) => h * 3600),
	);
	assert.equal(CASTLE_UPGRADE.durationsSec.slice(0, 5).reduce((a, b) => a + b, 0) / 3600, 44.5);
});

test('the castle can be taken all the way to the last level, the rates follow, and the save stays valid', () => {
	freshGame();
	for (let target = 2; target <= CASTLE_UPGRADE.maxLevel; target++) {
		upgradeOnce();
		assert.equal(castleLevel(), target);
		assert.ok(api().resourceRates.modifiers.gold >= castleModifier(target) - 1e-9);
		assert.equal(api().castleUpgrade, null);
	}
	// the tile keeps the price of the next level (the table reaches 15), the cap stops it
	setResources({ gold: 1e12, wood: 1e12, stone: 1e12, coal: 1e12, food: 1e12, meat: 1e12 });
	assert.equal(api().upgradeCastle(), false); // already at the last level without the Castle Expansion
	const saved = rawSnapshot();
	assert.equal(sanitizeSave(saved).ok, true);
	landAt(saved, CASTLE_X, CASTLE_Y).level = CASTLE_UPGRADE.maxLevel + 1;
	assert.equal(sanitizeSave(saved).ok, false);
	// xp bonus keeps growing with the level
	assert.ok(api().resourceRates.base.xp >= 0.25 + CASTLE_UPGRADE.xpBonus * (CASTLE_UPGRADE.maxLevel - 1));
});

test('the Castle Expansion lifts the cap by one level per level, up to 15, and the save follows the cap', () => {
	freshGame();
	const withExpansion = (levels: number) => ({
		...api().prestige,
		rebirths: 1,
		legacyEarned: 100000,
		legacyPoints: 100000 - emberSpent({ castlecap: levels }),
		upgrades: { castlecap: levels },
	});
	for (let bought = 1; bought <= 5; bought++) {
		const cap = 10 + bought;
		assert.equal(limitOf('castleMaxLevel', { prestige: withExpansion(bought) }), cap);
		const saved = rawSnapshot();
		saved.prestige = withExpansion(bought);
		landAt(saved, CASTLE_X, CASTLE_Y).level = cap;
		assert.equal(sanitizeSave(saved).ok, true, `level ${cap} with ${bought} Expansion levels`);
		landAt(saved, CASTLE_X, CASTLE_Y).level = cap + 1;
		assert.equal(sanitizeSave(saved).ok, false, `level ${cap + 1} is above the cap`);
	}
	assert.equal(limitOf('castleMaxLevel', { prestige: withExpansion(5) }), 15);
	assert.equal(limitOf('castleMaxLevel'), 10, 'without it the cap is the base');
	// the game refuses an upgrade past the cap and allows it with the Expansion
	api().buyEmberUpgrade('castlecap');
	assert.equal(api().prestige.upgrades.castlecap ?? 0, 0, 'no Embers, no Expansion');
	// the range stops growing at level 10 (levels 11-15 add the castle bonus, not more area)
	assert.equal(castleRangeRadius(15), castleRangeRadius(10));
	assert.ok(castleModifier(15) > castleModifier(10));
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
	const cut = sanitizeSave(saved);
	assert.equal(cut.ok, true, 'a timer longer than the duration (a shortened rule) is cut to it, not refused');
	if (cut.ok) assert.equal(cut.state.castleUpgrade?.remainingSec, castleUpgradeDuration(1));
	assert.equal(castleLevel(), 1);
	assert.equal(CASTLE_X, 25);
});
