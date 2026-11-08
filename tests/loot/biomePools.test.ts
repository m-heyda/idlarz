import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIOME_LOOT, monsterSourceId } from '@/catalog';
import { GRADES, gradeOfItem, type Grade } from '@/catalog/items/grades';
import { MONSTERS } from '@/config/combatConfig';
import { generateLoot } from '@/lib/loot/generate';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { eligibleCandidates } from '@/lib/loot/pools';
import { bestWornGrade, generateMerchantStock, shelfLevels } from '@/lib/merchant';
import { plainItem } from '@/lib/itemInstance';
import { mulberry32 } from '@/lib/rng';
import type { Equipment } from '@/types/game';

/** The data as it will be when every grade is live (IDL-238): enables each item of the ladder */
const allGradesLive = (): LootData => {
	const d = JSON.parse(JSON.stringify(LOOT_DATA)) as LootData;
	for (const item of Object.values(d.items)) if (gradeOfItem(item)) item.enabled = true;
	return d;
};

const topGrade = (d: LootData, pool: string, level: number): number =>
	Math.max(-1, ...eligibleCandidates(d, pool, level).map((c) => (gradeOfItem(c.def) ? GRADES.indexOf(gradeOfItem(c.def)!) : -1)));

test('every normal monster drops from the source of its own biome, bosses from the boss source', () => {
	for (const def of Object.values(MONSTERS)) {
		if (def.grade === 'boss') assert.equal(def.lootSourceId, 'boss');
		else {
			assert.equal(def.lootSourceId, monsterSourceId(def.spawn.biomes[0]));
			assert.ok(LOOT_DATA.sources[def.lootSourceId], `${def.lootSourceId} exists`);
		}
	}
});

test('a biome pool stops at its grade ceiling: plains G3, forest G4, swamp G5, tundra G7', () => {
	const d = allGradesLive();
	const ceilings = { plains: 'G3', forest: 'G4', swamp: 'G5', tundra: 'G7' } satisfies Record<keyof typeof BIOME_LOOT, Grade>;
	for (const [biome, ceiling] of Object.entries(ceilings)) {
		let top = -1;
		for (let level = 1; level <= 100; level++) top = Math.max(top, topGrade(d, `equipment_${biome}`, level));
		assert.equal(GRADES[top], ceiling, biome);
	}
});

test('with all grades live a plains monster never drops G4 and a forest monster never G5', () => {
	const d = allGradesLive();
	const rng = mulberry32(5);
	const gradesFrom = (sourceId: string, level: number) => {
		const seen = new Set<string>();
		for (let i = 0; i < 4000; i++)
			for (const drop of generateLoot({ sourceId, level, extraGearRolls: 1 }, rng, d).drops)
				if (drop.kind === 'gear') seen.add(gradeOfItem(d.items[drop.item.base]) ?? '-');
		return seen;
	};
	assert.ok(!gradesFrom(monsterSourceId('plains'), 40).has('G4'));
	assert.ok(gradesFrom(monsterSourceId('forest'), 40).has('G4'));
	assert.ok(!gradesFrom(monsterSourceId('forest'), 52).has('G5'));
	assert.ok(gradesFrom(monsterSourceId('swamp'), 52).has('G5'));
});

test('today (G1-G3 live) the biome pools differ from the general pool only in what they cannot yet reach', () => {
	for (const level of [1, 8, 9, 18, 19, 30]) {
		const general = eligibleCandidates(LOOT_DATA, 'general_equipment', level)
			.map((c) => c.def.id)
			.sort();
		for (const biome of Object.keys(BIOME_LOOT)) {
			assert.deepEqual(
				eligibleCandidates(LOOT_DATA, `equipment_${biome}`, level)
					.map((c) => c.def.id)
					.sort(),
				general,
				`${biome} at ${level}`,
			);
		}
	}
});

test('bestWornGrade is the highest grade on the worn pieces (G1 with nothing, or only pieces outside the ladder)', () => {
	const g = (grade: Grade) => Object.values(LOOT_DATA.items).find((i) => gradeOfItem(i) === grade && i.enabled !== false && i.slot === 'head')!.id;
	assert.equal(bestWornGrade({} as Equipment), 'G1');
	assert.equal(bestWornGrade({ head: plainItem('leather_cap') } as Equipment), 'G1');
	assert.equal(bestWornGrade({ head: plainItem(g('G2')), feet: plainItem(g('G1')) } as Equipment), 'G2');
	assert.equal(bestWornGrade({ head: plainItem(g('G3')) } as Equipment), 'G3');
});

test('the shelf never sells above the best worn grade, and its levels stay inside that grade', () => {
	const grade = (item: { base: string }) => gradeOfItem(LOOT_DATA.items[item.base]);
	for (const worn of ['G1', 'G2'] as const) {
		for (const castle of [1, 5, 10]) {
			for (let seed = 1; seed <= 40; seed++) {
				const stock = generateMerchantStock(castle, 100, mulberry32(seed), 0, {}, worn);
				for (const offer of stock.offers) {
					const g = grade(offer);
					assert.ok(!g || GRADES.indexOf(g) <= GRADES.indexOf(worn), `${worn}: sold ${offer.base} (${g})`);
				}
			}
		}
	}
	assert.equal(shelfLevels(10, 100, 'G1').max, 8);
	assert.equal(shelfLevels(10, 100, 'G1').centre, 8);
	assert.equal(shelfLevels(1, 100).max, 105, 'without a grade only the gear level holds it');
});

test('with all grades live the shelf still stops at the worn grade', () => {
	const d = allGradesLive();
	const rng = mulberry32(9);
	let gear = 0;
	for (let i = 0; i < 300; i++) {
		const r = generateLoot({ sourceId: 'merchant', castleLevel: 10, level: 25, maxItemLevel: 45, maxGrade: 'G3' }, rng, d);
		for (const drop of r.drops) {
			const g = drop.kind === 'gear' ? gradeOfItem(d.items[drop.item.base]) : undefined;
			assert.ok(!g || GRADES.indexOf(g) <= 2, `${g}`);
			if (drop.kind === 'gear') gear++;
		}
	}
	assert.ok(gear > 0);
});
