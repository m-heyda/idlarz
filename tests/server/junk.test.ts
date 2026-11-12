import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { JUNK_ITEMS } from '../../src/catalog/items/junk';
import { ITEM_ICONS } from '../../src/config/itemIcons';
import { addDrop, emptyBag } from '../../src/lib/inventory';
import { countJunk, isJunkStack, junkSale } from '../../src/lib/loot/junk';
import { rollJunkDrops } from '../../src/lib/loot/junkDrops';
import { mulberry32 } from '../../src/lib/rng';
import { plainItem } from '../../src/lib/itemInstance';

// IDL-312: junk materials. Trade goods that stack in 1,000s, drop from kills (bosses guarantee the pricey ones) and are what Sell junk sells.

const seeded = (n: number) => mulberry32(n);
const ctx = { level: 10, gold: 400, luck: 0, boss: false, lucky: false };

test('every junk material is a 1,000-stack consumable with art, lore and a price, and the ladder runs cheap to very pricey', () => {
	assert.equal(JUNK_ITEMS.length, 11);
	for (const item of JUNK_ITEMS) {
		assert.equal(item.stackMax, 1000, item.id);
		assert.equal(ITEM_CATALOG[item.id], item, `${item.id} is in the catalog`);
		assert.ok(item.junk && item.description && item.sellValue > 0, item.id);
		assert.ok(
			ITEM_ICONS.some((e) => e.icon === item.icon),
			`${item.id}: icon ${item.icon} is registered`,
		);
		assert.equal(isJunkStack(item.id), true);
	}
	assert.ok(ITEM_CATALOG.junk_amethyst.sellValue > 500 * ITEM_CATALOG.junk_rubble.sellValue);
	assert.equal(isJunkStack('potion_minor'), false);
});

test('every kill drops cheap junk, and how much follows the kill gold (monster level and the player economy)', () => {
	const total = (gold: number) => {
		let sum = 0;
		for (let seed = 1; seed <= 200; seed++)
			for (const d of rollJunkDrops({ ...ctx, gold }, seeded(seed))) if (d.kind === 'consumable') sum += d.qty * ITEM_CATALOG[d.id].sellValue;
		return sum;
	};
	for (let seed = 1; seed <= 50; seed++) assert.ok(rollJunkDrops(ctx, seeded(seed)).length >= 1);
	assert.ok(total(4000) > 5 * total(400), 'ten times the gold drops several times the junk value');
});

test('pricey junk is rare on an ordinary kill, locked behind monster level, and Luck helps', () => {
	const found = (level: number, luck: number) => {
		let n = 0;
		for (let seed = 1; seed <= 4000; seed++)
			if (rollJunkDrops({ ...ctx, level, luck }, seeded(seed)).some((d) => d.kind === 'consumable' && d.id === 'junk_amethyst')) n++;
		return n;
	};
	assert.equal(found(19, 0), 0, 'below its level');
	const plain = found(40, 0);
	assert.ok(plain > 0 && plain < 80, `about 0.4% of kills, found ${plain}`);
	assert.ok(found(40, 200) > plain, 'Luck raises the chance');
});

test('a boss always drops the pricey stacks, in a number that grows with its level; a golden one drops triple', () => {
	const at = (level: number, lucky = false) => {
		const drops = rollJunkDrops({ ...ctx, level, boss: true, lucky }, seeded(7));
		const qty = (id: string) => drops.reduce((sum, d) => sum + (d.kind === 'consumable' && d.id === id ? d.qty : 0), 0);
		return { claw: qty('junk_claw'), teal: qty('junk_teal_crystals'), amethyst: qty('junk_amethyst') };
	};
	const low = at(10);
	assert.ok(low.claw >= 3 && low.teal >= 2 && low.amethyst >= 1);
	const high = at(60);
	assert.ok(high.claw > low.claw && high.teal > low.teal && high.amethyst > low.amethyst);
	assert.ok(at(10, true).teal >= 3 * low.teal);
});

test('Sell junk sells every junk stack at its price (Haggler applies) and leaves potions and unflagged gear', () => {
	let bag = emptyBag();
	bag = addDrop(bag, { kind: 'consumable', id: 'junk_bones', qty: 2500 }).bag;
	bag = addDrop(bag, { kind: 'consumable', id: 'junk_amethyst', qty: 2 }).bag;
	bag = addDrop(bag, { kind: 'consumable', id: 'potion_minor', qty: 3 }).bag;
	bag = addDrop(bag, { kind: 'gear', item: plainItem('steel_helm') }).bag;
	assert.equal(bag.filter((s) => s && 'id' in s && s.id === 'junk_bones').length, 3, '2,500 bones fill three slots of 1,000');
	assert.equal(countJunk(bag), 2502);
	const sold = junkSale(bag, {});
	assert.equal(sold.count, 2502);
	assert.equal(sold.gold, 2500 * 5 + 2 * 2400);
	assert.deepEqual(
		sold.bag.filter((s) => s && 'id' in s),
		[{ id: 'potion_minor', qty: 3 }],
	);
	assert.equal(sold.bag.filter((s) => s && 'item' in s).length, 1);
	const rich = junkSale(bag, { merchantUpgrades: { haggler: 5 } });
	assert.ok(rich.gold > sold.gold, 'Haggler pays more');
	assert.equal(junkSale(emptyBag(), {}).count, 0);
});
