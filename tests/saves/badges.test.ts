import { ADMIN_UNLOCK } from '../../src/catalog/avatars';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NICK_COLORS, NICK_EFFECTS, inkOn, nickColorValue } from '../../src/config/nickColors';
import {
	BADGE_NONE,
	ADMIN_BADGE,
	ADMIN_BADGE_PIC,
	ADMIN_TITLE_ID,
	badgePicSrc,
	badgeOptions,
	checkBadgeChoice,
	checkNameColor,
	shownBadge,
	shownIdentity,
	shownNameColor,
	shownTitle,
	titleOptions,
} from '../../src/catalog/badges';

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

test('shownIdentity is the one rule for badge and title by a name (character window, landing, rankings)', () => {
	assert.deepEqual(shownIdentity({ badgeId: 'first_rebirth', titleId: 'early-tester' }, earned), {
		badge: shownBadge('first_rebirth', earned)?.badge,
		badgeName: shownBadge('first_rebirth', earned)?.title,
		title: 'Early tester',
		nameColor: null,
		admin: false,
	});
	assert.deepEqual(shownIdentity({ badgeId: BADGE_NONE, titleId: null }, earned), { badge: null, badgeName: null, title: null, nameColor: null, admin: false });
	assert.equal(shownIdentity({ badgeId: null, titleId: 'early-tester' }, []).title, null);
});

test('name colours: plain ones need the unlock, the rainbow its own, gold needs admin, null is always fine', () => {
	const locked = { admin: false, unlocked: false, effects: [] };
	const bought = { admin: false, unlocked: true, effects: [] };
	const rainbow = { admin: false, unlocked: false, effects: ['rainbow'] };
	const admin = { admin: true, unlocked: false, effects: [] };
	assert.deepEqual(checkNameColor(null, locked), { ok: true, nameColor: null });
	assert.equal(checkNameColor('crimson', locked).ok, false);
	assert.deepEqual(checkNameColor('crimson', bought), { ok: true, nameColor: 'crimson' });
	assert.deepEqual(checkNameColor('crimson', admin), { ok: true, nameColor: 'crimson' });
	assert.deepEqual(checkNameColor('mint', bought), { ok: true, nameColor: 'mint' });
	assert.equal(checkNameColor('rainbow', bought).ok, false, 'the plain unlock does not include the rainbow');
	assert.deepEqual(checkNameColor('rainbow', rainbow), { ok: true, nameColor: 'rainbow' });
	assert.equal(checkNameColor('crimson', rainbow).ok, false, 'the rainbow does not include the plain colours');
	assert.deepEqual(checkNameColor('rainbow', admin), { ok: true, nameColor: 'rainbow' });
	assert.equal(checkNameColor('gold', bought).ok, false);
	assert.equal(checkNameColor('gold', rainbow).ok, false);
	assert.deepEqual(checkNameColor('gold', admin), { ok: true, nameColor: 'gold' });
	assert.equal(checkNameColor('hotpink', admin).ok, false);
	assert.equal(checkNameColor(7, admin).ok, false);
});

test('the palette has fourteen distinct plain colours, and the rainbow and gold are not among them', () => {
	assert.equal(NICK_COLORS.length, 14);
	assert.equal(new Set(NICK_COLORS.map((c) => c.id)).size, 14);
	assert.ok(!NICK_COLORS.some((c) => c.id === 'rainbow' || c.id === 'gold'));
	assert.equal(nickColorValue('rainbow'), 'rainbow');
	assert.equal(nickColorValue('gold'), 'gold');
	assert.equal(nickColorValue('teal'), '#2dd4bf');
	assert.equal(nickColorValue(null), undefined);
	assert.equal(inkOn('#e8e46a'), '#1a1208');
	assert.equal(inkOn('#4f8df5'), '#ffffff');
});

test('a stored gold nickname is only shown for an admin; shownIdentity carries the colour', () => {
	assert.equal(shownNameColor('gold', false), null);
	assert.equal(shownNameColor('gold', true), 'gold');
	assert.equal(shownNameColor('teal', false), 'teal');
	assert.equal(shownNameColor('nope', true), null);
	assert.equal(shownIdentity({ badgeId: null, titleId: null, nameColor: 'teal' }, []).nameColor, 'teal');
	assert.equal(shownIdentity({ badgeId: null, titleId: null, nameColor: 'gold' }, []).nameColor, null);
});

test('every name effect is its own purchase: owning one opens only that one, an admin has all, none is gold', () => {
	assert.deepEqual(
		NICK_EFFECTS.map((e) => e.id),
		['rainbow', 'aurora', 'ember', 'frost', 'void', 'galaxy'],
	);
	for (const effect of NICK_EFFECTS) {
		assert.equal(effect.item, `name_${effect.id}`);
		assert.notEqual(effect.id, 'gold');
		const own = { admin: false, unlocked: false, effects: [effect.id] };
		assert.deepEqual(checkNameColor(effect.id, own), { ok: true, nameColor: effect.id });
		for (const other of NICK_EFFECTS.filter((o) => o.id !== effect.id))
			assert.equal(checkNameColor(other.id, own).ok, false, `${effect.id} does not open ${other.id}`);
		assert.deepEqual(checkNameColor(effect.id, { admin: true, unlocked: false, effects: [] }), { ok: true, nameColor: effect.id });
		assert.equal(nickColorValue(effect.id), effect.id);
	}
});

test('shownIdentity carries the admin flag, which is never part of the choice', () => {
	assert.equal(shownIdentity({ badgeId: null, titleId: null }, [], true).admin, true);
	assert.equal(shownIdentity({ badgeId: null, titleId: null }, []).admin, false);
});

test('the Dev title and the octopus badge exist for the admin account only (its pseudo id), and are checked like any other choice', () => {
	const adminEarned = ['early_tester', ADMIN_UNLOCK];
	assert.ok(badgeOptions(adminEarned).some((b) => b.id === ADMIN_BADGE));
	assert.ok(titleOptions(adminEarned).some((t) => t.id === ADMIN_TITLE_ID && t.name === 'Dev'));
	assert.equal(
		badgeOptions(['early_tester']).some((b) => b.id === ADMIN_BADGE),
		false,
	);
	assert.equal(
		titleOptions(['early_tester']).some((t) => t.id === ADMIN_TITLE_ID),
		false,
	);
	assert.equal(checkBadgeChoice({ badgeId: ADMIN_BADGE, titleId: ADMIN_TITLE_ID }, adminEarned).ok, true);
	assert.equal(checkBadgeChoice({ badgeId: ADMIN_BADGE, titleId: null }, ['early_tester']).ok, false, 'not for a player');
	assert.equal(checkBadgeChoice({ badgeId: null, titleId: ADMIN_TITLE_ID }, ['early_tester']).ok, false, 'not for a player');
	assert.equal(shownBadge(ADMIN_BADGE, ['early_tester']), null);
	assert.equal(shownBadge(ADMIN_BADGE, adminEarned)?.badge, ADMIN_BADGE);
	assert.equal(shownBadge(null, adminEarned)?.id, 'early_tester', 'the octopus is never a default: it is picked');
	assert.equal(shownIdentity({ badgeId: ADMIN_BADGE, titleId: ADMIN_TITLE_ID }, adminEarned, true).title, 'Dev');
	assert.equal(badgePicSrc(ADMIN_BADGE), ADMIN_BADGE_PIC);
	assert.equal(badgePicSrc('early_tester'), '/pixel/new_assets/achievements/early_tester.png');
});
