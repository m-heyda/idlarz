import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { patchTile } from '../../src/utils/world';
import { calculateLevel, totalStatPoints } from '../../src/utils/game/character';
import { memoryLedgers, STRONG_KIT } from '../builders';
import { COMBAT } from '../../src/config/combatConfig';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { claimOffline, startNewGame, type ServiceDeps } from '../../src/lib/offline/service';
import { fightStep, rebirthStep, syncTickets, type Online } from '../../src/lib/offline/online';
import { runCombat } from '../../src/lib/offline/fight';
import { simSetup } from '../../src/lib/fightSim';
import { spawnLevelRange } from '../../src/lib/monsters';
import { emptyStats, isEmptyStats, readStats } from '../../src/lib/offline/stats';
import type { ClaimResult } from '../../src/lib/offline/types';
import { requestClaim } from '../../src/lib/offlineClient';
import { useBestiaryStore } from '../../src/stores/bestiaryStore';
import type { MonsterType } from '../../src/types/game';

// IDL-267 / IDL-268: monster discovery ("?" silhouettes until the first fight) and per-monster kill counts, pinned end to end on the server side wherever possible.
// IDL-267 itself: the answer to the login claim (`/api/offline`) put monsters on the map but carried no `bestiary`, so the browser's store stayed `loaded = false`
// ("every type counts as known") and the first monster of a freshly reset account was drawn as the real monster until the first /api/spawn answer.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world, st) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			stats.set(id, st);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
		remove: async (id) => {
			rows.delete(id);
			worlds.delete(id);
			stats.delete(id);
		},
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, rows, deps };
};

const game = (): PersistedGame => {
	api().resetGame();
	growTo(60);
	api().tick(1000);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};
/** A game that meets the first rebirth's requirements on the server's reading: castle level 6 and more than 400 tiles bought. */
const rebirthReadyGame = (): PersistedGame => {
	api().resetGame();
	growTo(410);
	const grown = api();
	store.setState({
		tiles: patchTile(grown.tiles, CASTLE_X, CASTLE_Y, { level: 6 }),
		playSeconds: 1000,
		characterStats: { ...grown.characterStats, availablePoints: totalStatPoints(calculateLevel(grown.resources.xp).level) },
		resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 },
	} as never);
	return structuredClone(pickPersisted(api()));
};
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};
let keyNo = 0;
const key = () => `disc-key-${String(++keyNo).padStart(6, '0')}`;

/** A fresh account: a saved game, a ledger with nothing met yet, and a few minutes of play so monsters have appeared. */
const freshPlayer = async () => {
	const m = memory();
	await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(game()), 0, T0, false, m.ledgerRepo);
	return m;
};
const stats = (m: ReturnType<typeof memory>) => m.ledgers.get('u1')!.stats;
/** Asks the server until a monster is standing on the map; returns the clock and the monster. */
const untilMonster = async (m: ReturnType<typeof memory>) => {
	for (let t = 10; t <= 300; t += 10) {
		const view = ok(await syncTickets(m.deps, 'u1', T0 + t * MIN));
		if (view.tickets.monsters.length > 0) return { at: T0 + t * MIN, view, monster: view.tickets.monsters[0] };
	}
	throw new Error('no monster appeared');
};

// ---------------------------------------------------------------------------------------------------- IDL-267: the answer that places the first monster says what is known

test('IDL-267: the login claim carries the bestiary like every online answer, nothing met on a fresh account', async () => {
	const m = await freshPlayer();
	const out = await claimOffline(m.deps, 'u1', 'claim-0001', T0 + 3 * 60 * MIN);
	assert.equal(out.kind, 'ok');
	const result = (out as { kind: 'ok'; result: ClaimResult }).result;
	assert.ok(result.tickets.monsters.length > 0, 'monsters were placed by the claim itself');
	assert.deepEqual(result.bestiary, { seen: [], kills: {} }, 'and the browser is told that none of them has been met');
});

test('IDL-267: a replayed claim (a lost answer) still says what is known', async () => {
	const m = await freshPlayer();
	const first = await claimOffline(m.deps, 'u1', 'claim-0001', T0 + 3 * 60 * MIN);
	const again = await claimOffline(m.deps, 'u1', 'claim-0001', T0 + 3 * 60 * MIN + 5000);
	assert.deepEqual(again, first);
	assert.ok((again as { result: ClaimResult }).result.bestiary);
});

test('IDL-267: the browser applies the claim answer to the bestiary store before it places anything (loaded flips, unmet types are silhouettes)', async () => {
	useBestiaryStore.setState({ loaded: false, seen: new Set(), kills: {} });
	const body: ClaimResult = {
		grant: null,
		reason: 'short',
		tickets: { chests: [], monsters: [], boss: null },
		serverNowSec: T0 / 1000,
		gems: 0,
		bestiary: { seen: [], kills: {} },
	};
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
	try {
		const reply = await requestClaim('claim-0001-browser');
		assert.equal(reply.status, 'ok');
		assert.equal(useBestiaryStore.getState().loaded, true, 'the claim answer is the first thing the browser hears');
	} finally {
		globalThis.fetch = realFetch;
		useBestiaryStore.setState({ loaded: false, seen: new Set(), kills: {} });
	}
});

// ---------------------------------------------------------------------------------------------------- IDL-268: server side, step by step

test('step 1: on a fresh account every reply carries an empty bestiary and the public monster ticket holds no name, HP or kill data', async () => {
	const m = await freshPlayer();
	assert.deepEqual([stats(m).seen, stats(m).kills], [{}, {}], 'nothing met, nothing killed');
	const { at, view, monster } = await untilMonster(m);
	assert.deepEqual(view.bestiary, { seen: [], kills: {} });
	for (const field of Object.keys(monster))
		assert.ok(['n', 'at', 'lucky', 'x', 'y', 'spawnLevel', 'type', 'growCap'].includes(field), `unexpected ticket field ${field}`);
	const text = JSON.stringify(view.tickets);
	for (const word of ['label', 'name', 'hp', 'maxHp', 'monsterHp'])
		assert.doesNotMatch(text, new RegExp(`"${word}"`), `${word} must not be in a public ticket`);
	const sync = ok(await fightStep(m.deps, 'u1', null, { action: 'sync' }, at + MIN));
	assert.deepEqual(sync.bestiary, { seen: [], kills: {} }, '/api/fight answers carry it too');
});

test('step 2: a click on a monster discovers exactly its type, once, with the first-fight time; everything else stays unmet', async () => {
	const m = await freshPlayer();
	const { at, monster } = await untilMonster(m);
	const opened = ok(await fightStep(m.deps, 'u1', key(), { action: 'use', command: { kind: 'fight', n: monster.n } }, at + 1000));
	assert.ok(opened.combat.fight, 'the fight is open');
	const type = monster.type!;
	assert.deepEqual(opened.bestiary?.seen, [type]);
	assert.deepEqual(Object.keys(stats(m).seen), [type]);
	assert.equal(stats(m).seen[type], at + 1000, 'epoch ms of the fight start (the server clock)');
	const later = ok(await fightStep(m.deps, 'u1', null, { action: 'sync' }, at + 5000));
	assert.deepEqual(later.bestiary?.seen, [type]);
	assert.equal(stats(m).seen[type], at + 1000, 'the first time is kept');
});

test('step 2: auto-battle starting a fight records the encounter too', async () => {
	const m = await freshPlayer();
	const { at } = await untilMonster(m);
	const out = ok(await fightStep(m.deps, 'u1', key(), { action: 'auto', autoBattle: true }, at + 1000));
	if (out.combat.fight) assert.deepEqual(Object.keys(stats(m).seen), [out.combat.fight.type]);
	else assert.deepEqual(stats(m).seen, {}, 'no fight started: nothing discovered');
});

test('step 2/5: dismissing or merely seeing a monster does not discover it', async () => {
	const m = await freshPlayer();
	const { at, monster } = await untilMonster(m);
	const out = ok(await fightStep(m.deps, 'u1', key(), { action: 'dismiss', n: monster.n }, at + 1000));
	assert.equal(out.accepted, true);
	assert.deepEqual(out.bestiary, { seen: [], kills: {} });
	assert.deepEqual(stats(m).seen, {});
});

test('step 3: a lost or fled fight discovers but counts no kill; wins count 1, then 2; the first time stays', () => {
	const type: MonsterType = 'thistleBoar';
	const level = spawnLevelRange(type, 1).min;
	// an unarmed hero loses: discovered, no kill
	const weak = simSetup({ monsters: [{ type, level: level + 20 }], seed: 'lose' });
	let lost = runCombat(weak.ledger, weak.env(weak.start), { commands: [{ kind: 'fight', n: 1 }] }).ledger;
	for (let t = weak.start + 1; t < weak.start + 700 && lost.combat!.fight; t++) lost = runCombat(lost, weak.env(t)).ledger;
	assert.ok(lost.stats.seen[type] > 0, 'met');
	assert.equal(lost.stats.kills[type] ?? 0, 0, 'but not killed');
	// a strong hero wins twice
	const s = simSetup({
		equipment: STRONG_KIT,
		monsters: [
			{ type, level },
			{ type, level },
		],
		seed: 'win-twice',
	});
	const ran = runCombat(s.ledger, s.env(s.start + 400)).ledger;
	assert.equal(ran.stats.kills[type], 2);
	assert.ok(ran.stats.seen[type] > 0 && ran.stats.seen[type] <= (s.start + 400) * 1000, 'the first fight sets the time and the second one keeps it');
	assert.equal(Object.keys(ran.stats.seen).length, 1);
});

test('kill counts include golden and boss kills, per type, and an offline-sized batch (one long request) counts every kill', () => {
	const normal: MonsterType = 'thistleBoar';
	const boss: MonsterType = 'bossGreatAuroch';
	const level = spawnLevelRange(normal, 1).min;
	const s = simSetup({
		equipment: STRONG_KIT,
		monsters: [
			{ type: normal, level },
			{ type: normal, level, lucky: true },
			{ type: boss, level: spawnLevelRange(boss, 1).min },
		],
		seed: 'batch',
	});
	// one request a long time after the start: the server carries the whole stretch forward in one go and pays every kill it contains
	const ran = runCombat(s.ledger, s.env(s.start + 3600)).ledger;
	assert.equal(ran.stats.kills[normal], 2, 'the plain and the golden one count under their type');
	assert.equal(ran.stats.golden, 1);
	assert.equal(ran.stats.kills[boss], 1);
	assert.equal(ran.stats.bosses, 1);
	assert.deepEqual(Object.keys(ran.stats.seen).sort(), [boss, normal].sort(), 'only what was fought');
});

test('step 4: discovery and kills live in the ledger row (`player_ledger.stats`) and read back unchanged', () => {
	const type: MonsterType = 'thistleBoar';
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type, level: spawnLevelRange(type, 1).min }], seed: 'persist' });
	const ran = runCombat(s.ledger, s.env(s.start + 120)).ledger;
	const stored = JSON.parse(JSON.stringify(ran.stats));
	assert.deepEqual(Object.keys(stored.seen), [type]);
	assert.deepEqual(readStats(stored).seen, ran.stats.seen);
	assert.deepEqual(readStats(stored).kills, { [type]: 1 });
	assert.equal(isEmptyStats(emptyStats()), true, 'an untouched account stores null (the column is empty before the first fight)');
});

test('step 7: rebirth keeps seen and kills; a New Game (reset, new chapter) clears them; a fresh ledger holds nothing', async () => {
	const m = memory();
	await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(rebirthReadyGame()), 0, T0, false, m.ledgerRepo);
	const met = { ...emptyStats(), seen: { thistleBoar: 5 }, kills: { thistleBoar: 7 }, golden: 2, bosses: 1 };
	m.ledgers.set('u1', { ...m.ledgers.get('u1')!, stats: met });
	const result = ok(await rebirthStep(m.deps, 'u1', key(), T0 + MIN));
	assert.equal(result.ok, true, JSON.stringify({ ...result, inv: undefined }));
	assert.deepEqual(m.ledgers.get('u1')!.stats.seen, { thistleBoar: 5 });
	assert.deepEqual(m.ledgers.get('u1')!.stats.kills, { thistleBoar: 7 });
	assert.equal(m.ledgers.get('u1')!.stats.golden, 2);

	await startNewGame(m.deps, 'u1', T0 + 3 * 60 * MIN);
	assert.ok(isEmptyStats(m.ledgers.get('u1')!.stats), 'a New Game starts counting from zero');
});

test('the browser can never write kills: an uploaded save does not change the ledger counters', async () => {
	const m = await freshPlayer();
	m.ledgers.set('u1', { ...m.ledgers.get('u1')!, stats: { ...emptyStats(), seen: { thistleBoar: 5 }, kills: { thistleBoar: 7 }, at: T0 } });
	const forged = structuredClone(game()) as Record<string, unknown>;
	forged.kills = { thistleBoar: 99999 };
	forged.seen = { bossGrove: 1 };
	await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(forged as unknown as PersistedGame), m.rows.get('u1')!.rev, T0 + 30 * MIN, false, m.ledgerRepo);
	assert.deepEqual(m.ledgers.get('u1')!.stats.kills, { thistleBoar: 7 });
	assert.deepEqual(m.ledgers.get('u1')!.stats.seen, { thistleBoar: 5 });
});
