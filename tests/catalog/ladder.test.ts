import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ITEM_CATALOG, SETS, STAT_DEFS, levelScale, weaponDps } from '../../src/catalog';
import { ARMOUR_SLOTS, GRADES, GRADE_INFO, LADDER, LIVE_GRADES, LADDER_ITEMS, SPECIAL_SET, WEAPON_TYPES } from '../../src/catalog/items/ladder';
import { shopItems } from '../../src/catalog/loot';
import { HARD_LIMITS } from '../../src/config/limits';
import { fullSet } from '../../src/lib/fightSim';
import { generateLoot } from '../../src/lib/loot/generate';
import { mulberry32 } from '../../src/lib/rng';
import { kit, STRONG_KIT } from '../builders';

const ladderIds = new Set(LADDER_ITEMS.map((d) => d.id));
type Grade = (typeof GRADES)[number];
const gradeOf = (def: { tags?: string[] }) => def.tags!.find((t) => t.startsWith('grade:'))!.slice(6) as Grade;

test('every cell of the ladder resolves to an item', () => {
	for (const grade of GRADES) {
		for (const slot of ARMOUR_SLOTS) assert.ok(ITEM_CATALOG[LADDER[grade][slot]!], `${grade} ${slot}`);
		for (const id of Object.values(LADDER[grade])) assert.ok(ITEM_CATALOG[id!], `${grade}: ${id}`);
	}
	for (const grade of GRADES.filter((g) => g.startsWith('G'))) {
		for (const type of WEAPON_TYPES) assert.equal(ITEM_CATALOG[LADDER[grade][type]!].weaponType, type, `${grade} ${type}`);
		assert.equal(ITEM_CATALOG[LADDER[grade].shield!].weaponType, 'shield');
		assert.equal(ITEM_CATALOG[LADDER[grade].tome!].weaponType, 'tome');
	}
});

test('generated ladder items are graded by tag, inside the grade window, and enabled only for the live grades (G1-G3)', () => {
	for (const def of LADDER_ITEMS) {
		assert.equal(def.enabled, LIVE_GRADES.includes(gradeOf(def)), def.id);
		assert.ok(GRADES.includes(gradeOf(def)), def.id);
		assert.deepEqual([def.minItemLevel, def.maxItemLevel], GRADE_INFO[gradeOf(def)].levels, def.id);
		assert.deepEqual(def.allowedRarities, GRADE_INFO[gradeOf(def)].rarities, def.id);
	}
	for (const s of shopItems()) assert.ok(!ladderIds.has(s.id), `${s.id} is for sale`);
});

test('G1-G3 drop for every slot and weapon type, and nothing above G3 drops from any source at any level', () => {
	const rng = mulberry32(7);
	const seen = new Set<string>();
	for (const sourceId of ['monster', 'boss', 'chest', 'merchant']) {
		for (let level = 1; level <= 100; level += 1) {
			for (let i = 0; i < 40; i++) {
				for (const drop of generateLoot({ sourceId, level }, rng).drops) {
					if (drop.kind !== 'gear') continue;
					const grade = ITEM_CATALOG[drop.item.base].tags?.find((t) => t.startsWith('grade:'))?.slice(6);
					if (grade) assert.ok(LIVE_GRADES.includes(grade as Grade), `${drop.item.base} (${grade}) dropped from ${sourceId} L${level}`);
					seen.add(drop.item.base);
				}
			}
		}
	}
	// every cell of G1-G3 is reachable (a live item fills some cells; the generated ones are in the ladder)
	for (const grade of LIVE_GRADES) {
		for (const [cell, id] of Object.entries(LADDER[grade])) assert.equal(ITEM_CATALOG[id!].enabled !== false, true, `${grade} ${cell}`);
	}
	for (const def of LADDER_ITEMS.filter((d) => LIVE_GRADES.includes(gradeOf(d)))) assert.ok(seen.has(def.id), `${def.id} never dropped`);
});

test('the 12 belts exist (9 grades and 3 set pieces) and the Obsidian set has its belt', () => {
	assert.equal(GRADES.filter((g) => ITEM_CATALOG[LADDER[g].belt!]?.slot === 'belt').length, 12);
	assert.equal(ITEM_CATALOG[LADDER.G6.belt!].set, 'obsidian');
	assert.equal(ITEM_CATALOG[LADDER.G6.belt!].kind, 'accessory');
});

test('weapon damage per second rises with the grade within a type, one table per type', () => {
	for (const type of WEAPON_TYPES) {
		let last = 0;
		for (const grade of GRADES.filter((g) => g.startsWith('G'))) {
			const id = LADDER[grade][type]!;
			if (!ladderIds.has(id)) continue; // a live item fills the cell: it was authored at another item level
			const dps = weaponDps(ITEM_CATALOG[id]);
			assert.ok(dps > last, `${type} ${grade}: ${dps} beats ${last}`);
			last = dps;
		}
	}
});

test('each special set has 14 slots, the thresholds 3 / 6 / 9 / 12 / 14, and its pieces are disabled', () => {
	for (const [grade, setId] of Object.entries(SPECIAL_SET)) {
		const set = SETS[setId];
		assert.equal(set.size, 14, setId);
		assert.deepEqual(Object.keys(set.bonuses).map(Number), [3, 6, 9, 12, 14], setId);
		for (const id of set.pieces) {
			assert.equal(ITEM_CATALOG[id].enabled, false, id);
			assert.ok(ITEM_CATALOG[id].tags!.includes(`grade:${grade}`), id);
		}
	}
});

test('every set reaches its highest threshold with the pieces it has, and no set pushes a family past its cap', () => {
	for (const set of Object.values(SETS)) {
		assert.ok(Math.max(...Object.keys(set.bonuses).map(Number)) <= set.size, set.id);
		const total: Record<string, number> = {};
		for (const bonus of Object.values(set.bonuses)) for (const [k, v] of Object.entries(bonus)) total[k] = (total[k] ?? 0) + v;
		for (const key of Object.keys(total)) assert.ok(key in STAT_DEFS, `${set.id}: ${key}`);
		// family caps of IDL-149 (docs/plan/28-reuse-items-and-stats.md section 10)
		const caps: Record<string, number> = { incomePct: 50, xpPct: 40, killRewardPct: 60, clickPct: 40, damagePct: 45 };
		for (const [key, cap] of Object.entries(caps)) assert.ok((total[key] ?? 0) <= cap, `${set.id} ${key} ${total[key]} > ${cap}`);
		assert.ok((total.offlineCapHours ?? 0) <= HARD_LIMITS.offlineCapHours, set.id);
		assert.ok((total.offlineEff ?? 0) / 100 <= HARD_LIMITS.offlineEfficiency, set.id);
	}
});

test('a kit per grade: the defence of the kits rises along G1-G9, and the strong kit is the live best', () => {
	// Stats are authored at each item's own window start, so compare them at the grade's: grown by the level curve like the game does
	const power = (grade: Grade) =>
		Object.values(kit(grade)).reduce((sum, item) => {
			const def = ITEM_CATALOG[item!.base];
			return sum + ((def.stats?.armor ?? 0) + (def.stats?.maxHp ?? 0)) * (levelScale(GRADE_INFO[grade].levels[0]) / levelScale(def.minItemLevel!));
		}, 0);
	const normal = GRADES.filter((g) => g.startsWith('G'));
	for (let i = 1; i < normal.length; i++) assert.ok(power(normal[i]) > power(normal[i - 1]), `${normal[i]} beats ${normal[i - 1]}`);
	for (const grade of GRADES) {
		const k = kit(grade);
		assert.ok(k.mainHand && k.offHand && k.belt && k.ring1 && k.ring2, grade);
	}
	assert.equal(STRONG_KIT.mainHand?.base, 'titan_maul');
	assert.deepEqual(
		Object.keys(fullSet('obsidian')).sort(),
		Object.keys(STRONG_KIT)
			.filter((k) => k !== 'mainHand')
			.sort(),
		'the live kit has no disabled belt',
	);
});
