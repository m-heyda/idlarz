import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_CATALOG, SETS, levelScale } from '../../src/catalog';
import { GRADES, gradeLevels, gradeOfItem, gradeRarities, LIVE_GRADES } from '../../src/catalog/items/grades';
import { LADDER } from '../../src/catalog/items/ladder';
import { CLOTH_ITEMS } from '../../src/catalog/items/cloth';
import { OBSIDIAN_ITEMS } from '../../src/catalog/items/obsidian';
import { WOODEN_ITEMS } from '../../src/catalog/items/starter';
import { STEEL_ITEMS } from '../../src/catalog/items/steel';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { instanceProblem } from '../../src/lib/itemInstance';
import { LOOT_DATA } from '../../src/lib/loot/data';
import { eligibleCandidates } from '../../src/lib/loot/pools';
import { RARITY_ORDER } from '../../src/catalog';
import type { ItemInstance } from '../../src/types/game';

// IDL-243: the legacy families are on the grade ladder or retired, so the grade ceilings of the biome pools and the merchant bind every piece.

const LEGACY = [...WOODEN_ITEMS, ...CLOTH_ITEMS, ...STEEL_ITEMS, ...OBSIDIAN_ITEMS];

test('every legacy piece that fills a ladder cell is graded by it, every other one is retired', () => {
	for (const legacy of LEGACY) {
		const def = ITEM_CATALOG[legacy.id];
		const cells = GRADES.filter((g) => Object.values(LADDER[g]).includes(legacy.id));
		if (cells.length === 0) {
			assert.equal(def.enabled, false, `${def.id} is on no cell and must be retired`);
			assert.equal(gradeOfItem(def), undefined, def.id);
		} else {
			assert.deepEqual(cells.length, 1, `${def.id} fills one cell`);
			assert.equal(gradeOfItem(def), cells[0], def.id);
			assert.equal(def.enabled, LIVE_GRADES.includes(cells[0]), `${def.id}: enabled with its grade`);
			assert.deepEqual(def.dropLevels, gradeLevels(cells[0]), def.id);
			assert.deepEqual(def.dropRarities, gradeRarities(cells[0]), def.id);
		}
	}
});

test('the decisions: wood keeps three cells, cloth is retired, steel keeps the Iron Sword and six armour pieces, Obsidian is all of G6', () => {
	const graded = (items: { id: string }[]) => items.filter((d) => gradeOfItem(ITEM_CATALOG[d.id])).map((d) => `${d.id}:${gradeOfItem(ITEM_CATALOG[d.id])}`);
	assert.deepEqual(graded(WOODEN_ITEMS), ['wooden_club:G1', 'hunting_bow:G2', 'acorn_charm:G1']);
	assert.deepEqual(graded(CLOTH_ITEMS), []);
	assert.deepEqual(graded(STEEL_ITEMS), [
		'iron_sword:G3',
		'steel_helm:G4',
		'steel_pauldrons:G4',
		'steel_cuirass:G4',
		'steel_gauntlets:G4',
		'steel_greaves:G4',
		'steel_sabatons:G4',
	]);
	assert.equal(graded(OBSIDIAN_ITEMS).length, OBSIDIAN_ITEMS.length);
	for (const def of OBSIDIAN_ITEMS) assert.equal(gradeOfItem(ITEM_CATALOG[def.id]), 'G6', def.id);
	assert.deepEqual(Object.keys(SETS.obsidian.bonuses).map(Number), [2, 4, 6, 9, 12], 'Obsidian keeps its set bonuses');
});

test('no enabled base gear is outside the ladder, so no pool piece escapes a grade ceiling', () => {
	for (const def of Object.values(ITEM_CATALOG)) {
		if (def.generation !== 'base' || def.enabled === false || !def.slot) continue;
		assert.ok(gradeOfItem(def), `${def.id} drops with no grade`);
	}
	for (const poolId of ['general_equipment', 'equipment_plains', 'equipment_tundra']) {
		for (const level of [1, 10, 25, 40, 70, 100]) {
			for (const c of eligibleCandidates(LOOT_DATA, poolId, level))
				if (c.def.generation === 'base') assert.ok(gradeOfItem(c.def), `${c.def.id} in ${poolId} at ${level}`);
		}
	}
});

test('a piece a player already owns stays valid whatever its old level and rarity', () => {
	const owned = (base: string, level: number, rarity: string): ItemInstance => ({ base, level, rarity, quality: 50, affixes: [] });
	assert.equal(instanceProblem(owned('obsidian_cuirass', 12, 'rare')), null);
	assert.equal(instanceProblem(owned('obsidian_blade', 40, 'epic')), null);
	assert.equal(instanceProblem(owned('steel_cuirass', 10, 'rare')), null);
	assert.equal(instanceProblem(owned('iron_sword', 6, 'uncommon')), null);
	assert.equal(instanceProblem(owned('wooden_club', 14, 'uncommon')), null);
	assert.equal(instanceProblem(owned('cloth_robe', 9, 'rare')), null, 'retired pieces load too');
	assert.equal(instanceProblem(owned('leather_vest', 20, 'epic')), null);
	for (const item of Object.values(STARTER_EQUIPMENT)) assert.equal(instanceProblem(item!), null, 'the starter kit');
});

test('the top live grade is open at the top and takes every rarity, the ones below keep their own window', () => {
	const top = LIVE_GRADES[LIVE_GRADES.length - 1];
	assert.equal(gradeLevels(top)[1], 100);
	assert.deepEqual([...gradeRarities(top)], RARITY_ORDER);
	for (const g of LIVE_GRADES.slice(0, -1)) assert.ok(gradeLevels(g)[1] < 100, g);
});

test('pieces generated while G3 was the top live grade stay valid after G4-G6 closed its window (level 35, any rarity)', () => {
	const owned = (base: string, level: number, rarity: string): ItemInstance => ({ base, level, rarity, quality: 50, affixes: [] });
	assert.equal(instanceProblem(owned(LADDER.G3.head!, 35, 'epic')), null);
	assert.equal(instanceProblem(owned('iron_sword', 35, 'rare')), null);
	assert.equal(instanceProblem(owned('arming_sword', 50, 'legendary')), null, 'a graded reuse item of G3 too');
	assert.deepEqual(ITEM_CATALOG[LADDER.G3.head!].dropLevels, [19, 30], 'but it is generated only inside the G3 window');
});

test('the Obsidian weapons are at their G6 cell at the window start (damage within 5 % of the ladder table)', () => {
	const table = { obsidian_maul: 124, obsidian_longbow: 61, obsidian_crossbow: 84 };
	for (const [id, damage] of Object.entries(table)) {
		const def = ITEM_CATALOG[id];
		const at55 = def.stats!.damage! * (1 + (levelScale(55) / levelScale(def.minItemLevel!) - 1));
		assert.ok(Math.abs(at55 - damage) / damage < 0.05, `${id}: ${at55} vs ${damage}`);
	}
});
