import assert from 'node:assert/strict';
import test from 'node:test';
import { DAILY_CHEST } from '../../src/config/gemShop';
import { CHEST } from '../../src/config/spawns';

// IDL-197 and IDL-357: what a chest is worth, in minutes of income, worked out from the config (no dice), so a change to the chest numbers shows in review.

const mean = ([lo, hi]: [number, number]) => (lo + hi) / 2;
const weights = Object.values(CHEST.rewards).reduce((a, b) => a + b, 0);
const share = (kind: keyof typeof CHEST.rewards) => CHEST.rewards[kind] / weights;

/** Expected minutes of one resource's income that one ordinary chest holds as a bundle: chance x kinds x minutes each. */
const bundleMinutes = share('bundle') * mean(CHEST.bundle.count) * mean(CHEST.bundle.minutes);
/** Expected minutes of gold income of one ordinary chest (gold chest, and the lucky chest at x1.5). */
const goldMinutes =
	share('gold') * mean([CHEST.minMinutes, CHEST.maxMinutes]) + share('boost') * mean([CHEST.minMinutes, CHEST.maxMinutes]) * CHEST.boostMultiplier;

test('IDL-197: a bundle chest is 40 of 120 weight and pays 20-45 minutes of 1-2 resources', () => {
	assert.equal(CHEST.rewards.bundle, 40);
	assert.deepEqual(CHEST.bundle.minutes, [20, 45]);
	assert.ok(Math.abs(share('bundle') - 1 / 3) < 1e-12);
	assert.ok(Math.abs(bundleMinutes - (1 / 3) * 1.5 * 32.5) < 1e-9);
	assert.ok(bundleMinutes > 15 && bundleMinutes < 17, `${bundleMinutes} minutes of one resource per chest`);
});

test('IDL-197: a bundle is now worth about as much as the gold of a chest, and gold stays as it was', () => {
	assert.ok(
		bundleMinutes > goldMinutes * 0.8 && bundleMinutes < goldMinutes * 1.2,
		`bundle ${bundleMinutes.toFixed(1)} min against gold ${goldMinutes.toFixed(1)} min`,
	);
	assert.ok(goldMinutes > 14 && goldMinutes < 22);
	assert.deepEqual([CHEST.minMinutes, CHEST.maxMinutes], [10, 60], 'the gold chest is untouched');
});

test('IDL-357: the day 7 chest is a treat, under 1 % of the chests of a week', () => {
	const dailyMinutes = mean(DAILY_CHEST.count) * mean(DAILY_CHEST.minutes);
	assert.equal(dailyMinutes, 240);
	const chestsPerWeek = (7 * 24 * 3600) / CHEST.intervalSec;
	const weekMinutes = chestsPerWeek * (bundleMinutes + goldMinutes);
	assert.ok(dailyMinutes / weekMinutes < 0.01, `${((dailyMinutes / weekMinutes) * 100).toFixed(2)} % of a week of chests`);
});
