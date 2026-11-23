import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANT } from '../../src/config/crafting';
import { rollGear } from '../../src/lib/craftGear';
import { instanceProblem, plainItem } from '../../src/lib/itemInstance';
import { emptyCraft } from '../../src/lib/crafting';
import { applyEnchant, parseEnchant, type CraftEnv } from '../../src/lib/offline/craft';
import { sealedRng } from '../../src/lib/offline/seal';
import { LOOT_DATA } from '../../src/lib/loot/data';
import type { CraftState, Inventory } from '../../src/lib/offline/types';
import type { ItemInstance } from '../../src/types/game';

// IDL-120: the enchant craft: reroll or add one affix of a piece of gear in the bag, for Ichor from the crafting stash.

const env: CraftEnv = { secret: 'enchant-secret', userId: 'u', luck: 0, intelligence: 5 };
const T0 = 7_000_000;
const rng = (n: number) => sealedRng('enchant-secret', 'u', 0, 'piece', n);
/** A rare G5 chest with at least two affixes */
const rare = (): ItemInstance => {
	for (let n = 1; n < 200; n++) {
		const rolled = rollGear({ grade: 'G5', slot: 'chest' }, { craftLevel: 40, luck: 0, intelligence: 5 }, rng(n));
		if (rolled && rolled.item.affixes.length >= 2) return rolled.item;
	}
	throw new Error('no rare chest with affixes');
};
const invWith = (...items: ItemInstance[]): Inventory =>
	({
		ver: 3,
		bag: [...items.map((item) => ({ item })), null, { id: 'potion_minor', qty: 2 }, null],
		equipment: {},
		lootPity: {},
		autoSellUpTo: null,
	}) as unknown as Inventory;
const stocked = (ichor: number): CraftState => ({ ...emptyCraft(), stock: ichor > 0 ? { ing_ichor: ichor } : {} });
const groupsOf = (item: ItemInstance) => item.affixes.map((a) => LOOT_DATA.affixes[a.id].group);
const pieceAt = (inv: Inventory, i: number): ItemInstance | null => {
	const slot = inv.bag[i];
	return slot && 'item' in slot ? slot.item : null;
};

test('without Ichor nothing happens: "needs Ichor", the piece, the stash and the counter stay', () => {
	const item = rare();
	const out = applyEnchant(invWith(item), stocked(0), 0, 'reroll', 0, T0, env);
	assert.equal(out.ok, false);
	assert.equal(out.reason, 'needs_ichor');
	assert.equal(applyEnchant(invWith(item), stocked(ENCHANT.ichor.reroll - 1), 0, 'reroll', 0, T0, env).reason, 'needs_ichor');
});

test('a reroll replaces exactly the chosen affix with a valid one of another group, takes the Ichor, moves the counters and the bag version', () => {
	const item = rare();
	for (let index = 0; index < item.affixes.length; index++) {
		const out = applyEnchant(invWith(item), stocked(ENCHANT.ichor.reroll + 2), 0, 'reroll', index, T0, env);
		assert.equal(out.ok, true, `affix ${index}`);
		const now = pieceAt(out.inv, 0)!;
		assert.equal(now.affixes.length, item.affixes.length);
		item.affixes.forEach((a, i) => i !== index && assert.deepEqual(now.affixes[i], a, 'the others stay'));
		assert.equal(new Set(groupsOf(now)).size, now.affixes.length, 'one affix per group');
		assert.equal(instanceProblem(now), null);
		assert.equal(out.craft.stock.ing_ichor, 2);
		assert.equal(out.craft.ordEnchant, 1);
		assert.equal(out.craft.ord, 0, 'a gear craft counter never moves');
		assert.equal(out.inv.ver, 4);
		assert.equal(now.base, item.base);
		assert.equal(now.quality, item.quality);
	}
});

test('the roll is sealed: the same request is the same result, the next enchant counts on, a smart hero leans the new roll up', () => {
	const item = rare();
	const a = applyEnchant(invWith(item), stocked(30), 0, 'reroll', 0, T0, env);
	const b = applyEnchant(invWith(item), stocked(30), 0, 'reroll', 0, T0, env);
	assert.deepEqual(pieceAt(a.inv, 0), pieceAt(b.inv, 0));
	const next = applyEnchant(a.inv, a.craft, 0, 'reroll', 0, T0 + 2000, env);
	assert.equal(next.craft.ordEnchant, 2);
	const slim = { ...item, affixes: item.affixes.slice(0, 1) };
	const average = (e: CraftEnv) => {
		let sum = 0;
		let n = 0;
		for (let ord = 0; ord < 150; ord++) {
			const out = applyEnchant(invWith(slim), { ...stocked(30), ordEnchant: ord }, 0, 'add', 0, T0, e);
			if (out.ok) {
				sum += pieceAt(out.inv, 0)!.affixes[1].roll;
				n++;
			}
		}
		return sum / n;
	};
	assert.ok(average({ ...env, intelligence: 105 }) > average(env) + 8, 'Intelligence leans the new roll up');
});

test('adding stops at what the rarity carries and costs more Ichor', () => {
	const item = rare();
	const slim = { ...item, affixes: item.affixes.slice(0, 1) };
	const out = applyEnchant(invWith(slim), stocked(ENCHANT.ichor.add), 0, 'add', 0, T0, env);
	assert.equal(out.ok, true);
	const now = pieceAt(out.inv, 0)!;
	assert.equal(now.affixes.length, 2);
	assert.equal(now.affixes[0].id, slim.affixes[0].id, 'the old affix stays');
	assert.equal(instanceProblem(now), null);
	assert.equal(out.craft.stock.ing_ichor, undefined, 'all the Ichor was used');
	assert.equal(applyEnchant(invWith(slim), stocked(ENCHANT.ichor.add - 1), 0, 'add', 0, T0, env).reason, 'needs_ichor');
	// keep adding: it stops at the rarity's maximum
	let piece = slim;
	let craft = stocked(1000);
	let t = T0;
	let result = applyEnchant(invWith(piece), craft, 0, 'add', 0, t, env);
	while (result.ok) {
		piece = pieceAt(result.inv, 0)!;
		craft = result.craft;
		t += 2000;
		result = applyEnchant(invWith(piece), craft, 0, 'add', 0, t, env);
	}
	assert.equal(result.reason, 'affix_cap');
	assert.equal(piece.affixes.length, LOOT_DATA.rarities[piece.rarity].maxAffixes);
});

test('it refuses what is not a piece it can enchant, and a second request within a second', () => {
	const plain = invWith(rare());
	assert.equal(applyEnchant(plain, stocked(50), 2, 'reroll', 0, T0, env).reason, 'bad_item', 'an empty slot');
	assert.equal(applyEnchant(plain, stocked(50), 3, 'reroll', 0, T0, env).reason, 'bad_item', 'a potion');
	assert.equal(applyEnchant(invWith(plainItem('emberbrand')), stocked(50), 0, 'reroll', 0, T0, env).reason, 'bad_item', 'a named legendary');
	assert.equal(applyEnchant(plain, stocked(50), 0, 'reroll', 9, T0, env).reason, 'bad_affix');
	assert.equal(applyEnchant(plain, stocked(50), 0, 'reroll', -1, T0, env).reason, 'bad_affix');
	assert.equal(applyEnchant(plain, stocked(50), 0, 'reroll', 0, T0, undefined).ok, false, 'no roll environment: no enchant');
	assert.equal(applyEnchant(plain, { ...stocked(50), last: T0 - 200 }, 0, 'reroll', 0, T0, env).reason, 'too_fast');
});

test('the request body is parsed strictly', () => {
	assert.deepEqual(parseEnchant({ index: 2, mode: 'reroll', affix: 1 }), { index: 2, mode: 'reroll', affix: 1 });
	assert.deepEqual(parseEnchant({ index: 0, mode: 'add' }), { index: 0, mode: 'add', affix: 0 });
	for (const bad of [
		{ index: -1, mode: 'add' },
		{ index: 1.5, mode: 'add' },
		{ index: 1, mode: 'sell' },
		{ index: 1, mode: 'add', affix: 99 },
		{ mode: 'add' },
		{ index: '1', mode: 'add' },
	])
		assert.equal(parseEnchant(bad as never), null, JSON.stringify(bad));
});
