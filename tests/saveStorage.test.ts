import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { api, freshGame, growTo, store, gridCells } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { MIGRATIONS, SAVE_PREFIX, SAVE_SCHEMA, decodeSave, encodeSave, migrateBody, packBody, sealWire } from '../src/lib/saveFormat';
import { createSaveStorage, type KeyValue } from '../src/lib/saveStorage';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { plainItem } from '../src/lib/itemInstance';
import { emptyBag } from '../src/lib/inventory';
import { ownedCount, patchTile, setTile } from '../src/utils/world';

const FIXTURES = resolve(__dirname, 'fixtures', 'saves');

/** A played game with buildings, a chest, gear and a monster, as a plain persisted slice. */
const playedGame = (): PersistedGame => {
	api().resetGame();
	growTo(16);
	const bag = emptyBag();
	bag[2] = { item: plainItem('rattatui_tunic') };
	store.setState((s) => {
		const lots = gridCells(s.tiles).filter(({ t }) => t.isOwned && t.biome !== 'castle');
		let tiles = setTile(s.tiles, lots[0].x, lots[0].y,{ biome: 'forest', isOwned: true, building: 'tavern' });
		tiles = patchTile(tiles, lots[1].x, lots[1].y, { hasChest: true });
		return { tiles, activeChests: 1, bag, equipment: { ...STARTER_EQUIPMENT, head: plainItem('rattatui_cap') }, playerName: 'Zoë' } as never;
	});
	api().tick(60_000);
	return structuredClone(pickPersisted(api()));
};

/** A browser-like key/value store that can be told to refuse writes. */
const fakeKv = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	let failWith: string | null = null;
	const kv: KeyValue = {
		get: (k) => data.get(k) ?? null,
		set: (k, v) => {
			if (failWith) throw Object.assign(new Error('refused'), { name: failWith });
			data.set(k, v);
		},
		remove: (k) => void data.delete(k),
	};
	return { kv, data, refuse: (name: string | null) => (failWith = name) };
};

const KEY = 'idlarz.save';
const BACKUP = 'idlarz.save.backup';
const DAMAGED = 'idlarz.save.damaged';

const wrap = (state: PersistedGame) => ({ state, version: 1 });

test('a played game survives encode -> decode exactly', () => {
	const game = playedGame();
	const result = decodeSave(encodeSave(game, 1_700_000_000_000));
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.equal(result.savedAt, 1_700_000_000_000);
	assert.equal(result.schema, SAVE_SCHEMA);
	for (const key of ['tiles', 'resources', 'bag', 'equipment', 'farmLevels', 'prestige', 'freeTiles', 'playerName', 'activeChests'] as const) {
		assert.deepEqual(result.state[key], game[key], key);
	}
	assert.equal(result.state.playerName, 'Zoë', 'non-ASCII survives the base64 text');
});

test('the text is compact: only owned land is written, derived values are not', () => {
	const game = playedGame();
	const body = packBody(game);
	assert.equal('tiles' in body, false);
	assert.equal('level' in body, false);
	assert.equal('activeChests' in body, false);
	assert.deepEqual(Object.keys(body.characterStats as object).sort(), ['availablePoints', 'charisma', 'dexterity', 'intelligence', 'strength', 'vitality']);
	assert.equal((body.land as [number, number, string][]).reduce((n, row) => n + row[2].length, 0), ownedCount(game.tiles));
	assert.ok(encodeSave(game).length < 8000, 'a 16-tile game is a few KB');
});

test('pasted text survives line breaks, spaces and quotes; damage is reported, not thrown', () => {
	const text = encodeSave(playedGame());
	const wrapped = `"${text.replace(/(.{60})/g, '$1\r\n  ')}"\n`;
	assert.equal(decodeSave(wrapped).ok, true);

	for (const broken of ['', 'hello', SAVE_PREFIX, `${SAVE_PREFIX}abc.def`, text.slice(0, text.length - 20), text.slice(0, 40) + 'A' + text.slice(41), text + 'x']) {
		const r = decodeSave(broken);
		assert.equal(r.ok, false, broken.slice(0, 30));
	}
	assert.equal(decodeSave('x'.repeat(4_000_000)).ok, false);
});

test('a save from a newer schema is refused with a clear reason', () => {
	const game = playedGame();
	const text = sealWire({ v: SAVE_SCHEMA + 1, t: 1, s: packBody(game) });
	const r = decodeSave(text);
	assert.equal(r.ok, false);
	if (!r.ok) assert.match(r.reason, /newer version/);
});

test('migrations upgrade old bodies step by step', () => {
	const game = playedGame();
	const old = packBody(game);
	const { clickLevel, ...rest } = old; // pretend schema 1 called it `clicks`
	const v1 = sealWire({ v: 1, t: 1, s: { ...rest, clicks: clickLevel } });
	const table = { 1: (b: Record<string, unknown>) => { const { clicks, ...others } = b; return { ...others, clickLevel: clicks }; } };

	assert.equal(decodeSave(v1, { schema: 2, migrations: table }).ok, true);
	assert.equal(decodeSave(v1, { schema: 2, migrations: {} }).ok, false, 'a missing step is an error, not a guess');
	assert.deepEqual(migrateBody({ a: 1 }, 1, 3, { 1: (b) => ({ ...b, b: 2 }), 2: (b) => ({ ...b, c: 3 }) }), { a: 1, b: 2, c: 3 });
	assert.deepEqual(Object.keys(MIGRATIONS), ['1', '2', '3', '4', '5'], 'one step per bump of SAVE_SCHEMA: 1 -> 2 turned the land list into runs, 2 -> 3 the gear ids into item instances, 3 -> 4 the Grounds tiles into land, 4 -> 5 the monster tiers into levels, 5 -> 6 the slower level curve (the attribute points are refunded)');
});

test('every frozen save in tests/fixtures/saves still loads (the compatibility guard)', async () => {
	const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.sav'));
	assert.ok(files.some((f) => f.startsWith('v')), 'old schema versions are covered');
	const { parse } = createSaveStorage({ kv: null });
	for (const file of files) {
		const result = await parse(readFileSync(resolve(FIXTURES, file), 'utf8'));
		assert.equal(result.ok, true, `${file}: ${result.ok ? '' : result.reason}`);
		if (result.ok) assert.ok(ownedCount(result.state.tiles) > 9, file);
	}
});

// ---- storage ---------------------------------------------------------------------------------------------

test('writes are synchronous on flush and read back by a new session', async () => {
	const game = playedGame();
	const { kv, data } = fakeKv();
	const a = createSaveStorage({ kv });
	assert.equal(await a.storage.getItem('x'), null);
	a.markReady();
	await a.storage.setItem('x', wrap(game));
	assert.equal(data.has(KEY), false, 'debounced until flushed');
	a.flush();
	assert.ok(data.get(KEY)?.startsWith(SAVE_PREFIX), 'flush writes immediately, no await needed');

	const loaded = await createSaveStorage({ kv }).storage.getItem('x');
	assert.ok(loaded && !(loaded instanceof Promise));
	assert.deepEqual(loaded.state.resources, game.resources);
});

test('nothing is written before the first load, while paused or frozen', async () => {
	const game = playedGame();
	const { kv, data } = fakeKv();
	const s = createSaveStorage({ kv });
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal(data.size, 0, 'not ready');
	s.markReady();
	s.setPaused(true);
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal(data.size, 0, 'paused (another tab owns the game)');
	s.setPaused(false);
	await s.storage.setItem('x', wrap(game));
	s.freeze();
	s.flush();
	assert.equal(data.size, 0, 'frozen (an import or reset is replacing the save)');
});

test('an unreadable current save falls back to the backup and the damaged text is kept', async () => {
	const game = playedGame();
	const good = encodeSave(game);
	const { kv, data } = fakeKv({ [KEY]: good.slice(0, 80), [BACKUP]: good });
	const s = createSaveStorage({ kv });
	const loaded = await s.storage.getItem('x');
	assert.ok(loaded);
	assert.equal(data.get(DAMAGED), good.slice(0, 80));
	assert.match((await s.info()).loadProblem ?? '', /previous backup/);
	assert.equal(s.damagedCopy(), good.slice(0, 80));

	// the first write must not rotate the damaged current over the good backup
	s.markReady();
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal(data.get(BACKUP), good);
	assert.ok(decodeSave(data.get(KEY)!).ok);
});

test('with nothing readable the game starts new, says why, and the damaged text survives', async () => {
	const { kv, data } = fakeKv({ [KEY]: 'garbage' });
	const s = createSaveStorage({ kv });
	assert.equal(await s.storage.getItem('x'), null);
	assert.equal(data.get(DAMAGED), 'garbage');
	assert.ok((await s.info()).loadProblem);
});

test('the previous save is kept as a backup, refreshed at most every 10 minutes', async () => {
	const game = playedGame();
	let t = 1_000_000;
	const { kv, data } = fakeKv({ [KEY]: encodeSave(game, 1) });
	const s = createSaveStorage({ kv, now: () => t });
	await s.storage.getItem('x');
	s.markReady();
	const flushWith = async (state: PersistedGame) => {
		await s.storage.setItem('x', wrap(state));
		s.flush();
	};

	await flushWith({ ...game, playSeconds: 1000 });
	const backed = decodeSave(data.get(BACKUP)!);
	assert.ok(backed.ok && backed.savedAt === 1, 'the loaded save becomes the backup');
	const first = data.get(BACKUP);

	t += 60_000;
	await flushWith({ ...game, playSeconds: 2000 });
	assert.equal(data.get(BACKUP), first, 'within 10 minutes the backup stays');

	t += 11 * 60_000;
	await flushWith({ ...game, playSeconds: 3000 });
	assert.notEqual(data.get(BACKUP), first, 'after 10 minutes it moves on');
});

test('a browser that refuses to store is reported, and the session keeps its save in memory', async () => {
	const game = playedGame();
	const { kv, data, refuse } = fakeKv();
	const s = createSaveStorage({ kv });
	await s.storage.getItem('x');
	s.markReady();
	refuse('QuotaExceededError');
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal(data.size, 0);
	assert.equal((await s.info()).error, 'full');
	assert.ok(await s.storage.getItem('x'), 'a rehydrate in the same session still finds it');

	refuse('SecurityError');
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal((await s.info()).error, 'unavailable');

	refuse(null);
	await s.storage.setItem('x', wrap(game));
	s.flush();
	assert.equal((await s.info()).error, null);
	assert.ok(data.has(KEY));

	const none = createSaveStorage({ kv: null });
	none.markReady();
	await none.storage.setItem('x', wrap(game));
	none.flush();
	assert.equal((await none.info()).error, 'unavailable');
});

test('persistent storage is requested once, after the first successful save', async () => {
	let asked = 0;
	const { kv } = fakeKv();
	const s = createSaveStorage({ kv, requestPersist: async () => (asked++, true), queryPersisted: async () => true });
	await s.storage.getItem('x');
	s.markReady();
	assert.equal(asked, 0);
	for (let i = 0; i < 3; i++) {
		await s.storage.setItem('x', wrap(playedGame()));
		s.flush();
	}
	assert.equal(asked, 1);
	assert.equal((await s.info()).persisted, true);
});

test('import replaces the save, keeps the old one as backup and blocks later autosaves', async () => {
	const mine = playedGame();
	freshGame();
	const other: PersistedGame = structuredClone(pickPersisted(api()));
	const { kv, data } = fakeKv({ [KEY]: encodeSave(mine) });
	const s = createSaveStorage({ kv });
	await s.storage.getItem('x');
	s.markReady();
	await s.storage.setItem('x', wrap(mine));

	s.commitImport(other);
	const backup = decodeSave(data.get(BACKUP)!);
	assert.ok(backup.ok);
	assert.deepEqual(backup.ok && backup.state.tiles, mine.tiles);
	const stored = decodeSave(data.get(KEY)!);
	assert.ok(stored.ok);
	assert.deepEqual(stored.ok && stored.state.tiles, other.tiles);

	s.flush(); // the running game's pending write must not undo the import
	const after = decodeSave(data.get(KEY)!);
	assert.deepEqual(after.ok && after.state.tiles, other.tiles);
});

test('reset removes the save, the backup and the damaged copy', async () => {
	const { kv, data } = fakeKv({ [KEY]: 'a', [BACKUP]: 'b', [DAMAGED]: 'c' });
	const s = createSaveStorage({ kv });
	await s.reset();
	assert.equal(data.size, 0);
});
