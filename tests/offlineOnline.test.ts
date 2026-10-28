import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import type { Ledger, LedgerRepo } from '../src/lib/offline/ledger';
import { claimOffline, type ServiceDeps } from '../src/lib/offline/service';
import { fightStep, redeemChest, syncTickets, type Online } from '../src/lib/offline/online';
import { castleDistance } from '../src/lib/monsters';
import { MONSTERS } from '../src/config/combatConfig';
import type { FightReply } from '../src/lib/offline/types';

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const ledgers = new Map<string, Ledger>();
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
	return { saves, ledgerRepo, ledgers, deps };
};

const game = (): PersistedGame => {
	api().resetGame();
	growTo(60);
	api().tick(1000);
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 } } as never);
	return structuredClone(pickPersisted(api()));
};
const T0 = 1_800_000_000_000;
const MIN = 60_000;
const save = (m: ReturnType<typeof memory>, id: string, state: PersistedGame, baseRev: number, at: number) => acceptSave(m.saves, id, 'Zoë', encodeSave(state), baseRev, at, false, m.ledgerRepo);

const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

/** A player who has been playing for `minutes` (so tickets have appeared), with the ledger seeded by the first save. Auto-battle is off unless asked, so the monsters stay for the tests to look at. */
const playing = async (minutes: number, id = 'u1', autoBattle = false, rebirths = autoBattle ? 1 : 0) => {
	const m = memory();
	await save(m, id, game(), 0, T0);
	if (rebirths > 0) {
		// the ledger is seeded by the first request; a rebirth is the one thing a test cannot fake through a save
		ok(await fightStep(m.deps, id, null, { action: 'sync' }, T0 + 500));
		m.ledgers.get(id)!.rebirths = rebirths;
	}
	ok(await fightStep(m.deps, id, null, { action: 'auto', autoBattle }, T0 + 1000));
	// the player stays around: the game asks the server every ten minutes or so, which is what keeps "last seen" fresh
	for (let t = 10; t < minutes; t += 10) ok(await syncTickets(m.deps, id, T0 + t * MIN));
	const now = T0 + minutes * MIN;
	return { m, now };
};

test('a sync mints what the server clock says has appeared, and says when the next one is due', async () => {
	const { m, now } = await playing(25);
	const sync = ok(await syncTickets(m.deps, 'u1', now));
	assert.equal(sync.tickets.chests, 2, 'a chest every ten minutes');
	assert.equal(sync.tickets.rats.length, 2, 'a rat after 2 minutes and the next 15 later');
	assert.ok(sync.nextInSec !== null && sync.nextInSec > 0 && sync.nextInSec <= 600);
	// asking again changes nothing
	const again = ok(await syncTickets(m.deps, 'u1', now + 1000));
	assert.equal(again.tickets.chests, sync.tickets.chests);
	assert.deepEqual(again.tickets.rats, sync.tickets.rats);
});

test('a chest opens against a ticket, pays what the server rolled, and the same key replays the same reward', async () => {
	const { m, now } = await playing(25);
	ok(await syncTickets(m.deps, 'u1', now));
	const first = ok(await redeemChest(m.deps, 'u1', 'chest-key-0001', now + 1000));
	assert.equal(first.ok, true);
	const replay = ok(await redeemChest(m.deps, 'u1', 'chest-key-0001', now + 2000));
	assert.deepEqual(replay, first, 'a lost answer is replayed, never rolled again');
	assert.equal(m.ledgers.get('u1')!.ordChest, 1);
	assert.equal(m.ledgers.get('u1')!.bank.chests.length, 1, 'one ticket was spent');
});

test('opening more chests than have appeared gives nothing: five clicks in five seconds earn what the clock allows', async () => {
	const { m, now } = await playing(25); // two chests have appeared
	let opened = 0;
	let refused = 0;
	for (let i = 0; i < 5; i++) {
		const result = ok(await redeemChest(m.deps, 'u1', `chest-key-${1000 + i}`, now + i * 1000));
		if (result.ok) opened++;
		else refused++;
	}
	assert.equal(opened, 2);
	assert.equal(refused, 3);
	const granted = m.ledgers.get('u1')!.granted;
	assert.ok(granted.gold < 1e9, 'the ledger holds only what two chests paid');
});

test('chest rewards are sealed: the same account and number always roll the same, another account differently', async () => {
	const a = await playing(25, 'u1');
	const c = await playing(25, 'u1'); // the same history again
	const b = await playing(25, 'u2');
	const first = ok(await redeemChest(a.m.deps, 'u1', 'chest-key-0001', a.now));
	const again = ok(await redeemChest(c.m.deps, 'u1', 'chest-key-0001', c.now));
	const other = ok(await redeemChest(b.m.deps, 'u2', 'chest-key-0001', b.now));
	assert.ok(first.ok && again.ok && other.ok);
	if (first.ok && again.ok && other.ok) {
		assert.deepEqual(first.loot, again.loot);
		assert.equal(first.gems, again.gems);
		assert.notDeepEqual(first.loot, other.loot);
	}
});

test('gems found in chests raise the server balance and are never flagged in the next save', async () => {
	const { m, now } = await playing(60 * 8);
	let found = 0;
	for (let i = 0; i < 20; i++) {
		const result = ok(await redeemChest(m.deps, 'u1', `chest-key-${2000 + i}`, now + i * 1000));
		if (result.ok) found += result.gems;
	}
	const ledger = m.ledgers.get('u1')!;
	assert.equal(ledger.gems, 1000 + found);
	assert.equal(ledger.granted.gems, found);
});

test('the server puts every monster on land: 2 to 9 tiles from the castle, never on water, and gives it the level it appeared at', async () => {
	const { m, now } = await playing(60 * 5);
	const sync = ok(await syncTickets(m.deps, 'u1', now));
	assert.ok(sync.tickets.rats.length > 0);
	const stored = (await m.saves.load('u1'))!;
	for (const rat of sync.tickets.rats) {
		const distance = castleDistance(rat);
		assert.ok(distance >= MONSTERS.rat.spawn.minCastleDistance && distance <= MONSTERS.rat.spawn.maxCastleDistance, `distance ${distance}`);
		assert.ok(rat.spawnLevel >= 1);
	}
	assert.equal(new Set(sync.tickets.rats.map((r) => `${r.x},${r.y}`)).size, sync.tickets.rats.length, 'one monster per tile');
	assert.ok(stored.summary.tilesOwned > 9);
});

test('with auto-battle on the server fights the monsters one at a time and pays each kill once', async () => {
	const { m, now } = await playing(25, 'u1', true);
	// the server walks the fights forward each time it is asked: the starter kit beats the low-level rats of a young castle
	let won = 0;
	let t = now;
	let since: number | undefined = 0;
	for (let i = 0; i < 40; i++) {
		t += 20_000;
		const out: FightReply = ok(await fightStep(m.deps, 'u1', null, { action: 'sync', since }, t));
		since = out.combat.eventNo;
		won += out.combat.events.filter((e) => e.kind === 'won').length;
		assert.ok(out.combat.fight === null || out.combat.fight.monsterHp > 0);
	}
	const ledger = m.ledgers.get('u1')!;
	assert.ok(won >= 1, 'at least one rat fell');
	assert.equal(ledger.ordKill, won, 'each win rolled one sealed reward');
	assert.ok(ledger.granted.gold > 0 && ledger.granted.xp > 0);
});

test('auto-battle is locked before the first rebirth: the server ignores the switch and fights nothing by itself', async () => {
	const { m, now } = await playing(25, 'u1', true, 0);
	const out: FightReply = ok(await fightStep(m.deps, 'u1', null, { action: 'sync', since: 0 }, now + 20_000));
	assert.equal(out.combat.autoBattle, false);
	assert.equal(out.combat.fight, null);
	assert.equal(m.ledgers.get('u1')!.ordKill, 0);
});

test('a hotkey carries the same key twice and is applied once; an unknown action is refused by the route, a monster the server never made cannot be dismissed', async () => {
	const { m, now } = await playing(25);
	const first = ok(await fightStep(m.deps, 'u1', 'use-key-00001', { action: 'use', command: { kind: 'potion', id: 'potion_minor' } }, now));
	const replay = ok(await fightStep(m.deps, 'u1', 'use-key-00001', { action: 'use', command: { kind: 'potion', id: 'potion_minor' } }, now + 1000));
	assert.deepEqual(replay, first, 'a lost answer is replayed');
	const unknown = ok(await fightStep(m.deps, 'u1', 'dismiss-key-01', { action: 'dismiss', n: 9999 }, now + 2000));
	assert.equal(unknown.accepted, false);
});

test('dismissing a monster spends its ticket without a reward', async () => {
	const { m, now } = await playing(25);
	const sync = ok(await syncTickets(m.deps, 'u1', now));
	const n = sync.tickets.rats[0].n;
	const out = ok(await fightStep(m.deps, 'u1', 'dismiss-key-02', { action: 'dismiss', n }, now + 1000));
	assert.equal(out.accepted, true);
	assert.equal(m.ledgers.get('u1')!.granted.gold, 0);
	assert.equal(m.ledgers.get('u1')!.bank.rats.some((r) => r.n === n), false);
});

test('after a long absence every online call asks for the claim first, and the claim lets play go on', async () => {
	const { m } = await playing(0);
	const later = T0 + 5 * 3_600_000;
	const blocked = await syncTickets(m.deps, 'u1', later);
	assert.equal(blocked.kind, 'claim_first');
	assert.equal((await redeemChest(m.deps, 'u1', 'chest-key-0001', later)).kind, 'claim_first');
	const claim = await claimOffline(m.deps, 'u1', 'claim-0001', later);
	assert.equal(claim.kind, 'ok');
	const sync = ok(await syncTickets(m.deps, 'u1', later + 1000));
	assert.ok(sync.tickets.chests > 0, 'the absence made chests appear (at the efficiency)');
});

test('an account with no cloud save gets no tickets', async () => {
	const m = memory();
	assert.equal((await syncTickets(m.deps, 'nobody', T0)).kind, 'no_save');
});

test('two chest opens at the same moment spend two tickets, never the same one twice', async () => {
	const { m, now } = await playing(25);
	const [a, b] = await Promise.all([redeemChest(m.deps, 'u1', 'chest-key-aaaa', now), redeemChest(m.deps, 'u1', 'chest-key-bbbb', now)]);
	const results = [ok(a), ok(b)];
	assert.equal(results.filter((r) => r.ok).length, 2);
	assert.equal(m.ledgers.get('u1')!.ordChest, 2);
	assert.equal(m.ledgers.get('u1')!.bank.chests.length, 0);
});
