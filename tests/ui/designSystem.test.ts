import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compact, gemStates, hasGlow, upgradeState } from '../../packages/design-system/src/logic';

test('gemStates: yellow gems for the level, dim for the rest, purple once maxed', () => {
	assert.deepEqual(gemStates(0, 3), ['off', 'off', 'off']);
	assert.deepEqual(gemStates(2, 4), ['on', 'on', 'off', 'off']);
	assert.deepEqual(gemStates(3, 3), ['max', 'max', 'max']);
});

test('gemStates clamps bad input', () => {
	assert.equal(gemStates(5, 1000).length, 20);
	assert.deepEqual(gemStates(-4, 2), ['off', 'off']);
	assert.deepEqual(gemStates(9, 2), ['max', 'max']);
});

test('upgradeState: maxed, ready or short', () => {
	assert.equal(upgradeState(4, 4, 0, 0), 'maxed');
	assert.equal(upgradeState(1, 4, 100, 100), 'ready');
	assert.equal(upgradeState(1, 4, 100, 99), 'short');
});

test('hasGlow: every rarity above common glows', () => {
	assert.equal(hasGlow('common'), false);
	assert.equal(hasGlow(undefined), false);
	assert.equal(hasGlow('rare'), true);
});

test('compact short numbers', () => {
	assert.equal(compact(950), '950');
	assert.equal(compact(1500), '1.5K');
	assert.equal(compact(2_800_000), '2.80M');
});
