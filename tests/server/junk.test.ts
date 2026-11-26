import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { JUNK_ITEMS, JUNK_STACK } from '../../src/catalog/items/junk';
import { ITEM_ICONS } from '../../src/config/itemIcons';
import { addDrop, emptyBag } from '../../src/lib/inventory';
import { countJunk, isJunk, isJunkStack, JUNK_LEVEL_MARGIN, junkFor, junkGold, junkSale, wornLevelOf } from '../../src/lib/loot/junk';
import { applyOp, parseOp, sellJunkRule } from '../../src/lib/offline/inventory';
import { rollJunkDrops, rollJunkLoot } from '../../src/lib/loot/junkDrops';
import { mulberry32 } from '../../src/lib/rng';
import { plainItem } from '../../src/lib/itemInstance';

// IDL-312: junk materials. Trade goods that stack in the tens of thousands, drop from kills (bosses guarantee the pricey ones) and are what Sell junk sells.

const seeded = (n: number) => mulberry32(n);
const ctx = { level: 10, gold: 400, luck: 0, boss: false, lucky: false };

test('every junk material is a consumable that stacks without limit with art, lore and a price, and the ladder runs cheap to very pricey', () => {
	assert.equal(JUNK_ITEMS.length, 52);
	for (const item of JUNK_ITEMS) {
		assert.equal(item.stackMax, JUNK_STACK, item.id);
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
		for (let seed = 1; seed <= 4000; seed++) if (rollJunkLoot({ ...ctx, level, luck }, seeded(seed)).stash.ing_amethyst) n++;
		return n;
	};
	assert.equal(found(19, 0), 0, 'below its level');
	const plain = found(40, 0);
	assert.ok(plain > 0 && plain < 80, `about 0.4% of kills, found ${plain}`);
	assert.ok(found(40, 200) > plain, 'Luck raises the chance');
});

test('a boss always drops the pricey stacks, in a number that grows with its level; a golden one drops triple', () => {
	const at = (level: number, lucky = false) => {
		// claw and amethyst are crafting ingredients now (they go to the crafting bag), teal crystals stay junk
		const { drops, stash } = rollJunkLoot({ ...ctx, level, boss: true, lucky }, seeded(7));
		const qty = (id: string) => drops.reduce((sum, d) => sum + (d.kind === 'consumable' && d.id === id ? d.qty : 0), 0);
		return { claw: stash.ing_claw ?? 0, teal: qty('junk_teal_crystals'), amethyst: stash.ing_amethyst ?? 0 };
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
	assert.equal(bag.filter((s) => s && 'id' in s && s.id === 'junk_bones').length, 1, '2,500 bones fit one stack');
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
	assert.equal(junkGold(bag, {}), sold.gold, 'the number on the button is what the sale pays');
	assert.equal(junkGold(bag, { merchantUpgrades: { haggler: 5 } }), rich.gold);
});

// IDL-312: the gear rule: a player flag, or an item level well below what is worn

const piece = (level: number, over: Record<string, unknown> = {}) => ({ ...plainItem('steel_helm'), level, ...over });

test('gear is junk when the player marked it, or when its level is far below the worn average; never otherwise', () => {
	const worn = { head: piece(30), chest: piece(40) };
	assert.equal(wornLevelOf(worn), 35);
	assert.equal(wornLevelOf({}), 0);
	const ctx = { equipment: worn };
	assert.equal(isJunk(piece(35 - JUNK_LEVEL_MARGIN - 1), { equipment: { head: piece(35) } }), true, 'well below what is worn in its own slot');
	assert.equal(isJunk(piece(35 - JUNK_LEVEL_MARGIN), { equipment: { head: piece(35) } }), false, 'inside the margin');
	assert.equal(isJunk(piece(1)), false, 'nothing worn, no rule');
	assert.equal(isJunk(piece(1, { junk: true })), true, 'the player flag always counts');
	assert.equal(isJunk(piece(1, { crafted: true }), ctx), false, 'crafted gear is protected from the level rule');
	assert.equal(isJunk(piece(1, { rarity: 'epic' }), ctx), false, 'so is epic and above');
	assert.equal(isJunk(piece(1, { rarity: 'epic', junk: true }), ctx), true, 'but the player decides');
	assert.equal(junkFor({ head: piece(30) })(piece(10)), true);
});

// IDL-395: the rule compares a piece with what is worn in its own slot, never with the average of everything worn

test('a piece for a slot that is empty is never junk, whatever else is worn (it may be the next upgrade)', () => {
	assert.equal(isJunk(piece(1), { equipment: { chest: piece(60), mainHand: piece(60) } }), false, 'a helm with no helm worn');
});

test('a low-level piece that is better in rarity or affixes than the worn one is kept', () => {
	const worn = { head: piece(40) };
	const rare = piece(20, { rarity: 'rare' });
	assert.equal(isJunk(piece(20), { equipment: worn }), true, 'plain and lower: junk');
	assert.equal(isJunk(rare, { equipment: worn }), false, 'a rare is not worse than a common');
	const rolled = piece(20, { affixes: [{ id: 'x', roll: 50 }] });
	assert.equal(isJunk(rolled, { equipment: worn }), false, 'more affixes than the worn piece');
});

test('a ring is junk only when it is worse than both worn rings, and never with a ring slot empty', () => {
	const ring = (level: number) => ({ ...plainItem('cloth_ring'), level });
	assert.equal(isJunk(ring(5), { equipment: { ring1: ring(40), ring2: ring(40) } }), true);
	assert.equal(isJunk(ring(5), { equipment: { ring1: ring(40), ring2: ring(3) } }), false, 'better than the weaker ring');
	assert.equal(isJunk(ring(5), { equipment: { ring1: ring(40) } }), false, 'the second ring slot is empty');
});

test('markJunk sets and clears the flag on a bag piece, refuses anything else, and Sell junk then sells it', () => {
	const rare = piece(20);
	let bag = emptyBag();
	bag = addDrop(bag, { kind: 'gear', item: rare }).bag;
	bag = addDrop(bag, { kind: 'consumable', id: 'potion_minor', qty: 2 }).bag;
	const inv = { bag, equipment: {}, ver: 1, lootPity: {}, autoSellUpTo: null } as unknown as Parameters<typeof applyOp>[0];
	const ctx = {} as Parameters<typeof applyOp>[2];
	assert.deepEqual(parseOp({ action: 'markJunk', index: 0, junk: true }), { action: 'markJunk', index: 0, junk: true });
	assert.equal(parseOp({ action: 'markJunk', index: 0 }), null);
	assert.equal(applyOp(inv, { action: 'markJunk', index: 1, junk: true }, ctx).ok, false, 'a potion cannot be marked');
	assert.equal(applyOp(inv, { action: 'markJunk', index: 9, junk: true }, ctx).ok, false);
	assert.equal(sellJunkRule(inv, ctx).ok, false, 'nothing marked, nothing sold');
	const marked = applyOp(inv, { action: 'markJunk', index: 0, junk: true }, ctx);
	assert.ok(marked.ok);
	assert.equal(countJunk(marked.inv.bag, junkFor({})), 1);
	const sold = sellJunkRule(marked.inv, ctx);
	assert.ok(sold.ok && sold.count === 1 && sold.gold > 0);
	assert.deepEqual(
		sold.inv.bag.filter((s) => s && 'id' in s),
		[{ id: 'potion_minor', qty: 2 }],
	);
	const cleared = applyOp(marked.inv, { action: 'markJunk', index: 0, junk: false }, ctx);
	assert.ok(cleared.ok);
	assert.equal(sellJunkRule(cleared.inv, ctx).ok, false);
});

test('a chest also holds gems and ore for the crafting bag (IDL-358): none under their minimum level, and a plain kill never drops them', async () => {
	const { rollJunkLoot } = await import('../../src/lib/loot/junkDrops');
	const roll = (level: number, chest: boolean) => {
		const found = new Set<string>();
		for (let n = 0; n < 4000; n++) {
			let i = 0;
			const rng = () => ((n * 7919 + i++ * 104729) % 10007) / 10007;
			for (const key of Object.keys(rollJunkLoot({ level, gold: 100, luck: 100, boss: false, lucky: false, chest }, rng).stash)) found.add(key);
		}
		return found;
	};
	const high = roll(60, true);
	assert.ok(high.has('ing_copper_ore') && high.has('ing_jasper'), 'the common stones come');
	assert.ok(high.has('ing_ruby') || high.has('ing_sapphire'), 'and the finest gems are possible at the top');
	const low = roll(2, true);
	assert.ok(!['ing_copper_ore', 'ing_flint', 'ing_iron_ore', 'ing_jasper', 'ing_ruby'].some((id) => low.has(id)), 'a level 2 chest holds none of them');
	assert.equal(roll(60, false).has('ing_jasper'), false, 'a plain kill without a type never drops them');
});
