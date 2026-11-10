import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { STARTING_GEMS } from '../../src/config/economy';
import { calculateLevel, totalStatPoints } from '../../src/utils/game/character';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import { summarize } from '../../src/lib/cloudSave/summary';
import type { LedgerRepo } from '../../src/lib/offline/ledger';
import { seedLedger } from '../../src/lib/offline/ledger';
import { ensureSeasonReset } from '../../src/lib/offline/season';
import { fitInventory, inventoryFromCore, rebirthInventory, stampInventory } from '../../src/lib/offline/inventory';
import { limitOf } from '../../src/lib/limits';
import { starterBag } from '../../src/lib/inventory';
import { claimOffline, startNewGame, type ClaimResult, type ServiceDeps } from '../../src/lib/offline/service';
import { normalsOf } from '@/lib/offline/tickets';
import { startNewChapter, EARLY_TESTER, type ChapterRepo } from '../../src/lib/offline/chapter';
import { epochFromHeader, isStaleEpoch, needsResetFor } from '../../src/config/epoch';
import type { PlayerClassId } from '../../src/config/playerClasses';

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const archives: StoredSave[] = [];
	const control = { failArchive: false };
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
		pinChapter: async (_id, save) => {
			if (control.failArchive) throw new Error('archive failed');
			archives.push(structuredClone(save));
		},
		remove: async (id) => {
			rows.delete(id);
			worlds.delete(id);
			stats.delete(id);
		},
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgerRepo, rows, ledgers, deps, archives, control };
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
	assert.ok(result.tickets.chests.length > 0, 'chests appeared while away (and the server gave them a tile)');
	assert.ok(result.tickets.monsters.length > 0, 'rats appeared while away');
	assert.ok(
		result.tickets.monsters.every((rat) => rat.at > T0 / 1000 && rat.at <= (T0 + 3 * HOUR) / 1000),
		'stamped inside the absence, so they have grown by the time you are back',
	);
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

test('a claim made before the ledger exists seeds it from the save: the gems start at the gift, and a save from before server-placed monsters brings its rats as unplaced tickets', async () => {
	const m = memory();
	const state = game();
	const out = await save(m, 'u1', state, 0, T0);
	assert.equal(out.kind, 'ok');
	const ledger = m.ledgers.get('u1')!;
	assert.equal(ledger.gems, STARTING_GEMS);
	assert.equal(ledger.combat, null, 'combat is seeded by the first fight request, not here');
	// a stored save written before monsters moved to the server still lists them: they become tickets with no tile yet (the server places them)
	const stored = (await m.saves.load('u1'))!;
	const legacy = {
		...stored,
		core: {
			...stored.core,
			monsters: [
				{ id: 1, type: 'thistleBoar', ageSec: 100 },
				{ id: 2, type: 'thistleBoar', ageSec: 50 },
			],
			nextMonsterId: 3,
		},
	};
	const seeded = seedLedger(legacy, T0);
	assert.equal(normalsOf(seeded.bank).length, 2);
	assert.deepEqual(
		normalsOf(seeded.bank).map((r) => r.n),
		[1, 2],
	);
	assert.ok(
		normalsOf(seeded.bank).every((r) => r.x === undefined && r.spawnLevel === undefined),
		'not placed yet',
	);
});

// ---------------------------------------------------------------------------------------------------- the verifier knows the grants

test('what the server paid is allowed in the next save; the same gold without a payment is flagged', async () => {
	const m = memory();
	const state = game();
	await save(m, 'u1', state, 0, T0);
	const result = await claim(m, 'u1', 'claim-0001', T0 + 8 * HOUR);
	const paid = result.grant!.resources;

	const xp = state.resources.xp + paid.xp;
	// the levels the paid XP gives come with their attribute points (the game's tick or the offline apply credits them)
	const points = totalStatPoints(calculateLevel(xp).level) - totalStatPoints(calculateLevel(state.resources.xp).level);
	const honest = {
		...state,
		playSeconds: state.playSeconds + 15,
		characterStats: { ...state.characterStats, availablePoints: state.characterStats.availablePoints + points },
		resources: { ...state.resources, gold: state.resources.gold + paid.gold, xp },
	};
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

// ---------------------------------------------------------------------------------------------------- a New Game

test('a New Game on the server leaves nothing to claim, keeps the gems, and the first save of the new game re-anchors the timers', async () => {
	const m = memory();
	await save(m, 'u1', game(), 0, T0);
	m.ledgers.set('u1', { ...m.ledgers.get('u1')!, gems: 1234 });
	const oldRun = m.ledgers.get('u1')!.runId;

	await startNewGame(m.deps, 'u1', T0 + 3 * HOUR);
	assert.equal(m.rows.has('u1'), false, 'the old save is gone');
	const ledger = m.ledgers.get('u1')!;
	assert.equal(ledger.gems, 1234);
	assert.equal(ledger.runId, oldRun + 1);
	assert.equal(ledger.inv, null);
	assert.equal(ledger.combat, null);
	assert.equal(ledger.anchorAt, T0 + 3 * HOUR);
	assert.equal(
		Object.values(ledger.granted).every((v) => v === 0),
		true,
	);
	assert.equal((await claimOffline(m.deps, 'u1', 'claim-0001', T0 + 3 * HOUR + 5000)).kind, 'no_save', 'no absence is paid for a game that no longer exists');

	// the player comes back much later: the hours since the reset are neither played time nor an absence
	api().resetGame();
	const fresh = structuredClone(pickPersisted(api()));
	const back = T0 + 20 * HOUR;
	const outcome = await save(m, 'u1', fresh, 0, back);
	assert.equal(outcome.kind, 'ok');
	assert.equal(m.ledgers.get('u1')!.anchorAt, back);
	assert.equal(m.ledgers.get('u1')!.bank.accAt, back / 1000);
	const paid = await claim(m, 'u1', 'claim-0002', back + 20_000);
	assert.equal(paid.grant, null, 'nothing to pay a few seconds after the first save');
	assert.equal(calculateLevel(m.rows.get('u1')!.summary.xp).level, 1);
});

// ---------------------------------------------------------------------------------------------------- the server's Pack Rat level, the season marker

test('the server keeps the Pack Rat level with the bag: a lower level in an upload cannot shrink it, a rebirth keeps it', async () => {
	const withRat = game({ merchantUpgrades: { packrat: 2 } } as never);
	const inv = inventoryFromCore(withRat as unknown as Record<string, unknown>);
	assert.equal(inv.packrat, 2);
	assert.equal(inv.bag.length, limitOf('bagSize', { merchantUpgrades: { packrat: 2 } }));

	// an upload that says level 0 (a stale or fresh browser) is stamped back to the server's level, with the server's bag
	const stale = { ...withRat, merchantUpgrades: {}, bag: starterBag() };
	const stamped = stampInventory(stale, inv);
	assert.equal((stamped.merchantUpgrades as Record<string, number>).packrat, 2);
	assert.equal(stamped.bag.length, inv.bag.length);

	// a higher level in a save raises the server's, never the other way round
	assert.equal(fitInventory(inv, { merchantUpgrades: { packrat: 3 } }).packrat, 3);
	assert.equal(fitInventory(inv, { merchantUpgrades: {} }).packrat, 2);
	assert.equal(rebirthInventory(inv, {}).packrat, 2);
	assert.equal(rebirthInventory(inv, {}).bag.length, inv.bag.length);
});

test('a player whose game has not been through the last season reset is reset once, at login; a game made after it is left alone', async () => {
	const m = memory();
	await save(m, 'old', game(), 0, T0);
	await save(m, 'newer', game(), 0, T0);
	m.ledgers.set('old', { ...m.ledgers.get('old')!, resetAt: null, gems: 777 });
	m.ledgers.set('newer', { ...m.ledgers.get('newer')!, resetAt: T0 + 2 * HOUR });
	const marker = T0 + HOUR;

	assert.deepEqual(await ensureSeasonReset(m.deps, null, 'old', T0 + 3 * HOUR), { lastReset: null, reset: false }, 'no reset ever happened');
	assert.equal((await ensureSeasonReset(m.deps, marker, 'newer', T0 + 3 * HOUR)).reset, false, 'created after the marker');
	assert.equal(m.rows.has('newer'), true);

	assert.equal((await ensureSeasonReset(m.deps, marker, 'old', T0 + 3 * HOUR)).reset, true);
	assert.equal(m.rows.has('old'), false, 'the old game is gone');
	assert.equal(m.ledgers.get('old')!.gems, 777, 'gems stay');
	assert.equal(m.ledgers.get('old')!.resetAt, T0 + 3 * HOUR);
	assert.equal((await ensureSeasonReset(m.deps, marker, 'old', T0 + 4 * HOUR)).reset, false, 'only once');
});

test('lifetime counters (IDL-69): the first save sets the baselines, a later one counts the income earned while playing, at most every ten minutes', async () => {
	const m = memory();
	const first = game();
	assert.equal((await save(m, 'u1', first, 0, T0)).kind, 'ok');
	const baseline = m.ledgers.get('u1')!.stats;
	assert.deepEqual([baseline.at, baseline.playAt], [T0, 1000]);
	assert.deepEqual(baseline.income, {}, 'nothing is counted from a first save');
	// five minutes later: not due yet, the ledger is not written for the counters
	const soon = await save(m, 'u1', { ...first, playSeconds: 1300 }, 1, T0 + 5 * 60_000);
	assert.equal(soon.kind, 'ok');
	assert.equal(m.ledgers.get('u1')!.stats.at, T0, 'under ten minutes since the last count: left alone');
	// twenty minutes after the first save: 900 more play seconds are counted at the rates of the previous save
	const later = await save(m, 'u1', { ...first, playSeconds: 1900 }, 2, T0 + 20 * 60_000);
	assert.equal(later.kind, 'ok');
	const counted = m.ledgers.get('u1')!.stats;
	assert.equal(counted.at, T0 + 20 * 60_000);
	assert.ok((counted.income.gold ?? 0) > 0, 'income while playing was counted');
});

// ---- IDL-76: the new chapter reset -------------------------------------------------------------------------------------------------------------

const chapterRepo = (opts: { epoch?: number | null; taken?: boolean } = {}) => {
	const state = { epoch: opts.epoch === undefined ? null : opts.epoch, name: 'Zoë', playerClass: 'warrior' as PlayerClassId, granted: [] as string[] };
	const repo: ChapterRepo = {
		loadProfile: async () => ({ epoch: state.epoch }),
		setIdentity: async (_id, name, playerClass) => {
			if (opts.taken) return 'name_taken';
			state.name = name;
			state.playerClass = playerClass;
			return 'ok';
		},
		setEpoch: async (_id, epoch) => {
			if (state.epoch === null || state.epoch < epoch) state.epoch = epoch;
		},
		grantAchievement: async (_id, achievementId) => {
			if (!state.granted.includes(achievementId)) state.granted.push(achievementId);
		},
	};
	return { repo, state };
};
const INPUT = { characterName: 'Nova', playerClass: 'mage' as PlayerClassId };

test('epoch helpers: a profile with no epoch is on the baseline, and only an older browser is stale', () => {
	assert.equal(needsResetFor(null, 1), false, 'dark: the server is on the baseline');
	assert.equal(needsResetFor(null, 2), true);
	assert.equal(needsResetFor(1, 2), true);
	assert.equal(needsResetFor(2, 2), false);
	assert.equal(isStaleEpoch(null, 1), false);
	assert.equal(isStaleEpoch(null, 2), true, 'a client that sends no epoch counts as the baseline');
	assert.equal(isStaleEpoch(1, 2), true);
	assert.equal(isStaleEpoch(2, 2), false);
	assert.deepEqual(
		[epochFromHeader(null), epochFromHeader('2'), epochFromHeader('0'), epochFromHeader('x'), epochFromHeader('1.5')],
		[null, 2, null, null, null],
	);
});

test('while the server is on the baseline epoch the reset does nothing at all', async () => {
	const m = memory();
	assert.equal((await save(m, 'u1', game(), 0, T0)).kind, 'ok');
	const { repo, state } = chapterRepo();
	const out = await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + HOUR, 1);
	assert.deepEqual(out, { kind: 'ok', already: true });
	assert.ok(m.rows.has('u1'), 'the save is untouched');
	assert.equal(m.archives.length, 0);
	assert.deepEqual([state.name, state.playerClass, state.epoch], ['Zoë', 'warrior', null]);
});

test('the flip: the old game is archived for good, then replaced; gems, account and the early-tester mark are kept; a repeat changes nothing', async () => {
	const m = memory();
	assert.equal((await save(m, 'u1', game(), 0, T0)).kind, 'ok');
	const before = m.ledgers.get('u1')!;
	m.ledgers.set('u1', { ...before, gems: 77, stats: { ...before.stats, chests: 5 } });
	const { repo, state } = chapterRepo({ epoch: null });
	const out = await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + HOUR, 2);
	assert.deepEqual(out, { kind: 'ok', already: false });
	assert.equal(m.archives.length, 1, 'the old save went into the archive first');
	assert.ok(m.archives[0].world, 'the archive holds the map too');
	assert.equal(m.rows.has('u1'), false, 'the save is gone');
	const after = m.ledgers.get('u1')!;
	assert.equal(after.gems, 77, 'gems are kept');
	assert.equal(after.stats.chests, 0, 'the counters start again');
	assert.equal(after.runId, before.runId + 1, 'a new run: sealed rolls never repeat');
	assert.deepEqual([state.name, state.playerClass, state.epoch], ['Nova', 'mage', 2]);
	assert.deepEqual(state.granted, [EARLY_TESTER]);
	// the same request again (a second tab, a lost answer): nothing is touched
	const again = await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + 2 * HOUR, 2);
	assert.deepEqual(again, { kind: 'ok', already: true });
	assert.equal(m.archives.length, 1, 'no second archive');
	assert.equal(m.ledgers.get('u1')!.runId, after.runId, 'the ledger is not reset twice');
});

test('a name another account holds stops the reset before anything is deleted', async () => {
	const m = memory();
	assert.equal((await save(m, 'u1', game(), 0, T0)).kind, 'ok');
	const { repo, state } = chapterRepo({ epoch: null, taken: true });
	assert.deepEqual(await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + HOUR, 2), { kind: 'name_taken' });
	assert.ok(m.rows.has('u1'));
	assert.equal(m.archives.length, 0);
	assert.equal(state.epoch, null);
});

test('if the old game cannot be archived nothing is deleted and the account stays on the old epoch', async () => {
	const m = memory();
	assert.equal((await save(m, 'u1', game(), 0, T0)).kind, 'ok');
	m.control.failArchive = true;
	const { repo, state } = chapterRepo({ epoch: null });
	assert.deepEqual(await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + HOUR, 2), { kind: 'archive_failed' });
	assert.ok(m.rows.has('u1'), 'the save is still there');
	assert.equal(state.epoch, null);
	assert.deepEqual(state.granted, []);
	// the retry after the store recovers is the same request and goes through
	m.control.failArchive = false;
	assert.deepEqual(await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + 2 * HOUR, 2), { kind: 'ok', already: false });
});

test('an account with no save yet just moves to the new epoch (nothing to archive)', async () => {
	const m = memory();
	const { repo, state } = chapterRepo({ epoch: 1 });
	assert.deepEqual(await startNewChapter(m.deps, repo, 'u9', INPUT, T0, 2), { kind: 'ok', already: false });
	assert.equal(m.archives.length, 0);
	assert.equal(state.epoch, 2);
	assert.deepEqual(state.granted, [], 'only an account that predates epochs is an early tester');
});

test('a stale tab cannot bring the old game back: its upload for the deleted row is a conflict, never a new row', async () => {
	const m = memory();
	const old = game();
	assert.equal((await save(m, 'u1', old, 0, T0)).kind, 'ok');
	const { repo } = chapterRepo({ epoch: null });
	assert.equal((await startNewChapter(m.deps, repo, 'u1', INPUT, T0 + HOUR, 2)).kind, 'ok');
	const stale = await save(m, 'u1', { ...old, playSeconds: old.playSeconds + 600 }, 1, T0 + 2 * HOUR);
	assert.equal(stale.kind, 'conflict');
	assert.equal(m.rows.has('u1'), false, 'the old game did not come back');
});
