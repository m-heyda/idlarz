import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { STARTING_GEMS } from '../src/config/gameConfig';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { encodeSave } from '../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import { summarize } from '../src/lib/cloudSave/summary';
import type { Ledger, LedgerRepo } from '../src/lib/offline/ledger';
import { seedLedger } from '../src/lib/offline/ledger';
import { ownedRowMajor } from '../src/utils/world';
import { claimOffline, type ClaimResult, type ServiceDeps } from '../src/lib/offline/service';

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
		load: async (id) => {
			const row = ledgers.get(id);
			return row ? structuredClone(row) : null;
		},
		commit: async (id, expectedVer, ledger) => {
			const current = ledgers.get(id);
			if (expectedVer === 0 ? !!current : current?.ver !== expectedVer) return false;
			ledgers.set(id, structuredClone(ledger));
			return true;
		},
	};
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, rows, ledgers, deps };
};

const game = (patch: Partial<PersistedGame> = {}): PersistedGame => {
	api().resetGame();
	growTo(30);
	api().tick(1000); // a level reached by buying land only hands out its stat points on the next tick
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 }, ...patch } as never);
	return structuredClone(pickPersisted(api()));
};
const T0 = 1_800_000_000_000;
const HOUR = 3_600_000;
const save = (m: ReturnType<typeof memory>, id: string, state: PersistedGame, baseRev: number, at: number) =>
	acceptSave(m.saves, id, 'Zoë', encodeSave(state), baseRev, at, false, m.ledgerRepo);

const claim = async (m: ReturnType<typeof memory>, id: string, key: string, at: number): Promise<ClaimResult> => {
	const out = await claimOffline(m.deps, id, key, at);
	assert.equal(out.kind, 'ok');
	return (out as { kind: 'ok'; result: ClaimResult }).result;
};

// ---------------------------------------------------------------------------------------------------- the claim

test('three hours away pay half the income of those hours, and chests and rats come with it', async () => {
	const m = memory();
	const state = game();
	await save(m, 'u1', state, 0, T0);
	const rates = summarize(state).rates;
	const result = await claim(m, 'u1', 'claim-0001', T0 + 3 * HOUR);
	assert.equal(result.reason, 'paid');
	assert.equal(result.grant?.elapsedSec, 3 * 3600);
	assert.equal(result.grant?.resources.gold, Math.floor(rates.gold * 3 * 3600 * 0.5));
	assert.ok(result.tickets.chests > 0, 'chests appeared while away');
	assert.ok(result.tickets.rats.length > 0, 'rats appeared while away');
	assert.ok(result.tickets.rats.every((rat) => rat.at > T0 / 1000 && rat.at <= (T0 + 3 * HOUR) / 1000), 'stamped inside the absence, so they have grown by the time you are back');
});

test('the same claim repeated returns the same answer and pays once; a new claim right after pays nothing', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	const first = await claim(m, 'u1', 'claim-0001', T0 + 2 * HOUR);
	const again = await claim(m, 'u1', 'claim-0001', T0 + 2 * HOUR + 5000);
	assert.deepEqual(again, first, 'a lost response is replayed');
	const next = await claim(m, 'u1', 'claim-0002', T0 + 2 * HOUR + 10_000);
	assert.equal(next.grant, null);
	assert.equal(next.reason, 'short');
	assert.equal(m.ledgers.get('u1')?.granted.gold, first.grant?.resources.gold, 'the ledger holds one payment');
});

test('two claims at the same moment cannot both be paid', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	const [a, b] = await Promise.all([claimOffline(m.deps, 'u1', 'claim-aaaa', T0 + 4 * HOUR), claimOffline(m.deps, 'u1', 'claim-bbbb', T0 + 4 * HOUR)]);
	const paid = [a, b].filter((out) => out.kind === 'ok' && out.result.grant).length;
	assert.equal(paid, 1);
});

test('the paid stretch is capped at 8 hours, however long the absence', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	const result = await claim(m, 'u1', 'claim-0001', T0 + 5 * 24 * HOUR);
	assert.equal(result.grant?.elapsedSec, 8 * 3600);
	assert.equal(result.grant?.capped, true);
	assert.equal(result.grant?.gapSec, 5 * 24 * 3600);
});

test('a short absence pays nothing', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	const result = await claim(m, 'u1', 'claim-0001', T0 + 120_000);
	assert.equal(result.grant, null);
	assert.equal(result.reason, 'short');
});

test('a client clock cannot lengthen an absence: the gap is the server clock since the last accepted save', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	// the server is asked at T0 + 10 min whatever the browser believes
	const result = await claim(m, 'u1', 'claim-0001', T0 + 10 * 60_000);
	assert.equal(result.grant?.elapsedSec, 600);
});

test('an account with no cloud save has nothing to claim', async () => {
	const m = memory();
	assert.equal((await claimOffline(m.deps, 'nobody', 'claim-0001', T0)).kind, 'no_save');
});

test('an account under review (a poison flag on its latest save) is not paid', async () => {
	const m = memory();
	const state = game();
	// a first save with far more gold than the income could ever explain is flagged baseline_rich
	const rich = { ...state, resources: { ...state.resources, gold: 1e15 } };
	const out = await save(m, 'u1', rich, 0, T0);
	assert.ok(out.kind === 'ok' && out.flags.includes('baseline_rich'));
	const result = await claim(m, 'u1', 'claim-0001', T0 + 3 * HOUR);
	assert.equal(result.grant, null);
	assert.equal(result.reason, 'flagged');
});

test('a claim made before the ledger exists seeds it from the save: standing monsters become tickets', async () => {
	const m = memory();
	const state = game();
	const spots = ownedRowMajor(state.tiles).filter(({ tile }) => tile.biome !== 'castle' && tile.biome !== 'lake' && !tile.building);
	state.monsters = [
		{ id: 1, type: 'rat', level: 2, spawnLevel: 2, x: spots[0].x, y: spots[0].y, ageSec: 100 },
		{ id: 2, type: 'rat', level: 3, spawnLevel: 3, x: spots[1].x, y: spots[1].y, ageSec: 50 },
	];
	state.nextMonsterId = 3;
	const out = await save(m, 'u1', state, 0, T0);
	assert.equal(out.kind, 'ok');
	const ledger = m.ledgers.get('u1')!;
	assert.equal(ledger.bank.rats.length, 2);
	assert.deepEqual(ledger.bank.rats.map((r) => r.n), [1, 2]);
	assert.equal(ledger.gems, STARTING_GEMS);
	// the seed alone behaves the same (a save that predates the ledger)
	const stored = (await m.saves.load('u1'))!;
	assert.equal(seedLedger(stored, T0).bank.rats.length, 2);
});

// ---------------------------------------------------------------------------------------------------- the verifier knows the grants

test('what the server paid is allowed in the next save; the same gold without a payment is flagged', async () => {
	const m = memory();
	const state = game();
	await save(m, 'u1', state, 0, T0);
	const result = await claim(m, 'u1', 'claim-0001', T0 + 8 * HOUR);
	const paid = result.grant!.resources;

	const honest = { ...state, playSeconds: state.playSeconds + 15, resources: { ...state.resources, gold: state.resources.gold + paid.gold, xp: state.resources.xp + paid.xp } };
	const ok = await save(m, 'u1', honest, 1, T0 + 8 * HOUR + 20_000);
	assert.ok(ok.kind === 'ok');
	assert.equal(ok.flags.includes('gold_jump'), false, 'the grant explains the jump');
	assert.equal(ok.flags.includes('networth_exceeds'), false);

	// the account sees the same total only once: a second jump of that size is not explained any more
	const cheat = { ...honest, playSeconds: honest.playSeconds + 15, resources: { ...honest.resources, gold: honest.resources.gold + paid.gold + 5_000_000 } };
	const flagged = await save(m, 'u1', cheat, 2, T0 + 8 * HOUR + 40_000);
	assert.ok(flagged.kind === 'ok' && flagged.flags.includes('gold_jump'));
});

test('gold nobody paid for is flagged even on a fresh ledger', async () => {
	const m = memory();
	const state = game();
	await save(m, 'u1', state, 0, T0);
	const cheat = { ...state, playSeconds: state.playSeconds + 15, resources: { ...state.resources, gold: state.resources.gold + 50_000_000 } };
	const out = await save(m, 'u1', cheat, 1, T0 + 20_000);
	assert.ok(out.kind === 'ok' && out.flags.includes('gold_jump'));
});

// ---------------------------------------------------------------------------------------------------- gems are the server's

test('gems: a save can never raise the balance; the server keeps and returns its own number', async () => {
	const m = memory();
	const state = game();
	const first = await save(m, 'u1', state, 0, T0);
	assert.ok(first.kind === 'ok' && first.gems === STARTING_GEMS);

	const forged = { ...state, playSeconds: state.playSeconds + 15, gems: 999_999 };
	const out = await save(m, 'u1', forged, 1, T0 + 20_000);
	assert.ok(out.kind === 'ok');
	assert.equal(out.gems, STARTING_GEMS);
	assert.ok(out.flags.includes('gems_increase'));
	assert.equal(m.rows.get('u1')?.summary.gems, STARTING_GEMS, 'the stored summary holds the server balance');
	assert.equal(m.rows.get('u1')?.core.gems, STARTING_GEMS, 'and so does the stored game');
});

test('gems: a new account cannot start above the starting gift', async () => {
	const m = memory();
	const out = await save(m, 'u1', { ...game(), gems: 500_000_000 }, 0, T0);
	assert.ok(out.kind === 'ok' && out.gems === STARTING_GEMS);
	assert.equal(m.ledgers.get('u1')?.gems, STARTING_GEMS);
});

test('gems the server granted are not flagged when the next save carries them', async () => {
	const m = memory();
	const state = game();
	await save(m, 'u1', state, 0, T0);
	const ledger = m.ledgers.get('u1')!;
	m.ledgers.set('u1', { ...ledger, ver: ledger.ver + 1, gems: ledger.gems + 37 }); // what a chest would have added
	const out = await save(m, 'u1', { ...state, playSeconds: state.playSeconds + 15, gems: STARTING_GEMS + 37 }, 1, T0 + 20_000);
	assert.ok(out.kind === 'ok');
	assert.equal(out.flags.includes('gems_increase'), false);
	assert.equal(out.gems, STARTING_GEMS + 37);
});

// ---------------------------------------------------------------------------------------------------- runs

test('starting a new game starts a new run: tickets are cleared and rolls restart from the first ordinal in a new run id', async () => {
	const m = memory();
	const old = game();
	await save(m, 'u1', { ...old, playSeconds: 50_000 }, 0, T0);
	await claim(m, 'u1', 'claim-0001', T0 + 2 * HOUR); // fills some tickets
	assert.ok(m.ledgers.get('u1')!.bank.chests.length > 0);
	const before = m.ledgers.get('u1')!;
	await save(m, 'u1', { ...old, playSeconds: 100 }, 1, T0 + 2 * HOUR + 60_000); // time went backwards: a new game
	const after = m.ledgers.get('u1')!;
	assert.equal(after.runId, before.runId + 1);
	assert.equal(after.bank.chests.length, 0);
	assert.equal(after.ordChest, 0);
});

test('a ledger that cannot be read never blocks a save', async () => {
	const m = memory();
	const broken: LedgerRepo = {
		load: async () => {
			throw new Error('table missing');
		},
		commit: async () => {
			throw new Error('table missing');
		},
	};
	const out = await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(game()), 0, T0, false, broken);
	assert.equal(out.kind, 'ok');
	assert.equal(out.kind === 'ok' ? out.gems : -1, undefined);
});
