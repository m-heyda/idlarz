import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFTING } from '../../src/config/crafting';
import { newLedger } from '../../src/lib/offline/ledger';
import { moveIngredientStacks } from '../../src/lib/offline/ingredientMove';
import type { Inventory } from '../../src/lib/offline/types';

const ledgerWith = (bag: Inventory['bag'], stock: Record<string, number> = {}) => {
	const base = newLedger(0);
	const inv: Inventory = { ver: 4, bag, equipment: {}, lootPity: {}, autoSellUpTo: null } as Inventory;
	return { ...base, inv, craft: { ...base.craft, stock } };
};

test('ingredient stacks already in the bag move into the Crafting bag, and plain junk stays', () => {
	const before = ledgerWith([{ id: 'junk_blood', qty: 2 }, { id: 'junk_clay', qty: 3 }, null, { id: 'junk_rubble', qty: 40 }, { id: 'junk_blood', qty: 1 }], {
		ing_blood: 5,
	});
	const after = moveIngredientStacks(before);
	assert.equal(after.craft.stock.ing_blood, 8, 'both blood stacks joined the 5 already there');
	assert.equal(after.craft.stock.ing_clay, 3);
	assert.deepEqual(after.inv!.bag, [null, null, null, { id: 'junk_rubble', qty: 40 }, null], 'only the ingredients left; the rubble is junk for the merchant');
	assert.equal(after.inv!.ver, 5, 'the bag version moves on so the browser fetches the new bag');
});

test('with nothing to move it is the same ledger, and a second pass finds nothing', () => {
	const plain = ledgerWith([{ id: 'junk_rubble', qty: 4 }, null]);
	assert.equal(moveIngredientStacks(plain), plain);
	const once = moveIngredientStacks(ledgerWith([{ id: 'junk_clay', qty: 3 }]));
	assert.equal(moveIngredientStacks(once), once, 'idempotent: no write and no new bag version');
});

test('what does not fit in a full Crafting bag stays in the bag', () => {
	const cap = CRAFTING.componentCap;
	const after = moveIngredientStacks(ledgerWith([{ id: 'junk_clay', qty: 10 }], { ing_clay: cap - 4 }));
	assert.equal(after.craft.stock.ing_clay, cap);
	assert.deepEqual(after.inv!.bag, [{ id: 'junk_clay', qty: 6 }]);
	const full = ledgerWith([{ id: 'junk_clay', qty: 10 }], { ing_clay: cap });
	assert.equal(moveIngredientStacks(full), full, 'a full Crafting bag moves nothing');
});

test('gear and a ledger without a bag are left alone', () => {
	const none = { ...newLedger(0), inv: null } as unknown as ReturnType<typeof newLedger>;
	assert.equal(moveIngredientStacks(none), none);
});
