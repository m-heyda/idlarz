import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHit, armorOf, critOdds, damagePerClick, dodgeChance, maxHp, mitigate, newFight, regen, rollHit, stepFight } from '../src/lib/combat';
import { monsterStats } from '../src/lib/monsters';
import { INITIAL_CHARACTER_STATS } from '../src/config/gameConfig';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { calculateCombatStats } from '../src/utils/gameUtils';
import { fullSet } from '../src/lib/fightSim';
import type { CharacterStats } from '../src/types/game';

const freshStats = (): CharacterStats => {
	const stats = { ...INITIAL_CHARACTER_STATS };
	return Object.assign(stats, calculateCombatStats(stats));
};

const rat = (tier = 1) => newFight({ id: 1, type: 'rat', tier });
const king = () => newFight({ id: 2, type: 'ratKing', tier: 1 });
const noRng = () => 0;

test('maxHp is 101 for a fresh character with the starter kit', () => {
	assert.equal(maxHp(freshStats(), STARTER_EQUIPMENT), 101);
});

test('maxHp includes gear and set bonuses', () => {
	assert.equal(maxHp(freshStats(), { chest: 'rattatui_tunic' }), 101 + ITEM_CATALOG.rattatui_tunic.stats!.maxHp!);
});

test('damagePerClick is 6 with the wooden sword, 1 without a weapon, 3 with the fang blade', () => {
	assert.equal(damagePerClick(STARTER_EQUIPMENT), 6);
	assert.equal(damagePerClick({}), 1);
	assert.equal(damagePerClick({ mainHand: 'rattatui_fang_blade' }), ITEM_CATALOG.rattatui_fang_blade.stats!.damage);
});

test('armorOf sums gear armor', () => {
	assert.equal(armorOf(STARTER_EQUIPMENT), 2);
});

test('mitigate: armor 2 turns 4 into 4, armor 40 halves 10 to 5, never below 1', () => {
	assert.equal(mitigate(4, 2), 4);
	assert.equal(mitigate(10, 40), 5);
	assert.equal(mitigate(1, 1000), 1);
	assert.equal(mitigate(4, 0), 4);
});

test('rat stats: T1 100 HP, T5 506 HP, attack grows per tier', () => {
	assert.equal(monsterStats('rat', 1).maxHp, 100);
	assert.equal(monsterStats('rat', 5).maxHp, 506);
	assert.ok(monsterStats('rat', 5).attack > monsterStats('rat', 1).attack);
	assert.equal(monsterStats('ratKing', 3).maxHp, MONSTERS.ratKing.hp);
	assert.equal(monsterStats('ratKing', 3).attackIntervalSec, MONSTERS.ratKing.attackIntervalSec);
});

test('newFight starts active at full HP; only the king has a timer', () => {
	const r = rat(5);
	assert.equal(r.phase, 'active');
	assert.equal(r.monsterHp, 506);
	assert.equal(r.monsterMaxHp, 506);
	assert.equal(r.timeLeftSec, null);
	assert.equal(king().timeLeftSec, MONSTERS.ratKing.timeLimitSec);
	assert.equal(king().monsterHp, MONSTERS.ratKing.hp);
});

test('applyHit lowers HP, reports the kill, and ignores finished fights', () => {
	const r = applyHit(rat(), 2);
	assert.equal(r.fight.monsterHp, 98);
	assert.equal(r.killed, false);
	const dead = applyHit({ ...rat(), monsterHp: 2 }, 2);
	assert.equal(dead.killed, true);
	assert.equal(dead.fight.monsterHp, 0);
	const done = applyHit({ ...rat(), phase: 'won' }, 2);
	assert.equal(done.fight.monsterHp, 100);
	assert.equal(done.killed, false);
});

test('stepFight: a rat deals one mitigated hit every 2 s', () => {
	let fight = rat();
	let hp = 101;
	let r = stepFight(fight, 1, hp, 2, noRng);
	assert.equal(r.playerHp, 101);
	assert.deepEqual(r.events, []);
	r = stepFight(r.fight, 1, r.playerHp, 2, noRng);
	assert.equal(r.playerHp, 97);
	assert.deepEqual(r.events, [{ kind: 'hurt', amount: 4 }]);
	fight = r.fight;
	hp = r.playerHp;
	r = stepFight(fight, 1, hp, 2, noRng);
	assert.equal(r.playerHp, 97);
});

test('stepFight clamps dt: a 300 s step yields at most one attack', () => {
	const r = stepFight(rat(), 300, 101, 2, noRng);
	assert.ok(r.events.filter((e) => e.kind === 'hurt').length <= 1);
	assert.ok(r.playerHp >= 97);
	assert.equal(r.fight.phase, 'active');
});

test('potion cooldown counts down only in steps and stops at 0', () => {
	let r = stepFight({ ...rat(), potionCd: 2 }, 1, 101, 2, noRng);
	assert.equal(r.fight.potionCd, 1);
	r = stepFight(r.fight, 1, r.playerHp, 2, noRng);
	r = stepFight(r.fight, 1, r.playerHp, 2, noRng);
	assert.equal(r.fight.potionCd, 0);
});

test('knockout when hp hits 0', () => {
	const r = stepFight({ ...rat(), attackTimer: 1.5 }, 1, 3, 2, noRng);
	assert.equal(r.fight.phase, 'knockedOut');
	assert.equal(r.playerHp, 0);
	assert.deepEqual(r.events.at(-1), { kind: 'knockedOut' });
	const after = stepFight(r.fight, 1, 0, 2, noRng);
	assert.deepEqual(after.events, []);
});

test('a knockout by the Rat King taunts too; a rat stays silent', () => {
	const k = stepFight({ ...king(), attackTimer: 3 }, 1, 2, 2, noRng);
	assert.equal(k.fight.phase, 'knockedOut');
	assert.equal(k.fight.taunt, MONSTERS.ratKing.taunts[0]);
	const r = stepFight({ ...rat(), attackTimer: 1.5 }, 1, 2, 2, noRng);
	assert.equal(r.fight.phase, 'knockedOut');
	assert.equal(r.fight.taunt, null);
});

test('king times out after the time limit of steps and sets a taunt from the config', () => {
	let fight = king();
	let hp = 1000; // never knocked out in this test
	let last = stepFight(fight, 1, hp, 2, noRng);
	for (let i = 1; i <= MONSTERS.ratKing.timeLimitSec + 1 && last.fight.phase === 'active'; i++) {
		fight = last.fight;
		hp = last.playerHp;
		last = stepFight(fight, 1, hp, 2, noRng);
	}
	assert.equal(last.fight.phase, 'timeout');
	assert.equal(last.fight.taunt, MONSTERS.ratKing.taunts[0]);
	assert.deepEqual(last.events.at(-1), { kind: 'timeout' });
});

test('king: a starter-kit player is knocked out well before the time limit, full Rattatui armor outlasts it', () => {
	const run = (equipment: typeof STARTER_EQUIPMENT) => {
		let fight = king();
		let hp = maxHp(freshStats(), equipment);
		const start = hp;
		for (let i = 0; i < MONSTERS.ratKing.timeLimitSec + 10 && fight.phase === 'active'; i++) {
			const r = stepFight(fight, 1, hp, armorOf(equipment), noRng);
			fight = r.fight;
			hp = r.playerHp;
		}
		return { phase: fight.phase, hp, start };
	};
	assert.equal(run(STARTER_EQUIPMENT).phase, 'knockedOut');
	const geared = run(fullSet('rattatui'));
	assert.equal(geared.phase, 'timeout');
	assert.ok(geared.hp > 0 && geared.hp < geared.start);
});

test('regen stops at max and ignores bad input', () => {
	assert.equal(regen(50, 101, 10), 60);
	assert.equal(regen(100, 101, 5), 101);
	assert.equal(regen(50, 101, -5), 50);
	assert.equal(regen(50, 101, NaN), 50);
});

test('fight hits are not tied to CLICK_LIMIT: crit odds add the character and the gear, and are capped', () => {
	const stats = freshStats();
	assert.deepEqual(critOdds(stats, {}), { crit: stats.critChance / 100, superCrit: COMBAT.crit.superBase / 100 });
	const gear = critOdds(stats, { mainHand: 'starfall_bow', charm: 'rattatui_charm' });
	assert.ok(gear.crit > critOdds(stats, {}).crit && gear.superCrit > COMBAT.crit.superBase / 100);
	const stacked = { ...stats, critChance: 500 };
	assert.equal(critOdds(stacked, {}).crit, COMBAT.crit.maxCritChance / 100);
});

test('rollHit: low roll is a plain hit, high roll crits, and a second high roll is a super crit', () => {
	const stats = freshStats();
	const seq = (...r: number[]) => () => r.shift() ?? 0;
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0)), { damage: 6, crit: 'none' });
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0.999, 0)), { damage: 6 * COMBAT.crit.mult, crit: 'crit' });
	assert.deepEqual(rollHit(stats, STARTER_EQUIPMENT, seq(0.999, 0.999)), { damage: 6 * COMBAT.crit.superMult, crit: 'super' });
});

test('gear regen heals outside fights on top of the base rate, and inside fights too', () => {
	assert.equal(regen(50, 101, 10, 2), 50 + (COMBAT.regenPerSec + 2) * 10);
	const f = king();
	const hurt = stepFight(f, 1, 50, 0, noRng);
	const healed = stepFight(f, 1, 50, 0, noRng, { perSec: 2, max: 101 });
	assert.equal(healed.playerHp, hurt.playerHp + 2);
	assert.equal(stepFight(f, 1, 100.5, 0, noRng, { perSec: 5, max: 101 }).playerHp <= 101, true);
});

test('dodge: a high roll avoids a monster hit, a low roll does not, and no dodge never rolls', () => {
	const f = rat();
	const hitAfter = (dodge: number, roll: number) => stepFight({ ...f, attackTimer: 1.99 }, 0.02, 100, 0, () => roll, undefined, dodge);
	const hurt = hitAfter(0.3, 0); // a low roll never dodges
	assert.equal(hurt.events[0].kind, 'hurt');
	const dodged = hitAfter(0.3, 0.9);
	assert.deepEqual(dodged.events, [{ kind: 'dodged' }]);
	assert.equal(dodged.playerHp, 100);
	let calls = 0;
	stepFight({ ...f, attackTimer: 1.99 }, 0.02, 100, 0, () => (calls++, 0.99));
	assert.equal(calls, 0, 'without dodge the rng is untouched');
});

test('dodgeChance reads the gear and is capped', () => {
	assert.equal(dodgeChance({}), 0);
	assert.equal(dodgeChance({ cape: 'rattatui_cloak' }), ITEM_CATALOG.rattatui_cloak.stats!.dodge! / 100);
	assert.ok(dodgeChance(fullSet('rattatui')) <= COMBAT.maxDodge / 100);
});
