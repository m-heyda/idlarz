import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTING_GEMS } from '../../src/config/economy';
import { GEM_SHOP } from '../../src/config/gemShop';
import { rollGemAmount } from '../../src/lib/luck';
import { mulberry32 } from '../../src/lib/rng';
import {
	CLAIMED_SHARE,
	GEM_PROFILES,
	chestGemsPerDay,
	claimedShare,
	dailyGemsPerDay,
	daysToEarn,
	earnedBy,
	expectedGemFind,
	gemPools,
	priceBook,
	renderGemSim,
	runGemSim,
} from '../../scripts/gemSim';

// The gem economy sim (IDL-229, scripts/gem-sim.ts). The numbers below are pinned on purpose: change a gem price, a faucet or a pool and this test fails, so the change is seen in review together with docs/generated/gem-sim.md.

test("the expected gem find is the real roll's mean (exact sum against a long sample)", () => {
	const rng = mulberry32(7);
	let sum = 0;
	const N = 200_000;
	for (let i = 0; i < N; i++) sum += rollGemAmount(rng);
	assert.ok(Math.abs(sum / N - expectedGemFind()) < 0.1, `${sum / N} vs ${expectedGemFind()}`);
});

test('chest gems per day: a chest every 720 s at Luck 0, a 3% roll of about 20 gems, scaled by the share picked up', () => {
	assert.equal(Math.round(chestGemsPerDay(0, 1)), 72);
	assert.equal(Math.round(chestGemsPerDay(0, 0.5)), 36);
	assert.equal(Math.round(chestGemsPerDay(100, 0.5)), 172);
	assert.equal(Math.round(chestGemsPerDay(300, 1)), 715);
	assert.equal(chestGemsPerDay(0, 0), 0);
});

test('the daily bonus pays 35 a day on a full streak and only day 1 when claimed every other day', () => {
	assert.equal(dailyGemsPerDay(1), 35);
	assert.equal(dailyGemsPerDay(2), 10);
});

test("the one-off pools are the catalogs' totals", () => {
	assert.deepEqual(gemPools(), { achievements: 27_600, milestones: 2_800, mastery: 1_380 });
});

test('the claimed share rises in a straight line between the listed days and stops at the last', () => {
	assert.equal(claimedShare(0), 0);
	assert.equal(claimedShare(7), 0.05);
	assert.equal(claimedShare(180), 0.7);
	assert.equal(claimedShare(1000), CLAIMED_SHARE[CLAIMED_SHARE.length - 1][1]);
	assert.ok(claimedShare(60) > claimedShare(30) && claimedShare(60) < claimedShare(90));
});

test('gems earned by day, pinned per profile', () => {
	const earned = Object.fromEntries(GEM_PROFILES.map((p) => [p.id, [7, 30, 90, 180].map((d) => Math.round(earnedBy(p, d)))]));
	assert.deepEqual(earned, { casual: [1840, 7453, 17798, 29516], regular: [2966, 12279, 32276, 58471], dedicated: [6770, 28582, 81186, 156293] });
});

test('days to earn: the first whole day, and null when it never happens', () => {
	const regular = GEM_PROFILES.find((p) => p.id === 'regular')!;
	assert.equal(daysToEarn(regular, 1), 1);
	assert.equal(daysToEarn(regular, 1_000_000_000), null);
});

test('the price book lists every shop item (a tiered one per level) and the planned Cap Breaks on top', () => {
	const book = priceBook();
	const built = book.filter((r) => !r.planned);
	assert.equal(
		built.length,
		GEM_SHOP.reduce((n, item) => n + (item.tiers?.length ?? 1), 0),
	);
	assert.deepEqual(
		book.filter((r) => r.planned).map((r) => r.price),
		[300, 750, 1875],
		'300 x 2.5^(n-1), rounded up',
	);
});

test('the whole shop and the target checks, pinned', () => {
	const r = runGemSim();
	assert.equal(r.wholeList.total, 67_500);
	assert.deepEqual(r.wholeList.days, { casual: 1011, regular: 224, dedicated: 75 });
	assert.equal(r.capBreaksAll, 14_625);
	assert.deepEqual(
		r.checks.map((c) => [c.id, c.ok]),
		[
			['identity-week1', true],
			['qol-week2', true],
			['cap-break-week4-8', true],
			['whole-list-months', true],
			['purse-day1', false],
		],
	);
	assert.match(r.checks.find((c) => c.id === 'purse-day1')!.detail, /Name colours \(1000\), Overnight Orders \(1000\)/);
	assert.ok(STARTING_GEMS === 1000, 'the purse check is written for the 1,000 start purse');
});

test('the report names every profile and the targets table', () => {
	const text = renderGemSim(runGemSim());
	for (const p of GEM_PROFILES) assert.ok(text.includes(`| ${p.label} |`));
	assert.ok(text.includes('## Targets (docs/plan/30 section 9)'));
});
