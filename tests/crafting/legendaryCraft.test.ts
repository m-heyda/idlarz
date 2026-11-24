import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { LEGENDARY_RECIPES, LEGENDARY_UNLOCK, RECIPE_BY_ID } from '../../src/catalog/recipes';
import { CRAFTING } from '../../src/config/crafting';
import { craftCumulativeXp, emptyCraft } from '../../src/lib/crafting';
import { plainItem, instanceProblem } from '../../src/lib/itemInstance';
import { applyClaim, applyCraft, type CraftEnv } from '../../src/lib/offline/craft';
import type { CraftState, Inventory } from '../../src/lib/offline/types';

// IDL-120: the three legendary recipes are real (crafting level 80) but need 50 War Medals, which nothing gives out yet.

const env: CraftEnv = { secret: 's', userId: 'u', luck: 0, intelligence: 5 };
const T0 = 4_000_000;
const bag = (...slots: Inventory['bag']): Inventory =>
	({
		ver: 1,
		bag: [...slots, ...Array.from({ length: Math.max(0, 6 - slots.length) }, () => null)],
		equipment: {},
		lootPity: {},
		autoSellUpTo: null,
	}) as unknown as Inventory;
const ready = (stock: Record<string, number> = {}): CraftState => ({ ...emptyCraft(), xp: craftCumulativeXp(CRAFTING.maxLevel), stock });
/** Everything a legendary recipe takes from the stash: its components (the resources are the browser's) */
const stashFor = (id: string): Record<string, number> =>
	Object.fromEntries(RECIPE_BY_ID[id].inputs.flatMap((i) => ('component' in i ? [[i.component, i.qty]] : [])));

test('the legendary recipes are real recipes from the crafting cap, each needing 50 War Medals; the three weapons are craft-only items', () => {
	assert.equal(LEGENDARY_UNLOCK, CRAFTING.maxLevel);
	assert.equal(LEGENDARY_RECIPES.length, 3);
	for (const recipe of LEGENDARY_RECIPES) {
		assert.equal(RECIPE_BY_ID[recipe.id], recipe, 'the server can start it');
		assert.equal(recipe.kind, 'legendary');
		assert.equal(recipe.unlock, CRAFTING.maxLevel);
		assert.ok(
			recipe.inputs.some((i) => 'component' in i && i.component === 'ing_war_medals' && i.qty === 50),
			recipe.id,
		);
		const def = ITEM_CATALOG[(recipe.output as { item: string }).item];
		assert.ok(def.craftOnly && def.enabled !== false && def.slot, recipe.id);
	}
});

test('without the medals the craft is refused and nothing is taken; with them it is queued once, per request one', () => {
	const recipe = 'legendary_dawnsplitter';
	const all = stashFor(recipe);
	const noMedals = { ...all };
	delete noMedals.ing_war_medals;
	assert.equal(applyCraft(bag(), ready(noMedals), recipe, 1, T0).reason, 'no_components', 'the medals have no source yet');
	const queued = applyCraft(bag(), ready(all), recipe, 1, T0);
	assert.equal(queued.ok, true);
	assert.equal(queued.queued, 1);
	assert.equal(queued.craft.stock.ing_war_medals, undefined, 'the medals were taken');
	assert.equal(applyCraft(bag(), ready(all), recipe, 2, T0).reason, 'bad_request', 'one legendary per request');
	assert.equal(applyCraft(bag(), { ...ready(all), xp: 0 }, recipe, 1, T0).reason, 'locked');
});

test('one copy at a time: refused when the bag holds it, it is worn, or it is already being made; and a full bag is refused before anything is taken', () => {
	const recipe = 'legendary_stormstring';
	const all = stashFor(recipe);
	const mine = { ...plainItem('stormstring'), rarity: 'legendary', level: 91 };
	assert.equal(applyCraft(bag({ item: mine }), ready(all), recipe, 1, T0).reason, 'already_have');
	const worn = { ...bag(), equipment: { mainHand: mine } } as unknown as Inventory;
	assert.equal(applyCraft(worn, ready(all), recipe, 1, T0).reason, 'already_have');
	const first = applyCraft(bag(), ready(all), recipe, 1, T0);
	assert.equal(applyCraft(first.inv, { ...first.craft, stock: all }, recipe, 1, T0 + 2000).reason, 'already_have', 'one in the queue');
	const full = { ...bag(), bag: Array.from({ length: 6 }, () => ({ id: 'potion_minor', qty: 1 })) } as unknown as Inventory;
	const refused = applyCraft(full, ready(all), recipe, 1, T0);
	assert.equal(refused.reason, 'bag_full');
	assert.deepEqual(refused.craft.stock, all, 'a refusal takes nothing');
});

test('a finished legendary lands in the bag as a crafted, valid piece; a second claim finds nothing', () => {
	const recipe = 'legendary_starlight_wand';
	const queued = applyCraft(bag(), ready(stashFor(recipe)), recipe, 1, T0);
	const done = T0 + RECIPE_BY_ID[recipe].timeSec! * 1000 + 1;
	const out = applyClaim(queued.inv, queued.craft, 0, done, env);
	assert.equal(out.ok, true);
	assert.equal(out.crafted, 1);
	const piece = out.inv.bag.find((slot) => slot && 'item' in slot);
	assert.ok(piece && 'item' in piece);
	if (!piece || !('item' in piece)) return;
	assert.equal(piece.item.base, 'starlight_wand');
	assert.equal(piece.item.crafted, true);
	assert.equal(instanceProblem(piece.item), null, 'a save can hold it');
	assert.deepEqual(out.craft.queue, []);
	assert.equal(applyClaim(out.inv, out.craft, 0, done + 5000, env).ok, false);
});
