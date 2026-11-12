import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, clampWindowPosition, clampWindowSize, compact, gemStates, hasGlow, upgradeState } from '../../packages/design-system/src/logic';

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

test('clamp: an empty range keeps the minimum', () => {
	assert.equal(clamp(5, 0, 10), 5);
	assert.equal(clamp(-3, 0, 10), 0);
	assert.equal(clamp(50, 0, 10), 10);
	assert.equal(clamp(5, 20, 10), 20);
});

test('clampWindowPosition: 80 px stays visible sideways, the title stays under the header and above the bottom', () => {
	const size = { w: 400, h: 300 };
	const view = { w: 1000, h: 700 };
	assert.deepEqual(clampWindowPosition({ x: -999, y: -999 }, size, view, { minY: 76 }), { x: -320, y: 76 });
	assert.deepEqual(clampWindowPosition({ x: 5000, y: 5000 }, size, view, { minY: 76 }), { x: 920, y: 660 });
	assert.deepEqual(clampWindowPosition({ x: 100, y: 200 }, size, view), { x: 100, y: 200 });
});

test('clampWindowSize: never below the minimum, never past the screen edge', () => {
	const min = { w: 420, h: 260 };
	assert.deepEqual(clampWindowSize({ w: 800, h: 600 }, { x: -900, y: -900 }, min, { w: 1000, h: 700 }), min);
	assert.deepEqual(clampWindowSize({ w: 800, h: 600 }, { x: 900, y: 900 }, min, { w: 1000, h: 700 }), { w: 992, h: 692 });
});

// IDL-318: the AmountInput's pure rules

import { clampAmount, parseAmountText } from '../../packages/design-system/src/logic';
import { parseAmount } from '../../src/utils/formatters';

test('parseAmountText reads the typed amounts of the trade ticket exactly like the game does', () => {
	for (const text of ['250', '1,500', '1.5k', '2m', '3B', ' 4 k ', '12.5M', '1t', '0', '', '-5', '1x', 'abc', '0.4', '1.5.2'])
		assert.equal(parseAmountText(text), parseAmount(text), `"${text}"`);
	assert.equal(parseAmountText('1.5k'), 1500);
	assert.equal(parseAmountText('2m'), 2_000_000);
	assert.equal(parseAmountText('0'), null);
});

test('clampAmount holds an amount between 0 and the stock', () => {
	assert.equal(clampAmount(5_000, 1_200), 1_200);
	assert.equal(clampAmount(-3, 10), 0);
	assert.equal(clampAmount(Number.NaN, 10), 0);
	assert.equal(clampAmount(7.9, 10), 7);
});

test('toRarity maps a game rarity id onto the design-system one and reads anything unknown as common', async () => {
	const { toRarity } = await import('../../packages/design-system/src/logic');
	assert.equal(toRarity('epic'), 'epic');
	assert.equal(toRarity('mythic'), 'common');
	assert.equal(toRarity(undefined), 'common');
	assert.equal(toRarity(''), 'common');
});
