import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { syncTickets, tutorialStep, type Online } from '../../src/lib/offline/online';
import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { TUTORIAL_PATH } from '../../src/catalog/tutorial';
import { GEMS_CAP, STARTING_GEMS } from '../../src/config/economy';
import { achievementsDue, conditionHolds, payAchievements, settleAchievements, type AchievementFacts } from '../../src/lib/offline/achievements';
import { newLedger, type Ledger } from '../../src/lib/offline/ledger';
import { emptyStats, readStats, type LifetimeStats } from '../../src/lib/offline/stats';

process.env.NEXT_PUBLIC_GUIDE = 'on'; // achievements ship dark together with the guide

const T0 = 1_800_000_000_000;
const LAST_STEP = TUTORIAL_PATH[TUTORIAL_PATH.length - 1].id;

const facts = (patch: Partial<AchievementFacts> = {}, stats: Partial<LifetimeStats> = {}): AchievementFacts => ({
	stats: { ...emptyStats(), ...stats },
	castleLevel: 1,
	rebirths: 0,
	buildings: 0,
	...patch,
});
const ids = (f: AchievementFacts) => achievementsDue(f).map((a) => a.id);

test('the catalog is the decided launch set: 12 achievements, 600 gems, 4 avatars, unique ids', () => {
	assert.equal(ACHIEVEMENTS.length, 12);
	assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 12);
	assert.equal(
		ACHIEVEMENTS.reduce((sum, a) => sum + a.rewards.gems, 0),
		600,
	);
	assert.ok(ACHIEVEMENTS.every((a) => a.rewards.gems >= 25 && a.rewards.gems <= 100));
	assert.equal(ACHIEVEMENTS.filter((a) => a.rewards.avatarId).length, 4);
	assert.equal(ACHIEVEMENTS.find((a) => a.id === 'early_tester')?.rewards.titleId, 'early-tester');
});

test('eligibility comes from the lifetime counters and the save', () => {
	assert.deepEqual(ids(facts()), [], 'a fresh player has earned nothing');
	assert.deepEqual(ids(facts({}, { tiles: 1 })), ['first_tile']);
	assert.deepEqual(ids(facts({}, { chests: 3 })), ['first_chest']);
	assert.deepEqual(ids(facts({}, { kills: { thistleBoar: 1 } })), ['first_fight']);
	assert.deepEqual(ids(facts({}, { golden: 1 })), ['golden_kill']);
	assert.deepEqual(ids(facts({}, { kills: { bossGreatAuroch: 1 }, bosses: 1 })), ['first_fight', 'boss_auroch']);
	assert.deepEqual(ids(facts({ castleLevel: 2 })), ['castle_2']);
	assert.deepEqual(ids(facts({ castleLevel: 6 })), ['castle_2', 'castle_6']);
	assert.deepEqual(ids(facts({ castleLevel: 10 })), ['castle_2', 'castle_6', 'castle_10']);
	assert.deepEqual(ids(facts({ rebirths: 1 })), ['first_rebirth']);
	assert.deepEqual(ids(facts({ buildings: 1 })), ['first_building']);
});

test('the first achievement is the end of the tutorial path: skipping or the other steps do not earn it', () => {
	const progress = (done: string[], skipped = false) => ({ done, lessons: [], skipped });
	const others = ['intro', ...TUTORIAL_PATH.slice(0, -1).map((s) => s.id)];
	assert.equal(conditionHolds({ kind: 'tutorial' }, facts({}, { tutorial: progress(others) })), false);
	assert.equal(conditionHolds({ kind: 'tutorial' }, facts({}, { tutorial: progress([], true) })), false);
	assert.deepEqual(ids(facts({}, { tutorial: progress([LAST_STEP]) })), ['tutorial']);
});

test('the early tester is never checked by the lazy evaluator', () => {
	const everything = facts(
		{ castleLevel: 99, rebirths: 9, buildings: 9 },
		{ tiles: 9, chests: 9, golden: 9, kills: { bossGreatAuroch: 1 }, tutorial: { done: [LAST_STEP], lessons: [], skipped: false } },
	);
	assert.deepEqual(
		ids(everything),
		ACHIEVEMENTS.filter((a) => a.id !== 'early_tester').map((a) => a.id),
	);
});

test('paying is idempotent: a paid id pays nothing again, an unknown id pays nothing, the cap holds', () => {
	const ledger = newLedger(T0);
	const first = payAchievements(ledger, ['first_tile', 'castle_10', 'not-an-achievement']);
	assert.deepEqual(first.unlocked, [
		{ id: 'first_tile', gems: 25 },
		{ id: 'castle_10', gems: 100 },
	]);
	assert.equal(first.ledger.gems, STARTING_GEMS + 125);
	assert.equal(first.ledger.granted.gems, 125);
	assert.deepEqual(first.ledger.stats.achievements, ['first_tile', 'castle_10']);
	const again = payAchievements(first.ledger, ['first_tile', 'castle_10', 'first_tile']);
	assert.deepEqual(again.unlocked, []);
	assert.equal(again.ledger, first.ledger, 'nothing to pay returns the same ledger');
	const rich: Ledger = { ...ledger, gems: GEMS_CAP - 10 };
	const capped = payAchievements(rich, ['castle_10']);
	assert.equal(capped.ledger.gems, GEMS_CAP);
	assert.equal(capped.ledger.granted.gems, 10, 'only what was really added is recorded');
});

test('settle pays what became due once, and an earned achievement stays earned when the numbers fall back', () => {
	const summary = { castleLevel: 6, rebirths: 0 } as never;
	const ledger: Ledger = { ...newLedger(T0), stats: { ...emptyStats(), chests: 1 } };
	const first = settleAchievements(ledger, summary);
	assert.deepEqual(
		first.unlocked.map((u) => u.id),
		['first_chest', 'castle_2', 'castle_6'],
	);
	assert.equal(first.ledger.gems, STARTING_GEMS + 25 + 25 + 75);
	const lower = settleAchievements(first.ledger, { castleLevel: 1, rebirths: 0 } as never);
	assert.deepEqual(lower.unlocked, []);
	assert.deepEqual(settleAchievements(first.ledger, summary).unlocked, [], 'a replay of the same state pays nothing');
});

test('the stored list reads back safely', () => {
	assert.deepEqual(readStats(null).achievements, []);
	assert.deepEqual(readStats({ achievements: ['first_tile', 'first_tile', 7, '', 'x'.repeat(41)] }).achievements, ['first_tile']);
});

// ---- through the server ----------------------------------------------------------------------------------------------------------------------------

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
	const mirrored: { userId: string; ids: string[] }[] = [];
	const deps: ServiceDeps = {
		saves,
		ledgers: ledgerRepo,
		secret: 'test-secret-test-secret',
		achievements: {
			record: async (userId, recorded) => {
				mirrored.push({ userId, ids: [...recorded] });
			},
		},
	};
	return { saves, ledgerRepo, ledgers, deps, mirrored };
};

const player = async () => {
	const m = memory();
	api().resetGame();
	growTo(8);
	store.setState({ playSeconds: 1000 } as never);
	const state: PersistedGame = structuredClone(pickPersisted(api()));
	await acceptSave(m.saves, 'u1', 'Zoe', encodeSave(state), 0, T0, false, m.ledgerRepo);
	return m;
};

const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

/** Gives the ledger counters the server would have counted itself (the test runs no fights). */
const count = (m: ReturnType<typeof memory>, patch: Partial<LifetimeStats>) => {
	const ledger = m.ledgers.get('u1')!;
	m.ledgers.set('u1', { ...ledger, stats: { ...ledger.stats, ...patch } });
};

test('a request that finds an achievement due pays it once, tells the browser, and mirrors the row', async () => {
	const m = await player();
	const seeded = ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	assert.deepEqual(seeded.achievements?.earned, [], 'the poll always lists the earned ones');
	count(m, { chests: 1, golden: 1 });
	const before = m.ledgers.get('u1')!;

	const paid = ok(await syncTickets(m.deps, 'u1', T0 + 2000));
	assert.deepEqual(paid.achievements?.fresh, [
		{ id: 'first_chest', gems: 25 },
		{ id: 'golden_kill', gems: 50 },
	]);
	assert.equal(paid.achievements?.gemsTotal, before.gems + 75);
	assert.equal(paid.gemsTotal, before.gems + 75);
	const after = m.ledgers.get('u1')!;
	assert.equal(after.gems, before.gems + 75);
	assert.equal(after.granted.gems, before.granted.gems + 75);
	assert.deepEqual(m.mirrored, [{ userId: 'u1', ids: ['first_chest', 'golden_kill'] }]);

	const again = ok(await syncTickets(m.deps, 'u1', T0 + 3000));
	assert.deepEqual(again.achievements?.fresh, []);
	assert.deepEqual(again.achievements?.earned, ['first_chest', 'golden_kill']);
	assert.equal(m.ledgers.get('u1')!.gems, before.gems + 75, 'a later request pays nothing more');
	assert.equal(m.mirrored.length, 1);
});

test('requests at the same moment pay once (the ledger write is a compare-and-swap)', async () => {
	const m = await player();
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	count(m, { chests: 1 });
	const before = m.ledgers.get('u1')!.gems;
	await Promise.all([syncTickets(m.deps, 'u1', T0 + 2000), syncTickets(m.deps, 'u1', T0 + 2000), syncTickets(m.deps, 'u1', T0 + 2001)]);
	assert.equal(m.ledgers.get('u1')!.gems, before + 25);
	assert.deepEqual(m.ledgers.get('u1')!.stats.achievements, ['first_chest']);
});

test('a failed mirror never blocks or repeats a payout', async () => {
	const m = await player();
	m.deps.achievements = {
		record: async () => {
			throw new Error('table down');
		},
	};
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	count(m, { chests: 1 });
	const before = m.ledgers.get('u1')!.gems;
	const paid = ok(await syncTickets(m.deps, 'u1', T0 + 2000));
	assert.equal(paid.achievements?.fresh.length, 1);
	ok(await syncTickets(m.deps, 'u1', T0 + 3000));
	assert.equal(m.ledgers.get('u1')!.gems, before + 25);
});

test('a forged claim earns nothing: no request names an achievement, and the last tutorial step without proof in the save is refused', async () => {
	const m = await player();
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	const before = m.ledgers.get('u1')!.gems;
	// the last step carries a bundle, so it needs proof in the last accepted save (a spent attribute point); this save has none
	const stolen = ok(await tutorialStep(m.deps, 'u1', 'forge-key-0001', { action: 'done', id: LAST_STEP }, T0 + 2000));
	assert.equal(stolen.ok, false);
	assert.equal(stolen.reason, 'not_yet');
	// an id that is an achievement id is not a tutorial step either
	const unknown = ok(await tutorialStep(m.deps, 'u1', 'forge-key-0002', { action: 'done', id: 'castle_10' }, T0 + 3000));
	assert.equal(unknown.reason, 'unknown');
	assert.deepEqual(m.ledgers.get('u1')!.stats.achievements, []);
	assert.equal(m.ledgers.get('u1')!.gems, before);
	assert.equal(m.mirrored.length, 0);
});

test('finishing the end of the tutorial path pays the first achievement, once', async () => {
	const m = await player();
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	const before = m.ledgers.get('u1')!.gems;
	// the server records the step as done once the save shows it; here the record is set the way applyTutorial would
	const ledger = m.ledgers.get('u1')!;
	m.ledgers.set('u1', { ...ledger, stats: { ...ledger.stats, tutorial: { done: ['intro', LAST_STEP], lessons: [], skipped: false } } });
	const out = ok(await tutorialStep(m.deps, 'u1', null, { action: 'sync' }, T0 + 2000)) as unknown as { achievements?: { fresh: { id: string }[] } };
	assert.deepEqual(
		out.achievements?.fresh.map((f) => f.id),
		['tutorial'],
	);
	assert.equal(m.ledgers.get('u1')!.gems, before + 25);
	ok(await tutorialStep(m.deps, 'u1', null, { action: 'sync' }, T0 + 3000));
	assert.equal(m.ledgers.get('u1')!.gems, before + 25);
});
