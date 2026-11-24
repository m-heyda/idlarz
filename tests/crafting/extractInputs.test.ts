import test from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_RECIPES, RECIPE_BY_ID, RECIPES, type GearTarget } from '../../src/catalog/recipes';
import { craftValueOf } from '../../src/catalog/resources';
import { recipeCostGold } from '../../src/lib/crafting';

// The biome extracts (herbs, sap, iron ore, spores, frostshard, pearls, salt) are crafting inputs now (owner 2026-11-24).

const EXTRACTS = ['herbs', 'sap', 'ironOre', 'spores', 'frostshard', 'pearls', 'salt'];
const extractsIn = (id: string) => RECIPE_BY_ID[id].inputs.flatMap((i) => ('resource' in i && EXTRACTS.includes(i.resource) ? [i] : []));
const gearIds = (pick: (t: GearTarget) => boolean) => GEAR_RECIPES.filter((r) => pick((r.output as { gear: GearTarget }).gear)).map((r) => r.id);

test('gear takes extracts from the Iron grade up, none below, by family: weapons Iron Ore and Sap, armor Salt and Spores, jewelry Pearls and Frostshard, cloaks Herbs and Salt', () => {
	for (const id of gearIds((t) => t.grade === 'G1' || t.grade === 'G2')) assert.equal(extractsIn(id).length, 0, id);
	const keys = (id: string) =>
		extractsIn(id)
			.map((i) => ('resource' in i ? i.resource : ''))
			.sort();
	assert.deepEqual(keys('gear_g3_mainhand_sword'), ['ironOre', 'sap']);
	assert.deepEqual(keys('gear_g3_chest'), ['salt', 'spores']);
	assert.deepEqual(keys('gear_g3_ring'), ['frostshard', 'pearls']);
	assert.deepEqual(keys('gear_g3_cape'), ['herbs', 'salt']);
	assert.deepEqual(keys('gear_g8_offhand_shield'), ['ironOre', 'sap']);
});

test('the amounts climb with the grade and a heavier slot takes more', () => {
	const qty = (id: string) => (extractsIn(id)[0] as { qty: number }).qty;
	const ladder = [3, 4, 5, 6, 7, 8].map((g) => qty(`gear_g${g}_hands`));
	assert.deepEqual(
		ladder,
		[...ladder].sort((a, b) => a - b),
	);
	assert.ok(new Set(ladder).size === ladder.length);
	assert.ok(qty('gear_g5_chest') > qty('gear_g5_hands'), 'a chest is the bigger piece');
});

test('extracts count at their crafting value (50) in the cost, not the 5 the merchant pays', () => {
	const recipe = RECIPE_BY_ID.iron_ingot; // 50 Iron Ore among its inputs
	const withOre = recipeCostGold(recipe);
	const without = recipeCostGold({ ...recipe, inputs: recipe.inputs.filter((i) => !('resource' in i && i.resource === 'ironOre')) });
	assert.equal(Math.round(withOre - without), 50 * craftValueOf('ironOre'));
	assert.equal(craftValueOf('ironOre'), 50);
	assert.equal(craftValueOf('coal'), RECIPES.length > 0 ? craftValueOf('coal') : 0, 'a plain resource counts at its merchant price');
});

test('the potions, ingots, extracts and polished gems that need the biomes name their extract', () => {
	assert.ok(extractsIn('steel_ingot').length && extractsIn('gold_ingot').length && extractsIn('herb_extract').length);
	assert.ok(extractsIn('elixir_might').length && extractsIn('elixir_warding').length && extractsIn('cut_ruby').length);
	assert.equal(extractsIn('cut_jasper').length, 0, 'the cheap stones need no extract');
});
