import test from 'node:test';
import assert from 'node:assert/strict';
import { armorOf, armorReduction, attacksPerSecond, critOdds, damagePerHit, dodgeChance, maxHp, mitigate, regen, rollHit } from '../src/lib/combat';
import { monsterStats } from '../src/lib/monsters';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { calculateCombatStats } from '../src/utils/gameUtils';
import { fullSet } from '../src/lib/fightSim';
import { plainItem } from '../src/lib/itemInstance';
import type { CharacterStats } from '../src/types/game';

const freshStats = (): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS };
	return Object.assign(stats, calculateCombatStats(stats));
};

test('maxHp is 101 for a fresh character with the starter kit', () => {
	assert.equal(maxHp(freshStats(), STARTER_EQUIPMENT), 101);
});

test('maxHp includes gear and set bonuses', () => {
	assert.equal(maxHp(freshStats(), { chest: plainItem('rattatui_tunic') }), 101 + ITEM_CATALOG.rattatui_tunic.stats!.maxHp!);
});

test('damagePerHit is 6 with the wooden sword, 1 without a weapon, 3 with the fang blade', () => {
	assert.equal(damagePerHit(STARTER_EQUIPMENT), 6);
	assert.equal(damagePerHit({}), 1);
	assert.equal(damagePerHit({ mainHand: plainItem('rattatui_fang_blade') }), ITEM_CATALOG.rattatui_fang_blade.stats!.damage);
});

test('armorOf sums gear armor', () => {
	assert.equal(armorOf(STARTER_EQUIPMENT), 2);
});

test('armorReduction: armor / (armor + 40) up to 50 %, half as much per point after that, never above 75 %', () => {
	assert.equal(armorReduction(0), 0);
	assert.equal(armorReduction(-5), 0);
	assert.equal(armorReduction(40), 0.5, 'armor 40 is the knee');
	assert.ok(Math.abs(armorReduction(20) - 20 / 60) < 1e-12, 'below the knee it is the plain formula');
	assert.ok(Math.abs(armorReduction(120) - 0.625) < 1e-12, 'raw 75 % is worth 62.5 % past the knee');
	let last = 0;
	for (const armor of [1, 10, 40, 41, 100, 400, 1e4, 1e6, 1e9]) {
		const r = armorReduction(armor);
		assert.ok(r > last, `still rising at ${armor}`);
		assert.ok(r < 0.75, `${armor} stays under the 75 % ceiling`);
		last = r;
	}
	assert.equal(mitigate(100, 1e9), 25, 'a 100 hit still does 25 through any armor');
	assert.ok(mitigate(100, 120) > mitigate(100, 1e6), 'but more armor keeps helping a little');
});

test('mitigate: armor 2 turns 4 into 4, armor 40 halves 10 to 5, never below 1', () => {
	assert.equal(mitigate(4, 2), 4);
	assert.equal(mitigate(10, 40), 5);
	assert.equal(mitigate(1, 1000), 1);
	assert.equal(mitigate(4, 0), 4);
});

test('rat stats: level 1 100 HP, level 9 506 HP, attack grows per level; the King at level 15 is his config', () => {
	assert.equal(monsterStats('rat', 1).maxHp, 100);
	assert.equal(monsterStats('rat', 9).maxHp, 506);
	assert.ok(monsterStats('rat', 9).attack > monsterStats('rat', 1).attack);
	assert.equal(monsterStats('ratKing', 15).maxHp, MONSTERS.ratKing.hp);
	assert.equal(monsterStats('ratKing', 15).attackSpeed, MONSTERS.ratKing.attackSpeed);
	assert.equal(monsterStats('rat', 1).attackSpeed, 0.5, 'a rat bites every 2 s');
});

test('regen stops at max and ignores bad input', () => {
	assert.equal(regen(50, 101, 10), 60);
	assert.equal(regen(100, 101, 5), 101);
	assert.equal(regen(50, 101, -5), 50);
	assert.equal(regen(50, 101, NaN), 50);
});

test('crit odds add the character and the gear, and are capped', () => {
	const stats = freshStats();
	assert.deepEqual(critOdds(stats, {}), { crit: stats.critChance / 100, superCrit: COMBAT.crit.superBase / 100 });
	const gear = critOdds(stats, { mainHand: plainItem('starfall_bow'), charm: plainItem('rattatui_charm') });
	assert.ok(gear.crit > critOdds(stats, {}).crit && gear.superCrit > COMBAT.crit.superBase / 100);
	const stacked = { ...stats, critChance: 500 };
	assert.equal(critOdds(stacked, {}).crit, COMBAT.crit.maxCritChance / 100);
});

test('rollHit (the swing of a character): low roll is a plain hit, high roll crits, and a second high roll is a super crit', () => {
	const stats = freshStats();
	const seq = (...r: number[]) => () => r.shift() ?? 0;
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0)), { damage: 6, crit: 'none' });
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0.999, 0)), { damage: 6 * COMBAT.crit.mult, crit: 'crit' });
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0.999, 0.999)), { damage: 6 * COMBAT.crit.superMult, crit: 'super' });
});

test('gear regen heals outside fights on top of the base rate', () => {
	assert.equal(regen(50, 101, 10, 2), 50 + (COMBAT.regenPerSec + 2) * 10);
});

test('the player swings at the weapon speed: attacks per second is the weapon speed, 1 bare-handed, and Dexterity adds to it', () => {
	assert.equal(attacksPerSecond({}), 1);
	assert.equal(attacksPerSecond({ mainHand: plainItem('steel_mace') }), ITEM_CATALOG.steel_mace.attackSpeed);
	const nimble = { ...freshStats(), dexterity: 25 };
	assert.ok(attacksPerSecond(STARTER_EQUIPMENT, nimble) > attacksPerSecond(STARTER_EQUIPMENT, freshStats()));
});

test('dodgeChance reads the gear and is capped', () => {
	assert.equal(dodgeChance({}), 0);
	assert.equal(dodgeChance({ cape: plainItem('rattatui_cloak') }), ITEM_CATALOG.rattatui_cloak.stats!.dodge! / 100);
	assert.ok(dodgeChance(fullSet('rattatui')) <= COMBAT.maxDodge / 100);
});
