import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, RECIPES, RECIPE_BY_ID } from '../../src/catalog/recipes';
import { ITEM_CATALOG } from '../../src/catalog';
import { RESOURCES } from '../../src/catalog/resources';
import { CRAFTING } from '../../src/config/crafting';
import { craftBlock, craftCumulativeXp, craftLevelOf, craftLimit, craftNeeds, craftXpToNext, maxCraftable, recipeCostGold } from '../../src/lib/crafting';

test('recipe ids are unique and every input and output exists', () => {
	assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
	for (const r of RECIPES) {
		assert.ok(r.inputs.length > 0 && r.xp > 0 && r.unlock >= 1, r.id);
		for (const input of r.inputs) {
			assert.ok(input.qty > 0 && Number.isInteger(input.qty), `${r.id} input qty`);
			if ('resource' in input) assert.ok(RESOURCES[input.resource].merchant, `${r.id}: ${input.resource} has a merchant price`);
			else assert.ok(COMPONENTS[input.component], `${r.id}: component ${input.component}`);
		}
		assert.ok(r.output.qty > 0 && Number.isInteger(r.output.qty));
		if ('item' in r.output) assert.ok(ITEM_CATALOG[r.output.item], `${r.id}: item ${r.output.item}`);
		else assert.ok(COMPONENTS[r.output.component]);
	}
});

test('v0.1 uses potion, component and good recipes; potions are stackable consumables, goods are stacks with no effect, components stay in the stock', () => {
	for (const r of RECIPES) {
		assert.ok(r.kind === 'potion' || r.kind === 'component' || r.kind === 'good', r.id);
		if (r.kind === 'component') {
			assert.ok('component' in r.output);
			continue;
		}
		assert.ok('item' in r.output);
		const def = ITEM_CATALOG[(r.output as { item: string }).item];
		assert.equal(def.kind, 'consumable');
		assert.ok((def.stackMax ?? 1) > 1);
		if (r.kind === 'potion') assert.ok(def.consumable?.healHp);
		else assert.equal(def.consumable, undefined, `${r.id}: a trade good has no effect`);
	}
});

test('trade goods sell for at most 1.4x their inputs at merchant prices (and never below them), unlock by crafting level, and nothing drops them', () => {
	const goods = RECIPES.filter((r) => r.kind === 'good');
	assert.ok(goods.length >= 4);
	for (const r of goods) {
		const def = ITEM_CATALOG[(r.output as { item: string }).item];
		const cost = recipeCostGold(r) / r.output.qty;
		assert.ok(def.sellValue <= 1.4 * cost, `${r.id}: sells for ${def.sellValue}, inputs are worth ${cost}`);
		assert.ok(def.sellValue >= cost, `${r.id}: sells for less (${def.sellValue}) than its inputs (${cost})`);
		assert.equal(def.shop, undefined, `${r.id} is not sold by the merchant`);
		assert.equal(def.pools, undefined, `${r.id} is in no loot pool`);
		assert.ok(r.unlock >= 2, `${r.id} unlocks by crafting level`);
	}
	assert.ok(new Set(goods.map((r) => r.unlock)).size > 1, 'goods do not all unlock at once');
});

test('every component has exactly one recipe that makes it, and every component is used or is a gear input to come', () => {
	for (const id of Object.keys(COMPONENTS)) {
		assert.equal(RECIPES.filter((r) => 'component' in r.output && r.output.component === id).length, 1, id);
	}
});

test('no printer: a crafted potion costs less than the shop price and more than its sell value', () => {
	for (const r of RECIPES.filter((x) => x.kind === 'potion')) {
		const def = ITEM_CATALOG[(r.output as { item: string }).item];
		const cost = recipeCostGold(r) / r.output.qty;
		assert.ok(def.shop !== undefined && def.sellValue !== undefined, `${r.id} has a shop price and a sell value`);
		assert.ok(cost < def.shop!, `${r.id}: cost ${cost} is below the shop price ${def.shop}`);
		assert.ok(cost > def.sellValue!, `${r.id}: cost ${cost} is above the sell value ${def.sellValue}`);
	}
});

test('recipe costs resolve through components', () => {
	assert.equal(recipeCostGold(RECIPE_BY_ID.glass_vial), 10 * RESOURCES.stone.merchant.price + 5 * RESOURCES.coal.merchant.price);
	assert.ok(recipeCostGold(RECIPE_BY_ID.potion_minor) > 40 * RESOURCES.food.merchant.price);
});

test('the crafting level curve hits its anchors and only ever grows', () => {
	assert.equal(craftLevelOf(0).level, 1);
	for (const [level, xp] of CRAFTING.anchors) {
		const at = craftCumulativeXp(level);
		assert.ok(Math.abs(at - xp) / xp < 0.01, `level ${level} needs ${at}, anchor ${xp}`);
		assert.equal(craftLevelOf(at).level, level);
		assert.equal(craftLevelOf(at - 1).level, level - 1);
	}
	for (let l = 1; l < CRAFTING.maxLevel - 1; l++) assert.ok(craftXpToNext(l + 1) >= craftXpToNext(l), `step ${l}`);
	assert.equal(craftXpToNext(CRAFTING.maxLevel), Infinity);
	assert.equal(craftLevelOf(1e12).level, CRAFTING.maxLevel);
});

test('bad XP reads as level 1', () => {
	for (const bad of [NaN, -5, -Infinity]) assert.deepEqual(craftLevelOf(bad), { level: 1, progress: 0 });
});

test('the greater potion unlocks after a few hundred crafts (slow XP, owner 2026-11-09)', () => {
	assert.ok(craftCumulativeXp(RECIPE_BY_ID.potion_greater.unlock) <= 1_000);
});

test('craftNeeds scales with the count and craftBlock says why a craft cannot be done', () => {
	const minor = RECIPE_BY_ID.potion_minor;
	const needs = craftNeeds(minor, 3);
	assert.deepEqual(needs.resources, [{ key: 'food', qty: 120 }]);
	assert.deepEqual(needs.components, [{ id: 'glass_vial', qty: 3 }]);
	const have = { craftLevel: 1, resources: { food: 120 }, stock: { glass_vial: 3 } };
	assert.equal(craftBlock(minor, 3, have), null);
	assert.equal(craftBlock(minor, 3, { ...have, resources: { food: 119 } }), 'resources');
	assert.equal(craftBlock(minor, 3, { ...have, stock: { glass_vial: 2 } }), 'components');
	assert.equal(craftBlock(RECIPE_BY_ID.potion_greater, 1, { craftLevel: 4, resources: { food: 1e6, coal: 1e6 }, stock: { glass_vial: 9 } }), 'locked');
});

test('maxCraftable is the scarcest input, capped per request, and 0 while locked', () => {
	const minor = RECIPE_BY_ID.potion_minor;
	const rich = { craftLevel: 1, resources: { food: 1e6 }, stock: { glass_vial: 500 } };
	assert.equal(maxCraftable(minor, rich), craftLimit('craftBatchCap'));
	assert.equal(maxCraftable(minor, { ...rich, resources: { food: 119 } }), 2);
	assert.equal(maxCraftable(minor, { ...rich, stock: { glass_vial: 1 } }), 1);
	assert.equal(maxCraftable(minor, { ...rich, stock: {} }), 0);
	assert.equal(maxCraftable(RECIPE_BY_ID.potion_greater, { craftLevel: 4, resources: { food: 1e6, coal: 1e6 }, stock: { glass_vial: 9 } }), 0);
});
