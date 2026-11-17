// Carrying legendary gear through a rebirth: the pure rules (lib/rebirthKeep.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isKeepable, keepCandidates, keepSlots, parseKeep, placeKept, resolveKeep, refKey } from '../../src/lib/rebirthKeep';
import { plainItem } from '../../src/lib/itemInstance';
import { LEGENDARY_ITEMS } from '../../src/catalog/items/legendary';
import { rebirthKit } from '../../src/lib/inventory';
import type { BagSlot, ItemInstance } from '../../src/types/game';

const legend = (rarity = 'legendary'): ItemInstance => ({ ...plainItem(LEGENDARY_ITEMS[0].id), rarity });
const common = (): ItemInstance => plainItem('wooden_sword');

test('rebirth number N keeps min(N, 15) pieces', () => {
	assert.deepEqual([1, 2, 3, 10, 15, 16, 40].map(keepSlots), [1, 2, 3, 10, 15, 15, 15]);
	assert.equal(keepSlots(0), 0);
});

test('only Legendary and above can be kept', () => {
	assert.equal(isKeepable(legend()), true);
	assert.equal(isKeepable(legend('unique')), true);
	assert.equal(isKeepable(legend('epic')), false);
	assert.equal(isKeepable(common()), false);
	assert.equal(isKeepable(null), false);
});

test('candidates list the bag first, then the worn gear', () => {
	const bag: BagSlot[] = [null, { item: common() }, { item: legend() }, { id: 'potion_minor', qty: 2 }];
	const found = keepCandidates(bag, { mainHand: legend(), head: common() });
	assert.deepEqual(
		found.map((c) => refKey(c.ref)),
		['bag:2', 'equip:mainHand'],
	);
});

test('resolveKeep checks the places, the count and duplicates', () => {
	const inv = { bag: [{ item: legend() }, { item: common() }] as BagSlot[], equipment: { mainHand: legend() } };
	const good = resolveKeep(
		inv,
		[
			{ from: 'bag', index: 0 },
			{ from: 'equip', slot: 'mainHand' },
		],
		2,
	);
	assert.ok(good.ok && good.items.length === 2);
	assert.deepEqual(
		resolveKeep(
			inv,
			[
				{ from: 'bag', index: 0 },
				{ from: 'equip', slot: 'mainHand' },
			],
			1,
		),
		{ ok: false, reason: 'too_many' },
	);
	assert.deepEqual(resolveKeep(inv, [{ from: 'bag', index: 1 }], 1), { ok: false, reason: 'not_keepable' });
	assert.deepEqual(resolveKeep(inv, [{ from: 'bag', index: 9 }], 1), { ok: false, reason: 'not_keepable' });
	assert.deepEqual(resolveKeep(inv, [{ from: 'equip', slot: 'head' }], 1), { ok: false, reason: 'not_keepable' });
	assert.deepEqual(
		resolveKeep(
			inv,
			[
				{ from: 'bag', index: 0 },
				{ from: 'bag', index: 0 },
			],
			2,
		),
		{ ok: false, reason: 'duplicate' },
	);
	assert.deepEqual(resolveKeep(inv, [], 0), { ok: true, items: [] });
});

test('kept pieces go into the first free bag slots of the starter bag', () => {
	const kit = rebirthKit({}, undefined, 0);
	const kept = [legend(), legend()];
	const bag = placeKept(kit.bag, kept);
	assert.equal(bag.length, kit.bag.length);
	const free = kit.bag.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0);
	assert.deepEqual(bag[free[0]], { item: kept[0] });
	assert.deepEqual(bag[free[1]], { item: kept[1] });
	assert.deepEqual(kit.bag, rebirthKit({}, undefined, 0).bag, 'the kit itself is not changed');
});

test('a request body is read strictly', () => {
	assert.deepEqual(parseKeep(undefined), []);
	assert.deepEqual(
		parseKeep([
			{ from: 'bag', index: 3 },
			{ from: 'equip', slot: 'ring1' },
		]),
		[
			{ from: 'bag', index: 3 },
			{ from: 'equip', slot: 'ring1' },
		],
	);
	assert.equal(parseKeep('x'), null);
	assert.equal(parseKeep([{ from: 'bag', index: -1 }]), null);
	assert.equal(parseKeep([{ from: 'bag', index: 1.5 }]), null);
	assert.equal(parseKeep([{ from: 'sky' }]), null);
	assert.equal(parseKeep(Array.from({ length: 16 }, () => ({ from: 'bag', index: 0 }))), null);
});
