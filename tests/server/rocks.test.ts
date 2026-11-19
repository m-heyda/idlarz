import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { fightStep, hitRock, syncTickets, type Online } from '../../src/lib/offline/online';
import { ROCK, ROCK_TIERS } from '../../src/config/rocks';
import type { PublicRock } from '../../src/lib/offline/types';

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
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
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
const SEC = 1000;

const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

const playing = async (minutes: number, id = 'u1', miningPower = false) => {
	const m = memory();
	const save = game();
	await acceptSave(m.saves, id, 'Zoë', encodeSave(save), 0, T0, false, m.ledgerRepo);
	// the server reads the shop from its stored save (a rebirth is a server step, so the test puts the owned upgrade there)
	if (miningPower) (await m.saves.load(id))!.core.prestige = { rebirths: 1, legacyPoints: 0, legacyEarned: 50, upgrades: { miningpower: 1 }, shopVersion: 2 };
	ok(await fightStep(m.deps, id, null, { action: 'auto', autoBattle: false }, T0 + 1000));
	for (let t = 10; t < minutes; t += 10) ok(await syncTickets(m.deps, id, T0 + t * MIN));
	return { m, now: T0 + minutes * MIN };
};

/** The first rock on the map made a Legendary one (1,000 clicks), so a few batches never break it whatever the roll gave */
const legendary = async (m: ReturnType<typeof memory>, now: number): Promise<PublicRock> => {
	const [rock] = await rocksOf(m, now);
	const stored = m.ledgers.get('u1')!.bank.rocks!.find((r) => r.n === rock.n)!;
	stored.tier = 'legendary';
	return { ...rock, tier: 'legendary', need: ROCK_TIERS.legendary.clicks };
};

const rocksOf = async (m: ReturnType<typeof memory>, now: number): Promise<PublicRock[]> => ok(await syncTickets(m.deps, 'u1', now)).tickets.rocks ?? [];

test('rocks appear on their own clock, each on a tile of its own', async () => {
	const { m, now } = await playing(125);
	const sync = ok(await syncTickets(m.deps, 'u1', now));
	const rocks = sync.tickets.rocks ?? [];
	assert.ok(rocks.length === 1, `a rock every 15 minutes, room for one per 100 tiles (60 owned, so one): ${rocks.length} after 125 minutes`);
	const tiles = new Set(rocks.map((r) => `${r.x},${r.y}`));
	assert.equal(tiles.size, rocks.length, 'no two rocks on one tile');
	for (const rock of rocks) {
		assert.ok(!sync.tickets.chests.some((c) => c.x === rock.x && c.y === rock.y), 'not on a chest');
		assert.ok(!sync.tickets.monsters.some((mon) => mon.x === rock.x && mon.y === rock.y), 'not on a monster');
		assert.equal(rock.need, ROCK_TIERS[rock.tier].clicks);
		assert.equal(rock.hits, 0);
	}
	const again = ok(await syncTickets(m.deps, 'u1', now + 1000));
	assert.deepEqual(again.tickets.rocks, rocks, 'a poll changes nothing: the rocks stay where they were put');
});

test('a click on a tile with no rock does nothing', async () => {
	const { m, now } = await playing(125);
	const reply = ok(await hitRock(m.deps, 'u1', 'rock-key-0001', { x: 999, y: 999 }, 10, now + SEC));
	assert.equal(reply.ok, false);
	assert.equal(m.ledgers.get('u1')!.granted.stone, 0);
});

test('clicks are let in at a person’s pace: a burst, then 24 a second', async () => {
	const { m, now } = await playing(125);
	const rock = await legendary(m, now);
	assert.ok(rock.need > ROCK.burst + ROCK.maxCps, 'a rock that takes more clicks than the three batches');
	const first = ok(await hitRock(m.deps, 'u1', 'rock-key-0010', rock, 200, now + SEC));
	assert.ok(first.ok && !first.broken);
	if (first.ok) assert.equal(first.accepted, ROCK.burst, 'a fresh rock takes the burst and no more');
	const same = ok(await hitRock(m.deps, 'u1', 'rock-key-0011', rock, 200, now + SEC));
	if (same.ok) assert.equal(same.accepted, 0, 'the same instant: nothing more');
	const later = ok(await hitRock(m.deps, 'u1', 'rock-key-0012', rock, 200, now + 2 * SEC));
	if (later.ok) assert.equal(later.accepted, ROCK.maxCps, 'a second later: 24 more');
	const stored = m.ledgers.get('u1')!.bank.rocks!.find((r) => r.n === rock.n)!;
	assert.equal(stored.hits, ROCK.burst + ROCK.maxCps, 'the progress is the server’s and survives a reload');
});

test('a rock breaks after the clicks its tier needs, pays once from a secret, and a replayed key pays nothing more', async () => {
	const { m, now } = await playing(125);
	const rocks = await rocksOf(m, now);
	const rock = [...rocks].sort((a, b) => a.need - b.need)[0];
	let t = now + SEC;
	let last = ok(await hitRock(m.deps, 'u1', 'rock-key-0100', rock, ROCK.maxBatch, t));
	for (let i = 1; i < 60 && last.ok && !last.broken; i++) {
		t += 2 * SEC;
		last = ok(await hitRock(m.deps, 'u1', `rock-key-${100 + i}`, rock, ROCK.maxBatch, t));
	}
	assert.ok(last.ok && last.broken, 'broken');
	if (!(last.ok && last.broken)) return;
	assert.ok(last.loot.stone > 0 && last.loot.coal > 0, 'stone and coal always drop');
	const ledger = m.ledgers.get('u1')!;
	assert.equal(ledger.bank.rocksBroken, 1);
	assert.ok(!ledger.bank.rocks!.some((r) => r.n === rock.n), 'the ticket is spent');
	assert.equal(ledger.granted.stone, last.loot.stone, 'what the rock paid is in the ledger, so the next save passes the checks');
	assert.equal(ledger.granted.coal, last.loot.coal);
	assert.equal(ledger.stats.rocks, 1, 'counted for the deeds');
	assert.equal(ledger.stats.rocksByTier[rock.tier], 1);
	const keyOfLast = `rock-key-${100 + Math.floor((t - now - SEC) / (2 * SEC))}`;
	const replay = ok(await hitRock(m.deps, 'u1', keyOfLast, rock, ROCK.maxBatch, t + SEC));
	assert.deepEqual(replay, last, 'a lost answer is replayed, never rolled or paid again');
	assert.equal(m.ledgers.get('u1')!.granted.stone, last.loot.stone);
	const gone = ok(await hitRock(m.deps, 'u1', 'rock-key-9999', rock, 10, t + 2 * SEC));
	assert.equal(gone.ok, false, 'the broken rock is gone');
});

test('what a rock drops is sealed per account: another player’s rocks roll other numbers', async () => {
	const a = await playing(25, 'u1');
	const b = await playing(25, 'u2');
	const loot = async (m: ReturnType<typeof memory>, id: string, now: number) => {
		const list = ok(await syncTickets(m.deps, id, now)).tickets.rocks ?? [];
		const rock = list.find((r) => r.tier === 'common') ?? list[0];
		let t = now + SEC;
		let last = ok(await hitRock(m.deps, id, 'seal-key-0000', rock, ROCK.maxBatch, t));
		for (let i = 1; i < 200 && last.ok && !last.broken; i++) {
			t += 2 * SEC;
			last = ok(await hitRock(m.deps, id, `seal-key-${1000 + i}`, rock, ROCK.maxBatch, t));
		}
		return last.ok && last.broken ? last.loot : null;
	};
	const first = await loot(a.m, 'u1', a.now);
	const second = await loot(b.m, 'u2', b.now);
	assert.ok(first && second);
	assert.ok(first.stone !== second.stone || first.coal !== second.coal || JSON.stringify(first.stash) !== JSON.stringify(second.stash), 'not the same roll');
});

test('Mining Power from the Ember shop makes every click that gets in count as 2 hits, with the same click-rate cap', async () => {
	const plain = await playing(125);
	const strong = await playing(125, 'u1', true);
	const a = await legendary(plain.m, plain.now);
	const b = await legendary(strong.m, strong.now);
	const slow = ok(await hitRock(plain.m.deps, 'u1', 'rock-key-0201', a, 200, plain.now + SEC));
	const fast = ok(await hitRock(strong.m.deps, 'u1', 'rock-key-0202', b, 200, strong.now + SEC));
	assert.ok(slow.ok && fast.ok);
	if (!(slow.ok && fast.ok)) return;
	assert.equal(slow.accepted, ROCK.burst);
	assert.equal(fast.accepted, ROCK.burst, 'the click-rate cap counts real clicks');
	assert.equal(slow.hits, ROCK.burst);
	assert.equal(fast.hits, ROCK.burst * 2, 'each accepted click counts twice');
});
