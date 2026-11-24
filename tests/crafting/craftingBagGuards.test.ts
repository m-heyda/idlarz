import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { INGREDIENTS } from '../../src/catalog/ingredients';
import { COMPONENTS, RECIPES } from '../../src/catalog/recipes';
import { addToBag, emptyBag } from '../../src/lib/inventory';
import { countJunk, junkSale } from '../../src/lib/loot/junk';
import { applyWithdraw } from '../../src/lib/offline/craft';
import { emptyCraft } from '../../src/lib/crafting';
import type { Inventory } from '../../src/lib/offline/types';

// IDL-350: ingredients and components are tooltip-only: they live in the Crafting bag, can never be taken out and can never be sold.

const inv = (): Inventory => ({ ver: 1, bag: Array.from({ length: 12 }, () => null), equipment: {}, lootPity: {}, autoSellUpTo: null }) as unknown as Inventory;
const T0 = 9_000_000;

test('no ingredient or component is an item: the bag cannot hold one, so no sell path can reach it', () => {
	for (const def of INGREDIENTS) assert.equal(ITEM_CATALOG[def.id], undefined, `${def.id} is no item`);
	const components = Object.keys(COMPONENTS).filter((id) => !RECIPES.some((r) => 'item' in r.output && r.output.item === id));
	assert.ok(components.length > 40);
	for (const id of components) {
		assert.equal(ITEM_CATALOG[id], undefined, `${id} is no item`);
		const put = addToBag(emptyBag(), id, 5);
		assert.equal(put.added, 0, `${id} does not enter the bag`);
		assert.equal(put.bag.filter(Boolean).length, 0);
	}
});

test('the server refuses to withdraw a component or an ingredient, whatever is in the stash, and charges nothing', () => {
	const stock = { glass_vial: 5, ing_blood: 5, cut_ruby: 2, steel_ingot: 3, gem_grit: 9 };
	const craft = { ...emptyCraft(), stock };
	for (const id of Object.keys(stock)) {
		const out = applyWithdraw(inv(), craft, id, 1, T0);
		assert.equal(out.ok, false, id);
		assert.equal(out.reason, 'bad_request', id);
		assert.deepEqual(out.craft.stock, stock, `${id}: the stash is untouched`);
	}
});

test('a crafted potion can be taken out (that is what the stash is for), and Sell junk never counts anything in the stash', () => {
	const craft = { ...emptyCraft(), stock: { elixir_might: 4, ing_blood: 100 } };
	const out = applyWithdraw(inv(), craft, 'elixir_might', 3, T0);
	assert.equal(out.ok, true);
	assert.equal(out.moved, 3);
	assert.equal(out.craft.stock.ing_blood, 100, 'the ingredient stays');
	const bag = out.inv.bag;
	assert.equal(countJunk(bag), 0);
	assert.equal(junkSale(bag, {}).gold, 0, 'potions are not junk and the stash is not the bag');
});
