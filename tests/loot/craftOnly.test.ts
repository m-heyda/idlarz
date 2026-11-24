import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../../src/catalog';
import { CRAFT_ONLY_GRADES, LIVE_GRADES, gradeOfItem } from '../../src/catalog/items/grades';
import { CRAFTED_LEGENDARIES } from '../../src/catalog/items/ladder';
import { LOOT_DATA } from '../../src/lib/loot/data';
import { eligibleCandidates, poolMembers } from '../../src/lib/loot/pools';
import { generateLoot } from '../../src/lib/loot/generate';
import { mulberry32 } from '../../src/lib/rng';

// IDL-152: G7 (Runed) and G8 (Ancient) are craft-only: the Crafting tab makes them, nothing else ever gives one out.

const craftOnly = ITEMS.filter((d) => d.craftOnly);

test('exactly the G7 and G8 ladder items and the three crafted legendaries are craft-only, enabled, and none of them is a live or a named item', () => {
	assert.ok(craftOnly.length > 40);
	for (const def of craftOnly) {
		assert.ok(CRAFT_ONLY_GRADES.includes(gradeOfItem(def)!) || CRAFTED_LEGENDARIES.includes(def.id), def.id);
		assert.notEqual(def.enabled, false, def.id);
		assert.ok(!LIVE_GRADES.includes(gradeOfItem(def)!), def.id);
	}
	for (const def of ITEMS.filter((d) => d.enabled !== false && CRAFT_ONLY_GRADES.includes(gradeOfItem(d) as never))) assert.equal(def.craftOnly, true, def.id);
	assert.equal(craftOnly.filter((d) => CRAFTED_LEGENDARIES.includes(d.id)).length, 3);
});

test('no loot pool but the craft pool ever holds a craft-only item', () => {
	for (const poolId of Object.keys(LOOT_DATA.pools)) {
		const members = poolMembers(LOOT_DATA, poolId).filter((d) => d.craftOnly);
		if (poolId === 'equipment_craft') assert.ok(members.length > 40, 'the craft pool holds them');
		else assert.equal(members.length, 0, `${poolId} holds ${members.map((d) => d.id).join(', ')}`);
	}
});

test('the craft pool offers G7 and G8 pieces in their windows; kills, bosses, chests and the shelf never drop one at any level', () => {
	const grades = (level: number) => new Set(eligibleCandidates(LOOT_DATA, 'equipment_craft', level).map((c) => gradeOfItem(c.def)));
	assert.ok(grades(70).has('G7'));
	assert.ok(grades(85).has('G8'));
	const rng = mulberry32(7);
	for (const sourceId of Object.keys(LOOT_DATA.sources).filter((s) => s !== 'craft'))
		for (const level of [30, 60, 75, 90, 100])
			for (let i = 0; i < 40; i++)
				for (const drop of generateLoot({ sourceId, level, luck: 100, extraGearRolls: 2 }, rng).drops)
					if (drop.kind === 'gear') assert.ok(!LOOT_DATA.items[drop.item.base].craftOnly, `${drop.item.base} dropped from ${sourceId} L${level}`);
});
