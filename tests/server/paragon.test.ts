// The paragon points (docs/plan/paragon.md) on the server: the ledger's record, /api/paragon's step, the gem shop respec, and how an accepted save works the points into what the server derives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { MIN_SAVE_INTERVAL_MS, acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { gemsStep, paragonStep, type Online } from '../../src/lib/offline/online';
import type { GemsReply, ParagonReply } from '../../src/lib/offline/gemTypes';
import { paragonSpent } from '../../src/lib/offline/paragon';
import { LEVELING } from '../../src/config/character';
import { PARAGON_CAP_POINTS } from '../../src/config/paragon';
import { cumulativeParagonXp, cumulativeXp } from '../../src/utils/game/character';
import { summarize } from '../../src/lib/cloudSave/summary';
import { STARTING_GEMS } from '../../src/config/economy';

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
let keyNo = 0;
const key = () => `paragon-test-key-${String(++keyNo).padStart(6, '0')}`;
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

/** The paragon level the stored XP is worth */
const LEVELS = 40;
const paragonXp = cumulativeXp(LEVELING.maxLevel) + cumulativeParagonXp(LEVELS) + 1;

/** A game saved once so the account has a ledger, then its stored XP raised to `LEVELS` paragon levels (the XP model would clamp an upload, so the row is written directly). */
const started = async () => {
	api().resetGame();
	growTo(60);
	const state: PersistedGame = structuredClone(pickPersisted(api()));
	const m = memory();
	await acceptSave(m.saves, ID, 'Zoë', encodeSave(state), 0, T0, false, m.ledgerRepo);
	const row = m.rows.get(ID)!;
	m.rows.set(ID, { ...row, core: { ...row.core, resources: { ...(row.core.resources as object), xp: paragonXp } } as typeof row.core });
	return { m, state };
};

const step = (m: ReturnType<typeof memory>, add: Record<string, number> | null, at: number, k: string | null = key()) =>
	paragonStep(m.deps, ID, add ? k : null, add ? { action: 'allocate', add } : { action: 'sync' }, at);

test('sync reads the record: nothing spent, one point per paragon level free', async () => {
	const { m } = await started();
	const read = ok(await step(m, null, T0 + STEP)) as ParagonReply;
	assert.equal(read.ok, true);
	assert.equal(read.level, LEVELS);
	assert.equal(read.available, LEVELS);
	assert.deepEqual(read.paragon.spent, {});
});

test('allocate puts points into upgrades and answers with the record; the ledger holds it', async () => {
	const { m } = await started();
	const reply = ok(await step(m, { damage: 5, luck: 3 }, T0 + STEP)) as ParagonReply;
	assert.equal(reply.ok, true);
	assert.deepEqual(reply.paragon.spent, { damage: 5, luck: 3 });
	assert.equal(reply.available, LEVELS - 8);
	assert.deepEqual(m.ledgers.get(ID)!.paragon?.spent, { damage: 5, luck: 3 });
});

test('more points than the paragon level earned are refused and nothing changes; so is a capped upgrade past its cap', async () => {
	const { m } = await started();
	const tooMany = ok(await step(m, { damage: LEVELS + 1 }, T0 + STEP)) as ParagonReply;
	assert.equal(tooMany.ok, false);
	assert.equal(tooMany.reason, 'no_points');
	assert.equal(paragonSpent(tooMany.paragon.spent), 0);
	const capped = ok(await step(m, { luck: PARAGON_CAP_POINTS + 1 }, T0 + STEP + 1000)) as ParagonReply;
	assert.equal(capped.reason, 'capped');
	const bad = ok(await step(m, { not_an_upgrade: 1 }, T0 + STEP + 2000)) as ParagonReply;
	assert.equal(bad.reason, 'bad_request');
});

test('a repeated key replays the answer and spends once', async () => {
	const { m } = await started();
	const k = key();
	const first = ok(await step(m, { damage: 4 }, T0 + STEP, k)) as ParagonReply;
	const again = ok(await step(m, { damage: 4 }, T0 + STEP + 1000, k)) as ParagonReply;
	assert.equal(again.paragon.spent.damage, 4);
	assert.equal(first.paragon.spent.damage, 4);
	assert.equal(m.ledgers.get(ID)!.paragon?.spent.damage, 4);
});

test('the first paragon respec is free, a second one costs 500 gems, and an empty record is refused', async () => {
	const { m } = await started();
	const info = { characterName: 'Zoe', playerClass: 'knight', nameChangedAtSec: null };
	const gems = (at: number) => gemsStep(m.deps, ID, key(), { action: 'spend', itemId: 'paragon_respec' }, at, info);
	const empty = ok(await gems(T0 + STEP)) as GemsReply;
	assert.equal(empty.reason, 'nothing_to_respec');
	ok(await step(m, { damage: 3 }, T0 + STEP + 1000));
	const free = ok(await gems(T0 + STEP + 2000)) as GemsReply;
	assert.equal(free.ok, true);
	assert.equal(free.paid, 0);
	assert.equal(free.gems, STARTING_GEMS);
	assert.deepEqual(free.paragon?.spent, {});
	assert.equal(free.freeParagonRespec, false);
	ok(await step(m, { damage: 3 }, T0 + STEP + 3000));
	const paid = ok(await gems(T0 + STEP + 4000)) as GemsReply;
	assert.equal(paid.paid, 500);
	assert.equal(paid.gems, STARTING_GEMS - 500);
});

test('the summary the server derives counts the points: Luck from the upgrade, kill rewards, and the XP the Paragon XP upgrade adds only from level 100', () => {
	api().resetGame();
	growTo(60);
	const state: PersistedGame = structuredClone(pickPersisted(api()));
	const plain = summarize(state);
	const spent = summarize({ ...state, paragonSpent: { luck: 10, killRewards: 100, income: 25, paragonXp: 100 } });
	assert.ok(Math.abs(spent.derived.luck - plain.derived.luck - 12) < 1e-6);
	assert.ok(Math.abs(spent.derived.killRewardPct - plain.derived.killRewardPct - 15) < 1e-6);
	assert.ok(spent.rates.gold > plain.rates.gold, 'the Income bucket reaches the rates');
	assert.equal(spent.xpGainPct, plain.xpGainPct, 'below level 100 the Paragon XP upgrade pays nothing');
});

test('an upload cannot claim paragon points, and a record above what the saved XP has earned goes back to unspent', async () => {
	const { m, state } = await started();
	ok(await step(m, { luck: 10 }, T0 + STEP));
	const sent = structuredClone(state) as PersistedGame & { paragonSpent?: Record<string, number> };
	sent.paragonSpent = { luck: 25 }; // a forged claim: the pipeline never reads it
	const res = await acceptSave(m.saves, ID, 'Zoë', encodeSave(sent), m.rows.get(ID)!.rev, T0 + 2 * STEP, false, m.ledgerRepo);
	assert.equal(res.kind, 'ok');
	// the upload holds a level-60 game: it has earned no paragon points, so the ledger's points go back (the same rule as the attribute points)
	assert.deepEqual(m.ledgers.get(ID)!.paragon?.spent, {});
	assert.equal(m.rows.get(ID)!.summary.derived.luck, summarize(state).derived.luck);
});

test('each claimed paragon milestone adds one bonus point to the budget (derived from the claimed ids, never stored), and an unclaimed one adds nothing', async () => {
	const { m } = await started();
	const none = ok(await step(m, null, T0 + STEP)) as ParagonReply;
	assert.equal(none.available, LEVELS);
	assert.equal(none.bonus, 0);
	const ledger = m.ledgers.get(ID)!;
	// paragon_50 is a tier but not a milestone (the milestones start at paragon 100); paragon_100 and paragon_200 are claimed
	m.ledgers.set(ID, { ...ledger, stats: { ...ledger.stats, claimed: ['paragon_50', 'paragon_100', 'paragon_200', 'paragon_300x'] } });
	const read = ok(await step(m, null, T0 + 2 * STEP)) as ParagonReply;
	assert.equal(read.bonus, 2);
	assert.equal(read.available, LEVELS + 2);
	const tooMany = ok(await step(m, { damage: LEVELS + 3 }, T0 + 3 * STEP)) as ParagonReply;
	assert.equal(tooMany.reason, 'no_points', 'one point more than the level and the bonus have earned is refused');
	const fits = ok(await step(m, { damage: LEVELS + 2 }, T0 + 4 * STEP)) as ParagonReply;
	assert.equal(fits.ok, true);
	assert.equal(fits.available, 0, 'the bonus points are spendable like the earned ones');
});

test('a claim replay pays nothing more: the bonus stays at one point per milestone', async () => {
	const { m } = await started();
	const ledger = m.ledgers.get(ID)!;
	m.ledgers.set(ID, { ...ledger, stats: { ...ledger.stats, claimed: ['paragon_100', 'paragon_100'] } });
	const read = ok(await step(m, null, T0 + STEP)) as ParagonReply;
	assert.equal(read.bonus, 1);
});
