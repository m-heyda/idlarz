import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, CLASS_AVATARS, CLASS_DEFAULT_AVATAR, STARTER_AVATAR_IDS, resolveAvatar, unlockedAvatarIds } from '../../src/catalog/avatars';
import { PLAYER_CLASS_ORDER } from '../../src/config/playerClasses';
import { checkAvatar, checkCreationAvatar, checkProfile } from '../../src/lib/authValidation';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

test('the catalog has 8 starters and the 4 launch unlockables, each with its portrait file', () => {
	assert.equal(STARTER_AVATAR_IDS.length, 8);
	assert.deepEqual(
		AVATARS.filter((a) => a.kind === 'unlock').map((a) => a.id),
		['architect', 'reborn', 'boss_slayer', 'early_tester'],
	);
	assert.equal(new Set(AVATARS.map((a) => a.id)).size, AVATARS.length);
	for (const avatar of AVATARS) {
		assert.ok(existsSync(join(__dirname, '..', '..', 'public', 'pixel', 'new_assets', 'heroes', `${avatar.portrait}.png`)), avatar.id);
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

test('every class has a default avatar that is a starter; a null avatar resolves to it', () => {
	for (const id of PLAYER_CLASS_ORDER) {
		const def = CLASS_DEFAULT_AVATAR[id];
		assert.ok(STARTER_AVATAR_IDS.includes(def), `${id} -> ${def}`);
		assert.equal(resolveAvatar(null, id).id, def);
		assert.equal(resolveAvatar('not_an_avatar', id).id, def);
		assert.equal(resolveAvatar('bard', id).id, 'bard', 'a chosen avatar wins over the class default');
		assert.deepEqual(checkAvatar(def, []), { ok: true, value: def });
	}
	assert.deepEqual(CLASS_DEFAULT_AVATAR, { warrior: 'knight', paladin: 'alchemist', ranger: 'scout', mage: 'druid' });
});

test('a stored id is still validated by the server: forged or locked ids are refused whatever the class', () => {
	assert.equal(checkAvatar('boss_slayer', []).ok, false);
	assert.equal(checkAvatar('knight_of_doom', []).ok, false);
});

test('each class owns two starters: together they cover all 8 once, and the default is the first of the pair', () => {
	const owned = PLAYER_CLASS_ORDER.flatMap((id) => [...CLASS_AVATARS[id]]);
	assert.equal(owned.length, 8);
	assert.deepEqual([...owned].sort(), [...STARTER_AVATAR_IDS].sort(), 'every starter belongs to exactly one class');
	for (const id of PLAYER_CLASS_ORDER) assert.equal(CLASS_DEFAULT_AVATAR[id], CLASS_AVATARS[id][0]);
});

test("at sign-up an avatar must be one of the chosen class's two (an earned one passes with any class)", () => {
	assert.deepEqual(checkCreationAvatar('knight', 'warrior', []), { ok: true, value: 'knight' });
	assert.deepEqual(checkCreationAvatar('miner', 'warrior', []), { ok: true, value: 'miner' });
	assert.equal(checkCreationAvatar('druid', 'warrior', []).ok, false, "a Mage's starter is refused for a Warrior");
	assert.equal(checkCreationAvatar('boss_slayer', 'mage', []).ok, false, 'still locked');
	assert.deepEqual(checkCreationAvatar('boss_slayer', 'mage', ['boss_auroch']), { ok: true, value: 'boss_slayer' });
	assert.deepEqual(checkCreationAvatar(null, 'ranger', []), { ok: true, value: null });
	assert.equal(checkCreationAvatar('nope', 'ranger', []).ok, false);
});
