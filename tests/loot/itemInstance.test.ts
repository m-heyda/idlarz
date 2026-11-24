import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AFFIXES, AFFIX_CATALOG } from '@/catalog/affixes';
import { RARITIES } from '@/catalog/rarity';
import { MAX_ITEM_LEVEL, levelScale, qualityMultiplier, roundStat, scaleStats } from '@/catalog/stats';
import { ITEM_CATALOG } from '@/catalog';
import { affixFits, affixValue, instanceProblem, resolveItem, sellValueOf } from '@/lib/itemInstance';
import type { ItemInstance } from '@/types/game';

test('the level curve starts at 1, rises with the level and stays finite at the cap', () => {
	assert.equal(levelScale(1), 1);
	assert.ok(levelScale(10) > levelScale(5));
	assert.equal(levelScale(0), 1);
	assert.equal(levelScale(MAX_ITEM_LEVEL + 50), levelScale(MAX_ITEM_LEVEL));
	assert.equal(qualityMultiplier(50), 1);
	assert.ok(qualityMultiplier(0) < 1 && qualityMultiplier(100) > 1);
});

test('stat rounding: whole numbers where the stat says so, never rounding a present stat to 0', () => {
	assert.equal(roundStat('damage', 6.4), 6);
	assert.equal(roundStat('armor', 0.3), 1);
	assert.equal(roundStat('regen', 0.3333), 0.33);
	assert.equal(roundStat('damage', 0), 0);
	assert.deepEqual(scaleStats({ damage: 10, regen: 0.5 }, 1), { damage: 10, regen: 0.5 });
});

test('higher level and quality make the same base stronger', () => {
	const base = 'iron_sword';
	const at = (level: number, quality: number): ItemInstance => ({ base, level, rarity: 'common', quality, affixes: [] });
	const low = resolveItem(at(4, 50))!.stats.damage!;
	const high = resolveItem(at(30, 50))!.stats.damage!;
	assert.ok(high > low);
	assert.ok(resolveItem(at(10, 100))!.stats.damage! > resolveItem(at(10, 0))!.stats.damage!);
});

test('affixes add their derived value and name the item', () => {
	const instance: ItemInstance = {
		base: 'iron_sword',
		level: 10,
		rarity: 'rare',
		quality: 50,
		affixes: [
			{ id: 'critChance_prefix', roll: 50 },
			{ id: 'damage_suffix', roll: 100 },
		],
	};
	assert.equal(instanceProblem(instance), null);
	const resolved = resolveItem(instance)!;
	assert.equal(resolved.name, 'Keen Iron Sword of Power');
	assert.ok(resolved.stats.critChance! > 0);
	assert.ok(resolved.stats.damage! > resolved.baseStats.damage!);
});

test('affix values grow with item level and with the roll', () => {
	for (const affix of AFFIXES) {
		assert.ok(affixValue(affix, 100, 1) >= affixValue(affix, 0, 1), affix.id);
		assert.ok(affixValue(affix, 50, 40) >= affixValue(affix, 50, 5), affix.id);
		assert.ok(affixValue(affix, 0, 1) > 0, affix.id);
	}
});

test('affixes only fit items with a matching tag, level and rarity', () => {
	const sword = ITEM_CATALOG.iron_sword;
	const boots = ITEM_CATALOG.leather_boots;
	assert.equal(affixFits(AFFIX_CATALOG.damage_prefix, sword, 10, RARITIES.rare), true);
	assert.equal(affixFits(AFFIX_CATALOG.damage_prefix, boots, 10, RARITIES.rare), false);
	assert.equal(affixFits(AFFIX_CATALOG.superCrit_prefix, sword, 3, RARITIES.rare), false); // needs item level 6
});

test('instanceProblem rejects what the generator could not make', () => {
	const ok: ItemInstance = { base: 'iron_sword', level: 10, rarity: 'uncommon', quality: 50, affixes: [{ id: 'damage_prefix', roll: 10 }] };
	assert.equal(instanceProblem(ok), null);
	const bad = (patch: Partial<ItemInstance>) => instanceProblem({ ...ok, ...patch });
	assert.ok(bad({ base: 'nope' }));
	assert.ok(bad({ base: 'constructor' }));
	assert.ok(bad({ base: 'potion_minor' }));
	assert.ok(bad({ rarity: 'mythic' }));
	assert.ok(bad({ level: 0 }));
	assert.ok(bad({ level: 1000 }));
	assert.ok(bad({ level: 4.5 }));
	assert.ok(bad({ level: 2 })); // below the steel window
	assert.ok(bad({ quality: 101 }));
	assert.ok(
		bad({
			affixes: [
				{ id: 'damage_prefix', roll: 10 },
				{ id: 'armor_prefix', roll: 10 },
			],
		}),
	); // uncommon takes one
	assert.ok(bad({ affixes: [{ id: 'constructor', roll: 10 }] }));
	assert.ok(bad({ affixes: [{ id: 'damage_prefix', roll: 101 }] }));
	assert.ok(
		bad({
			rarity: 'rare',
			affixes: [
				{ id: 'damage_prefix', roll: 1 },
				{ id: 'damage_suffix', roll: 1 },
			],
		}),
	); // same group twice
	const named: ItemInstance = { base: 'emberbrand', level: 5, rarity: 'legendary', quality: 50, affixes: [] };
	assert.equal(instanceProblem(named), null);
	assert.ok(instanceProblem({ ...named, rarity: 'common' })); // named items have one rarity
	assert.ok(instanceProblem({ ...named, affixes: [{ id: 'damage_prefix', roll: 1 }] }));
});

test('sell value grows with rarity and item level', () => {
	const at = (rarity: string, level: number): ItemInstance => ({ base: 'iron_sword', level, rarity, quality: 50, affixes: [] });
	assert.ok(sellValueOf(at('rare', 10)) > sellValueOf(at('uncommon', 10)));
	assert.ok(sellValueOf(at('rare', 40)) > sellValueOf(at('rare', 10)));
});

test('capped percentage stats follow only a share of the level curve, so crit and dodge do not hit their caps within a few levels', () => {
	assert.deepEqual(scaleStats({ damage: 10, critChance: 10 }, 1), { damage: 10, critChance: 10 });
	const grown = scaleStats({ damage: 10, critChance: 10, dodge: 4, armor: 10 }, 4);
	assert.equal(grown.damage, 40);
	assert.equal(grown.armor, 40);
	assert.ok(grown.critChance! > 10 && grown.critChance! < 25, `${grown.critChance}`);
	assert.ok(grown.dodge! > 4 && grown.dodge! < 10, `${grown.dodge}`);
	const dagger: ItemInstance = { base: 'steel_dagger', level: 50, rarity: 'common', quality: 50, affixes: [] };
	assert.ok(resolveItem(dagger)!.stats.critChance! < 25, 'a level 50 steel dagger stays far from the 75% crit cap');
	const top = AFFIXES.filter((a) => a.stat === 'critChance').map((a) => affixValue(a, 100, 100));
	assert.ok(Math.max(...top) < 15, `a single max crit affix at the level cap is ${Math.max(...top)}`);
});

test('rarity raises the numbers (IDL-382): the same base and level is worth more as rare, epic and legendary, in its base stats and in every affix', () => {
	const at = (rarity: string, affixes: ItemInstance['affixes'] = []): ItemInstance => ({ base: 'iron_sword', level: 30, rarity, quality: 50, affixes });
	const damage = (rarity: string) => resolveItem(at(rarity))!.baseStats.damage!;
	assert.equal(damage('uncommon'), damage('common'), 'common and uncommon share the plain numbers');
	assert.ok(damage('rare') > damage('uncommon'));
	assert.ok(damage('epic') > damage('rare'));
	assert.ok(damage('legendary') > damage('epic'));
	const sharp = AFFIXES.find((a) => a.stat === 'damage')!;
	const roll = (rarity: string) => resolveItem(at(rarity, [{ id: sharp.id, roll: 50 }]))!.affixes[0].value;
	assert.ok(roll('rare') > roll('uncommon'));
	assert.ok(roll('epic') > roll('rare'));
	assert.ok(roll('legendary') > roll('epic'));
	// the same roll, only the rarity differs: the affix is scaled by exactly the rarity's multiplier
	assert.equal(roll('epic'), affixValue(sharp, 50, 30, RARITIES.epic.affixMultiplier));
});

test('a named item keeps its authored numbers whatever its rarity multiplier is', () => {
	const named: ItemInstance = { base: 'emberbrand', level: ITEM_CATALOG.emberbrand.minItemLevel ?? 1, rarity: 'legendary', quality: 50, affixes: [] };
	const authored = ITEM_CATALOG.emberbrand.stats!;
	const got = resolveItem(named)!.stats;
	for (const [key, value] of Object.entries(authored)) assert.equal((got as Record<string, number>)[key], Math.round((value as number) * 100) / 100, key);
});
