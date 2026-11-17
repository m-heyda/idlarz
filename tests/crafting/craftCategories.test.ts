import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDARY_RECIPES, RECIPES } from '../../src/catalog/recipes';
import { CRAFT_CATEGORIES, craftGroups, recipeMatches } from '../../src/lib/craftCategories';

const SHOWN = [...RECIPES, ...LEGENDARY_RECIPES];

test('every shown recipe sits in exactly one section; trade goods are the only ones left out', () => {
	const groups = craftGroups(SHOWN);
	const placed = groups.flatMap((g) => g.sections.flatMap((s) => s.recipes.map((r) => r.id)));
	assert.equal(new Set(placed).size, placed.length, 'no recipe is listed twice');
	const missing = SHOWN.filter((r) => !placed.includes(r.id));
	assert.ok(
		missing.every((r) => r.kind === 'good'),
		'only trade goods are not listed',
	);
});

test('the categories are Weapons, Armor, Potions, Jewelry, Components and Legendary, and "Other" is gone', () => {
	assert.deepEqual(
		CRAFT_CATEGORIES.map((c) => c.id),
		['weapons', 'armor', 'potions', 'jewelry', 'components', 'legendary'],
	);
	const groups = craftGroups(SHOWN);
	const armor = groups.find((g) => g.id === 'armor');
	assert.ok(armor?.headed);
	assert.deepEqual(
		armor.sections.map((s) => s.id),
		['helmets', 'shoulders', 'chest', 'gloves', 'legs', 'boots', 'cloaks', 'belts'],
	);
	const jewelry = groups.find((g) => g.id === 'jewelry');
	assert.deepEqual(
		jewelry?.sections.map((s) => s.id),
		['rings', 'necklaces', 'charms'],
	);
	assert.ok(groups.find((g) => g.id === 'potions')?.sections[0].recipes.every((r) => r.kind === 'potion'));
});

test('a section lists its recipes from the lowest crafting level up', () => {
	for (const group of craftGroups(SHOWN))
		for (const section of group.sections) {
			const levels = section.recipes.map((r) => r.unlock);
			assert.deepEqual(
				levels,
				[...levels].sort((a, b) => a - b),
			);
		}
});

test('search: every word must match somewhere in the name, slot, grade, description or inputs; case does not matter', () => {
	const vial = RECIPES.find((r) => r.id === 'glass_vial');
	assert.ok(vial);
	assert.equal(recipeMatches(vial, ''), true, 'an empty phrase matches everything');
	assert.equal(recipeMatches(vial, 'GLASS'), true, 'by name');
	assert.equal(recipeMatches(vial, 'fire-blown'), true, 'by description');
	assert.equal(recipeMatches(vial, 'coal stone'), true, 'by inputs, in any order');
	assert.equal(recipeMatches(vial, 'glass dragon'), false, 'every word has to match');
	const boots = SHOWN.find((r) => 'gear' in r.output && r.output.gear.slot === 'feet');
	assert.ok(boots);
	assert.equal(recipeMatches(boots, 'boots'), true, 'by slot');
	assert.equal(recipeMatches(boots, 'jewelry'), false);
});

test('search keeps the group shape and drops the groups with no match', () => {
	const groups = craftGroups(SHOWN, 'healing');
	assert.deepEqual(
		groups.map((g) => g.id),
		['potions'],
	);
	assert.equal(craftGroups(SHOWN, 'zzzz-nothing').length, 0);
	assert.equal(
		groups[0].count,
		groups[0].sections.reduce((n, s) => n + s.recipes.length, 0),
	);
});
