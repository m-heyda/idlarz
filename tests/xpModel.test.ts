import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { pickPersisted, type PersistedGame } from '../src/lib/sanitizeSave';
import { decodeSave, encodeSave } from '../src/lib/saveFormat';
import { acceptSave, storedToText, type SaveRepo, type StoredSave, type WorldPart } from '../src/lib/cloudSave/pipeline';
import { summarize, type SaveSummary } from '../src/lib/cloudSave/summary';
import { verifyTransition } from '../src/lib/cloudSave/verify';
import { XP_MODEL, purchasedOf, settleXp, tileXp } from '../src/lib/cloudSave/xpModel';
import { calculateLevel, calculateXpGain, cumulativeXp, reconcileCharacter, totalStatPoints } from '../src/utils/gameUtils';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { zeroTotals } from '../src/lib/offline/ledger';

// The server's model of XP (cloudSave/xpModel.ts): the XP two saves can explain, from the tiles bought, the time played and what the server paid.

const T0 = 1_800_000_000_000;

const base = (): PersistedGame => {
	freshGame();
	growTo(12);
	store.setState({ playSeconds: 1000 } as never);
	return structuredClone(pickPersisted(api()));
};

/** A summary of a character that bought `purchased` tiles and holds `xp`, `playSeconds` into the game. */
const summaryAt = (purchased: number, xp: number, playSeconds: number, over: Partial<SaveSummary> = {}): SaveSummary => {
	const s = summarize(base());
	return { ...s, xp, playSeconds, tilesOwned: purchased + 8, derived: { ...s.derived, purchased, xpBase: undefined }, ...over };
};

test('tileXp adds up the XP of the purchases (the n-th purchase gives calculateXpGain(n)), with the XP bonus', () => {
	assert.equal(tileXp(10, 10, 0), 0);
	assert.equal(tileXp(9, 10, 0), calculateXpGain(10));
	// the castle counts as the first tile: the first purchase (1 -> 2) gives calculateXpGain(2)
	assert.ok(Math.abs(tileXp(1, 4, 0) - (calculateXpGain(2) + calculateXpGain(3) + calculateXpGain(4))) < 1e-9);
	assert.equal(tileXp(0, 4, 0), tileXp(1, 4, 0), 'a count below 1 is read as the castle alone');
	assert.ok(Math.abs(tileXp(20, 25, 10) - 1.1 * tileXp(20, 25, 0)) < 1e-9);
});

test('an honest purchase is never clamped, at any size of map (the old check flagged it from about tile 45)', () => {
	for (const [from, to] of [[19, 20], [44, 45], [71, 72], [99, 100], [330, 331], [900, 901]] as const) {
		const before = summaryAt(from, 5_000, 10_000);
		const xp = before.xp + tileXp(from, to, before.xpGainPct);
		const next = summaryAt(to, xp, 10_040);
		const verdict = settleXp({ summary: before, serverSavedAt: T0 }, next, T0 + 40_000);
		assert.equal(verdict.clamped, false, `tile ${to}`);
		assert.equal(verdict.xp, xp);
		assert.deepEqual(verifyTransition({ summary: before, serverSavedAt: T0 }, next, T0 + 40_000), [], `tile ${to}`);
	}
});

test('a burst of tiles bought between two saves is explained by their XP, and a jump nothing explains is clamped to the limit', () => {
	const before = summaryAt(100, 600_000, 50_000);
	const many = summaryAt(140, before.xp + tileXp(100, 140, 0), 50_060);
	assert.equal(settleXp({ summary: before, serverSavedAt: T0 }, many, T0 + 60_000).clamped, false);

	const forged = summaryAt(100, before.xp + 1e12, 50_060);
	const verdict = settleXp({ summary: before, serverSavedAt: T0 }, forged, T0 + 60_000);
	assert.equal(verdict.clamped, true);
	assert.ok(verdict.xp < before.xp + 1e6, `the limit is about what a minute can pay (${verdict.xp})`);
	assert.ok(verifyTransition({ summary: before, serverSavedAt: T0 }, forged, T0 + 60_000).includes('xp_jump'));
});

test('what the server paid (kills, chests, an absence) is explained, the same XP without a payment is not', () => {
	const before = summaryAt(60, 100_000, 20_000);
	const paid = 5e8;
	const next = summaryAt(60, before.xp + paid, 20_040);
	const grants = { ...zeroTotals(), xp: paid };
	assert.equal(settleXp({ summary: before, serverSavedAt: T0 }, next, T0 + 40_000, grants).clamped, false);
	assert.equal(settleXp({ summary: before, serverSavedAt: T0 }, next, T0 + 40_000).clamped, true);
});

test('more play time than real time does not make more XP: the time that passed counts, not the time the save claims', () => {
	const before = summaryAt(60, 100_000, 20_000, { rates: { ...summaryAt(60, 0, 0).rates, xp: 100 } });
	const claims = summaryAt(60, before.xp + 100 * 86_400, 20_000 + 86_400, { rates: before.rates });
	assert.equal(settleXp({ summary: before, serverSavedAt: T0 }, claims, T0 + 60_000).clamped, true, 'a day of income in a minute');
});

test('XP carries over a rebirth: the new run adds its purchases to the old total, and a reset to zero is no cheat', () => {
	const before = summaryAt(300, 4e8, 400_000, { rebirths: 0 });
	// the rebirth, 40 tiles into the new run, with the old XP kept
	const reborn = summaryAt(40, before.xp + tileXp(0, 40, 0), 400_060, { rebirths: 1 });
	assert.equal(settleXp({ summary: before, serverSavedAt: T0 }, reborn, T0 + 60_000).clamped, false);
	// a character that comes back with a smaller number (an older save) is not clamped either, and its credit does not grow with it
	const lower = summaryAt(40, 1_000, 400_060, { rebirths: 1 });
	const verdict = settleXp({ summary: before, serverSavedAt: T0 }, lower, T0 + 60_000);
	assert.equal(verdict.clamped, false);
	assert.ok(verdict.base <= lower.xp + 1e6, 'no credit is banked for the XP that was lost');
});

test('the first save of an account is judged with a wide margin, an absurd total is clamped', () => {
	const modest = summaryAt(60, tileXp(0, 60, 0) * 1.5, 30_000);
	assert.equal(settleXp(null, modest, T0).clamped, false);
	const absurd = summaryAt(60, 1e18, 30_000);
	const verdict = settleXp(null, absurd, T0);
	assert.equal(verdict.clamped, true);
	assert.ok(verdict.xp < 1e9);
	assert.deepEqual(verifyTransition(null, absurd, T0).includes('xp_jump'), true);
});

test('purchased tiles are read from the summary, or from the map for older rows', () => {
	assert.equal(purchasedOf(summaryAt(50, 0, 0)), 50);
	const old = summaryAt(50, 0, 0);
	delete old.derived.purchased;
	assert.equal(purchasedOf(old), old.tilesOwned - 8);
	assert.ok(XP_MODEL.firstSaveSlack >= 1);
});

// ---------------------------------------------------------------------------------------------------- the pipeline keeps the clamp

const memoryRepo = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const repo: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			return row ? (options?.world ? { ...row, world: worlds.get(id) } : { ...row }) : null;
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
	return { repo, rows, worlds };
};

test('a save that claims XP nobody could earn is stored with the XP the server can explain, flagged, and the attribute points follow the level', async () => {
	const { repo, rows, worlds } = memoryRepo();
	const honest = base();
	const first = await acceptSave(repo, 'u1', 'Zoë', encodeSave(honest), 0, T0);
	assert.equal(first.kind, 'ok');
	if (first.kind === 'ok') assert.equal(first.xp, undefined, 'an honest save is not touched');

	// the same character a minute later with a trillion XP and all the points of the maximum level, spent
	const level = calculateLevel(1e15).level;
	const cheat: PersistedGame = {
		...honest,
		playSeconds: honest.playSeconds + 60,
		resources: { ...honest.resources, xp: 1e15 },
		characterStats: { ...honest.characterStats, strength: INITIAL_CHARACTER_STATS.strength + totalStatPoints(level), availablePoints: 0 },
	};
	const out = await acceptSave(repo, 'u1', 'Zoë', encodeSave(cheat), 1, T0 + 60_000);
	assert.ok(out.kind === 'ok', out.kind === 'invalid' ? out.reason : out.kind);
	if (out.kind !== 'ok') return;
	assert.ok(out.flags.includes('xp_jump'));
	assert.ok(out.xp !== undefined && out.xp < 1e9, `the server kept ${out.xp}`);

	const row = rows.get('u1')!;
	assert.equal(row.summary.xp, out.xp);
	assert.equal(row.summary.level, calculateLevel(out.xp).level, 'the level on the ranking follows the clamped XP');
	assert.ok(row.summary.derived.xpBase !== undefined && row.summary.derived.xpBase <= out.xp + 1e6);
	assert.equal(row.everFlagged, true);

	// what is stored loads: the points the lower level has not earned are back to be spent
	const stored = decodeSave(storedToText({ ...row, world: worlds.get('u1') }));
	assert.ok(stored.ok, stored.ok ? '' : stored.reason);
	if (!stored.ok) return;
	assert.equal(stored.state.resources.xp, out.xp);
	assert.equal(stored.state.characterStats.strength, INITIAL_CHARACTER_STATS.strength);
	assert.equal(stored.state.characterStats.availablePoints, totalStatPoints(calculateLevel(out.xp).level));
});

test('an honest long session is never clamped: play, buy tiles, save every minute', async () => {
	const { repo, rows } = memoryRepo();
	freshGame();
	growTo(12);
	store.setState({ playSeconds: 1000 } as never);
	let rev = 0;
	let at = T0;
	for (let i = 0; i < 25; i++) {
		growTo(12 + i * 3);
		api().tick(30_000);
		const out = await acceptSave(repo, 'u2', 'Zoë', encodeSave(pickPersisted(api())), rev, at);
		assert.ok(out.kind === 'ok', out.kind === 'invalid' ? out.reason : out.kind);
		if (out.kind !== 'ok') return;
		assert.equal(out.xp, undefined, `save ${i}`);
		assert.equal(out.flags.includes('xp_jump'), false, `save ${i}`);
		rev = out.rev;
		at += 60_000;
	}
	assert.equal(rows.get('u2')!.summary.xp, api().resources.xp);
});

// ---------------------------------------------------------------------------------------------------- the client side of a clamp

test('the game takes the lower XP the server kept: level, attribute points and income follow', () => {
	freshGame();
	growTo(8);
	store.setState((s) => ({ resources: { ...s.resources, xp: cumulativeXp(40) + 1 } }));
	api().tick(100);
	assert.equal(api().level.level, 40);
	for (let i = 0; i < 30; i++) api().addStatPoint('strength');
	api().applyServerXp(cumulativeXp(10) + 5);
	assert.equal(api().level.level, 10);
	assert.equal(api().resources.xp, cumulativeXp(10) + 5);
	assert.equal(api().characterStats.strength, INITIAL_CHARACTER_STATS.strength, 'the points spent beyond level 10 are given back');
	assert.equal(api().characterStats.availablePoints, totalStatPoints(10));

	// a higher or nonsense number changes nothing
	const before = api().resources.xp;
	api().applyServerXp(before * 10);
	api().applyServerXp(NaN);
	api().applyServerXp(-3);
	assert.equal(api().resources.xp, before);
});

test('reconcileCharacter leaves a character within its points alone', () => {
	freshGame();
	const stats = api().characterStats;
	assert.equal(reconcileCharacter(stats, cumulativeXp(20)), stats);
});
