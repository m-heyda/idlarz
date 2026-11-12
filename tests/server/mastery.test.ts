import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTERY_ENTRY_KILLS, MASTERY_TIERS } from '../../src/catalog/mastery';
import { masteryReached, masteryState } from '../../src/lib/mastery';
import { claimAllMastery, claimMastery } from '../../src/lib/offline/mastery';
import { newLedger, type Ledger } from '../../src/lib/offline/ledger';
import { bestiaryOf, emptyStats, readStats, statsToJson } from '../../src/lib/offline/stats';
import { GEMS_CAP } from '../../src/config/economy';

// IDL-309: Bestiary mastery. The hybrid ladder (10 / 100 / 500 / 2,500 kills) is data; a claim is a count per monster type, judged from the server's own kills.

const T0 = 1_800_000_000_000;
const withKills = (kills: Record<string, number>, masteryClaimed: Record<string, number> = {}): Ledger => {
	const base = newLedger(T0);
	return { ...base, stats: { ...base.stats, kills, masteryClaimed } };
};

test('the ladder is the decided hybrid one and the entry fills at the first tier', () => {
	assert.deepEqual(
		MASTERY_TIERS.map((t) => t.kills),
		[10, 100, 500, 2500],
	);
	assert.equal(MASTERY_ENTRY_KILLS, 10);
	assert.equal(MASTERY_TIERS[0].reveal, 'stats');
	assert.equal(MASTERY_TIERS[1].reveal, 'drops');
	assert.ok(
		MASTERY_TIERS.every((t) => t.gems === 0),
		'no gems per tier until the owner decides',
	);
});

test('tier from kills, and what the entry may show once tiers are claimed', () => {
	assert.deepEqual(
		[0, 9, 10, 99, 100, 499, 500, 2499, 2500, 99999].map((k) => masteryReached(k)),
		[0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
	);
	const s = masteryState(250, 1);
	assert.deepEqual([s.reached, s.claimed, s.claimable, s.next, s.from], [2, 1, 1, 500, 100]);
	assert.deepEqual([s.showStats, s.showDrops], [true, false], 'the drop table opens with its tier claimed');
	assert.deepEqual([masteryState(5000, 4).next, masteryState(5000, 4).claimable], [null, 0]);
	assert.equal(masteryState(50, 9).claimed, 1, 'a bad claimed count is cut to what the kills reach');
});

test('a claim needs the tier reached and the earlier tiers taken; a repeat or a forged one pays nothing', () => {
	const ledger = withKills({ wolf: 120 });
	assert.deepEqual(claimMastery(ledger, 'bear', 1), { ok: false, reason: 'unknown' }, 'no kills of that type');
	assert.deepEqual(claimMastery(ledger, 'wolf', 0), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 9), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 1.5), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 3), { ok: false, reason: 'not_reached' });
	const first = claimMastery(ledger, 'wolf', 1);
	assert.ok(first.ok);
	if (!first.ok) return;
	assert.equal(first.ledger.stats.masteryClaimed.wolf, 1);
	assert.deepEqual(claimMastery(first.ledger, 'wolf', 1), { ok: false, reason: 'already_claimed' });
	const skipped = claimMastery(withKills({ wolf: 600 }), 'wolf', 2);
	assert.deepEqual(skipped, { ok: false, reason: 'out_of_order' });
	const second = claimMastery(first.ledger, 'wolf', 2);
	assert.ok(second.ok && second.ledger.stats.masteryClaimed.wolf === 2);
});

test('Claim all takes every reached tier of every type in one write, and nothing when nothing waits', () => {
	const ledger = withKills({ wolf: 600, boar: 12, rat: 3 }, { wolf: 1 });
	const all = claimAllMastery(ledger);
	assert.ok(all.ok);
	if (!all.ok) return;
	assert.equal(all.tiers, 2 + 1);
	assert.deepEqual(all.ledger.stats.masteryClaimed, { wolf: 3, boar: 1 });
	assert.deepEqual(claimAllMastery(all.ledger), { ok: false, reason: 'not_reached' });
	assert.deepEqual(claimAllMastery(newLedger(T0)), { ok: false, reason: 'not_reached' });
});

test('legacy accounts with kills but no claims start with every tier waiting and nothing paid', () => {
	const ledger = withKills({ wolf: 50 });
	assert.deepEqual(ledger.stats.masteryClaimed, {});
	assert.equal(masteryState(50, 0).claimable, 1);
	const all = claimAllMastery(ledger);
	assert.ok(all.ok && all.gems === 0 && all.ledger.gems === ledger.gems);
});

test('gems per tier, once configured, are paid and capped by GEMS_CAP (exercised with a temporary tier value)', () => {
	const tiers = MASTERY_TIERS as unknown as { gems: number }[];
	const saved = tiers[0].gems;
	try {
		tiers[0].gems = 40;
		const ledger = withKills({ wolf: 20 });
		const paid = claimMastery(ledger, 'wolf', 1);
		assert.ok(paid.ok && paid.gems === 40 && paid.ledger.gems === ledger.gems + 40 && paid.ledger.granted.gems === 40);
		const rich: Ledger = { ...ledger, gems: GEMS_CAP - 10 };
		const capped = claimMastery(rich, 'wolf', 1);
		assert.ok(capped.ok && capped.gems === 10 && capped.ledger.gems === GEMS_CAP);
	} finally {
		tiers[0].gems = saved;
	}
});

test('the claimed record reads back tolerantly, stays out of the stored form while empty, and rides in the bestiary report', () => {
	assert.deepEqual(emptyStats().masteryClaimed, {});
	assert.equal('masteryClaimed' in statsToJson(emptyStats()), false);
	assert.deepEqual(readStats({ masteryClaimed: { wolf: 2, bad: -1, worse: 'x' } }).masteryClaimed, { wolf: 2 });
	const stats = { ...emptyStats(), kills: { wolf: 12 }, masteryClaimed: { wolf: 1 }, deaths: { wolf: 2 }, bestMs: { wolf: 4000 } };
	assert.deepEqual(readStats(JSON.parse(JSON.stringify(statsToJson(stats)))).masteryClaimed, { wolf: 1 });
	assert.deepEqual(bestiaryOf(stats), { seen: [], kills: { wolf: 12 }, claimed: { wolf: 1 }, deaths: { wolf: 2 }, bestMs: { wolf: 4000 } });
});
