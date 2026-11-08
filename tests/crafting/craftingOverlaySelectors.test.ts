import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_STOCK, selectStock } from '@/stores/craftStore';

// The Crafting window crashed the whole app when it first opened: before the server's first answer `craft` is null and the stock selector
// returned a NEW `{}` on every call, which Zustand 5 (useSyncExternalStore) treats as a state change forever. A selector must give back the
// same reference for the same state.

test('the stock selector returns one shared empty stock while the server has not answered', () => {
	const first = selectStock({ craft: null });
	const second = selectStock({ craft: null });
	assert.equal(first, second, 'same reference twice, or React re-renders in a loop');
	assert.equal(first, EMPTY_STOCK);
	assert.deepEqual(first, {});
});

test('the stock selector returns the held stock itself, not a copy', () => {
	const stock = { glass_vial: 3 };
	const state = { craft: { xp: 0, ord: 0, stock, pity: {}, spent: 0, last: 0 } };
	assert.equal(selectStock(state), stock);
	assert.equal(selectStock(state), selectStock(state));
});
