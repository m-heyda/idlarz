import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { decodeSave, encodeSave, sealWire } from '../src/lib/saveFormat';
import {
	HISTORY_EVERY_MS,
	HISTORY_KEEP,
	MIN_SAVE_INTERVAL_MS,
	PINNED_KEEP,
	acceptSave,
	storedToText,
	type SaveRepo,
	type StatsRow,
	type StoredSave,
	type WorldPart,
} from '../src/lib/cloudSave/pipeline';
import { summarize } from '../src/lib/cloudSave/summary';
import { VERIFY, verifyTransition } from '../src/lib/cloudSave/verify';
import { isNonProduction } from '../src/lib/cloudSave/environment';

interface Hist {
	userId: string;
	rev: number;
	pinned: boolean;
	flags: string[];
}

const memoryRepo = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const history: Hist[] = [];
	let worldWrites = 0;
	const repo: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world, st) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) {
				worlds.set(id, world);
				worldWrites++;
			}
			stats.set(id, st);
			return true;
		},
		archive: async (id, save, keep) => {
			history.push({ userId: id, rev: save.rev, pinned: false, flags: save.flags });
			const mine = history.filter((h) => h.userId === id && !h.pinned).sort((a, b) => b.rev - a.rev);
			mine.slice(keep).forEach((h) => history.splice(history.indexOf(h), 1));
		},
		pin: async (id, save, keep) => {
			const row = history.find((h) => h.userId === id && h.rev === save.rev);
			if (row) row.pinned = true;
			else history.push({ userId: id, rev: save.rev, pinned: true, flags: save.flags });
			const pinned = history.filter((h) => h.userId === id && h.pinned).sort((a, b) => b.rev - a.rev);
			pinned.slice(keep).forEach((h) => history.splice(history.indexOf(h), 1));
		},
	};
	return { repo, rows, worlds, stats, history, worldWrites: () => worldWrites };
};

const game = (patch: Partial<PersistedGame> = {}): PersistedGame => {
	api().resetGame();
	growTo(12);
	// the helper hands out a huge balance: reset it to an honest-looking one
	store.setState({ playSeconds: 1000, resources: { ...api().resources, gold: 100, wood: 0, stone: 0, coal: 0, food: 0, hide: 0 }, ...patch } as never);
	return structuredClone(pickPersisted(api()));
};
const withResources = (state: PersistedGame, resources: Partial<PersistedGame['resources']>): PersistedGame => ({
	...state,
	resources: { ...state.resources, ...resources },
});

const T0 = 1_800_000_000_000;
const accept = (repo: SaveRepo, id: string, state: PersistedGame, baseRev: number, at: number) => acceptSave(repo, id, 'Zoë', encodeSave(state), baseRev, at);

test('summary comes from the map, not from anything the client sends', () => {
	const state = game();
	const s = summarize(state);
	assert.ok(s.rates.gold > 0);
	assert.equal(s.gold, state.resources.gold);
	assert.equal(s.tilesOwned >= 12, true);
	assert.equal(s.playSeconds, 1000);
	assert.equal(s.gems, state.gems);
});

test('a save is stored split: small core, map apart, typed numbers, and reads back to the same game', async () => {
	const { repo, rows, worlds } = memoryRepo();
	const state = game();
	const out = await accept(repo, 'u1', state, 0, T0);
	assert.equal(out.kind, 'ok');
	const row = rows.get('u1');
	assert.ok(row && row.rev === 1 && row.serverSavedAt === T0);
	assert.equal('land' in row.core, false, 'the map is not in the hot row');
	assert.equal(worlds.get('u1')?.hash, row.worldHash);

	const whole = await repo.load('u1', { world: true });
	assert.ok(whole);
	const back = decodeSave(storedToText(whole));
	assert.ok(back.ok, 'the client can import what the server returns');
	assert.equal(back.state.playerName, state.playerName);
	assert.deepEqual(back.state.resources, state.resources);
	assert.deepEqual(summarize(back.state).tilesOwned, summarize(state).tilesOwned);
});

test('the map is only rewritten when it changed, the small row every time', async () => {
	const { repo, worldWrites, rows } = memoryRepo();
	let state = game();
	let now = T0;
	await accept(repo, 'u1', state, 0, now);
	for (let rev = 1; rev <= 3; rev++) {
		now += MIN_SAVE_INTERVAL_MS + 1000;
		state = withResources({ ...state, playSeconds: state.playSeconds + 12 }, { gold: state.resources.gold + 5 });
		assert.equal((await accept(repo, 'u1', state, rev, now)).kind, 'ok');
	}
	assert.equal(rows.get('u1')?.rev, 4);
	assert.equal(worldWrites(), 1, 'three saves without a purchase never touched the map');
});

test('damaged, forged or oversized text is refused and nothing is stored', async () => {
	const { repo, rows } = memoryRepo();
	const text = encodeSave(game());
	for (const bad of ['', 'nonsense', text.slice(0, -3), sealWire({ v: 2, t: 1, s: { land: 'x' } })]) {
		const out = await acceptSave(repo, 'u1', 'Zoë', bad, 0, T0);
		assert.equal(out.kind, 'invalid', bad.slice(0, 20));
	}
	assert.equal(rows.size, 0);
});

test('a stale base revision is a conflict and overwrites nothing', async () => {
	const { repo, rows } = memoryRepo();
	const a = game();
	await accept(repo, 'u1', a, 0, T0);
	const b = withResources(a, { gold: 5 });
	await accept(repo, 'u1', b, 1, T0 + 60_000);
	const stale = await accept(repo, 'u1', a, 1, T0 + 120_000);
	assert.equal(stale.kind === 'conflict' && stale.rev, 2);
	assert.equal(rows.get('u1')?.rev, 2);
	assert.equal((await accept(repo, 'u2', a, 3, T0)).kind, 'conflict', 'cannot claim to continue a save the account does not have');
	assert.equal((await accept(repo, 'u1', a, 0, T0 + 180_000)).kind, 'conflict', 'base 0 on an account that has a save');
});

test('saves from one player are rate limited', async () => {
	const { repo } = memoryRepo();
	const state = game();
	assert.equal((await accept(repo, 'u1', state, 0, T0)).kind, 'ok');
	assert.equal((await accept(repo, 'u1', state, 1, T0 + 1000)).kind, 'too_soon');
});

test('history is sparse: first save, one copy per 30 minutes of the clock, and the first save with a new flag; only the newest few stay', async () => {
	const { repo, history } = memoryRepo();
	let state = game();
	let now = T0;
	let rev = 0;
	const save = async (next: PersistedGame, stepMs: number) => {
		now += stepMs;
		const out = await accept(repo, 'u1', next, rev, now);
		assert.equal(out.kind, 'ok');
		rev++;
		return out;
	};
	await save(state, 0);
	assert.deepEqual(history.map((h) => h.rev), [1]);

	// a burst of event saves (every 11 s for 20 min) makes no copies: the clock decides, not the revision count
	for (let i = 0; i < 100; i++) {
		state = { ...state, playSeconds: state.playSeconds + 11 };
		await save(state, 11_000);
	}
	assert.deepEqual(history.map((h) => h.rev), [1], '100 saves in 18 min: still only the first copy');

	// then one save every 5 min: a copy every 6th save (30 min)
	for (let i = 0; i < 6 * (HISTORY_KEEP + 2); i++) {
		state = { ...state, playSeconds: state.playSeconds + 300 };
		await save(state, 5 * 60_000);
	}
	assert.equal(history.length, HISTORY_KEEP);
	const revs = history.map((h) => h.rev).sort((x, y) => x - y);
	assert.ok(revs.slice(1).every((r, i) => r - revs[i] === 6), `one copy per 6 saves, got ${revs.join()}`);

	const cheat = { ...state, gems: state.gems + 1 };
	const flagged = await save(cheat, 60_000);
	assert.ok(flagged.kind === 'ok' && flagged.flags.includes('gems_increase'));
	assert.ok(history.some((h) => h.flags.includes('gems_increase')), 'a flagged save is archived at once');

	// the same flag on the next saves does not fill the history again
	const before = history.length;
	let again = cheat;
	for (let i = 1; i <= 4; i++) {
		again = { ...again, playSeconds: again.playSeconds + 11 };
		await save(again, 11_000);
	}
	assert.equal(history.length, before, 'a flag that was already there is not archived again');
});

test('starting over (a much younger game) pins the replaced game so history never drops it', async () => {
	const { repo, history } = memoryRepo();
	const old = { ...game(), playSeconds: 500_000 };
	let now = T0;
	await accept(repo, 'u1', old, 0, now);
	now += MIN_SAVE_INTERVAL_MS + 1000;
	const fresh = { ...game(), playSeconds: 10 };
	const out = await accept(repo, 'u1', fresh, 1, now);
	assert.ok(out.kind === 'ok' && out.flags.includes('playtime_regress'));
	assert.equal(history.find((h) => h.rev === 1 && h.pinned) !== undefined, true);
	let state = fresh;
	for (let rev = 2; rev <= 6 * (HISTORY_KEEP + 3); rev++) {
		now += HISTORY_EVERY_MS / 6;
		state = { ...state, playSeconds: state.playSeconds + 11 };
		await accept(repo, 'u1', state, rev, now);
	}
	assert.ok(history.some((h) => h.rev === 1 && h.pinned), 'the old game is still there');
	assert.ok(history.filter((h) => h.pinned).length <= PINNED_KEEP);
});

// ---- trust: fresh start, flags, leaderboard row ------------------------------------------------------------------

test('a young account that plays honestly is trusted, with the profile name on the leaderboard row', async () => {
	const { repo, stats } = memoryRepo();
	const state = { ...game(), playSeconds: 120 };
	const out = await acceptSave(repo, 'u1', 'Profile Name', encodeSave(state), 0, T0);
	assert.ok(out.kind === 'ok' && out.flags.length === 0, out.kind === 'ok' ? out.flags.join() : '');
	assert.deepEqual(stats.get('u1'), { displayName: 'Profile Name', trusted: true });
});

test('an existing player whose first save already has a long history is not ranking-eligible', async () => {
	const { repo, stats, rows } = memoryRepo();
	await accept(repo, 'u1', { ...game(), playSeconds: VERIFY.freshStartSec + 5000 }, 0, T0);
	assert.equal(rows.get('u1')?.freshStart, false);
	assert.equal(stats.get('u1')?.trusted, false);
});

test('one poisonous flag keeps an account out of rankings for good, even after honest saves', async () => {
	const { repo, stats, rows } = memoryRepo();
	let state = { ...game(), playSeconds: 120 };
	let now = T0;
	await accept(repo, 'u1', state, 0, now);
	assert.equal(stats.get('u1')?.trusted, true);
	now += MIN_SAVE_INTERVAL_MS + 1000;
	state = { ...state, gems: state.gems + 100, playSeconds: state.playSeconds + 12 };
	await accept(repo, 'u1', state, 1, now);
	assert.equal(stats.get('u1')?.trusted, false);
	now += MIN_SAVE_INTERVAL_MS + 1000;
	state = { ...state, gems: state.gems - 100, playSeconds: state.playSeconds + 12 };
	await accept(repo, 'u1', state, 2, now);
	assert.equal(rows.get('u1')?.everFlagged, true);
	assert.equal(stats.get('u1')?.trusted, false);
});

test('a balance the game could never have paid is flagged by the spending check and recorded with its ratio', async () => {
	const { repo, rows } = memoryRepo();
	const forged = withResources({ ...game(), playSeconds: 700 }, { gold: 1e15 });
	const out = await accept(repo, 'u1', forged, 0, T0);
	assert.ok(out.kind === 'ok' && out.flags.includes('networth_exceeds'), out.kind === 'ok' ? out.flags.join() : out.kind);
	assert.ok((rows.get('u1')?.auditRatio ?? 0) > 1);
	assert.equal(rows.get('u1')?.everFlagged, true);
});

// ---- the verifier (shadow mode: flags only), from summaries -------------------------------------------------------

const snap = (state: PersistedGame, at = T0) => ({ summary: summarize(state), serverSavedAt: at });
const flagsOf = (prev: PersistedGame | null, next: PersistedGame, at: number) => verifyTransition(prev ? snap(prev) : null, summarize(next), at);

test('an honest minute of play raises no flag', () => {
	const prev = game();
	const rate = summarize(prev).rates.gold;
	const next = withResources({ ...prev, playSeconds: prev.playSeconds + 60 }, { gold: prev.resources.gold + rate * 60 });
	assert.deepEqual(flagsOf(prev, next, T0 + 61_000), []);
});

test('more play time than real time, going back in time, and extra gems are flagged', () => {
	const prev = game();
	assert.ok(flagsOf(prev, { ...prev, playSeconds: prev.playSeconds + 3600 }, T0 + 60_000).includes('playtime_fast'));
	assert.ok(flagsOf(prev, { ...prev, playSeconds: prev.playSeconds - 500 }, T0 + 60_000).includes('playtime_regress'));
	assert.ok(flagsOf(prev, { ...prev, gems: prev.gems + 1 }, T0 + 60_000).includes('gems_increase'));
});

test('a gold or xp jump that income cannot explain is flagged, a burst within the allowance is not', () => {
	const prev = game();
	const rate = summarize(prev).rates.gold;
	assert.ok(flagsOf(prev, withResources(prev, { gold: prev.resources.gold + (rate * VERIFY.burstSec + VERIFY.goldFloor) * 10 + 1e9 }), T0 + 60_000).includes('gold_jump'));
	assert.deepEqual(flagsOf(prev, withResources(prev, { gold: prev.resources.gold + VERIFY.goldFloor / 2 }), T0 + 60_000), []);
	assert.ok(flagsOf(prev, withResources(prev, { xp: prev.resources.xp + 1e12 }), T0 + 60_000).includes('xp_jump'));
});

test('a rebirth is not a cheat, a rebirth counter that goes down is', () => {
	const prev = game();
	const reborn = {
		...prev,
		prestige: { ...prev.prestige, rebirths: prev.prestige.rebirths + 1, legacyEarned: prev.prestige.legacyEarned + 5 },
		playSeconds: prev.playSeconds + 60,
		resources: { ...prev.resources, gold: 0, xp: 0 },
	};
	assert.deepEqual(flagsOf(prev, reborn, T0 + 61_000), []);
	assert.ok(verifyTransition({ summary: summarize(reborn), serverSavedAt: T0 }, summarize(prev), T0 + 61_000).includes('prestige_regress'));
});

test('the first save of an account can only be sanity checked: an absurd balance is flagged', () => {
	const modest = withResources(game(), { gold: 100 });
	assert.deepEqual(flagsOf(null, modest, T0), []);
	assert.deepEqual(flagsOf(null, withResources(modest, { gold: 1e18 }), T0), ['baseline_rich']);
});

// ---- test accounts: decided by the server's environment, never by the request ------------------------------------

test('only a developer machine or a Vercel preview counts as non-production; a missing platform variable stays production', () => {
	assert.equal(isNonProduction({ NODE_ENV: 'development' }), true, 'next dev');
	assert.equal(isNonProduction({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), true);
	assert.equal(isNonProduction({ NODE_ENV: 'production', VERCEL_ENV: 'development' }), true);
	assert.equal(isNonProduction({ NODE_ENV: 'production', VERCEL_ENV: 'production' }), false);
	assert.equal(isNonProduction({ NODE_ENV: 'production' }), false, 'platform variables not exposed: players must stay in the checks');
	assert.equal(isNonProduction({}), true, 'no NODE_ENV at all is not a production server');
});

test('a save through a non-production server makes a test account: flags recorded, never poisonous, never ranked, sticky', async () => {
	const { repo, rows, stats, history } = memoryRepo();
	const forged = withResources({ ...game(), playSeconds: 120 }, { gold: 1e15 });
	const out = await acceptSave(repo, 'dev', 'Insane', encodeSave(forged), 0, T0, true);
	assert.ok(out.kind === 'ok' && out.flags.includes('networth_exceeds'), 'the checks still run, so a tester can see them work');
	assert.equal(rows.get('dev')?.testAccount, true);
	assert.equal(rows.get('dev')?.everFlagged, false, 'the finding does not count against the account');
	assert.equal(stats.get('dev')?.trusted, false, 'a test account is never ranked');

	// later saves through the production server do not turn it into a ranked account
	const honest = withResources({ ...game(), playSeconds: 200 }, { gold: 50 });
	assert.equal((await acceptSave(repo, 'dev', 'Insane', encodeSave(honest), 1, T0 + 60_000, false)).kind, 'ok');
	assert.equal(rows.get('dev')?.testAccount, true, 'sticky');
	assert.equal(stats.get('dev')?.trusted, false);
	assert.equal(history.filter((h) => h.rev > 1).length, 0, 'no history churn from flags on a test account');
});

test('the same forged save through the production server poisons the account and keeps it out of rankings', async () => {
	const { repo, rows, stats } = memoryRepo();
	const forged = withResources({ ...game(), playSeconds: 120 }, { gold: 1e15 });
	const out = await acceptSave(repo, 'player', 'Cheater', encodeSave(forged), 0, T0, false);
	assert.ok(out.kind === 'ok' && out.flags.includes('networth_exceeds'));
	assert.equal(rows.get('player')?.testAccount, false);
	assert.equal(rows.get('player')?.everFlagged, true);
	assert.equal(stats.get('player')?.trusted, false);
});
