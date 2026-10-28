import test from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCE_ORDER, sortedCostEntries } from '../src/catalog';

test('a cost bundle is listed in catalog order whatever order it was built in', () => {
	// the explore cost is built wood, stone, coal, food, hide, and gold is added last
	const tile = { wood: 5, stone: 4, coal: 3, food: 2, hide: 1, gold: 9 };
	assert.deepEqual(
		sortedCostEntries(tile).map(([key]) => key),
		['gold', 'wood', 'stone', 'coal', 'food', 'hide']
	);
	assert.deepEqual(
		sortedCostEntries({ food: 1, wood: 2 }).map(([key]) => key),
		['wood', 'food']
	);
});

test('zero and missing amounts are left out, unknown keys go last', () => {
	assert.deepEqual(sortedCostEntries({ stone: 0, wood: 3, coal: undefined }), [['wood', 3]]);
	assert.deepEqual(
		sortedCostEntries({ mystery: 1, gold: 2 }).map(([key]) => key),
		['gold', 'mystery']
	);
});

test('the order starts with gold, then the base materials', () => {
	assert.deepEqual(RESOURCE_ORDER.slice(0, 5), ['gold', 'wood', 'stone', 'coal', 'food']);
});
