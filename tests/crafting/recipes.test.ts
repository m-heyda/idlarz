import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, RECIPES, RECIPE_BY_ID } from '../../src/catalog/recipes';
import { ITEM_CATALOG } from '../../src/catalog';
import { RESOURCES } from '../../src/catalog/resources';
import { CRAFTING } from '../../src/config/crafting';
import { craftBlock, craftCumulativeXp, craftLevelOf, craftNeeds, craftXpToNext, recipeCostGold } from '../../src/lib/crafting';

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

test('v0.0 uses potion and component recipes only; potions make stackable consumables, components make components', () => {
	for (const r of RECIPES) {
		assert.ok(r.kind === 'potion' || r.kind === 'component', r.id);
		if (r.kind === 'potion') {
			assert.ok('item' in r.output);
			const def = ITEM_CATALOG[(r.output as { item: string }).item];
			assert.equal(def.kind, 'consumable');
			assert.ok((def.stackMax ?? 1) > 1);
		} else assert.ok('component' in r.output);
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

test('the greater potion unlocks after a few dozen crafts', () => {
	assert.ok(craftCumulativeXp(RECIPE_BY_ID.potion_greater.unlock) <= 200);
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
