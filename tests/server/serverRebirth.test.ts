// IDL-102: the server runs the rebirth. POST /api/rebirth judges the last stored save, computes the Embers, wipes the server's bag and gear once,
// and the save that follows is capped at exactly that gain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { patchTile } from '../../src/utils/world';
import { calculateLevel, totalStatPoints } from '../../src/utils/game/character';

/** A game that meets the first rebirth's requirements on the server's reading: castle level 6 and more than 400 tiles bought (purchases + 1 count). */
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
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { MIN_SAVE_INTERVAL_MS, acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { rebirthStep, type Online } from '../../src/lib/offline/online';
import { judgeRebirth } from '../../src/lib/cloudSave/serverRebirth';
import { EMBER_MODEL, settleEmbers } from '../../src/lib/cloudSave/emberModel';
import { summarize } from '../../src/lib/cloudSave/summary';
import { rebirthKit } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { emberGain } from '../../src/utils/game/rebirth';
import type { RebirthReply } from '../../src/lib/offline/types';

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
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
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, ledgers, rows, deps };
};

const T0 = 1_800_000_000_000;
const STEP = MIN_SAVE_INTERVAL_MS + 1000;
const ID = 'u1';
const save = (m: ReturnType<typeof memory>, state: PersistedGame, baseRev: number, at: number) =>
	acceptSave(m.saves, ID, 'Zoë', encodeSave(state), baseRev, at, false, m.ledgerRepo);
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

test("the judgement is the game's own rule from the stored save: castle level, territory, no castle upgrade running, and the gain of emberGain", () => {
	const summary = summarize(rebirthReadyGame());
	const judged = judgeRebirth(summary, {});
	assert.ok(judged.ok);
	assert.equal(judged.ok && judged.gain, emberGain(summary.castleLevel, summary.derived.purchased, {}, 0));
	assert.deepEqual(judgeRebirth({ ...summary, derived: { ...summary.derived, castleUpgrade: { toLevel: 7, remainingSec: 100 } } }, {}), {
		ok: false,
		reason: 'not_ready',
	});
	assert.deepEqual(judgeRebirth({ ...summary, castleLevel: 5 }, {}), { ok: false, reason: 'not_ready' });
	assert.deepEqual(judgeRebirth({ ...summary, derived: { ...summary.derived, purchased: 10 } }, {}), { ok: false, reason: 'not_ready' });
	// the Tithe level of the stored save raises the gain
	const withTithe = judgeRebirth(summary, { tithe: 10 });
	assert.ok(withTithe.ok && judged.ok && withTithe.gain > judged.gain);
});

test("the server runs the rebirth: it answers with the Embers and the starter kit, and the ledger's bag and gear are wiped", async () => {
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

test("a tampered gain is clamped to the server's number and flagged ember_jump", async () => {
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
	assert.equal(api().prestige.legacyEarned, own + 3, "the server's number");
	rebirthReadyGame();
	assert.equal(api().rebirth(1e9), true);
	assert.ok(api().prestige.legacyEarned < 1e6, "a server number above the game's own is not taken");
});

test('a rebirth ends every running potion buff (IDL-155)', async () => {
	const { m } = await ready();
	m.ledgers.set(ID, { ...m.ledgers.get(ID)!, buffs: [{ family: 'might', stat: 'damagePct', amount: 10, untilSec: T0 / 1000 + 9999 }] });
	assert.equal(ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000)).ok, true);
	assert.deepEqual(m.ledgers.get(ID)!.buffs, []);
});

/** The ready player, with a legendary in the bag and another one worn (and a common piece in the bag). */
const readyWithLegends = async () => {
	const r = await ready();
	const sword = { ...plainItem('emberbrand'), rarity: 'legendary' };
	const ledger = r.m.ledgers.get(ID)!;
	const bag = ledger.inv!.bag.map((slot) => slot);
	bag[0] = { item: sword };
	bag[1] = { item: plainItem('wooden_sword') };
	r.m.ledgers.set(ID, {
		...ledger,
		inv: { ...ledger.inv!, bag, equipment: { ...ledger.inv!.equipment, offHand: { ...plainItem('emberbrand'), rarity: 'legendary' } as never } },
	});
	return { ...r, sword };
};

test('a legendary the player chose to keep survives the rebirth, in the new bag; the rest is wiped', async () => {
	const { m, sword } = await readyWithLegends();
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [{ from: 'bag', index: 0 }]));
	assert.equal(reply.ok, true);
	assert.deepEqual(reply.kept, [sword]);
	const inv = m.ledgers.get(ID)!.inv!;
	assert.ok(
		inv.bag.some((s) => s && 'item' in s && s.item.base === 'emberbrand'),
		'the kept piece is in the bag',
	);
	assert.equal(inv.bag.filter((s) => s && 'item' in s).length, 1, 'nothing else came along');
	assert.deepEqual(inv.equipment, rebirthKit(undefined).equipment, 'worn gear is the starter kit again');
	assert.deepEqual(inv.rebirth, { to: 1, gain: reply.gain, kept: 1 });
});

test('an epic piece can be kept too, a rare one is refused', async () => {
	const { m } = await readyWithLegends();
	const ledger = m.ledgers.get(ID)!;
	const bag = ledger.inv!.bag.map((slot) => slot);
	const epic = { ...plainItem('emberbrand'), rarity: 'epic' };
	bag[0] = { item: epic };
	bag[1] = { item: { ...plainItem('emberbrand'), rarity: 'rare' } };
	m.ledgers.set(ID, { ...ledger, inv: { ...ledger.inv!, bag } });
	const refused = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [{ from: 'bag', index: 1 }]));
	assert.equal(refused.reason, 'bad_keep');
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [{ from: 'bag', index: 0 }]));
	assert.equal(reply.ok, true);
	assert.deepEqual(reply.kept, [epic]);
	assert.equal(m.ledgers.get(ID)!.inv!.bag.filter((s) => s && 'item' in s).length, 1, 'only the epic piece came along');
});

test('the first rebirth has one slot: more picks, a common piece or an empty place are refused and nothing is wiped', async () => {
	const { m } = await readyWithLegends();
	const before = m.ledgers.get(ID)!.inv;
	for (const keep of [
		[
			{ from: 'bag', index: 0 },
			{ from: 'equip', slot: 'offHand' },
		],
		[{ from: 'bag', index: 1 }],
		[{ from: 'bag', index: 50 }],
		[{ from: 'equip', slot: 'head' }],
	] as const) {
		const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, keep));
		assert.equal(reply.ok, false);
		assert.equal(reply.reason, 'bad_keep');
	}
	assert.deepEqual(m.ledgers.get(ID)!.inv, before, 'the inventory is untouched');
});

test('a worn legendary can be kept too, and the same key replays the answer with the kept piece', async () => {
	const { m } = await readyWithLegends();
	const first = key();
	const a = ok(await rebirthStep(m.deps, ID, first, T0 + 30_000, [{ from: 'equip', slot: 'offHand' }]));
	assert.equal(a.kept?.length, 1);
	const replay = ok(await rebirthStep(m.deps, ID, first, T0 + 31_000, [{ from: 'equip', slot: 'offHand' }]));
	assert.deepEqual(replay.kept, a.kept);
	assert.equal(m.ledgers.get(ID)!.inv!.ver, a.inv.ver, 'no second wipe');
});

test('the browser rebirths locally when the server cannot be asked today, and refuses to the day the server must run every rebirth (IDL-211)', async () => {
	const { blocksLocalRebirth } = await import('@/lib/serverRebirth');
	assert.equal(blocksLocalRebirth({ status: 'unavailable' }), false, 'today: the switch is off, the local rebirth stays allowed');
	assert.equal(blocksLocalRebirth({ status: 'unavailable' }, true), true, 'switched on: a rebirth the server never saw would be reverted, so do not start it');
	assert.equal(blocksLocalRebirth({ status: 'ok', gain: 5, kept: [] }, true), false);
	assert.equal(blocksLocalRebirth({ status: 'refused' }, true), false, 'a refusal has its own notice');
});

// ------------------------------------------------------------------------------ the rebirth screen's two free respecs

test('by default a rebirth hands every attribute point back and leaves the paragon points alone', async () => {
	const { m } = await ready();
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, {
		...ledger,
		attrs: { ver: 3, alloc: { strength: 12, dexterity: 0, intelligence: 0, vitality: 4, charisma: 0 }, freeUsed: false },
		paragon: { ver: 2, spent: { damage: 5 }, freeUsed: false },
	});
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000));
	assert.equal(reply.ok, true);
	assert.equal(reply.keepAttrs, undefined);
	assert.equal(reply.paragon?.spent.damage, 5);
	const after = m.ledgers.get(ID)!;
	assert.deepEqual(after.attrs?.alloc, { strength: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 });
	assert.deepEqual(after.paragon?.spent, { damage: 5 });
	assert.equal(after.inv!.rebirth?.keepAttrs, undefined);
});

test('keepAttrs: the allocation stays through the rebirth and the choice is recorded for the save that follows', async () => {
	const { m } = await ready();
	const ledger = m.ledgers.get(ID)!;
	const alloc = { strength: 12, dexterity: 0, intelligence: 0, vitality: 4, charisma: 0 };
	m.ledgers.set(ID, { ...ledger, attrs: { ver: 3, alloc, freeUsed: true } });
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [], { keepAttrs: true, resetParagon: false }));
	assert.equal(reply.ok, true);
	assert.equal(reply.keepAttrs, true);
	const after = m.ledgers.get(ID)!;
	assert.deepEqual(after.attrs?.alloc, alloc, 'the attribute points were not taken back');
	assert.equal(after.attrs?.freeUsed, true);
	assert.equal(after.inv!.rebirth?.keepAttrs, true);
	// another key for the same rebirth replays what was chosen, never wipes or changes anything
	const again = ok(await rebirthStep(m.deps, ID, key(), T0 + 31_000, [], { keepAttrs: false, resetParagon: true }));
	assert.equal(again.keepAttrs, true);
	assert.deepEqual(m.ledgers.get(ID)!.attrs?.alloc, alloc);
});

test('resetParagon gives the paragon points back for free and leaves the one free paid respec as it was', async () => {
	const { m } = await ready();
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, paragon: { ver: 2, spent: { damage: 5, luck: 3 }, freeUsed: false } });
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [], { keepAttrs: false, resetParagon: true }));
	assert.equal(reply.ok, true);
	assert.deepEqual(reply.paragon?.spent, {});
	const after = m.ledgers.get(ID)!.paragon!;
	assert.deepEqual(after.spent, {});
	assert.equal(after.freeUsed, false, 'the first paid respec is still free');
	assert.equal(after.ver, 3);
});

test('resetParagon with nothing spent changes nothing, and an account without a paragon record never gets one made by a rebirth', async () => {
	const { m } = await ready();
	const reply = ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [], { keepAttrs: false, resetParagon: true }));
	assert.equal(reply.ok, true);
	assert.equal(reply.paragon, undefined);
	assert.equal(m.ledgers.get(ID)!.paragon, null);
});

test('the save that carries a rebirth keeps the attribute points when the player chose to, and clears them otherwise', async () => {
	for (const keepAttrs of [true, false]) {
		const { m, state } = await ready();
		const ledger = m.ledgers.get(ID)!;
		const alloc = { strength: 7, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 };
		m.ledgers.set(ID, { ...ledger, attrs: { ver: 2, alloc, freeUsed: false } });
		ok(await rebirthStep(m.deps, ID, key(), T0 + 30_000, [], { keepAttrs, resetParagon: false }));
		const gain = m.ledgers.get(ID)!.inv!.rebirth!.gain;
		const next = rebirthed(state, 1, gain);
		const stored = m.rows.get(ID)!;
		const out = await save(m, next, stored.rev, T0 + 30_000 + STEP);
		assert.equal(out.kind, 'ok', JSON.stringify(out));
		const after = m.ledgers.get(ID)!.attrs!;
		assert.equal(after.alloc.strength, keepAttrs ? 7 : 0, keepAttrs ? 'the points stayed' : 'the points went back');
	}
});
