import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT } from '../src/config/combatConfig';
import { INITIAL_CHARACTER_STATS, LEGACY_UPGRADES } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { aggregateStats } from '../src/lib/inventory';
import { plainItem } from '../src/lib/itemInstance';
import { critOdds, damagePerClick, maxHp } from '../src/lib/combat';
import { effectiveStats } from '../src/lib/effectiveStats';
import { calculateCombatStats } from '../src/utils/gameUtils';
import type { CharacterStats, Equipment, PrestigeState } from '../src/types/game';

const character = (over: Partial<CharacterStats> = {}): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS, ...over };
	return Object.assign(stats, calculateCombatStats(stats));
};
const prestige = (upgrades: PrestigeState['upgrades'] = {}): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades });

test('a fresh character shows the base numbers: x2 crits, 5% super crit, no extra bonuses', () => {
	const fx = effectiveStats({ characterStats: character(), equipment: STARTER_EQUIPMENT });
	assert.equal(fx.critMultiplier, COMBAT.crit.mult);
	assert.equal(fx.superCritMultiplier, COMBAT.crit.superMult);
	assert.equal(fx.superCritChance, COMBAT.crit.superBase);
	assert.equal(fx.damage, damagePerClick(STARTER_EQUIPMENT));
	assert.equal(fx.maxHp, maxHp(character(), STARTER_EQUIPMENT));
	assert.equal(fx.tileDiscount, character().tileCostDiscount, 'only the attribute discount');
	assert.equal(fx.clickMastery, 0);
});

test('the crit numbers include the worn gear and the attributes, for crits and super crits alike', () => {
	const gearWithCrit: Equipment = { ...STARTER_EQUIPMENT, mainHand: plainItem('steel_dagger'), neck: plainItem('obsidian_pendant') };
	const stats = character({ strength: 15, dexterity: 15, charisma: 15 });
	const fx = effectiveStats({ characterStats: stats, equipment: gearWithCrit });
	const odds = critOdds(stats, gearWithCrit);
	assert.equal(fx.critChance, odds.crit * 100);
	assert.equal(fx.superCritChance, odds.superCrit * 100);
	assert.ok(fx.critChance > stats.critChance, 'the gear adds to the character crit chance');
	const extra = 1 + (10 * 1 + 10 * 0.5 + 10 * 0.5) / 100;
	assert.equal(fx.critMultiplier, COMBAT.crit.mult * extra);
	assert.equal(fx.superCritMultiplier, COMBAT.crit.superMult * extra);
	const withSuper: Equipment = { ...STARTER_EQUIPMENT };
	const gear = aggregateStats(withSuper);
	assert.equal(effectiveStats({ characterStats: stats, equipment: withSuper }).superCritChance, COMBAT.crit.superBase + gear.superCrit);
});

test('luck adds the merchant charm and the gear; the tile discount adds the rebirth Thrift and the merchant Bulk Discount', () => {
	const stats = character({ charisma: 10 });
	const base = effectiveStats({ characterStats: stats, equipment: STARTER_EQUIPMENT });
	const boosted = effectiveStats({ characterStats: stats, equipment: STARTER_EQUIPMENT, merchantUpgrades: { charm: 3, bulk: 4 }, prestige: prestige({ thrift: 5, mastery: 2, builders: 3 }) });
	assert.equal(boosted.luck - base.luck, 6, 'three Lucky Charm levels are +6 Luck');
	assert.equal(boosted.tileDiscount - base.tileDiscount, 4 + 5 * LEGACY_UPGRADES.thrift.effectPerLevel * 100);
	assert.equal(boosted.clickMastery, 2 * LEGACY_UPGRADES.mastery.effectPerLevel * 100);
	assert.equal(boosted.buildTimeReduction, 3 * LEGACY_UPGRADES.builders.effectPerLevel * 100);
});
