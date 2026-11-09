import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { generateLoot, resolveSourceLevel, rollItemLevel, type LootDrop } from '@/lib/loot/generate';
import { instanceProblem, resolveItem } from '@/lib/itemInstance';
import { mulberry32, randomInt, weightedPick } from '@/lib/rng';

const gear = (drops: LootDrop[]) => drops.flatMap((d) => (d.kind === 'gear' ? [d.item] : []));

// A deep copy of the real data to modify (plain objects are fine: no test looks up 'constructor')
const copy = (): LootData => JSON.parse(JSON.stringify(LOOT_DATA)) as LootData;

test('weightedPick follows normalised weights, whatever they sum to', () => {
	const rng = mulberry32(1);
	const counts = { a: 0, b: 0, c: 0 };
	const entries = [
		{ id: 'a' as const, w: 3 },
		{ id: 'b' as const, w: 1 },
		{ id: 'c' as const, w: 0 },
	];
	for (let i = 0; i < 20000; i++) counts[weightedPick(entries, (e) => e.w, rng)!.id]++;
	assert.equal(counts.c, 0);
	assert.ok(Math.abs(counts.a / 20000 - 0.75) < 0.02);
	assert.equal(
		weightedPick([], () => 1, rng),
		undefined,
	);
	assert.equal(
		weightedPick([{ w: 0 }, { w: -1 }], (e) => e.w, rng),
		undefined,
	);
});

test('randomInt covers its range and mulberry32 is reproducible', () => {
	const rng = mulberry32(7);
	const seen = new Set<number>();
	for (let i = 0; i < 500; i++) seen.add(randomInt(rng, 3, 6));
	assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
	assert.deepEqual([mulberry32(5)(), mulberry32(5)()], [mulberry32(5)(), mulberry32(5)()]);
});

test('a chest level comes from the castle level and is clamped; a monster passes its own level', () => {
	const chest = LOOT_DATA.sources.chest.level!;
	assert.equal(resolveSourceLevel(chest, 1), 4);
	assert.equal(resolveSourceLevel(chest, 4), 13);
	assert.equal(resolveSourceLevel(chest, 1000), 100);
	assert.equal(resolveSourceLevel(chest, 0), 4);
	assert.equal(generateLoot({ sourceId: 'monster', level: 7 }, mulberry32(1)).sourceLevel, 7);
	assert.equal(generateLoot({ sourceId: 'monster', level: 1000 }, mulberry32(1)).sourceLevel, 100);
	assert.ok(
		generateLoot({ sourceId: 'monster' }, mulberry32(1)).warnings.length > 0,
		'a monster source with no level is a configuration problem, not a silent level 1',
	);
});

test('item level stays inside the profile bounds', () => {
	const rng = mulberry32(2);
	for (let i = 0; i < 2000; i++) {
		const level = rollItemLevel(1, { offset: 0, variance: 3, min: 1, max: 100 }, rng);
		assert.ok(level >= 1 && level <= 4);
	}
	assert.equal(rollItemLevel(500, { offset: 10, variance: 5, min: 1, max: 100 }, rng), 100);
	assert.equal(rollItemLevel(12, { offset: 0, variance: 0 }, rng), 12);
});

test('a weak source never drops items above its level cap', () => {
	const rng = mulberry32(3);
	let seen = 0;
	for (let i = 0; i < 20000; i++) {
		const result = generateLoot({ sourceId: 'monster', level: 1 }, rng);
		for (const item of gear(result.drops)) {
			seen++;
			assert.ok(item.level <= 2, `level ${item.level}`);
			assert.equal(item.rarity === 'rare' || item.rarity === 'epic' || item.rarity === 'legendary', false, 'gated rarity at level 1-2');
			assert.equal(instanceProblem(item), null);
		}
	}
	assert.ok(seen > 1000);
	assert.deepEqual(generateLoot({ sourceId: 'monster', level: 1 }, mulberry32(1)).warnings, []);
});

test('rarity is rolled independently of the drop chance and follows the normalised weights', () => {
	// Rat level 11: item level 10-12, grade G2, which carries common (70) and uncommon (22) only
	const rng = mulberry32(11);
	const counts: Record<string, number> = {};
	let total = 0;
	for (let i = 0; i < 60000; i++) {
		for (const item of gear(generateLoot({ sourceId: 'monster', level: 11 }, rng).drops)) {
			counts[item.rarity] = (counts[item.rarity] ?? 0) + 1;
			total++;
		}
	}
	// drop chance 0.12 + 0.01 per level above 1
	assert.ok(Math.abs(total / 60000 - 0.22) < 0.01, `drops per kill ${total / 60000}`);
	assert.ok(Math.abs(counts.common / total - 70 / 92) < 0.03, `common ${counts.common / total}`);
	assert.ok(Math.abs(counts.uncommon / total - 22 / 92) < 0.03);
	assert.equal(counts.rare ?? 0, 0);
});

test('higher monster levels raise the item level, and rarer rarities unlock with the grade', () => {
	const rarities = (level: number) => {
		const rng = mulberry32(4);
		const seen = new Set<string>();
		let maxLevel = 0;
		for (let i = 0; i < 40000; i++) {
			for (const item of gear(generateLoot({ sourceId: 'monster', level }, rng).drops)) {
				seen.add(item.rarity);
				maxLevel = Math.max(maxLevel, item.level);
				assert.equal(instanceProblem(item), null);
			}
		}
		assert.equal(maxLevel, level + 1); // source level, +1 variance
		return [...seen].sort();
	};
	assert.deepEqual(rarities(20), ['uncommon'], 'G3 carries uncommon only');
	assert.deepEqual(rarities(36), ['rare', 'uncommon'], 'G4 carries uncommon and rare');
});

test('every rolled instance is valid and resolves', () => {
	const rng = mulberry32(5);
	for (const sourceId of ['monster', 'boss', 'chest']) {
		for (let i = 0; i < 3000; i++) {
			for (const item of gear(generateLoot({ sourceId, level: sourceId === 'chest' ? undefined : 1 + (i % 20), castleLevel: 1 + (i % 10) }, rng).drops)) {
				assert.equal(instanceProblem(item), null, JSON.stringify(item));
				assert.ok(resolveItem(item));
			}
		}
	}
});

test('rarity sets the affix count', () => {
	const rng = mulberry32(6);
	for (let i = 0; i < 20000; i++) {
		for (const item of gear(generateLoot({ sourceId: 'monster', level: 20 }, rng).drops)) {
			const rarity = LOOT_DATA.rarities[item.rarity];
			assert.ok(item.affixes.length >= rarity.minAffixes && item.affixes.length <= rarity.maxAffixes, `${item.rarity}: ${item.affixes.length}`);
			assert.equal(new Set(item.affixes.map((a) => LOOT_DATA.affixes[a.id].group)).size, item.affixes.length);
		}
	}
});

test('a boss always drops a general roll and every potion', () => {
	const rng = mulberry32(8);
	for (let i = 0; i < 500; i++) {
		const { drops } = generateLoot({ sourceId: 'boss', level: 25 }, rng);
		const items = gear(drops);
		assert.ok(
			items.some((g) => !LOOT_DATA.items[g.base].pools?.includes('legendary_weapons')),
			'general roll',
		);
		assert.ok(!items.some((g) => LOOT_DATA.items[g.base].retired), 'a retired piece dropped');
		assert.deepEqual(
			drops.filter((d) => d.kind === 'consumable').map((d) => (d.kind === 'consumable' ? [d.id, d.qty] : null)),
			[
				['potion_minor', 2],
				['potion_greater', 1],
			],
		);
	}
});

test('retired items never drop from any source, at any level', () => {
	const rng = mulberry32(81);
	for (const [sourceId, levels] of [
		['monster', [1, 9, 20, 50]],
		['boss', [12, 25, 60]],
	] as const)
		for (const level of levels)
			for (let i = 0; i < 1500; i++)
				for (const g of gear(generateLoot({ sourceId, level }, rng).drops))
					assert.ok(!LOOT_DATA.items[g.base].retired, `${sourceId} L${level} dropped retired ${g.base}`);
	for (let i = 0; i < 4000; i++)
		for (const g of gear(generateLoot({ sourceId: 'chest', castleLevel: 1 + (i % 10) }, rng).drops))
			assert.ok(!LOOT_DATA.items[g.base].retired, `a chest dropped retired ${g.base}`);
});

test('a table with preferMissing favours the pieces the player does not own yet, then duplicates', () => {
	// no table in the shipped data uses it today: the generator feature is kept and tested on the legendary pool
	const data = copy();
	data.profiles.boss.bonusTables = [
		{
			id: 'pick',
			poolId: 'legendary_weapons',
			mode: 'fixed',
			rolls: { min: 2, max: 2, guaranteed: 1, chancePerRoll: 0.4 },
			preferMissing: true,
			itemLevel: { offset: 0, variance: 0 },
		},
	];
	const setIds = Object.values(data.items)
		.filter((d) => d.pools?.includes('legendary_weapons'))
		.map((d) => d.id);
	assert.ok(setIds.length >= 3, `need a few pieces in the pool (${setIds.length})`);
	const rng = mulberry32(9);
	const missing = setIds[1];
	const pieces = (owned: string[], level = 40) =>
		gear(generateLoot({ sourceId: 'boss', level, owned }, rng, data).drops).filter((g) => setIds.includes(g.base));
	for (let i = 0; i < 200; i++) assert.equal(pieces(setIds.filter((id) => id !== missing))[0].base, missing);
	assert.ok(pieces(setIds).length > 0, 'all owned still drops one');
	// Two pieces in one kill are never the same while others are missing
	for (let i = 0; i < 400; i++) {
		const got = pieces([]);
		assert.equal(new Set(got.map((p) => p.base)).size, got.length);
	}
});

test('a chest item is exactly one thing; a legendary replaces the gear roll instead of adding to it', () => {
	const rng = mulberry32(10);
	let legendaryNamed = 0;
	let potions = 0;
	const n = 40000;
	for (let i = 0; i < n; i++) {
		const { drops } = generateLoot({ sourceId: 'chest', castleLevel: 1 }, rng);
		assert.equal(drops.length, 1, JSON.stringify(drops));
		const d = drops[0];
		if (d.kind === 'consumable') potions++;
		else if (LOOT_DATA.items[d.item.base].pools?.includes('legendary_weapons')) legendaryNamed++;
	}
	assert.ok(Math.abs(legendaryNamed / n - 0.019) < 0.006, `legendary ${legendaryNamed / n}`);
	assert.ok(Math.abs(potions / n - 0.18 * (1 - 0.019)) < 0.02, `potions ${potions / n}`);
});

test('a bonus table adds to the general loot and never removes it', () => {
	const data = copy();
	data.profiles.normal_monster.rolls = { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 };
	data.profiles.normal_monster.bonusTables = [{ id: 'extra_set', poolId: 'legendary_weapons', mode: 'fixed', chance: 1 }];
	data.items = Object.fromEntries(Object.entries(data.items).map(([k, v]) => [k, v.pools?.includes('legendary_weapons') ? { ...v, minItemLevel: 1 } : v]));
	const { drops } = generateLoot({ sourceId: 'monster' }, mulberry32(1), data);
	assert.equal(gear(drops).length, 2);
});

test('pity raises the chance after misses and resets on a drop', () => {
	// Boss legendary (pity key `boss:king_legendary`, a legacy name): base 5%, +1% per miss up to +10%
	const miss = () => 0.999;
	let pity: Record<string, number> = {};
	for (let i = 0; i < 4; i++) pity = generateLoot({ sourceId: 'boss', level: 15, pity }, miss).pity;
	assert.equal(pity['boss:king_legendary'], 4);
	// 4 misses = 5% + 4% = 9%: a roll of 0.08 now succeeds, which it would not at the base 5%
	const rng = mulberry32(12);
	let hitsBase = 0;
	let hitsPity = 0;
	const isLegendary = (drops: LootDrop[]) => gear(drops).some((g) => LOOT_DATA.items[g.base].pools?.includes('legendary_weapons'));
	for (let i = 0; i < 20000; i++) {
		if (isLegendary(generateLoot({ sourceId: 'boss', level: 15 }, rng).drops)) hitsBase++;
		if (isLegendary(generateLoot({ sourceId: 'boss', level: 15, pity: { 'boss:king_legendary': 50 } }, rng).drops)) hitsPity++;
	}
	assert.ok(Math.abs(hitsBase / 20000 - 0.05) < 0.01, `base ${hitsBase / 20000}`);
	assert.ok(Math.abs(hitsPity / 20000 - 0.15) < 0.015, `capped pity ${hitsPity / 20000}`); // 5% + the 10% cap
	// a drop resets the counter
	const win = () => 0;
	assert.equal(generateLoot({ sourceId: 'boss', level: 15, pity: { 'boss:king_legendary': 7 } }, win).pity['boss:king_legendary'], 0);
});

test('the explain trace says why an item dropped', () => {
	const result = generateLoot({ sourceId: 'boss', level: 20 }, mulberry32(13));
	assert.equal(result.sourceLevel, 20);
	const general = result.trace.find((t) => t.table === 'general')!;
	assert.equal(general.sourceId, 'boss');
	assert.equal(general.profileId, 'boss');
	assert.equal(general.sourceLevel, 20);
	assert.equal(general.itemLevel, 20);
	assert.ok(general.rarity && general.itemId);
	assert.ok(Math.abs(Object.values(general.rarityChances).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('new content is data only: a fake rarity drops through the unchanged generator', () => {
	const data = copy();
	data.rarities.mythic = {
		id: 'mythic',
		label: 'Mythic',
		color: '#f0f',
		order: 9,
		sellValue: 5000,
		glow: { blur: 8, alpha: 1, pulse: true },
		minAffixes: 2,
		maxAffixes: 2,
		statMultiplier: 1,
		enabled: true,
	};
	for (const item of Object.values(data.items))
		if (item.generation === 'base') {
			item.allowedRarities = [...(item.allowedRarities ?? []), 'mythic'];
			if (item.dropRarities) item.dropRarities = [...item.dropRarities, 'mythic'];
		}
	data.profiles.normal_monster.rarityWeights.mythic = 50;
	data.profiles.normal_monster.rolls = { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 };
	const rng = mulberry32(14);
	let mythic = 0;
	for (let i = 0; i < 3000; i++) {
		for (const g of gear(generateLoot({ sourceId: 'monster' }, rng, data).drops)) {
			if (g.rarity === 'mythic') {
				mythic++;
				assert.equal(g.affixes.length, 2);
				assert.equal(instanceProblem(g, data), null);
			}
		}
	}
	assert.ok(mythic > 1000);
});

test('disabled content is never selected, and an empty pool warns instead of substituting', () => {
	const data = copy();
	for (const item of Object.values(data.items)) if (item.generation === 'base') item.enabled = false;
	data.profiles.normal_monster.rolls = { min: 1, max: 1, guaranteed: 1, chancePerRoll: 1 };
	const result = generateLoot({ sourceId: 'monster' }, mulberry32(15), data);
	assert.equal(gear(result.drops).length, 0);
	assert.ok(result.warnings.length > 0);
	assert.equal(generateLoot({ sourceId: 'nope' }, mulberry32(1)).warnings.length, 1);
});

test('guaranteed rolls always drop and a zero-weight rarity never does', () => {
	const data = copy();
	data.profiles.boss.rarityWeights = { common: 1, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
	const rng = mulberry32(16);
	for (let i = 0; i < 300; i++) {
		const general = gear(generateLoot({ sourceId: 'boss', level: 15 }, rng, data).drops).filter((g) => !LOOT_DATA.items[g.base].pools?.length);
		assert.equal(general.length, 1);
		assert.equal(general[0].rarity, 'common');
	}
});
