import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_QUEUE, EMPTY_STOCK, selectQueue, selectStock } from '@/stores/craftStore';

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
	const state = { craft: { xp: 0, ord: 0, stock, pity: {}, spent: 0, last: 0, queue: [] } };
	assert.equal(selectStock(state), stock);
	assert.equal(selectStock(state), selectStock(state));
});

test('the queue selector returns one shared empty list before the server answers, and the held queue itself after', () => {
	assert.equal(selectQueue({ craft: null }), selectQueue({ craft: null }));
	assert.equal(selectQueue({ craft: null }), EMPTY_QUEUE);
	const queue = [{ recipeId: 'glass_vial', count: 5, startedAt: 1, timeSec: 10 }];
	const state = { craft: { xp: 0, ord: 0, stock: {}, pity: {}, spent: 0, last: 0, queue } };
	assert.equal(selectQueue(state), queue);
});

// The Crafting window crashed again when the trade goods arrived: they had no icon, so `PixelIcon` read the size of `undefined`.
test('every item a recipe makes has a sprite the icon set knows', async () => {
	const { RECIPES } = await import('@/catalog/recipes');
	const { ITEM_CATALOG } = await import('@/catalog');
	const { itemIconName } = await import('@/components/game/itemUi');
	const { PIXEL_ICON_SIZES } = await import('@/config/pixelIcons');
	for (const recipe of RECIPES) {
		if (!('item' in recipe.output)) continue;
		const name = itemIconName(ITEM_CATALOG[recipe.output.item]);
		assert.ok(name && name in PIXEL_ICON_SIZES, `${recipe.id}: icon ${String(name)}`);
	}
});
