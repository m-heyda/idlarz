import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { JUNK_ITEMS } from '../../src/catalog/items/junk';
import { BOSS_DROPS, FAMILY_DROPS, MONSTER_DROPS, ingredientQty, ingredientsOf } from '../../src/catalog/monsterDrops';
import { MONSTER_CATALOG } from '../../src/catalog/monsters';
import { rollJunkDrops } from '../../src/lib/loot/junkDrops';
import { mulberry32 } from '../../src/lib/rng';

// The ingredients monsters leave (the Bestiary drop table): data only, every id is a junk item, every live monster has some, a boss always leaves its own.

test('every ingredient id is a junk item with an icon, and every table row is sane', () => {
	const ids = new Set(JUNK_ITEMS.map((i) => i.id));
	const tables = [...Object.values(FAMILY_DROPS), ...Object.values(MONSTER_DROPS), ...Object.values(BOSS_DROPS)];
	for (const row of tables.flat()) {
		assert.ok(ids.has(row.id), `${row.id} is a junk item`);
		assert.ok(ITEM_CATALOG[row.id], `${row.id} is in the item catalog`);
		assert.ok(row.chance > 0 && row.chance <= 1, `${row.id}: chance`);
		assert.ok(row.qty[0] >= 1 && row.qty[1] >= row.qty[0], `${row.id}: qty`);
		assert.ok(row.minLevel >= 1 && row.perLevel >= 0, `${row.id}: level terms`);
	}
	for (const id of [...Object.keys(MONSTER_DROPS), ...Object.keys(BOSS_DROPS)])
		assert.ok(
			MONSTER_CATALOG.some((m) => m.id === id),
			`${id} is a monster`,
		);
});

test('every live monster leaves at least two ingredients, a boss leaves guaranteed ones', () => {
	for (const m of MONSTER_CATALOG.filter((m) => m.enabled)) {
		assert.ok(ingredientsOf(m.id).length >= 2, `${m.id}: ingredients`);
		if (m.grade === 'boss')
			assert.ok(
				ingredientsOf(m.id).some((d) => d.chance === 1),
				`${m.id}: a guaranteed ingredient`,
			);
	}
});

test('the amount grows with the monster level and stays inside the range at level 1', () => {
	const drop = { id: 'junk_bacon', chance: 1, minLevel: 1, qty: [2, 4] as const, perLevel: 0.5 };
	assert.deepEqual(
		[0, 0.5, 0.99].map((r) => ingredientQty(drop, 1, r)),
		[2, 3, 4],
	);
	assert.equal(ingredientQty(drop, 21, 0), 12, 'level 21 adds floor(0.5 x 20) = 10');
});

test('a boss kill always drops its ingredients; a kill without a type drops none; a golden monster triples', () => {
	const ctx = { level: 20, gold: 1000, luck: 0, boss: true, lucky: false };
	const drops = rollJunkDrops({ ...ctx, type: 'bossGreatAuroch' }, mulberry32(1));
	assert.ok(drops.some((d) => d.kind === 'consumable' && d.id === 'junk_horn'));
	assert.ok(drops.some((d) => d.kind === 'consumable' && d.id === 'junk_bacon'));
	const plain = rollJunkDrops(ctx, mulberry32(1));
	assert.ok(!plain.some((d) => d.kind === 'consumable' && d.id === 'junk_horn'), 'no type, no ingredients');
	const gold = rollJunkDrops({ ...ctx, lucky: true, type: 'bossGreatAuroch' }, mulberry32(1));
	const hornOf = (list: typeof drops) => list.reduce((n, d) => n + (d.kind === 'consumable' && d.id === 'junk_horn' ? d.qty : 0), 0);
	assert.ok(hornOf(gold) >= hornOf(drops) * 3 - 3, 'a golden monster pays about triple');
});

test("an ingredient is listed once per monster (its own row replaces its family's)", () => {
	for (const m of MONSTER_CATALOG.filter((m) => m.enabled)) {
		const ids = ingredientsOf(m.id).map((d) => d.id);
		assert.equal(new Set(ids).size, ids.length, m.id);
	}
});
