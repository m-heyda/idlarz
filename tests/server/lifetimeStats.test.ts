import test from 'node:test';
import assert from 'node:assert/strict';
import { countSave, emptyStats, isEmptyStats, readStats, recordChest, recordKill, statsDue, STATS_EVERY_MS } from '../../src/lib/offline/stats';

// IDL-69: lifetime counters in player_ledger.stats. Counted by the server from its own events and from accepted saves; nothing reads them yet.

test('kills are counted per monster type, with golden and boss kills on top', () => {
	let s = emptyStats();
	s = recordKill(s, { type: 'thistleBoar', lucky: false, boss: false });
	s = recordKill(s, { type: 'thistleBoar', lucky: true, boss: false });
	s = recordKill(s, { type: 'bossGrove', lucky: false, boss: true });
	assert.deepEqual(s.kills, { thistleBoar: 2, bossGrove: 1 });
	assert.equal(s.golden, 1);
	assert.equal(s.bosses, 1);
	assert.equal(recordChest(recordChest(emptyStats())).chests, 2);
});

test('an empty record is stored as null, and a malformed column reads as zeros', () => {
	assert.equal(isEmptyStats(emptyStats()), true);
	assert.equal(isEmptyStats(recordChest(emptyStats())), false);
	assert.deepEqual(readStats(null), emptyStats());
	assert.deepEqual(readStats('garbage'), emptyStats());
	const messy = readStats({ kills: { a: 3, b: -1, c: 'x' }, chests: 2.9, tiles: Number.NaN, income: { gold: 5 } });
	assert.deepEqual(messy.kills, { a: 3 });
	assert.equal(messy.chests, 2);
	assert.equal(messy.tiles, 0);
	assert.deepEqual(messy.income, { gold: 5 });
});

test('the first save only sets the baselines; the next counts tiles bought and income earned while playing', () => {
	const first = countSave(emptyStats(), { nowMs: 1_000_000, playSeconds: 100, tilesOwned: 4, rates: null, newRun: false });
	assert.deepEqual([first.tiles, first.income, first.at, first.playAt, first.tilesAt], [0, {}, 1_000_000, 100, 4]);
	const next = countSave(first, { nowMs: 1_000_000 + 60_000, playSeconds: 160, tilesOwned: 7, rates: { gold: 2, wood: 0.5 }, newRun: false });
	assert.equal(next.tiles, 3);
	assert.deepEqual(next.income, { gold: 120, wood: 30 });
});

test('income uses the smaller of the play-time rise and the wall-clock gap, so an absence is never counted as income', () => {
	const base = { ...emptyStats(), at: 1_000_000, playAt: 100, tilesAt: 4 };
	const away = countSave(base, { nowMs: 1_000_000 + 8 * 3600_000, playSeconds: 130, tilesOwned: 4, rates: { gold: 1 }, newRun: false });
	assert.equal(away.income.gold, 30, 'only the 30 s the game was played');
	const forged = countSave(base, { nowMs: 1_000_000 + 10_000, playSeconds: 9999, tilesOwned: 4, rates: { gold: 1 }, newRun: false });
	assert.equal(forged.income.gold, 10, 'a claimed play time cannot exceed the wall clock');
});

test('a rebirth or New Game resets the baselines and adds nothing; the totals are kept', () => {
	const before = { ...emptyStats(), tiles: 50, income: { gold: 9 }, at: 1000, playAt: 5000, tilesAt: 60 };
	const after = countSave(before, { nowMs: 2000, playSeconds: 3, tilesOwned: 4, rates: { gold: 1 }, newRun: true });
	assert.deepEqual([after.tiles, after.income, after.playAt, after.tilesAt], [50, { gold: 9 }, 3, 4]);
	const falling = countSave({ ...before, tilesAt: 60 }, { nowMs: 5_000_000, playSeconds: 9000, tilesOwned: 10, rates: null, newRun: false });
	assert.equal(falling.tiles, 50, 'fewer tiles than last time never subtract');
});

test('the save path writes the counters at most every ten minutes', () => {
	assert.equal(statsDue(emptyStats(), 5), true, 'never counted');
	const counted = { ...emptyStats(), at: 1_000_000 };
	assert.equal(statsDue(counted, 1_000_000 + STATS_EVERY_MS - 1), false);
	assert.equal(statsDue(counted, 1_000_000 + STATS_EVERY_MS), true);
});

test('a season restart wipes the tutorial progress and keeps the other counters; nothing left stores as null', async () => {
	const { statsWithoutTutorial } = await import('../../src/lib/offline/statsReset');
	const raw = { kills: { thistleBoar: 4 }, chests: 2, achievements: ['tutorial'], tutorial: { done: ['build'], lessons: ['a'], skipped: true } };
	const wiped = statsWithoutTutorial(raw);
	assert.deepEqual(wiped?.tutorial, { done: [], lessons: [], skipped: false });
	assert.equal(wiped?.kills.thistleBoar, 4);
	assert.deepEqual(wiped?.achievements, ['tutorial']);
	assert.equal(statsWithoutTutorial({ tutorial: { done: ['build'], lessons: [], skipped: false } }), null, 'only tutorial progress: nothing left to store');
	assert.equal(statsWithoutTutorial(null), null);
});
