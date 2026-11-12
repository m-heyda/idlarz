import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	ADMIN_UNLOCK,
	AVATARS,
	CLASS_AVATARS,
	CLASS_DEFAULT_AVATAR,
	STARTER_AVATAR_IDS,
	classAvatarIds,
	fitAvatar,
	resolveAvatar,
	unlockedAvatarIds,
} from '../../src/catalog/avatars';
import { PLAYER_CLASS_ORDER, type PlayerClassId } from '../../src/config/playerClasses';
import { checkAvatar, checkProfile } from '../../src/lib/authValidation';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

test('the catalog has 8 starters and the 5 unlockables plus the admin-only Admin avatar, each with its portrait file', () => {
	assert.equal(STARTER_AVATAR_IDS.length, 8);
	assert.deepEqual(
		AVATARS.filter((a) => a.kind === 'unlock').map((a) => a.id),
		['architect', 'reborn', 'boss_slayer', 'early_tester', 'beta_tester', 'admin'],
	);
	assert.equal(new Set(AVATARS.map((a) => a.id)).size, AVATARS.length);
	for (const avatar of AVATARS) {
		assert.ok(existsSync(join(__dirname, '..', '..', 'public', 'pixel', 'new_assets', 'heroes', `${avatar.portrait}.png`)), avatar.id);
		assert.equal(avatar.kind === 'unlock', Boolean(avatar.unlockedBy && avatar.how), avatar.id);
	}
});

const AVATAR_CLASS = Object.fromEntries(AVATARS.filter((a) => a.classId).map((a) => [a.id, a.classId as PlayerClassId]));

test('a starter avatar is accepted with nothing earned', () => {
	for (const id of STARTER_AVATAR_IDS) assert.deepEqual(checkAvatar(id, AVATAR_CLASS[id], []), { ok: true, value: id });
});

test('a locked avatar is refused until its achievement is earned', () => {
	assert.equal(checkAvatar('architect', 'mage', []).ok, false);
	assert.equal(checkAvatar('architect', 'mage', ['first_rebirth', 'early_tester']).ok, false, "another avatar's achievement does not open it");
	assert.deepEqual(checkAvatar('architect', 'mage', ['castle_10']), { ok: true, value: 'architect' });
	assert.deepEqual(checkAvatar('early_tester', 'ranger', ['early_tester']), { ok: true, value: 'early_tester' });
	assert.equal(checkAvatar('beta_tester', 'ranger', ['early_tester']).ok, false, 'the Early tester alone does not open the beta face');
	assert.deepEqual(checkAvatar('beta_tester', 'ranger', ['beta_tester']), { ok: true, value: 'beta_tester' });
});

test('a forged id is refused: unknown, wrong type, prototype keys', () => {
	for (const bad of ['', 'god_mode', 'KNIGHT', 'knight ', '__proto__', 'constructor', 7, true, {}, ['knight']]) {
		assert.equal(checkAvatar(bad, 'warrior', ['castle_10', 'first_rebirth', 'boss_auroch', 'early_tester']).ok, false, JSON.stringify(bad));
	}
});

test('an achievement id the catalog does not know unlocks nothing; none chosen passes', () => {
	assert.deepEqual(unlockedAvatarIds(['made_up']), [...STARTER_AVATAR_IDS]);
	assert.deepEqual(checkAvatar(null, 'mage', []), { ok: true, value: null });
	assert.deepEqual(checkAvatar(undefined, 'mage', []), { ok: true, value: null });
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
		assert.equal(resolveAvatar(CLASS_AVATARS[id][1], id).id, CLASS_AVATARS[id][1], 'a chosen avatar of the class wins over the class default');
		assert.deepEqual(checkAvatar(def, id, []), { ok: true, value: def });
	}
	assert.deepEqual(CLASS_DEFAULT_AVATAR, { warrior: 'knight', paladin: 'alchemist', ranger: 'scout', mage: 'druid' });
});

test('a stored id is still validated by the server: forged or locked ids are refused whatever the class', () => {
	assert.equal(checkAvatar('boss_slayer', 'mage', []).ok, false);
	assert.equal(checkAvatar('knight_of_doom', 'mage', []).ok, false);
});

test('each class owns two starters: together they cover all 8 once, and the default is the first of the pair', () => {
	const owned = PLAYER_CLASS_ORDER.flatMap((id) => [...CLASS_AVATARS[id]]);
	assert.equal(owned.length, 8);
	assert.deepEqual([...owned].sort(), [...STARTER_AVATAR_IDS].sort(), 'every starter belongs to exactly one class');
	for (const id of PLAYER_CLASS_ORDER) assert.equal(CLASS_DEFAULT_AVATAR[id], CLASS_AVATARS[id][0]);
});

test('every starter has exactly one class, rewards have none, and each class default is among its own starters', () => {
	for (const avatar of AVATARS) assert.equal(avatar.classId !== undefined, avatar.kind === 'starter', avatar.id);
	for (const id of PLAYER_CLASS_ORDER) {
		const own = AVATARS.filter((a) => a.classId === id).map((a) => a.id);
		assert.deepEqual([...own].sort(), [...CLASS_AVATARS[id]].sort(), `${id}: classId matches CLASS_AVATARS`);
		assert.ok(own.includes(CLASS_DEFAULT_AVATAR[id]), id);
	}
	assert.deepEqual(CLASS_AVATARS, { warrior: ['knight', 'miner'], paladin: ['alchemist', 'farmer'], ranger: ['scout', 'bard'], mage: ['druid', 'scholar'] });
});

test("another class's starter is refused (register, profile, avatar route and new chapter all use checkAvatar); the class's own pass", () => {
	for (const cls of PLAYER_CLASS_ORDER) {
		for (const avatar of AVATARS.filter((a) => a.kind === 'starter')) {
			const res = checkAvatar(avatar.id, cls, []);
			assert.equal(res.ok, avatar.classId === cls, `${cls} <- ${avatar.id}`);
		}
	}
	assert.equal(checkAvatar('druid', 'warrior', []).ok, false);
});

test('earned reward avatars are selectable by every class, unearned ones by none', () => {
	const all = ['castle_10', 'first_rebirth', 'boss_auroch', 'early_tester', 'beta_tester'];
	for (const cls of PLAYER_CLASS_ORDER) {
		for (const id of ['architect', 'reborn', 'boss_slayer', 'early_tester', 'beta_tester']) {
			assert.equal(checkAvatar(id, cls, all).ok, true, `${cls} <- ${id}`);
			assert.equal(checkAvatar(id, cls, []).ok, false, `${cls} <- ${id} unearned`);
		}
		assert.deepEqual(classAvatarIds(cls, []).sort(), [...CLASS_AVATARS[cls]].sort());
		assert.equal(classAvatarIds(cls, all).length, 7);
	}
});

test("a stored avatar that no longer fits the class falls back to the new class's default", () => {
	assert.equal(fitAvatar('knight', 'warrior').id, 'knight');
	assert.equal(fitAvatar('knight', 'mage').id, 'druid', 'class changed');
	assert.equal(fitAvatar(null, 'ranger').id, 'scout');
	assert.equal(fitAvatar('architect', 'mage', ['castle_10']).id, 'architect', 'an earned reward stays');
	assert.equal(fitAvatar('architect', 'mage', []).id, 'druid', 'a reward that is not earned does not');
	assert.equal(resolveAvatar('knight', 'paladin').id, 'alchemist');
});

test('the Admin avatar is only ever unlocked by the admin pseudo achievement, and only that account earns it', () => {
	const admin = AVATARS.find((a) => a.id === 'admin');
	assert.ok(admin?.adminOnly);
	assert.equal(admin?.unlockedBy, ADMIN_UNLOCK);
	assert.equal(checkAvatar('admin', 'mage', ['castle_10', 'beta_tester', 'early_tester']).ok, false, 'no achievement opens it');
	assert.deepEqual(checkAvatar('admin', 'mage', [ADMIN_UNLOCK]), { ok: true, value: 'admin' });
	assert.ok(!unlockedAvatarIds([]).includes('admin'));
	assert.ok(unlockedAvatarIds([ADMIN_UNLOCK]).includes('admin'));
	for (const cls of PLAYER_CLASS_ORDER) assert.ok(classAvatarIds(cls, [ADMIN_UNLOCK]).includes('admin'), 'any class may wear it once granted');
});
