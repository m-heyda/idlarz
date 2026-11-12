import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_NONE, badgeOptions, checkBadgeChoice, shownBadge, shownTitle, titleOptions } from '../../src/catalog/badges';

const earned = ['early_tester', 'first_rebirth'];

test('the default badge is the tester medal (Beta before Early), and only for accounts that hold one', () => {
	assert.equal(shownBadge(null, ['early_tester', 'beta_tester'])?.id, 'beta_tester');
	assert.equal(shownBadge(null, earned)?.id, 'early_tester');
	assert.equal(shownBadge(null, ['first_rebirth']), null);
});

test('a chosen badge must be earned; "none" hides it completely', () => {
	assert.equal(shownBadge('first_rebirth', earned)?.id, 'first_rebirth');
	assert.equal(shownBadge('castle_10', earned), null);
	assert.equal(shownBadge(BADGE_NONE, earned), null);
	assert.deepEqual(
		badgeOptions(earned)
			.map((a) => a.id)
			.sort(),
		[...earned].sort(),
	);
});

test('titles come from earned achievements', () => {
	assert.deepEqual(
		titleOptions(earned).map((t) => t.id),
		['early-tester'],
	);
	assert.equal(shownTitle('early-tester', earned), 'Early tester');
	assert.equal(shownTitle('early-tester', []), null);
	assert.equal(shownTitle(null, earned), null);
});

test('checkBadgeChoice accepts earned picks, none and null, and refuses the rest', () => {
	assert.deepEqual(checkBadgeChoice({ badgeId: BADGE_NONE, titleId: null }, earned), { ok: true, badgeId: BADGE_NONE, titleId: null });
	assert.deepEqual(checkBadgeChoice({ badgeId: null, titleId: 'early-tester' }, earned), { ok: true, badgeId: null, titleId: 'early-tester' });
	assert.equal(checkBadgeChoice({ badgeId: 'castle_10', titleId: null }, earned).ok, false);
	assert.equal(checkBadgeChoice({ badgeId: null, titleId: 'early-tester' }, []).ok, false);
	assert.equal(checkBadgeChoice({ badgeId: 5, titleId: null }, earned).ok, false);
});

test('only the short badge list can be worn: an earned achievement outside it is not a badge', () => {
	const all = ['early_tester', 'first_rebirth', 'chicken_keeper_1'];
	assert.deepEqual(
		badgeOptions(all)
			.map((a) => a.id)
			.sort(),
		['early_tester', 'first_rebirth'],
	);
	assert.equal(shownBadge('chicken_keeper_1', all), null);
	assert.equal(checkBadgeChoice({ badgeId: 'chicken_keeper_1', titleId: null }, all).ok, false);
});
