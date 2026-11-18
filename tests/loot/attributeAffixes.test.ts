import test from 'node:test';
import assert from 'node:assert/strict';
import { AFFIXES, AFFIX_CATALOG } from '../../src/catalog/affixes';
import { ITEM_CATALOG } from '../../src/catalog';
import { ITEM_STAT_KEYS } from '../../src/catalog/stats';
import { qualityBiasOf } from '../../src/lib/craftGear';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import { attributesWithGear, gearAttributes, withGearAttributes } from '../../src/lib/gearAttributes';
import { xpGainPct } from '../../src/lib/gearEconomy';
import { aggregateStats } from '../../src/lib/inventory';
import { affixFits, affixValue, instanceProblem, resolveItem } from '../../src/lib/itemInstance';
import { attacksPerSecond, critOdds, damagePerHit, maxHp, maxMana, manaRegenPerSec } from '../../src/lib/combat';
import { healAmount } from '../../src/lib/skills';
import { RARITIES } from '../../src/catalog';
import { calculateCombatStats } from '../../src/utils/game/character';
import type { CharacterStats, Equipment, ItemInstance } from '../../src/types/game';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';

// The five attributes as gear affixes (Strength, Dexterity, Intelligence, Vitality, Charisma): they add to the points the player spent while worn.

const ATTRS = ['strength', 'dexterity', 'intelligence', 'vitality', 'charisma'] as const;

const character = (): CharacterStats => {
	const stats: CharacterStats = { ...INITIAL_CHARACTER_STATS };
	Object.assign(stats, calculateCombatStats(stats));
	return stats;
};

/** A base item of a slot tag, carrying the given affix at the given roll. */
const withAffix = (tag: string, affixId: string, roll = 100, level = 20): ItemInstance => {
	const base = Object.entries(ITEM_CATALOG).find(([, def]) => def.slot && def.tags?.includes(tag) && !def.fixedRarity);
	assert.ok(base, `an item tagged ${tag}`);
	return { base: base[0], level, rarity: 'rare', quality: 50, affixes: [{ id: affixId, roll }] };
};

test('each attribute has a prefix and a suffix affix, one group per stat, on the gear that suits it', () => {
	for (const attr of ATTRS) {
		assert.ok(ITEM_STAT_KEYS.includes(attr), `${attr} is an item stat`);
		const rows = AFFIXES.filter((a) => a.stat === attr);
		assert.deepEqual(rows.map((a) => a.position).sort(), ['prefix', 'suffix']);
		assert.ok(rows.every((a) => a.enabled && a.group === attr));
		assert.ok(AFFIX_CATALOG[`${attr}_prefix`] && AFFIX_CATALOG[`${attr}_suffix`]);
	}
	const int = AFFIX_CATALOG.intelligence_prefix;
	const rare = RARITIES.rare;
	const neck = ITEM_CATALOG[withAffix('neck', 'intelligence_prefix').base];
	assert.ok(affixFits(int, neck, 20, rare), 'Intelligence rolls on a necklace');
	assert.equal(affixFits(int, ITEM_CATALOG[withAffix('feet', 'vitality_prefix').base], 20, rare), false, 'but not on boots');
	assert.equal(affixFits(int, neck, 1, rare), false, 'and not before its minimum item level');
});

test('an attribute affix resolves, is valued like the other stats and is accepted by the save check', () => {
	const item = withAffix('neck', 'intelligence_prefix', 100);
	assert.equal(instanceProblem(item), null);
	const resolved = resolveItem(item)!;
	const value = affixValue(AFFIX_CATALOG.intelligence_prefix, 100, 20);
	assert.ok(value >= 5, `a level 20 Intelligence roll is worth something (${value})`);
	assert.equal(resolved.stats.intelligence, value);
	const low = affixValue(AFFIX_CATALOG.intelligence_prefix, 0, 20);
	assert.ok(low < value, 'a better roll is worth more');
	assert.ok(Number.isInteger(value), 'attributes are whole numbers');
});

test('without attribute gear nothing changes: the same objects come back and every number stays what it was', () => {
	const stats = character();
	assert.equal(attributesWithGear(stats, STARTER_EQUIPMENT), stats);
	assert.equal(withGearAttributes(stats, STARTER_EQUIPMENT), stats);
	assert.deepEqual(gearAttributes({}), { strength: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0 });
});

test('worn attribute gear adds to the spent points and the derived numbers follow', () => {
	const stats = character();
	const ring = withAffix('ring', 'intelligence_prefix');
	const gear: Equipment = { ...STARTER_EQUIPMENT, ring1: ring };
	const added = aggregateStats(gear).intelligence;
	assert.ok(added > 0);
	const total = withGearAttributes(stats, gear);
	assert.equal(total.intelligence, stats.intelligence + added);
	assert.equal(total.mp, calculateCombatStats(total).mp, 'the mana pool is worked out from the total');
	assert.ok(maxMana(stats, gear) > maxMana(stats, STARTER_EQUIPMENT), 'Intelligence gear raises max mana');
	assert.ok(manaRegenPerSec(stats, gear) > manaRegenPerSec(stats, STARTER_EQUIPMENT), 'and mana regeneration');
	assert.ok(healAmount(stats, gear) >= healAmount(stats, STARTER_EQUIPMENT), 'and never lowers Heal');
	assert.equal(stats.intelligence, INITIAL_CHARACTER_STATS.intelligence, 'the character itself is not changed');
});

test('each attribute reaches the rule it feeds: Strength damage, Dexterity speed and crit, Vitality max HP, Charisma Luck and XP', () => {
	const stats = character();
	const weapon = withAffix('weapon', 'strength_prefix', 100, 40);
	const equip = (item: ItemInstance, slot: keyof Equipment): Equipment => ({ ...STARTER_EQUIPMENT, [slot]: item });

	const strong = equip(weapon, 'mainHand');
	const plainWeapon = equip({ ...weapon, affixes: [] }, 'mainHand');
	assert.ok(damagePerHit(strong, stats) > damagePerHit(plainWeapon, stats), 'Strength raises damage per hit');

	const dexWeapon = equip(withAffix('weapon', 'dexterity_prefix', 100, 40), 'mainHand');
	const plainDex = equip({ ...dexWeapon.mainHand!, affixes: [] }, 'mainHand');
	assert.ok(attacksPerSecond(dexWeapon, stats) >= attacksPerSecond(plainDex, stats), 'Dexterity never lowers attack speed');
	assert.ok(critOdds(stats, dexWeapon).crit > critOdds(stats, plainDex).crit, 'Dexterity raises crit chance');

	const vit = equip(withAffix('chest', 'vitality_prefix', 100, 40), 'chest');
	const plainVit = equip({ ...vit.chest!, affixes: [] }, 'chest');
	assert.ok(maxHp(stats, vit) > maxHp(stats, plainVit), 'Vitality raises max HP');

	const cha = equip(withAffix('neck', 'charisma_prefix', 100, 40), 'neck');
	const plainCha = equip({ ...cha.neck!, affixes: [] }, 'neck');
	assert.ok(xpGainPct(stats, cha) > xpGainPct(stats, plainCha), 'Charisma raises XP gain');
	const luckOf = (equipment: Equipment) => withGearAttributes(stats, equipment).luck;
	assert.ok(luckOf(cha) > luckOf(plainCha), 'Charisma raises Luck');
});

test('crafted gear leans further to good rolls with Intelligence gear on: the bias counts the worn Intelligence', () => {
	const stats = character();
	const gear: Equipment = {
		...STARTER_EQUIPMENT,
		ring1: withAffix('ring', 'intelligence_prefix', 100, 40),
		neck: withAffix('neck', 'intelligence_suffix', 100, 40),
	};
	const worn = attributesWithGear(stats, gear).intelligence;
	assert.ok(worn > stats.intelligence);
	assert.ok(qualityBiasOf(worn) > qualityBiasOf(stats.intelligence), 'wearing it raises the craft bias');
	assert.equal(qualityBiasOf(stats.intelligence), 0, 'the starting 5 gives none');
});
