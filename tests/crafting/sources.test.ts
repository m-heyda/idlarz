import test from 'node:test';
import assert from 'node:assert/strict';
import { INGREDIENTS } from '../../src/catalog/ingredients';
import { BOSS_DROPS, FAMILY_DROPS, MONSTER_DROPS } from '../../src/catalog/monsterDrops';
import { RECIPES } from '../../src/catalog/recipes';
import { ROCK_DROPS } from '../../src/config/rocks';
import { JUNK_ROLL_IDS } from '../../src/lib/loot/junkDrops';

// IDL-381: a recipe is only worth shipping if every input can be obtained. A component input must be made by another recipe or be an ingredient something drops.

const anyDrop = (junkId: string, ingredientId: string): boolean =>
	Object.values(FAMILY_DROPS).some((rows) => rows.some((d) => d.id === junkId)) ||
	Object.values(MONSTER_DROPS).some((rows) => rows.some((d) => d.id === junkId)) ||
	Object.values(BOSS_DROPS).some((rows) => rows.some((d) => d.id === junkId)) ||
	Object.values(ROCK_DROPS).some((table) => table.some((drop) => drop.kind === 'ingredient' && drop.id === ingredientId)) ||
	JUNK_ROLL_IDS.has(junkId);

test('every ingredient a recipe takes is made by another recipe or dropped by a monster, boss, rock or chest', () => {
	const made = new Set(RECIPES.flatMap((r) => ('component' in r.output ? [r.output.component] : [])));
	const byId = new Map(INGREDIENTS.map((i) => [i.id, i]));
	const problems: string[] = [];
	for (const recipe of RECIPES)
		for (const input of recipe.inputs) {
			if (!('component' in input) || made.has(input.component)) continue;
			const ing = byId.get(input.component);
			if (!ing) problems.push(`${recipe.id}: ${input.component} is neither crafted nor an ingredient`);
			else if (!anyDrop(ing.junkId, ing.id)) problems.push(`${recipe.id}: ${input.component} has no source`);
		}
	assert.deepEqual(problems, []);
});
