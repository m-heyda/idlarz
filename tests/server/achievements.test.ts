import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { gemsStep, syncTickets, tutorialStep, type Online } from '../../src/lib/offline/online';
import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { TUTORIAL_PATH } from '../../src/catalog/tutorial';
import { GEMS_CAP, STARTING_GEMS } from '../../src/config/economy';
import {
	achievementsDue,
	claimAchievement,
	conditionHolds,
	earnAchievements,
	mergeManual,
	settleAchievements,
	type AchievementFacts,
} from '../../src/lib/offline/achievements';
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

test('the catalog is the launch set plus the Beta tester: 13 achievements, 800 gems, 5 avatars, unique ids', () => {
	assert.equal(ACHIEVEMENTS.length, 13);
	assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, 13);
	assert.equal(
		ACHIEVEMENTS.reduce((sum, a) => sum + a.rewards.gems, 0),
		800,
	);
	assert.ok(ACHIEVEMENTS.every((a) => a.rewards.gems >= 25 && a.rewards.gems <= 200));
	assert.equal(ACHIEVEMENTS.filter((a) => a.rewards.avatarId).length, 5);
	assert.equal(ACHIEVEMENTS.find((a) => a.id === 'beta_tester')?.rewards.gems, 200);
	assert.equal(ACHIEVEMENTS.find((a) => a.id === 'beta_tester')?.withAchievement, 'early_tester');
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

test('the testers are never checked by the lazy evaluator', () => {
	const everything = facts(
		{ castleLevel: 99, rebirths: 9, buildings: 9 },
		{ tiles: 9, chests: 9, golden: 9, kills: { bossGreatAuroch: 1 }, tutorial: { done: [LAST_STEP], lessons: [], skipped: false } },
	);
	assert.deepEqual(
		ids(everything),
		ACHIEVEMENTS.filter((a) => a.when.kind !== 'manual').map((a) => a.id),
	);
});

test('earning pays nothing and is idempotent; the Claim pays once, an unknown, unearned or claimed id pays nothing, the cap holds', () => {
	const ledger = newLedger(T0);
	const first = earnAchievements(ledger, ['first_tile', 'castle_10', 'not-an-achievement'], T0 + 5);
	assert.deepEqual(first.unlocked, [
		{ id: 'first_tile', gems: 25 },
		{ id: 'castle_10', gems: 100 },
	]);
	assert.equal(first.ledger.gems, STARTING_GEMS, 'earning pays nothing: the player claims');
	assert.deepEqual(first.ledger.stats.achievements, ['first_tile', 'castle_10']);
	assert.deepEqual(first.ledger.stats.claimed, []);
	assert.deepEqual(first.ledger.stats.earnedAt, { first_tile: T0 + 5, castle_10: T0 + 5 });
	const again = earnAchievements(first.ledger, ['first_tile', 'castle_10', 'first_tile'], T0 + 9);
	assert.deepEqual(again.unlocked, []);
	assert.equal(again.ledger, first.ledger, 'nothing new returns the same ledger');

	assert.deepEqual(claimAchievement(first.ledger, 'first_chest', T0), { ok: false, reason: 'not_earned' });
	assert.deepEqual(claimAchievement(first.ledger, 'nope', T0), { ok: false, reason: 'unknown' });
	const claimed = claimAchievement(first.ledger, 'castle_10', T0 + 20);
	assert.ok(claimed.ok);
	if (claimed.ok) {
		assert.equal(claimed.gems, 100);
		assert.equal(claimed.ledger.gems, STARTING_GEMS + 100);
		assert.equal(claimed.ledger.granted.gems, 100);
		assert.deepEqual(claimed.ledger.stats.claimed, ['castle_10']);
		assert.equal(claimed.ledger.stats.claimedAt.castle_10, T0 + 20);
		assert.deepEqual(claimAchievement(claimed.ledger, 'castle_10', T0 + 30), { ok: false, reason: 'already_claimed' });
	}
	const rich: Ledger = { ...first.ledger, gems: GEMS_CAP - 10 };
	const capped = claimAchievement(rich, 'castle_10', T0);
	assert.ok(capped.ok && capped.ledger.gems === GEMS_CAP && capped.ledger.granted.gems === 10, 'only what was really added is recorded');
});

test('a ledger from before claiming existed counts everything it holds as claimed (nothing is paid twice)', () => {
	const old: Ledger = { ...newLedger(T0), stats: { ...emptyStats(), achievements: ['first_tile'], claimed: null } };
	assert.deepEqual(claimAchievement(old, 'first_tile', T0), { ok: false, reason: 'already_claimed' });
	const next = earnAchievements(old, ['first_chest'], T0 + 1);
	assert.deepEqual(next.ledger.stats.claimed, ['first_tile'], 'the old one is claimed, the new one waits');
	assert.deepEqual(readStats({ achievements: ['a'] }).claimed, null);
});

test('the testers are merged into the ledger once from the table, the Beta tester comes with the Early tester', () => {
	const ledger = newLedger(T0);
	const merged = mergeManual(ledger, ['early_tester'], T0 + 1);
	assert.deepEqual(merged.ledger.stats.achievements, ['early_tester', 'beta_tester']);
	assert.deepEqual(merged.mirror, ['beta_tester'], 'the one the table did not hold yet is mirrored');
	assert.equal(merged.ledger.stats.manualSynced, true);
	assert.equal(merged.ledger.gems, STARTING_GEMS, 'nothing is paid by the merge');
	assert.equal(mergeManual(merged.ledger, ['early_tester'], T0 + 2).ledger, merged.ledger, 'only once');
	assert.deepEqual(mergeManual(ledger, [], T0).ledger.stats.achievements, [], 'an account without the mark gets nothing');
	const both = claimAchievement(merged.ledger, 'beta_tester', T0 + 3);
	assert.ok(both.ok && both.gems === 200);
});

test('settle records what became due once, and an earned achievement stays earned when the numbers fall back', () => {
	const summary = { castleLevel: 6, rebirths: 0 } as never;
	const ledger: Ledger = { ...newLedger(T0), stats: { ...emptyStats(), chests: 1 } };
	const first = settleAchievements(ledger, summary, T0);
	assert.deepEqual(
		first.unlocked.map((u) => u.id),
		['first_chest', 'castle_2', 'castle_6'],
	);
	assert.equal(first.ledger.gems, STARTING_GEMS, 'no gems until they are claimed');
	const lower = settleAchievements(first.ledger, { castleLevel: 1, rebirths: 0 } as never, T0);
	assert.deepEqual(lower.unlocked, []);
	assert.deepEqual(settleAchievements(first.ledger, summary, T0).unlocked, [], 'a replay of the same state earns nothing');
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

test('a request that finds an achievement due records it once, tells the browser, mirrors the row and pays only on the Claim', async () => {
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
	assert.equal(paid.achievements?.gemsTotal, before.gems, 'earning pays nothing');
	const after = m.ledgers.get('u1')!;
	assert.equal(after.gems, before.gems);
	assert.deepEqual(after.stats.claimed, []);
	assert.deepEqual(m.mirrored, [{ userId: 'u1', ids: ['first_chest', 'golden_kill'] }]);

	const again = ok(await syncTickets(m.deps, 'u1', T0 + 3000));
	assert.deepEqual(again.achievements?.fresh, []);
	assert.deepEqual(again.achievements?.earned, ['first_chest', 'golden_kill']);
	assert.equal(m.ledgers.get('u1')!.gems, before.gems, 'a later request pays nothing');
	assert.equal(m.mirrored.length, 1);
	// the Claim pays once
	const claim = ok(await gemsStep(m.deps, 'u1', 'claim-key-0001', { action: 'claim', id: 'golden_kill' }, T0 + 4000, null));
	assert.equal(claim.ok, true);
	assert.equal(claim.paid, 50);
	assert.equal(claim.gems, before.gems + 50);
	assert.deepEqual(claim.achievements?.claimed, ['golden_kill']);
	const twice = ok(await gemsStep(m.deps, 'u1', 'claim-key-0002', { action: 'claim', id: 'golden_kill' }, T0 + 5000, null));
	assert.equal(twice.ok, false);
	assert.equal(twice.reason, 'already_claimed');
	const replay = ok(await gemsStep(m.deps, 'u1', 'claim-key-0002', { action: 'claim', id: 'golden_kill' }, T0 + 5001, null));
	assert.deepEqual(replay, twice, 'the same key replays the answer');
	const unearned = ok(await gemsStep(m.deps, 'u1', 'claim-key-0003', { action: 'claim', id: 'castle_10' }, T0 + 6000, null));
	assert.equal(unearned.reason, 'not_earned');
	assert.equal(m.ledgers.get('u1')!.gems, before.gems + 50);
});

test('requests at the same moment record once (the ledger write is a compare-and-swap)', async () => {
	const m = await player();
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	count(m, { chests: 1 });
	await Promise.all([syncTickets(m.deps, 'u1', T0 + 2000), syncTickets(m.deps, 'u1', T0 + 2000), syncTickets(m.deps, 'u1', T0 + 2001)]);
	assert.deepEqual(m.ledgers.get('u1')!.stats.achievements, ['first_chest']);
	// two claims at once pay once
	const before = m.ledgers.get('u1')!.gems;
	await Promise.all([
		gemsStep(m.deps, 'u1', 'claim-race-0001', { action: 'claim', id: 'first_chest' }, T0 + 3000, null),
		gemsStep(m.deps, 'u1', 'claim-race-0002', { action: 'claim', id: 'first_chest' }, T0 + 3000, null),
	]);
	assert.equal(m.ledgers.get('u1')!.gems, before + 25);
});

test('a failed mirror never blocks or repeats an unlock', async () => {
	const m = await player();
	m.deps.achievements = {
		record: async () => {
			throw new Error('table down');
		},
	};
	ok(await syncTickets(m.deps, 'u1', T0 + 1000));
	count(m, { chests: 1 });
	const paid = ok(await syncTickets(m.deps, 'u1', T0 + 2000));
	assert.equal(paid.achievements?.fresh.length, 1);
	ok(await syncTickets(m.deps, 'u1', T0 + 3000));
	assert.deepEqual(m.ledgers.get('u1')!.stats.achievements, ['first_chest']);
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

test('finishing the end of the tutorial path earns the first achievement, once', async () => {
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
	assert.equal(m.ledgers.get('u1')!.gems, before, 'the starter bundle is resources, the achievement waits for its Claim');
	ok(await tutorialStep(m.deps, 'u1', null, { action: 'sync' }, T0 + 3000));
	assert.deepEqual(m.ledgers.get('u1')!.stats.achievements, ['tutorial']);
});

test('every achievement names a badge that exists in the asset library', async () => {
	const { existsSync } = await import('node:fs');
	for (const a of ACHIEVEMENTS) assert.ok(existsSync(`public/pixel/new_assets/achievements/${a.badge}.png`), `${a.id}: ${a.badge}`);
});
