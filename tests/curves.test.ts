import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { BASE_TILE_COST, BASE_XP_PER_TILE, RESOURCE_CAP, SCALING_CONFIG, TILE_PRICE, XP_CAP, XP_LEVEL_SOFT, XP_TILE } from '../src/config/gameConfig';
import { calculateBuildingCost, calculateLevel, calculateXpGain, OLD_XP_LEVEL_SOFT, xpToLeaveLevel } from '../src/utils/gameUtils';
import { setTiles, EMPTY_WORLD } from '../src/utils/world';
import { formatCompact, formatNumber, formatPct, formatPercent, formatRate } from '../src/utils/formatters';

// The tile price and the XP per tile used to be pure exponentials that stopped being payable at ~157 tiles. They now have a
// polynomial tail; below the tail start the price is exactly the three exponential stages of SCALING_CONFIG.

/** The three exponential stages written out from the config, kept here as the reference. */
const stagedPrice = (n: number) => {
	const S = SCALING_CONFIG;
	return Math.floor(
		BASE_TILE_COST *
			Math.pow(S.growthEarly, Math.min(n, S.earlyTiles)) *
			Math.pow(S.growthLate, Math.max(Math.min(n, S.lateTiles) - S.earlyTiles, 0)) *
			Math.pow(S.growthEndgame, Math.max(n - S.lateTiles, 0))
	);
};
const oldXp = (n: number) => BASE_XP_PER_TILE * Math.pow(1.02, n - 1) * (n / 4);

test('tile price: the three exponential stages up to the tail start', () => {
	for (let n = 0; n <= TILE_PRICE.tailFrom; n++) assert.equal(SCALING_CONFIG.costFormula(n), stagedPrice(n), `n=${n}`);
});

test('tile price: pacing anchors (cheap to ~100 tiles, a long soft middle to 300)', () => {
	const price = SCALING_CONFIG.costFormula;
	assert.ok(price(1) <= 100, 'the first tile is nearly free');
	assert.ok(price(50) < 10_000, 'tile 50 is an hour-ish');
	assert.ok(price(100) < 250_000, 'tile 100 stays within the first day');
	assert.ok(price(300) < 1_500_000, 'tile 300 is a 2-3 day goal');
	let cumulative = 0;
	for (let n = 1; n <= 300; n++) cumulative += price(n);
	assert.ok(cumulative < 1e8, '300 tiles cost under 1e8 gold in total');
});

test('tile price: finite, rising and never above the ceiling, for any number of tiles', () => {
	let last = 0;
	for (const n of [100, 101, 157, 300, 1000, 3000, 10_000, 30_000, 50_000, 250_000, 1e6, 1e9]) {
		const p = SCALING_CONFIG.costFormula(n);
		assert.ok(Number.isFinite(p) && (n <= 250_000 ? p > last : p >= last), `n=${n} price ${p}`);
		assert.ok(p <= TILE_PRICE.ceiling, `n=${n} below the ceiling`);
		last = p;
	}
	// the old curve passed the resource cap at 157 tiles; this one is still comfortably payable far past it
	assert.ok(SCALING_CONFIG.costFormula(157) < RESOURCE_CAP / 1000);
	assert.ok(SCALING_CONFIG.costFormula(50_000) < RESOURCE_CAP, 'a 50,000-tile map is buyable');
});

test('tile price: past the tail start the climb is steeper than before it, then eases off towards a polynomial', () => {
	const ratio = (n: number) => SCALING_CONFIG.costFormula(n + 1) / SCALING_CONFIG.costFormula(n);
	assert.ok(ratio(TILE_PRICE.tailFrom) > SCALING_CONFIG.growthEndgame, 'harder once the map is filled');
	let lastRatio = ratio(TILE_PRICE.tailFrom);
	for (let n = TILE_PRICE.tailFrom + 1; n < 5000; n += 7) {
		assert.ok(ratio(n) <= lastRatio + 1e-9, `n=${n}: ${ratio(n)} vs ${lastRatio}`);
		lastRatio = ratio(n);
	}
	// 100 tiles past the fill line cost clearly more than the 100 before it
	const stretch = (from: number) => Array.from({ length: 100 }, (_, i) => SCALING_CONFIG.costFormula(from + i)).reduce((a, b) => a + b, 0);
	assert.ok(stretch(TILE_PRICE.tailFrom) > 2.5 * stretch(TILE_PRICE.tailFrom - 100));
});

test('XP per tile: identical to the old curve up to the tail start, finite and slow after it', () => {
	for (let n = 1; n <= XP_TILE.growthUntil; n++) assert.equal(calculateXpGain(n), oldXp(n), `n=${n}`);
	let cumulative = 0;
	let last = 0;
	for (let n = 2; n <= 250_000; n++) {
		const xp = calculateXpGain(n);
		assert.ok(Number.isFinite(xp) && xp >= last, `n=${n}`);
		last = xp;
		cumulative += xp;
	}
	assert.ok(cumulative < XP_CAP / 100, `a 250,000-tile map's XP (${cumulative}) fits well under the cap`);
});

test('levels: terminate for any XP, including absurd and non-finite values', () => {
	assert.deepEqual(calculateLevel(0), { level: 1, progress: 0 });
	for (const xp of [1e9, XP_CAP, XP_CAP * 1e30, Infinity, NaN]) {
		const { level, progress } = calculateLevel(xp);
		assert.ok(Number.isInteger(level) && level >= 1 && progress >= 0 && progress <= 1, `xp=${xp}`);
	}
});

test('big numbers are shown with suffixes up to Sx, then scientific, and never as Infinity text by accident', () => {
	assert.equal(formatNumber(1_500_000), '1.50M');
	assert.equal(formatNumber(2.5e9), '2.50B');
	assert.equal(formatNumber(3e12), '3.00T');
	assert.equal(formatNumber(4e15), '4.00Qa');
	assert.equal(formatNumber(5e18), '5.00Qi');
	assert.equal(formatNumber(6e21), '6.00Sx');
	assert.equal(formatNumber(7e24), '7.00e24');
	assert.equal(formatNumber(12_345), '12.35K');
	assert.equal(formatRate(2e15), '+2.00Qa/s');
	assert.equal(formatRate(-3e6), '-3.00M/s');
	assert.equal(formatRate(1234.5), '+1234.50/s');
});

test('stats and percentages use the same short notation: plain below 10,000 (5,000 for a percentage), then K / M / B / T', () => {
	assert.equal(formatCompact(40.8), '40.8');
	assert.equal(formatCompact(281), '281');
	assert.equal(formatCompact(6.004), '6');
	assert.equal(formatCompact(2.456, 2), '2.46');
	assert.equal(formatCompact(9999), '9999');
	assert.equal(formatCompact(174_198_138), '174.20M');
	assert.equal(formatCompact(2.5e9), '2.50B');
	assert.equal(formatCompact(undefined), '0');
	assert.equal(formatPct(27.34), '27.3%');
	assert.equal(formatPct(4999), '4999%');
	assert.equal(formatPct(14_080), '14.08K%');
	assert.equal(formatPct(3e6), '3.00M%');
	assert.equal(formatPercent(4999), '4999%');
	assert.equal(formatPercent(5000), '5.00K%');
	assert.equal(formatPercent(450), '450%');
});

test('building cost stays finite however many buildings stand', () => {
	const built = Array.from({ length: 6000 }, (_, i) => ({ x: i % 100, y: Math.floor(i / 100), tile: { biome: 'plains' as const, isOwned: true, building: 'farm' } }));
	const cost = calculateBuildingCost(setTiles(EMPTY_WORLD, built));
	for (const [resource, amount] of Object.entries(cost)) {
		assert.ok(Number.isFinite(amount) && (amount as number) <= RESOURCE_CAP / 100, `${resource}: ${amount}`);
	}
});

test('level curve: the old x1.3 per level up to the soft level, gentler after, so level 100 is a real (if distant) goal', () => {
	for (let level = 1; level <= XP_LEVEL_SOFT.fromLevel; level++) assert.equal(xpToLeaveLevel(level), Math.floor(750 * Math.pow(1.3, level - 1)), `level ${level}`);
	for (let level = XP_LEVEL_SOFT.fromLevel + 1; level <= 100; level++) {
		assert.ok(xpToLeaveLevel(level) > xpToLeaveLevel(level - 1), `still growing at ${level}`);
		assert.ok(xpToLeaveLevel(level) < xpToLeaveLevel(level, OLD_XP_LEVEL_SOFT), `softer than the old curve at ${level}`);
	}
	// total XP for level 100: reachable by a run of a thousand-odd tiles, nowhere near the cap
	let total = 0;
	for (let level = 1; level < 100; level++) total += xpToLeaveLevel(level);
	assert.ok(total > 1e9 && total < 5e10, `level 100 needs ${total.toExponential(2)} XP`);
	assert.equal(calculateLevel(total).level, 100);
	assert.equal(calculateLevel(total - 1).level, 99);
	// a save never has a lower level than the old curve gave it
	for (const xp of [0, 5e3, 1e6, 5e7, 1.5e8, 1e10, 1e12]) assert.ok(calculateLevel(xp).level >= calculateLevel(xp, OLD_XP_LEVEL_SOFT).level, `xp=${xp}`);
});
