import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, openFight, store } from './helpers';
import { COMBAT } from '../src/config/combatConfig';
import { ITEM_CATALOG } from '../src/config/itemCatalog';
import { emptyBag, gearOf, organizeBag, slotQty, stackOf } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import type { BagSlot, ItemInstance } from '../src/types/game';

const gear = (base: string, over: Partial<ItemInstance> = {}): BagSlot => ({ item: { ...plainItem(base), ...over } });
const bagOf = (...slots: BagSlot[]): BagSlot[] => [...slots, ...emptyBag().slice(slots.length)];
const ids = (bag: BagSlot[]) => bag.map((s) => (s ? ('item' in s ? s.item.base : `${s.id}x${s.qty}`) : null));
const total = (bag: BagSlot[]) => bag.reduce((n, s) => n + slotQty(s), 0);

test('organizeBag merges stacks of one consumable up to the stack limit and moves them to the front', () => {
	const max = ITEM_CATALOG.potion_minor.stackMax ?? 1;
	assert.ok(max > 1);
	const bag = bagOf(null, { id: 'potion_minor', qty: max - 1 }, gear('wooden_sword'), { id: 'potion_minor', qty: 3 });
	const out = organizeBag(bag);
	assert.deepEqual(stackOf(out[0]), { id: 'potion_minor', qty: max });
	assert.deepEqual(stackOf(out[1]), { id: 'potion_minor', qty: 2 });
	assert.equal(gearOf(out[2])?.base, 'wooden_sword');
	assert.equal(out[3], null);
	assert.equal(total(out), total(bag), 'no item lost or made');
});

test('organizeBag sorts gear by kind, slot, rarity, level and quality; the best of a kind comes first', () => {
	const bag = bagOf(
		gear('wooden_shield'),
		gear('leather_cap'),
		gear('wooden_sword', { rarity: 'common', level: 3 }),
		gear('wooden_sword', { rarity: 'rare', level: 1 }),
		gear('wooden_sword', { rarity: 'rare', level: 9 }),
		gear('wooden_sword', { rarity: 'rare', level: 9, quality: 90 }),
		gear('cloth_ring')
	);
	const out = organizeBag(bag).slice(0, 7).map((s) => gearOf(s)!);
	assert.deepEqual(out.slice(0, 4).map((i) => [i.base, i.rarity, i.level, i.quality]), [
		['wooden_sword', 'rare', 9, 90],
		['wooden_sword', 'rare', 9, out[1].quality],
		['wooden_sword', 'rare', 1, out[2].quality],
		['wooden_sword', 'common', 3, out[3].quality],
	]);
	assert.ok(out[0].quality >= out[1].quality);
	// weapons, then the shield, then armor, then jewelry
	assert.deepEqual(out.slice(4).map((i) => ITEM_CATALOG[i.base].kind), ['offhand', 'armor', 'accessory']);
});

test('organizeBag keeps the number of slots, never mutates its input, and organising twice changes nothing more', () => {
	const bag = bagOf(gear('steel_mace'), { id: 'potion_minor', qty: 1 }, null, gear('wooden_sword'), { id: 'potion_greater', qty: 2 }, { id: 'potion_minor', qty: 1 });
	const snapshot = JSON.stringify(bag);
	const once = organizeBag(bag);
	assert.equal(JSON.stringify(bag), snapshot, 'the input is untouched');
	assert.equal(once.length, COMBAT.bagSize);
	assert.deepEqual(organizeBag(once), once, 'idempotent');
	assert.notEqual(once[0], bag[0], 'fresh slot objects, not shared with the input');
	assert.deepEqual(organizeBag(emptyBag()), emptyBag());
	// every empty slot is at the end
	const firstEmpty = once.findIndex((s) => s === null);
	assert.ok(once.slice(firstEmpty).every((s) => s === null));
});

test('a full bag organises without losing anything', () => {
	const full = Array.from({ length: COMBAT.bagSize }, (_, i): BagSlot => (i % 3 === 0 ? { id: 'potion_minor', qty: 2 } : gear(i % 2 ? 'wooden_sword' : 'steel_mace')));
	const out = organizeBag(full);
	assert.equal(out.length, full.length);
	assert.equal(total(out), total(full));
});

test('the store action organises the bag, and is refused in a fight', () => {
	freshGame();
	store.setState({ bag: bagOf(null, gear('wooden_sword'), { id: 'potion_minor', qty: 1 }, { id: 'potion_minor', qty: 1 }) });
	assert.equal(api().organizeBag(), true);
	assert.deepEqual(ids(api().bag).slice(0, 3), ['potion_minorx2', 'wooden_sword', null]);
	const bag = api().bag;
	store.setState({ bag: bagOf(null, gear('wooden_sword'), gear('steel_mace')) });
	openFight();
	const before = api().bag;
	assert.equal(api().organizeBag(), false);
	assert.equal(api().bag, before, 'untouched during a fight');
	assert.notEqual(api().bag, bag);
});
