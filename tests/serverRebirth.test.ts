// IDL-102: the server runs the rebirth. POST /api/rebirth judges the last stored save, computes the Embers, wipes the server's bag and gear once,
// and the save that follows is capped at exactly that gain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { patchTile } from '../src/utils/world';
import { calculateLevel, totalStatPoints } from '../src/utils/gameUtils';

/** A game that meets the first rebirth's requirements on the server's reading: castle level 6 and more than 400 tiles bought (purchases + 1 count). */
const rebirthReadyGame = (): PersistedGame => {
	api().resetGame();
	growTo(410);
	const grown = api();
	store.setState({ tiles: patchTile(grown.tiles, CASTLE_X, CASTLE_Y, { level: 6 }), playSeconds: 1000, characterStats: { ...grown.characterStats, availablePoints: totalStatPoints(calculateLevel(grown.resources.xp).level) }, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { MIN_SAVE_INTERVAL_MS, acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import type { Ledger, LedgerRepo } from '../src/lib/offline/ledger';
import type { ServiceDeps } from '../src/lib/offline/service';
import { rebirthStep, type Online } from '../src/lib/offline/online';
import { judgeRebirth } from '../src/lib/cloudSave/serverRebirth';
import { EMBER_MODEL, settleEmbers } from '../src/lib/cloudSave/emberModel';
import { summarize } from '../src/lib/cloudSave/summary';
import { rebirthKit } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import { emberGain } from '../src/utils/gameUtils';
import type { RebirthReply } from '../src/lib/offline/types';

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const ledgers = new Map<string, Ledger>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	const ledgerRepo: LedgerRepo = {
		load: async (id) => (ledgers.has(id) ? structuredClone(ledgers.get(id)!) : null),
		commit: async (id, expectedVer, ledger) => {
			const current = ledgers.get(id);
			if (expectedVer === 0 ? !!current : current?.ver !== expectedVer) return false;
			ledgers.set(id, structuredClone(ledger));
			return true;
		},
	};
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, rows, deps };
};

const T0 = 1_800_000_000_000;
const STEP = MIN_SAVE_INTERVAL_MS + 1000;
const ID = 'u1';
const save = (m: ReturnType<typeof memory>, state: PersistedGame, baseRev: number, at: number) => acceptSave(m.saves, ID, 'Zoë', encodeSave(state), baseRev, at, false, m.ledgerRepo);
const ok = (out: Online<RebirthReply>): RebirthReply => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: RebirthReply }).value;
};
let keyNo = 0;
const key = () => `rebirth-key-${String(++keyNo).padStart(6, '0')}`;

/** The state a rebirth leaves in the browser, as far as the checks look at it. */
const rebirthed = (state: PersistedGame, rebirths: number, legacyEarned: number): PersistedGame => ({
	...state,
	playSeconds: state.playSeconds + 12,
	prestige: { ...state.prestige, rebirths, legacyEarned, legacyPoints: legacyEarned },
});

/** A rebirth-ready player with a saved game, and the ledger's inventory holding something the starter kit does not (so a wipe shows). */
const ready = async () => {
	const m = memory();
	const state = rebirthReadyGame();
	assert.equal((await save(m, state, 0, T0)).kind, 'ok');
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, inv: { ...ledger.inv!, equipment: { mainHand: plainItem('wooden_sword'), head: plainItem('leather_cap') } as never } });
	return { m, state, expected: emberGain(summarize(state).castleLevel, summarize(state).derived.purchased, {}, 0) };
};

test('a game that does not meet the requirements is refused, and nothing is wiped', async () => {
	const m = memory();
	api().resetGame();
	growTo(12);
	store.setState({ playSeconds: 1000 } as never);
	await save(m, structuredClone(pickPersisted(api())), 0, T0);
	const before = m.ledgers.get(ID)!.inv;
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000));
	assert.equal(reply.ok, false);
	assert.equal(reply.reason, 'not_ready');
	assert.equal(reply.gain, 0);
	assert.deepEqual(m.ledgers.get(ID)!.inv, before, 'the inventory is untouched');
});

test('the judgement is the game\'s own rule from the stored save: castle level, territory, no castle upgrade running, and the gain of emberGain', () => {
	const summary = summarize(rebirthReadyGame());
	const judged = judgeRebirth(summary, {});
	assert.ok(judged.ok);
	assert.equal(judged.ok && judged.gain, emberGain(summary.castleLevel, summary.derived.purchased, {}, 0));
	assert.deepEqual(judgeRebirth({ ...summary, derived: { ...summary.derived, castleUpgrade: { toLevel: 7, remainingSec: 100 } } }, {}), { ok: false, reason: 'not_ready' });
	assert.deepEqual(judgeRebirth({ ...summary, castleLevel: 5 }, {}), { ok: false, reason: 'not_ready' });
	assert.deepEqual(judgeRebirth({ ...summary, derived: { ...summary.derived, purchased: 10 } }, {}), { ok: false, reason: 'not_ready' });
	// the Tithe level of the stored save raises the gain
	const withTithe = judgeRebirth(summary, { tithe: 10 });
	assert.ok(withTithe.ok && judged.ok && withTithe.gain > judged.gain);
});

test('the server runs the rebirth: it answers with the Embers and the starter kit, and the ledger\'s bag and gear are wiped', async () => {
	const { m, expected } = await ready();
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000));
	assert.equal(reply.ok, true);
	assert.equal(reply.to, 1);
	assert.equal(reply.gain, expected);
	assert.ok(reply.gain >= 1);
	const inv = m.ledgers.get(ID)!.inv!;
	assert.deepEqual(inv.equipment, rebirthKit(undefined).equipment, 'the worn gear is the starter kit again');
	assert.deepEqual(inv.rebirth, { to: 1, gain: expected }, 'the rebirth is recorded for the save that follows');
});

test('a replayed request is a no-op: the same key replays the answer, another key neither wipes again nor pays again', async () => {
	const { m } = await ready();
	const first = key();
	const a = ok(await rebirthStep(m.deps, ID, first, T0 + 30_000));
	const verAfter = m.ledgers.get(ID)!.inv!.ver;
	// the player picks something up after the wipe, then the request is repeated
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, inv: { ...ledger.inv!, lootPity: { ...ledger.inv!.lootPity, marker: 1 } } });
	const replay = ok(await rebirthStep(m.deps, ID, first, T0 + 31_000));
	assert.deepEqual({ ...replay, inv: null }, { ...a, inv: null }, 'the same key: the stored answer (the inventory in it is always the current one)');
	const again = ok(await rebirthStep(m.deps, ID, key(), T0 + 32_000));
	assert.equal(again.ok, true);
	assert.equal(again.gain, a.gain, 'the gain is paid once');
	assert.equal(m.ledgers.get(ID)!.inv!.ver, verAfter, 'no second wipe');
	assert.equal(m.ledgers.get(ID)!.inv!.lootPity.marker, 1, 'what was picked up since stays');
});

test('the rebirth save is capped at exactly the Embers the server computed, and the bag is not wiped a second time', async () => {
	const { m, state, expected } = await ready();
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000));
	const wipedVer = reply.inv.ver;
	// honest: the Embers the server answered
	const out = await save(m, rebirthed(state, 1, reply.gain), 1, T0 + STEP);
	assert.ok(out.kind === 'ok' && !out.flags.includes('ember_jump') && out.prestige === undefined, JSON.stringify(out));
	assert.equal(m.rows.get(ID)!.summary.legacyEarned, expected);
	assert.equal(m.ledgers.get(ID)!.inv!.ver, wipedVer, 'the wipe happened once, at /api/rebirth');
	assert.equal(m.ledgers.get(ID)!.rebirths, 1, 'the new run is open');
});

test('a tampered gain is clamped to the server\'s number and flagged ember_jump', async () => {
	const { m, state, expected } = await ready();
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000));
	assert.equal(reply.gain, expected);
	const out = await save(m, rebirthed(state, 1, expected + 500), 1, T0 + STEP);
	assert.ok(out.kind === 'ok' && out.flags.includes('ember_jump'), JSON.stringify(out));
	assert.equal(m.rows.get(ID)!.summary.legacyEarned, expected, 'exactly what the server computed, not the loose bound');
	assert.equal(out.kind === 'ok' ? out.prestige?.legacyEarned : null, expected);
});

test('a rebirth that skipped /api/rebirth still falls back to the loose bound, and can be required to go through it', () => {
	const summary = summarize(rebirthReadyGame());
	const prev = { summary, serverSavedAt: T0 };
	const claim = { rebirths: 1, legacyEarned: 5, playSeconds: summary.playSeconds + 12 };
	assert.equal(settleEmbers(prev, claim, null).rebirths, 1, 'no record: the old bound allows an honest rebirth');
	assert.equal(settleEmbers(prev, claim, null, true).rebirths, 0, 'with the requirement on, no record means no rebirth');
	assert.equal(settleEmbers(prev, claim, { to: 1, gain: 5 }, true).rebirths, 1, 'a record satisfies it');
	assert.equal(settleEmbers(prev, { ...claim, legacyEarned: 9 }, { to: 1, gain: 5 }).legacyEarned, 5, 'the record caps the Embers');
	assert.equal(settleEmbers(prev, { ...claim, rebirths: 2 }, { to: 1, gain: 5 }).rebirths <= 1, true, 'a record for rebirth 1 does not pay rebirth 2');
	assert.equal(EMBER_MODEL.requireServerRebirth, false, 'off until every client goes through the route');
});

test('the browser starts the new run with the Embers the server named, never more than it works out itself', () => {
	rebirthReadyGame(); // leaves the store holding a game that can rebirth
	const own = api().prestige.legacyEarned;
	assert.equal(api().rebirth(0), false, 'a server answer that pays nothing starts nothing');
	assert.equal(api().prestige.rebirths, 0);
	assert.equal(api().rebirth(3), true);
	assert.equal(api().prestige.legacyEarned, own + 3, 'the server\'s number');
	rebirthReadyGame();
	assert.equal(api().rebirth(1e9), true);
	assert.ok(api().prestige.legacyEarned < 1e6, 'a server number above the game\'s own is not taken');
});
