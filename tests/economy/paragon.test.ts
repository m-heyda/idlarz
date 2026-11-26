import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELING } from '../../src/config/character';
import { calculateParagon, cumulativeParagonXp, cumulativeXp, paragonStepXp } from '../../src/utils/game/character';

// Paragon (docs/plan/paragon.md): the levels past 100, from lifetime XP. Step from paragon p to p+1 costs paragonFirstStepXp x paragonGrowth^p.

const base = cumulativeXp(100);
const near = (actual: number, expected: number, what: string) =>
	assert.ok(
		Math.abs(actual / expected - 1) < 0.025, // the design's totals are rounded to two figures (1.285e11 is written 1.3e11)
		`${what}: ${actual} vs ${expected}`,
	);

test('the totals follow the design: paragon 50 to 1,000', () => {
	near(cumulativeParagonXp(50), 1.1e10, 'paragon 50');
	near(cumulativeParagonXp(100), 2.3e10, 'paragon 100');
	near(cumulativeParagonXp(200), 5.2e10, 'paragon 200');
	near(cumulativeParagonXp(300), 8.6e10, 'paragon 300');
	near(cumulativeParagonXp(400), 1.3e11, 'paragon 400');
	near(cumulativeParagonXp(500), 1.8e11, 'paragon 500');
	near(cumulativeParagonXp(1000), 6.7e11, 'paragon 1,000');
	assert.equal(cumulativeParagonXp(0), 0);
});

test('the ceiling stays below 2^53 so the XP is still exact', () => {
	assert.equal(LEVELING.paragonCap, 5000);
	assert.ok(cumulativeParagonXp(5000) + base < 2 ** 53);
});

test('the steps: 2.1e8 first, growing 0.2 % a level, none at the ceiling', () => {
	assert.equal(paragonStepXp(0), 2.1e8);
	const last = paragonStepXp(499);
	assert.ok(last > 5.6e8 && last < 5.8e8, `step 499 = ${last}`);
	assert.equal(paragonStepXp(5000), 0);
	assert.equal(paragonStepXp(6000), 0);
});

test('below the level-100 total there is no paragon, and at it paragon is 0 with no progress', () => {
	assert.deepEqual(calculateParagon(base - 1), { paragon: 0, progress: 0, into: 0, needed: paragonStepXp(0) });
	const at = calculateParagon(base);
	assert.equal(at.paragon, 0);
	assert.equal(at.progress, 0);
});

test('every boundary steps up exactly there, one XP less stays below', () => {
	for (const n of [1, 2, 10, 99, 100, 499, 500, 999, 1000, 4999, 5000]) {
		const exact = base + cumulativeParagonXp(n);
		assert.equal(calculateParagon(exact).paragon, n, `paragon ${n} at its total`);
		assert.equal(calculateParagon(exact - 1).paragon, n - 1, `paragon ${n - 1} one XP below`);
	}
});

test('progress is the share of the current step', () => {
	const half = calculateParagon(base + cumulativeParagonXp(10) + paragonStepXp(10) / 2);
	assert.equal(half.paragon, 10);
	assert.ok(Math.abs(half.progress - 0.5) < 1e-6);
	assert.equal(half.needed, paragonStepXp(10));
	assert.ok(Math.abs(half.into - paragonStepXp(10) / 2) < 1);
});

test('garbage XP never gives NaN or a negative paragon', () => {
	for (const xp of [Number.NaN, Number.POSITIVE_INFINITY, -5, 0, 1e30]) {
		const p = calculateParagon(xp);
		assert.ok(Number.isInteger(p.paragon) && p.paragon >= 0 && p.paragon <= 5000, `paragon of ${xp}`);
		assert.ok(Number.isFinite(p.progress) && p.progress >= 0 && p.progress <= 1, `progress of ${xp}`);
	}
	assert.equal(calculateParagon(1e30).paragon, 5000);
});

test('at the ceiling there is nothing to go', () => {
	const top = calculateParagon(1e30);
	assert.equal(top.progress, 1);
	assert.equal(top.needed, 0);
});

test('the banked XP of the first level-100 player lands near paragon 183, not 400', () => {
	const p = calculateParagon(6.5e10).paragon;
	assert.ok(p > 150 && p < 220, `paragon ${p}`);
});
