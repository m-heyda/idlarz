// The gem shop (IDL-189/190/194) and the server-held attribute points: the daily bonus, purchases (class, name, respec), idempotency, the identity write, and how an upload meets the ledger's allocation and balance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { MIN_SAVE_INTERVAL_MS, acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { characterStep, gemsStep, type Online } from '../../src/lib/offline/online';
import { runGems } from '../../src/lib/offline/gemsFlow';
import { parseGemsBody } from '../../src/lib/offline/gemsParse';
import type { IdentityInfo, IdentityRepo } from '../../src/lib/offline/identity';
import type { CharacterReply, GemsReply, GemsRequest, PendingIdentity } from '../../src/lib/offline/gemTypes';
import { dailyInfo, serverDay } from '../../src/lib/offline/gems';
import { emptyGemShop, newLedger, readGemShop } from '../../src/lib/offline/ledger';
import { ATTR_KEYS, allocatePoints, attributeBudget, newAttrs, readAttrs } from '../../src/lib/offline/attrs';
import { DAILY_BONUS_GEMS, DAY_SEC, GEM_SHOP } from '../../src/config/gemShop';
import { STARTING_GEMS } from '../../src/config/economy';
import { calculateLevel, totalStatPoints } from '../../src/utils/game/character';

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

/** The profile table as a Map, with the unique name rule. */
const identityRepo = (start: IdentityInfo) => {
	const info = { ...start };
	const taken = new Set<string>();
	const repo: IdentityRepo = {
		load: async () => ({ ...info }),
		nameTaken: async (_id, name) => taken.has(name.toLowerCase()),
		apply: async (_id, pending: PendingIdentity, nowSec) => {
			if (pending.kind === 'name') {
				if (taken.has(pending.value.toLowerCase())) return 'name_taken';
				info.characterName = pending.value;
				info.nameChangedAtSec = Math.floor(nowSec);
			} else info.playerClass = pending.value;
			return 'ok';
		},
	};
	return { repo, info, taken };
};

const T0 = 1_800_000_000_000;
const STEP = MIN_SAVE_INTERVAL_MS + 1000;
const ID = 'u1';
let keyNo = 0;
const key = () => `gem-test-key-${String(++keyNo).padStart(6, '0')}`;
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

/** A game with `points` attribute points spent, saved once so the account has a ledger. */
const started = async (points = 3) => {
	api().resetGame();
	growTo(60);
	store.setState({ characterStats: { ...api().characterStats, availablePoints: totalStatPoints(calculateLevel(api().resources.xp).level) } } as never);
	for (let i = 0; i < points; i++) assert.ok(api().addStatPoint('strength'));
	const state: PersistedGame = structuredClone(pickPersisted(api()));
	const m = memory();
	await acceptSave(m.saves, ID, 'Zoë', encodeSave(state), 0, T0, false, m.ledgerRepo);
	return { m, state };
};

/** The player was last here a moment before `at` (an absence is claimed first in the game: here it is as if they had been playing). */
const here = (m: ReturnType<typeof memory>, at: number) => {
	m.ledgers.set(ID, { ...m.ledgers.get(ID)!, anchorAt: at - 1000 });
	m.rows.set(ID, { ...m.rows.get(ID)!, serverSavedAt: at - 1000 });
};

const gems = (
	m: ReturnType<typeof memory>,
	request: GemsRequest,
	at: number,
	info: IdentityInfo | null = { characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null },
	k: string | null = key(),
) => gemsStep(m.deps, ID, request.action === 'status' ? null : k, request, at, info);

test('the first save seeds the allocation from what the player holds', async () => {
	const { m } = await started(3);
	const ledger = m.ledgers.get(ID)!;
	assert.equal(ledger.attrs?.alloc.strength, 3);
	assert.equal(ledger.attrs?.freeUsed, false);
});

test('the daily bonus pays once per UTC day and climbs a ladder of seven', async () => {
	const { m } = await started();
	const at = (day: number) => T0 + day * DAY_SEC * 1000;
	const first = ok(await gems(m, { action: 'daily' }, T0 + STEP));
	assert.equal(first.ok, true);
	assert.equal(first.paid, DAILY_BONUS_GEMS[0]);
	assert.equal(first.gems, STARTING_GEMS + DAILY_BONUS_GEMS[0]);
	const again = ok(await gems(m, { action: 'daily' }, T0 + STEP + 1000));
	assert.equal(again.ok, false);
	assert.equal(again.reason, 'already_claimed');
	assert.equal(again.gems, first.gems);
	// the next UTC day is step 2
	here(m, at(1) + STEP);
	const next = ok(await gems(m, { action: 'daily' }, at(1) + STEP));
	assert.equal(next.paid, DAILY_BONUS_GEMS[1]);
	// a missed day starts again at day 1
	here(m, at(3) + STEP);
	const missed = ok(await gems(m, { action: 'daily' }, at(3) + STEP));
	assert.equal(missed.paid, DAILY_BONUS_GEMS[0]);
});

test('after day seven the ladder starts again', () => {
	const shop = { ...emptyGemShop(), daily: { day: serverDay(T0 / 1000) - 1, streak: DAILY_BONUS_GEMS.length } };
	const info = dailyInfo(shop, T0 / 1000);
	assert.equal(info.step, 1);
	assert.equal(info.available, true);
	assert.equal(info.gems, DAILY_BONUS_GEMS[0]);
});

test('a repeated key replays the answer and charges once', async () => {
	const { m } = await started();
	const k = key();
	const a = ok(await gems(m, { action: 'daily' }, T0 + STEP, undefined, k));
	const b = ok(await gems(m, { action: 'daily' }, T0 + STEP + 500, undefined, k));
	assert.deepEqual(b, a);
	assert.equal(m.ledgers.get(ID)!.gems, STARTING_GEMS + DAILY_BONUS_GEMS[0]);
});

test('the first attribute respec is free, the next costs 300', async () => {
	const { m } = await started(3);
	const free = ok(await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP));
	assert.equal(free.ok, true);
	assert.equal(free.paid, 0);
	assert.equal(free.gems, STARTING_GEMS);
	assert.equal(free.freeRespec, false);
	assert.deepEqual(free.attrs?.alloc, { strength: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 });
	// nothing spent: nothing to give back, and nothing is charged
	const empty = ok(await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP + 1000));
	assert.equal(empty.reason, 'nothing_to_respec');
	// put points back, then the second respec is paid
	ok(await characterStep(m.deps, ID, key(), { action: 'allocate', add: { vitality: 2 } }, T0 + STEP + 2000));
	const paid = ok(await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP + 3000));
	assert.equal(paid.ok, true);
	assert.equal(paid.paid, 300);
	assert.equal(paid.gems, STARTING_GEMS - 300);
});

test('a short balance refuses and charges nothing', async () => {
	const { m } = await started();
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, gems: 499 });
	const out = ok(await gems(m, { action: 'spend', itemId: 'class_change', value: 'mage' }, T0 + STEP));
	assert.equal(out.ok, false);
	assert.equal(out.reason, 'short_balance');
	assert.equal(m.ledgers.get(ID)!.gems, 499);
});

test('a class change takes 500 gems and writes the class on the profile', async () => {
	const { m } = await started();
	const id = identityRepo({ characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null });
	const out = ok(await runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'class_change', value: 'mage' }, T0 + STEP));
	assert.equal(out.ok, true);
	assert.equal(out.playerClass, 'mage');
	assert.equal(out.gems, STARTING_GEMS - 500);
	assert.equal(id.info.playerClass, 'mage');
	assert.equal(m.ledgers.get(ID)!.gemShop.pending, null);
	const same = ok(await runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'class_change', value: 'mage' }, T0 + STEP + 1000));
	assert.equal(same.reason, 'same_class');
	assert.equal(m.ledgers.get(ID)!.gems, STARTING_GEMS - 500);
	const unknown = ok(await runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'class_change', value: 'wizard' }, T0 + STEP + 2000));
	assert.equal(unknown.reason, 'bad_value');
});

test('a name change: rules, a taken name costs nothing, then 200 gems and a 30-day wait', async () => {
	const { m } = await started();
	const id = identityRepo({ characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null });
	id.taken.add('bob');
	const run = (value: string, at: number) => runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'name_change', value }, at).then(ok);
	assert.equal((await run('', T0 + STEP)).reason, 'bad_value');
	assert.equal((await run('WayTooLongAName', T0 + STEP)).reason, 'bad_value');
	assert.equal((await run('BOB', T0 + STEP)).reason, 'name_taken');
	assert.equal(m.ledgers.get(ID)!.gems, STARTING_GEMS);
	const done = await run('Alice', T0 + STEP);
	assert.equal(done.ok, true);
	assert.equal(done.characterName, 'Alice');
	assert.equal(done.gems, STARTING_GEMS - 200);
	assert.equal(id.info.characterName, 'Alice');
	const wait = await run('Carol', T0 + STEP + 1000);
	assert.equal(wait.reason, 'cooldown');
	assert.equal(m.ledgers.get(ID)!.gems, STARTING_GEMS - 200);
	here(m, T0 + STEP + 31 * DAY_SEC * 1000);
	const later = await run('Carol', T0 + STEP + 31 * DAY_SEC * 1000);
	assert.equal(later.ok, true);
});

test('a name another account took a moment ago gives the gems back', async () => {
	const { m } = await started();
	const id = identityRepo({ characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null });
	// the check passes, then the write finds the name gone (a race with another account)
	const racing: IdentityRepo = { ...id.repo, nameTaken: async () => false, apply: async () => 'name_taken' };
	const out = ok(await runGems(m.deps, racing, ID, key(), { action: 'spend', itemId: 'name_change', value: 'Alice' }, T0 + STEP));
	assert.equal(out.ok, false);
	assert.equal(out.reason, 'name_taken');
	assert.equal(out.gems, STARTING_GEMS);
	const ledger = m.ledgers.get(ID)!;
	assert.equal(ledger.gems, STARTING_GEMS);
	assert.equal(ledger.gemShop.pending, null);
	assert.equal(ledger.gemShop.bought.name_change, undefined);
});

test('two buyers at once cannot both spend the same gems', async () => {
	const { m } = await started();
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, gems: 500 });
	const id = identityRepo({ characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null });
	const results = await Promise.all([
		runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'class_change', value: 'mage' }, T0 + STEP),
		runGems(m.deps, id.repo, ID, key(), { action: 'spend', itemId: 'class_change', value: 'archer' }, T0 + STEP),
	]);
	const replies = results.map((r) => ok(r) as GemsReply);
	assert.equal(replies.filter((r) => r.ok).length, 1, JSON.stringify(replies));
	assert.equal(m.ledgers.get(ID)!.gems, 0);
});

test('the allocation: points up to the budget, never beyond, the answer carries the truth', async () => {
	const { m, state } = await started(3);
	const level = calculateLevel(state.resources.xp).level;
	const budget = attributeBudget(level);
	const read = ok(await characterStep(m.deps, ID, null, { action: 'sync' }, T0 + STEP));
	assert.equal(read.attrs.alloc.strength, 3);
	assert.equal(read.available, budget - 3);
	const more = ok(await characterStep(m.deps, ID, key(), { action: 'allocate', add: { dexterity: 2 } }, T0 + STEP + 1000)) as CharacterReply;
	assert.equal(more.ok, true);
	assert.equal(more.attrs.alloc.dexterity, 2);
	const tooMany = ok(await characterStep(m.deps, ID, key(), { action: 'allocate', add: { vitality: budget } }, T0 + STEP + 2000));
	assert.equal(tooMany.ok, false);
	assert.equal(tooMany.reason, 'no_points');
	assert.equal(tooMany.attrs.alloc.vitality, 0);
	const bad = ok(await characterStep(m.deps, ID, key(), { action: 'allocate', add: { luck: 1 } }, T0 + STEP + 3000));
	assert.equal(bad.reason, 'bad_request');
});

test('allocatePoints rejects fractions, negatives and unknown attributes', () => {
	const attrs = newAttrs();
	for (const add of [{ strength: 0.5 }, { strength: -1 }, { strength: '2' }, { wisdom: 1 }, {}, null, [1]])
		assert.equal(allocatePoints(attrs, add, 100).ok, false, JSON.stringify(add));
	assert.equal(allocatePoints(attrs, { strength: 1, dexterity: 2 }, 3).ok, true);
	assert.equal(allocatePoints(attrs, { strength: 1, dexterity: 3 }, 3).ok, false);
});

test('the readers drop what they do not know', () => {
	assert.equal(readAttrs(null), null);
	assert.equal(readAttrs({ nope: 1 }), null);
	const a = readAttrs({ ver: 4, alloc: { strength: 2.9, dexterity: -3, wisdom: 9 }, freeUsed: true })!;
	assert.deepEqual(a.alloc, { strength: 2, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 });
	assert.equal(a.freeUsed, true);
	assert.deepEqual(readGemShop(undefined), emptyGemShop());
	assert.deepEqual(readGemShop({ bought: { a: 2, b: -1 }, daily: { day: 5, streak: 99 }, pending: { kind: 'bad' } }).bought, { a: 2 });
	assert.equal(readGemShop({ pending: { kind: 'class', value: 'mage', price: 500 } }).pending?.value, 'mage');
	assert.equal(ATTR_KEYS.length, 5);
	assert.equal(newLedger(T0).attrs, null);
	assert.ok(GEM_SHOP.every((item) => item.price > 0));
});

test('an upload meets the ledger: its allocation is replaced, a stale gem balance is not a gem increase', async () => {
	const { m, state } = await started(3);
	// the player respecced on the server (free), the browser's save still holds the old points and the old balance
	await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP);
	await gems(m, { action: 'daily' }, T0 + STEP + 500);
	const before = m.ledgers.get(ID)!;
	assert.ok(before.gemShop.spentSinceSave === 0);
	const spent = ok(await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP + 1000));
	assert.equal(spent.ok, false); // nothing to respec: no charge, no allowance
	// allocate and pay for a second respec so something was bought
	ok(await characterStep(m.deps, ID, key(), { action: 'allocate', add: { vitality: 2 } }, T0 + STEP + 1500));
	ok(await gems(m, { action: 'spend', itemId: 'attr_respec' }, T0 + STEP + 2000));
	const afterSpend = m.ledgers.get(ID)!;
	assert.equal(afterSpend.gemShop.spentSinceSave, 300);
	// a save that still holds the balance from before the purchase and the old allocation
	const stale: PersistedGame = { ...state, playSeconds: state.playSeconds + 30, gems: afterSpend.gems + 300 };
	const out = await acceptSave(m.saves, ID, 'Zoë', encodeSave(stale), 1, T0 + 2 * STEP, false, m.ledgerRepo);
	assert.equal(out.kind, 'ok');
	if (out.kind === 'ok') assert.ok(!out.flags.includes('gems_increase'), out.flags.join(','));
	const stored = m.rows.get(ID)!;
	const stats = stored.core.characterStats as Record<string, number>;
	assert.equal(stats.strength, 5, 'the ledger holds no points: the upload is put back to the start value');
	assert.equal(stats.vitality, 5);
	assert.equal(m.ledgers.get(ID)!.gemShop.spentSinceSave, 0, 'the allowance is used up by the accepted save');
	// but a save that claims more than the balance plus the allowance is still a gem increase
	const forged: PersistedGame = { ...stale, playSeconds: stale.playSeconds + 30, gems: m.ledgers.get(ID)!.gems + 5000 };
	const bad = await acceptSave(m.saves, ID, 'Zoë', encodeSave(forged), 2, T0 + 3 * STEP, false, m.ledgerRepo);
	assert.equal(bad.kind, 'ok');
	if (bad.kind === 'ok') assert.ok(bad.flags.includes('gems_increase'));
	void store;
});

test('the route reads a claim: it needs the key and an id, and never lets a claim fall through as a bad body', () => {
	const key = 'claim-key-000001';
	assert.deepEqual(parseGemsBody({ action: 'claim', key, id: 'first_blood' }), { key, request: { action: 'claim', id: 'first_blood' } });
	assert.equal(parseGemsBody({ action: 'claim', id: 'first_blood' }), null, 'no key');
	assert.deepEqual(parseGemsBody({ action: 'claimAll', key }), { key, request: { action: 'claimAll' } });
	assert.equal(parseGemsBody({ action: 'claimAll' }), null, 'no key');
	assert.equal(parseGemsBody({ action: 'claim', key }), null, 'no id');
	assert.equal(parseGemsBody({ action: 'claim', key, id: '' }), null, 'empty id');
	assert.equal(parseGemsBody({ action: 'claim', key, id: 'x'.repeat(61) }), null, 'id too long');
	assert.deepEqual(parseGemsBody({ action: 'status' }), { key: null, request: { action: 'status' } });
});
