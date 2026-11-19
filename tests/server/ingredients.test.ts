import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, RECIPES } from '../../src/catalog/recipes';
import { INGREDIENTS, INGREDIENT_BY_ID, ingredientDescription, stashKeyOfJunk } from '../../src/catalog/ingredients';
import { JUNK_ITEMS } from '../../src/catalog/items/junk';
import { ingredientsOf } from '../../src/catalog/monsterDrops';
import { MONSTER_CATALOG } from '../../src/catalog/monsters';
import { rollJunkDrops, rollJunkLoot } from '../../src/lib/loot/junkDrops';
import { mulberry32 } from '../../src/lib/rng';

// IDL-358 (owner request 2026-11-18): the rarer monster ingredients are crafting ingredients now, not junk: they drop into the crafting bag.

const ctx = { level: 20, gold: 1000, luck: 0, boss: true, lucky: false };

test('every ingredient points at a real junk item and a crafting bag key, with a name and a tooltip, and no recipe uses it yet', () => {
	assert.equal(new Set(INGREDIENTS.map((i) => i.id)).size, INGREDIENTS.length);
	for (const def of INGREDIENTS) {
		assert.ok(
			JUNK_ITEMS.some((j) => j.id === def.junkId),
			`${def.id} comes from a junk item`,
		);
		assert.equal(def.id, `ing_${def.junkId.replace('junk_', '')}`);
		assert.ok(COMPONENTS[def.id]?.name && COMPONENTS[def.id].description.includes('Ingredient'), def.id);
		assert.ok(ingredientDescription(def).includes('no recipe uses it yet'));
		assert.equal(
			RECIPES.filter((r) => ('component' in r.output && r.output.component === def.id) || r.inputs.some((i) => 'component' in i && i.component === def.id))
				.length,
			0,
			`${def.id}: no recipe yet`,
		);
	}
	assert.equal(stashKeyOfJunk('junk_blood'), 'ing_blood');
	assert.equal(stashKeyOfJunk('junk_rubble'), undefined, 'plain junk stays junk');
});

test('the old junk ids stay in the catalog (stacks players already hold keep working)', () => {
	for (const def of INGREDIENTS)
		assert.ok(
			JUNK_ITEMS.some((j) => j.id === def.junkId),
			def.junkId,
		);
});

test('an ingredient the monster drops goes to the crafting bag, never to the junk drops', () => {
	let seen = 0;
	for (const m of MONSTER_CATALOG.filter((x) => x.enabled)) {
		const table = ingredientsOf(m.id).filter((d) => INGREDIENT_BY_ID.has(`ing_${d.id.replace('junk_', '')}`));
		if (table.length === 0) continue;
		for (let seed = 1; seed <= 300; seed++) {
			const loot = rollJunkLoot({ ...ctx, boss: false, type: m.id, level: 40 }, mulberry32(seed));
			for (const d of loot.drops)
				assert.ok(!stashKeyOfJunk(d.kind === 'consumable' ? d.id : ''), `${m.id}: ${d.kind === 'consumable' ? d.id : ''} must not be a bag drop`);
			seen += Object.keys(loot.stash).length;
			for (const [key, qty] of Object.entries(loot.stash)) {
				assert.ok(INGREDIENT_BY_ID.has(key), key);
				assert.ok(qty >= 1);
			}
		}
	}
	assert.ok(seen > 0, 'ingredients do drop');
});

test('the roll draws the same numbers as before: the cheap junk and the rest of the table are unchanged', () => {
	for (let seed = 1; seed <= 50; seed++) {
		const a = rollJunkLoot({ ...ctx, type: 'bossGreatAuroch' }, mulberry32(seed));
		const b = rollJunkDrops({ ...ctx, type: 'bossGreatAuroch' }, mulberry32(seed));
		assert.deepEqual(a.drops, b, 'the plain list is the same list');
	}
	const withoutType = rollJunkLoot(ctx, mulberry32(3));
	// no type means no monster table; the pricey rolls (claw, amethyst) are crafting ingredients too and may still land in the crafting bag
	assert.deepEqual(
		Object.keys(withoutType.stash).filter((k) => k !== 'ing_claw' && k !== 'ing_amethyst'),
		[],
		'no type, no monster ingredients',
	);
});

test('a golden monster triples the ingredients it drops', () => {
	const total = (lucky: boolean) => {
		let n = 0;
		for (let seed = 1; seed <= 400; seed++)
			for (const q of Object.values(rollJunkLoot({ ...ctx, boss: false, lucky, type: 'stonehornBison', level: 30 }, mulberry32(seed)).stash)) n += q;
		return n;
	};
	assert.ok(total(true) >= total(false) * 3 - 3);
});
