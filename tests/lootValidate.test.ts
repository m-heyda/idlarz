import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOOT_DATA, type LootData } from '@/lib/loot/data';
import { validateLootData } from '@/lib/loot/validate';

const copy = (): LootData => JSON.parse(JSON.stringify(LOOT_DATA)) as LootData;
const has = (data: LootData, text: RegExp) => validateLootData(data).errors.some((e) => text.test(e));

test('the shipped loot configuration is valid', () => {
	const { errors, warnings } = validateLootData();
	assert.deepEqual(errors, []);
	assert.deepEqual(warnings, []);
});

test('a source must reference an existing profile, a profile existing pools and rarities', () => {
	let d = copy();
	d.sources.rat.lootProfileId = 'ghost';
	assert.ok(has(d, /unknown loot profile ghost/));
	d = copy();
	d.profiles.boss.generalPoolId = 'ghost';
	assert.ok(has(d, /unknown general pool ghost/));
	d = copy();
	d.profiles.boss.bonusTables[0].poolId = 'ghost';
	assert.ok(has(d, /unknown pool ghost/));
	d = copy();
	d.profiles.boss.rarityWeights.mythic = 5;
	assert.ok(has(d, /unknown rarity mythic/));
});

test('rarity weights must be non-negative and at least one enabled rarity positive', () => {
	let d = copy();
	d.profiles.boss.rarityWeights.common = -1;
	assert.ok(has(d, /non-negative/));
	d = copy();
	d.profiles.boss.rarityWeights = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
	assert.ok(has(d, /no enabled rarity has a positive weight/));
	d = copy();
	d.rarities.common.enabled = false;
	d.profiles.boss.rarityWeights = { common: 5 };
	assert.ok(has(d, /no enabled rarity/));
});

test('roll counts, guarantees and chances are checked', () => {
	let d = copy();
	d.profiles.boss.rolls = { min: 1, max: 1, guaranteed: 3, chancePerRoll: 1 };
	assert.ok(has(d, /guaranteed rolls exceed/));
	d = copy();
	d.profiles.boss.rolls = { min: 3, max: 1, chancePerRoll: 1 };
	assert.ok(has(d, /bad roll count/));
	d = copy();
	d.profiles.boss.rolls.chancePerRoll = 1.5;
	assert.ok(has(d, /chancePerRoll/));
	d = copy();
	d.profiles.boss.bonusTables[1].chance = 2;
	assert.ok(has(d, /chance must be 0-1/));
});

test('item level windows must be valid', () => {
	let d = copy();
	d.items.iron_sword.minItemLevel = 60;
	d.items.iron_sword.maxItemLevel = 20;
	assert.ok(has(d, /iron_sword: bad item level window/));
	d = copy();
	d.items.iron_sword.maxItemLevel = 500;
	assert.ok(has(d, /iron_sword: bad item level window/));
	d = copy();
	d.profiles.boss.itemLevel = { offset: 0, variance: 0, min: 0, max: 100 };
	assert.ok(has(d, /bad item level bounds/));
});

test('items must name known rarities, slots and pools', () => {
	let d = copy();
	d.items.iron_sword.allowedRarities = ['mythic'];
	assert.ok(has(d, /iron_sword: unknown rarity mythic/));
	d = copy();
	d.items.emberbrand.fixedRarity = 'mythic';
	assert.ok(has(d, /emberbrand: named item needs a known fixedRarity/));
	d = copy();
	d.items.emberbrand.pools = ['ghost'];
	assert.ok(has(d, /emberbrand: unknown pool ghost/));
	d = copy();
	d.items.iron_sword.slot = 'tail' as never;
	assert.ok(has(d, /unknown slot tail/));
	d = copy();
	d.items.iron_sword.poolWeight = 0;
	assert.ok(has(d, /iron_sword: poolWeight/));
});

test('an affix with an unknown stat, a typo tag or a bad range is reported', () => {
	let d = copy();
	d.affixes.damage_prefix.stat = 'mana' as never;
	assert.ok(has(d, /unknown stat mana/));
	d = copy();
	d.affixes.damage_prefix.tags = ['sowrd'];
	assert.ok(has(d, /no item has the tag sowrd/));
	d = copy();
	d.affixes.damage_prefix.roll = [2, 1];
	assert.ok(has(d, /bad power or roll range/));
});

test('an enabled pool with no items is an error', () => {
	const d = copy();
	d.pools.rattatui_set.enabled = true;
	for (const item of Object.values(d.items)) if (item.pools?.includes('rattatui_set')) item.pools = [];
	assert.ok(has(d, /pool rattatui_set: enabled but has no items/));
});

test('every weighted rarity needs an eligible item at every level the source can reach', () => {
	// Only low-level bases left: the castle pushes rat levels far past their windows
	let d = copy();
	for (const item of Object.values(d.items)) if (item.generation === 'base') item.maxItemLevel = 5;
	assert.ok(has(d, /nothing can drop at item level|has weight but no eligible item/));
	// A rarity nobody may roll
	d = copy();
	for (const item of Object.values(d.items)) if (item.generation === 'base') item.allowedRarities = item.allowedRarities!.filter((r) => r !== 'rare');
	assert.ok(has(d, /rarity rare has weight but no eligible item/));
	// ...is fine when the weight is zero
	d.profiles.normal_monster.rarityWeights.rare = 0;
	d.profiles.basic_chest.rarityWeights.rare = 0;
	d.profiles.boss.rarityWeights.rare = 0;
	assert.deepEqual(validateLootData(d).errors, []);
});

test('an item that cannot take the affix count its rarity asks for is flagged', () => {
	const d = copy();
	d.rarities.legendary.minAffixes = 12;
	d.rarities.legendary.maxAffixes = 12;
	assert.ok(validateLootData(d).warnings.some((w) => /can only roll/.test(w)));
});
