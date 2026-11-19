import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGENDARY_RECIPES, RECIPES } from '../../src/catalog/recipes';
import { CRAFT_CATEGORIES, craftGroups, recipeMatches } from '../../src/lib/craftCategories';

const SHOWN = [...RECIPES, ...LEGENDARY_RECIPES];

test('every shown recipe sits in exactly one section; trade goods and legacy recipes are the only ones left out', () => {
	const groups = craftGroups(SHOWN);
	const placed = groups.flatMap((g) => g.sections.flatMap((s) => s.recipes.map((r) => r.id)));
	assert.equal(new Set(placed).size, placed.length, 'no recipe is listed twice');
	const missing = SHOWN.filter((r) => !placed.includes(r.id));
	assert.ok(
		missing.every((r) => r.kind === 'good' || r.legacy),
		'only trade goods and legacy recipes are not listed',
	);
});

test('the categories are Components, Weapons, Off hands, Armor, Potions, Jewelry and Legendary, and "Other" is gone', () => {
	assert.deepEqual(
		CRAFT_CATEGORIES.map((c) => c.id),
		['components', 'weapons', 'offhands', 'armor', 'potions', 'jewelry', 'legendary'],
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
	const potions = groups.find((g) => g.id === 'potions');
	assert.deepEqual(
		potions?.sections.map((s) => s.id),
		['healing', 'elixirs'],
	);
	assert.ok(potions?.sections.every((s) => s.recipes.every((r) => r.kind === 'potion')));
	assert.deepEqual(
		groups.find((g) => g.id === 'components')?.sections.map((s) => s.id),
		['metals', 'fasteners', 'gems', 'tools', 'extracts', 'materials'],
	);
});

test('weapons and off hands are split by item type, each with one recipe per tier (G1-G6) and only that type', () => {
	const groups = craftGroups(SHOWN);
	const weapons = groups.find((g) => g.id === 'weapons');
	assert.deepEqual(
		weapons?.sections.map((s) => s.id),
		['sword', 'dagger', 'axe', 'mace', 'maul', 'spear', 'bow', 'crossbow', 'staff', 'wand'],
	);
	const offhands = groups.find((g) => g.id === 'offhands');
	assert.deepEqual(
		offhands?.sections.map((s) => s.id),
		['shield', 'tome'],
	);
	for (const section of [...(weapons?.sections ?? []), ...(offhands?.sections ?? [])]) {
		assert.equal(section.recipes.length, 6, `${section.id} has six tiers`);
		assert.ok(section.recipes.every((r) => 'gear' in r.output && r.output.gear.type === section.id));
		assert.deepEqual(
			section.recipes.map((r) => ('gear' in r.output ? r.output.gear.grade : '')),
			['G1', 'G2', 'G3', 'G4', 'G5', 'G6'],
		);
	}
	// armor and jewelry: six tiers of every slot too
	for (const id of ['armor', 'jewelry'])
		for (const section of groups.find((g) => g.id === id)?.sections ?? []) assert.equal(section.recipes.length, 6, `${id}/${section.id} has six tiers`);
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
