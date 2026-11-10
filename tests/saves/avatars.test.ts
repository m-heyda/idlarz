import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, STARTER_AVATAR_IDS, unlockedAvatarIds } from '../../src/catalog/avatars';
import { checkAvatar, checkProfile } from '../../src/lib/authValidation';
import { PIXEL_ICON_SIZES } from '../../src/config/pixelIcons';

test('the catalog has 8 starters and the 4 launch unlockables, each with a registered 40x40 bust', () => {
	assert.equal(STARTER_AVATAR_IDS.length, 8);
	assert.deepEqual(
		AVATARS.filter((a) => a.kind === 'unlock').map((a) => a.id),
		['architect', 'reborn', 'boss_slayer', 'early_tester'],
	);
	assert.equal(new Set(AVATARS.map((a) => a.id)).size, AVATARS.length);
	for (const avatar of AVATARS) {
		assert.deepEqual(PIXEL_ICON_SIZES[avatar.portrait], [40, 40], avatar.id);
		assert.equal(avatar.kind === 'unlock', Boolean(avatar.unlockedBy && avatar.how), avatar.id);
	}
});

test('a starter avatar is accepted with nothing earned', () => {
	for (const id of STARTER_AVATAR_IDS) assert.deepEqual(checkAvatar(id, []), { ok: true, value: id });
});

test('a locked avatar is refused until its achievement is earned', () => {
	assert.equal(checkAvatar('architect', []).ok, false);
	assert.equal(checkAvatar('architect', ['first_rebirth', 'early_tester']).ok, false, "another avatar's achievement does not open it");
	assert.deepEqual(checkAvatar('architect', ['castle_10']), { ok: true, value: 'architect' });
	assert.deepEqual(checkAvatar('early_tester', ['early_tester']), { ok: true, value: 'early_tester' });
});

test('a forged id is refused: unknown, wrong type, prototype keys', () => {
	for (const bad of ['', 'god_mode', 'KNIGHT', 'knight ', '__proto__', 'constructor', 7, true, {}, ['knight']]) {
		assert.equal(checkAvatar(bad, ['castle_10', 'first_rebirth', 'boss_auroch', 'early_tester']).ok, false, JSON.stringify(bad));
	}
});

test('an achievement id the catalog does not know unlocks nothing; none chosen passes', () => {
	assert.deepEqual(unlockedAvatarIds(['made_up']), [...STARTER_AVATAR_IDS]);
	assert.deepEqual(checkAvatar(null, []), { ok: true, value: null });
	assert.deepEqual(checkAvatar(undefined, []), { ok: true, value: null });
});

test('checkProfile carries the raw avatar id and rejects a non-string one', () => {
	const base = { characterName: 'Zoe', playerClass: 'mage' };
	assert.deepEqual(checkProfile({ ...base, avatarId: 'bard' }), { ok: true, value: { ...base, avatarId: 'bard' } });
	assert.equal(checkProfile({ ...base, avatarId: 5 }).ok, false);
	assert.equal(checkProfile({ ...base, avatarId: 'x'.repeat(100) }).ok, false);
});
