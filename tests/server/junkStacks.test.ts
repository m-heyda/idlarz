import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot } from '../helpers';
import { ITEM_CATALOG } from '../../src/catalog';
import { JUNK_ITEMS, JUNK_STACK } from '../../src/catalog/items/junk';
import { addToBag, emptyBag, mergeJunk, slotQty } from '../../src/lib/inventory';
import { junkGold, junkSale } from '../../src/lib/loot/junk';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { mergeJunkStacks } from '../../src/lib/offline/junkMerge';
import { newLedger } from '../../src/lib/offline/ledger';
import { readInventory } from '../../src/lib/offline/ledgerRead';
import { formatStack } from '../../src/utils/formatters';
import type { Inventory } from '../../src/lib/offline/types';

// Junk has no practical stack limit (owner request 2026-11-24): one kind of junk is one bag slot, however much of it you carry.

const ledgerWith = (bag: Inventory['bag']) => {
	const base = newLedger(0);
	return { ...base, inv: { ver: 4, bag, equipment: {}, lootPity: {}, autoSellUpTo: null } as Inventory };
};

test('every junk material stacks to JUNK_STACK, a trillion, whatever its rarity; potions still stack to 100', () => {
	for (const item of JUNK_ITEMS) assert.equal(item.stackMax, JUNK_STACK, item.id);
	assert.equal(JUNK_STACK, 1e12);
	assert.equal(ITEM_CATALOG.potion_minor.stackMax, 100);
});

test('millions of one junk material, and many drops of it, stay in one slot', () => {
	let bag = emptyBag();
	for (let i = 0; i < 30; i++) bag = addToBag(bag, 'junk_rubble', 400_000).bag;
	assert.deepEqual(bag.filter(Boolean), [{ id: 'junk_rubble', qty: 12_000_000 }]);
	const more = addToBag(bag, 'junk_amethyst', 5_000_000);
	assert.equal(more.overflow, 0);
	assert.equal(more.bag.filter(Boolean).length, 2, 'two kinds, two slots');
});

test('a bag from the old stack sizes (several stacks of one junk) merges into the first slot, once', () => {
	const old = [{ id: 'junk_rubble', qty: 100_000 }, { id: 'potion_minor', qty: 9 }, { id: 'junk_rubble', qty: 100_000 }, null, { id: 'junk_rubble', qty: 7 }];
	const merged = mergeJunk(old);
	assert.deepEqual(merged, [{ id: 'junk_rubble', qty: 200_007 }, { id: 'potion_minor', qty: 9 }, null, null, null]);
	assert.equal(mergeJunk(merged), merged, 'nothing left to merge: the same bag');
	// potions are never merged here (their stacks follow `stackMax` 100)
	const potions = [
		{ id: 'potion_minor', qty: 9 },
		{ id: 'potion_minor', qty: 9 },
	];
	assert.equal(mergeJunk(potions), potions);
});

test('the server merges split junk in the ledger, moves the bag version on, and a second pass changes nothing', () => {
	const ledger = ledgerWith([
		{ id: 'junk_scrap', qty: 90_000 },
		{ id: 'junk_scrap', qty: 90_000 },
		{ id: 'junk_scrap', qty: 5 },
	]);
	const once = mergeJunkStacks(ledger);
	assert.deepEqual(once.inv!.bag, [{ id: 'junk_scrap', qty: 180_005 }, null, null]);
	assert.equal(once.inv!.ver, 5);
	assert.equal(mergeJunkStacks(once), once, 'idempotent: no write and no new version');
	const plain = ledgerWith([{ id: 'junk_scrap', qty: 5 }, null]);
	assert.equal(mergeJunkStacks(plain), plain);
});

test('a ledger bag keeps a stack far above the old junk limit, and still cuts a potion stack to 100', () => {
	const inv = readInventory({
		ver: 1,
		bag: [
			{ id: 'junk_rubble', qty: 7_000_000_000 },
			{ id: 'potion_minor', qty: 5000 },
		],
		equipment: {},
		lootPity: {},
		autoSellUpTo: null,
	});
	assert.ok(inv);
	assert.equal(slotQty(inv!.bag[0]), 7_000_000_000);
	assert.equal(slotQty(inv!.bag[1]), 100);
});

test('a save keeps a junk stack above a billion (the old save cap), cuts potions to their stack size, and merges split junk', () => {
	freshGame();
	growTo(10);
	api().tick(60_000);
	const raw = rawSnapshot();
	raw.bag[0] = { id: 'junk_rubble', qty: 3_000_000_000 };
	raw.bag[1] = { id: 'junk_rubble', qty: 50_000 };
	raw.bag[2] = { id: 'potion_minor', qty: 5000 };
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.deepEqual(result.state.bag[0], { id: 'junk_rubble', qty: 3_000_050_000 });
	assert.equal(result.state.bag[1], null, 'merged into the first slot');
	assert.deepEqual(result.state.bag[2], { id: 'potion_minor', qty: 100 });
});

test('selling a huge junk stack pays exactly, and big stack counts read short on the slot', () => {
	const bag = [{ id: 'junk_amethyst', qty: 1_000_000_000_000 }, null];
	const sale = junkSale(bag, {});
	assert.equal(sale.count, 1_000_000_000_000);
	assert.ok(Number.isSafeInteger(sale.gold) && sale.gold > 0, 'a trillion pieces still pay an exact whole number');
	assert.equal(junkGold(bag, {}), sale.gold, 'the preview and the sale agree');
	assert.equal(formatStack(999), '999');
	assert.equal(formatStack(12_000_000), '12m');
	assert.equal(formatStack(3_200_000_000), '3.2b');
	assert.equal(formatStack(1e12), '1t');
});
