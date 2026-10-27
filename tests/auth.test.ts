import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { SAVE_PREFIX, encodeSave } from '../src/lib/saveFormat';
import { createSaveStorage, type KeyValue } from '../src/lib/saveStorage';
import { checkCredentials, checkProfile, CHARACTER_NAME_MAX } from '../src/lib/authValidation';
import { DEFAULT_PLAYER_NAME } from '../src/config/gameConfig';

const KEY = 'idlarz.save';
const BACKUP = 'idlarz.save.backup';
const PREVIOUS = 'idlarz.save.previous-game';

const fakeKv = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	const kv: KeyValue = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
	return { kv, data };
};

const played = (name = 'Zoë'): PersistedGame => {
	api().resetGame();
	growTo(12);
	store.setState({ playerName: name, playSeconds: 4000 } as never);
	return structuredClone(pickPersisted(api()));
};

// ---- validators ----------------------------------------------------------------------------------------------

test('credentials: email is trimmed and lowercased, short or odd input is refused', () => {
	const ok = checkCredentials({ email: '  Me@Example.COM ', password: 'longenough' });
	assert.deepEqual(ok, { ok: true, value: { email: 'me@example.com', password: 'longenough' } });
	for (const bad of [null, [], {}, { email: 'nope', password: 'longenough' }, { email: 'a@b.co', password: 'short' }, { email: 'a@b.co', password: 12345678 }]) {
		assert.equal(checkCredentials(bad).ok, false, JSON.stringify(bad));
	}
	assert.equal(checkCredentials({ email: 'a@b.co', password: 'x'.repeat(73) }).ok, false, 'bcrypt would silently cut it');
});

test('profile: name 1-9 characters after trimming, class one of the four heroes', () => {
	assert.deepEqual(checkProfile({ characterName: ' Zoë ', playerClass: 'mage' }), { ok: true, value: { characterName: 'Zoë', playerClass: 'mage' } });
	assert.equal(checkProfile({ characterName: 'x'.repeat(CHARACTER_NAME_MAX + 1), playerClass: 'mage' }).ok, false);
	assert.equal(checkProfile({ characterName: '   ', playerClass: 'mage' }).ok, false);
	for (const playerClass of ['dragon', '', 7, null, '__proto__', 'constructor', 'toString']) {
		assert.equal(checkProfile({ characterName: 'Zoë', playerClass }).ok, false, String(playerClass));
	}
});

// ---- the start hub's view of storage ----------------------------------------------------------------------------

test('peek reads without writing or starting a game', () => {
	const game = played();
	const text = encodeSave(game, 1_700_000_000_000);
	const { kv, data } = fakeKv({ [KEY]: text });
	const peek = createSaveStorage({ kv }).peek();
	assert.equal(peek.kind, 'ok');
	if (peek.kind === 'ok') {
		assert.equal(peek.state.playerName, 'Zoë');
		assert.equal(peek.fromBackup, false);
	}
	assert.deepEqual([...data.keys()], [KEY], 'nothing added, nothing removed');
	assert.equal(data.get(KEY), text);
});

test('peek: nothing stored, only a backup, and unreadable text are told apart', () => {
	const game = played();
	assert.equal(createSaveStorage({ kv: fakeKv().kv }).peek().kind, 'none');

	const fromBackup = createSaveStorage({ kv: fakeKv({ [KEY]: SAVE_PREFIX + 'garbage', [BACKUP]: encodeSave(game) }).kv }).peek();
	assert.equal(fromBackup.kind === 'ok' && fromBackup.fromBackup, true);

	const damaged = fakeKv({ [KEY]: SAVE_PREFIX + 'garbage' });
	assert.equal(createSaveStorage({ kv: damaged.kv }).peek().kind, 'unreadable');
	assert.equal(damaged.data.get(KEY), SAVE_PREFIX + 'garbage', 'peek never touches the stored text');
});

// ---- New Game safety -------------------------------------------------------------------------------------------------

test('archiveForNewGame keeps the old game under its own key, and reset leaves that copy alone', async () => {
	const text = encodeSave(played());
	const { kv, data } = fakeKv({ [KEY]: text, [BACKUP]: text });
	const s = createSaveStorage({ kv });
	assert.equal(s.archiveForNewGame(), true);
	assert.equal(data.get(PREVIOUS), text);
	await s.reset();
	assert.equal(data.has(KEY), false);
	assert.equal(data.get(PREVIOUS), text, 'the wipe does not remove the copy');
});

test('a barely played game never replaces the copy of a real one', () => {
	const real = encodeSave(played('Real'));
	api().resetGame();
	const barely = encodeSave(structuredClone(pickPersisted(api())));
	const { kv, data } = fakeKv({ [KEY]: barely, [PREVIOUS]: real });
	assert.equal(createSaveStorage({ kv }).archiveForNewGame(), true);
	assert.equal(data.get(PREVIOUS), real);
});

test('archive reports failure when the browser refuses, and keeps unreadable text too', () => {
	const refusing: KeyValue = { get: () => SAVE_PREFIX + 'garbage', set: () => { throw new Error('refused'); }, remove: () => undefined };
	assert.equal(createSaveStorage({ kv: refusing }).archiveForNewGame(), false);

	const { kv, data } = fakeKv({ [KEY]: SAVE_PREFIX + 'garbage' });
	assert.equal(createSaveStorage({ kv }).archiveForNewGame(), true);
	assert.equal(data.get(PREVIOUS), SAVE_PREFIX + 'garbage');
	assert.equal(createSaveStorage({ kv: fakeKv().kv }).archiveForNewGame(), true, 'nothing stored, nothing to keep');
});

// ---- profile on a game -----------------------------------------------------------------------------------------------

test('the profile only ever lands on a brand-new game', () => {
	api().resetGame();
	assert.equal(api().playerName, DEFAULT_PLAYER_NAME);
	assert.equal(api().applyProfileToFreshGame('  Aria ', 'mage'), true);
	assert.equal(api().playerName, 'Aria');
	assert.equal(api().playerClass, 'mage');

	assert.equal(api().applyProfileToFreshGame('Other', 'ranger'), false, 'name no longer the default');
	assert.equal(api().playerName, 'Aria');

	api().resetGame();
	store.setState({ playSeconds: 30 } as never);
	assert.equal(api().applyProfileToFreshGame('Aria', 'mage'), false, 'a played game keeps its name and hero');
	assert.equal(api().playerName, DEFAULT_PLAYER_NAME);

	api().resetGame();
	assert.equal(api().applyProfileToFreshGame('Aria', 'dragon' as never), false);
	assert.equal(api().applyProfileToFreshGame('   ', 'mage'), false);
});
