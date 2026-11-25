import assert from 'node:assert/strict';
import test from 'node:test';
import { itemTierLabel } from '../../src/catalog/stats';

// IDL-45: the tier label of the item card, read from the item level.

test('the tier follows the item level: I 1-19, II 20-39, III 40-59, IV 60-79, V 80 and up', () => {
	const at = (levels: number[]) => levels.map(itemTierLabel);
	assert.deepEqual(at([1, 10, 19]), ['I', 'I', 'I']);
	assert.deepEqual(at([20, 39]), ['II', 'II']);
	assert.deepEqual(at([40, 59]), ['III', 'III']);
	assert.deepEqual(at([60, 79]), ['IV', 'IV']);
	assert.deepEqual(at([80, 100]), ['V', 'V']);
	assert.deepEqual(at([0, -5, 19.6]), ['I', 'I', 'II'], 'out-of-range and fractional levels are rounded into range');
});
