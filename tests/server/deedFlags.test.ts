import test from 'node:test';
import assert from 'node:assert/strict';
import { crossedGoldTier } from '../../src/lib/goldTiers';
import { FORGED_GOLD_FLAGS, FORGED_LAND_FLAGS } from '../../src/lib/cloudSave/verify';

test('only forged land or gold flags keep land facts and gold out of the deeds', () => {
	for (const flag of ['castle_jump', 'timer_jump', 'xp_jump', 'ember_jump', 'playtime_regress', 'prestige_regress'] as const) {
		assert.equal(FORGED_LAND_FLAGS.has(flag), false);
		assert.equal(FORGED_GOLD_FLAGS.has(flag), false);
	}
	assert.equal(FORGED_LAND_FLAGS.has('networth_exceeds'), true);
	assert.equal(FORGED_GOLD_FLAGS.has('gold_jump'), true);
});

test('a Hoarder tier crossed between two ticks asks for an upload', () => {
	assert.equal(crossedGoldTier(99_999, 100_000), true);
	assert.equal(crossedGoldTier(1_500_000_000, 1_500_000_100), false);
	assert.equal(crossedGoldTier(2_000_000, 500), false);
});
