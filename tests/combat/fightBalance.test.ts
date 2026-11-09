import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { ITEM_CATALOG } from '../../src/catalog';
import { STARTER_EQUIPMENT } from '../../src/config/itemCatalog';
import { GRADE_INFO, type Grade } from '../../src/catalog/items/grades';
import { atItemLevel, kit, simulateMany, spentCharacter } from '../../src/lib/fightSim';
import { STRONG_KIT } from '../builders';
import type { Equipment } from '../../src/types/game';

// The fights run on the server's engine (lib/offline/fight.ts) with the player swinging at the weapon's attack speed: nobody clicks, so
// the tuning is gear, attributes, potions and skills. docs/generated/fight-sim.md (npm run fight-sim) has the full tables.
// The yardstick is the grade ladder (catalog/items/ladder.ts): a kit is a full set of the cells of one grade, so nothing here depends on a
// particular set staying in the game. More monsters will come: nothing here may depend on the boss numbers except the boss rows below.

type Foe = { type: 'thistleBoar' | 'bossGreatAuroch'; level: number };
const BOSS: Foe = { type: 'bossGreatAuroch', level: 15 };
const RUNS = 12;
const sim = (equipment: Equipment, monster: Foe = BOSS, extra: { level?: number; autoUse?: boolean; potions?: { id: string; qty: number }[] } = {}) =>
	simulateMany({ equipment, monster: { ...monster }, autoUse: false, ...extra }, RUNS, `bal-${monster.type}-${monster.level}`);

/** A full kit of one grade (a mace unless said otherwise), at the start of the grade window */
const G = (grade: Grade, weapon: Parameters<typeof kit>[1] = 'mace'): Equipment => kit(grade, weapon);
const BEST = STRONG_KIT;

test('no enabled item exceeds the damage sanity ceiling', () => {
	for (const def of Object.values(ITEM_CATALOG).filter((d) => d.enabled !== false)) assert.ok((def.stats?.damage ?? 0) <= COMBAT.maxItemDamage, def.id);
});

test('the starter kit and the first grade never beat the boss, with or without skills and potions', () => {
	for (const gear of [STARTER_EQUIPMENT, G('G1')]) {
		assert.equal(sim(gear).winRate, 0);
		assert.equal(sim(gear, BOSS, { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 20 }] }).winRate, 0);
	}
});

test('the level 15 boss asks for G2: the grade below loses to the clock, G2 wins with the clock running down, the best loadout comfortably', () => {
	assert.ok(sim(atItemLevel(G('G1'), 15)).winRate < 0.5);
	const g2 = sim(atItemLevel(G('G2'), 15));
	assert.ok(g2.winRate >= 0.9, `G2: ${g2.winRate}`);
	assert.ok(g2.meanTimeSec > MONSTERS.bossGreatAuroch.timeLimitSec * 0.5, `${g2.meanTimeSec} s: not a pushover`);
	assert.ok(sim(BEST).winRate >= 0.95, `the best loadout: ${sim(BEST).winRate}`);
});

test('a better grade kills the boss sooner, grade by grade', () => {
	let last = Infinity;
	for (const grade of ['G2', 'G3', 'G4', 'G5', 'G6'] as const) {
		const t = sim(atItemLevel(G(grade), Math.max(25, GRADE_INFO[grade].levels[0])), { type: 'bossGreatAuroch', level: 25 }).meanTimeSec;
		assert.ok(t < last, `${grade}: ${t} s beats ${last} s`);
		last = t;
	}
});

test('no loadout trivialises the boss: even the best gear needs several seconds', () => {
	assert.ok(sim(BEST).meanTimeSec >= 15, `${sim(BEST).meanTimeSec} s`);
});

test('basic monsters: a level 1 boar falls to the starter kit, a level 9 boar does not, and G2 gear wins either way', () => {
	assert.equal(sim(STARTER_EQUIPMENT, { type: 'thistleBoar', level: 1 }).winRate, 1);
	assert.equal(sim(STARTER_EQUIPMENT, { type: 'thistleBoar', level: 9 }).winRate, 0);
	assert.equal(sim(G('G2'), { type: 'thistleBoar', level: 9 }).winRate, 1);
});

test('weapons swing at their own speed: a dagger faster than a maul, and the fights differ', () => {
	const boar = { type: 'thistleBoar', level: 9 } as const;
	const speed = (weapon: Parameters<typeof kit>[1]) => ITEM_CATALOG[kit('G3', weapon).mainHand!.base].attackSpeed!;
	assert.ok(speed('dagger') > speed('maul'));
	assert.notEqual(sim(G('G3', 'maul'), boar).meanTimeSec, sim(G('G3', 'dagger'), boar).meanTimeSec);
});

// ---- attribute builds (25 spare points is about level 30) --------------------------------------------------------------------

const simAs = (character: ReturnType<typeof spentCharacter>, equipment: Equipment, monster: Foe = BOSS) =>
	simulateMany({ equipment, monster: { ...monster }, character, autoUse: false }, RUNS, `build-${monster.type}`);

test('spending points pays off: 25 Strength makes a physical weapon clearly faster, 25 Intelligence does the same for a magic weapon, and the wrong stat does nothing', () => {
	const maul = G('G6', 'maul');
	const staff = G('G6', 'staff');
	const none = spentCharacter({});
	const strong = spentCharacter({ strength: 25 });
	const wise = spentCharacter({ intelligence: 25 });
	const rat = { type: 'thistleBoar', level: 9 } as const;
	const base = simAs(none, maul, rat).meanTimeSec;
	assert.ok(simAs(strong, maul, rat).meanTimeSec < base * 0.8, 'Strength speeds up the maul');
	assert.ok(Math.abs(simAs(wise, maul, rat).meanTimeSec - base) < base * 0.05, 'Intelligence does nothing for a maul');
	const staffBase = simAs(none, staff, rat).meanTimeSec;
	assert.ok(simAs(wise, staff, rat).meanTimeSec < staffBase * 0.8, 'Intelligence speeds up the staff');
	assert.ok(simAs(strong, staff, rat).meanTimeSec > staffBase * 0.92, 'Strength barely helps a staff');
});

test('points never trivialise the boss: a level 30 Strength build with the best loadout still needs a good while, and the starter kit with the same points still does not win', () => {
	const r = simAs(spentCharacter({ strength: 25 }), BEST);
	assert.ok(r.meanTimeSec >= 12, `${r.meanTimeSec} s`);
	assert.equal(simAs(spentCharacter({ strength: 25 }), STARTER_EQUIPMENT).winRate, 0);
});

test('defense points matter: Vitality and Dexterity make a level 5 rat fight end with more HP left', () => {
	const rat = { type: 'thistleBoar', level: 5 } as const;
	const bare = simAs(spentCharacter({}), STARTER_EQUIPMENT, rat);
	const tank = simAs(spentCharacter({ vitality: 25, dexterity: 10 }), STARTER_EQUIPMENT, rat);
	assert.ok(tank.winRate >= bare.winRate);
	assert.ok(tank.meanHpLeft > bare.meanHpLeft, `${tank.meanHpLeft} vs ${bare.meanHpLeft}`);
});

// ---- auto-use (potions, Heal under 50 % HP, Stun on cooldown, from level 30) -----------------------------------------------------

test('auto-use never replaces gear: G1 still does not beat the boss with Heal, Stun and potions, and the starter kit never does', () => {
	const extra = { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 10 }] };
	assert.ok(sim(G('G1'), BOSS, extra).winRate < 0.6);
	assert.equal(sim(STARTER_EQUIPMENT, BOSS, extra).winRate, 0);
});

test('auto-use only ever helps, and costs no time: skills do no damage', () => {
	const rat = { type: 'thistleBoar', level: 9 } as const;
	for (const gear of [G('G3'), G('G6')]) {
		const plain = sim(gear, rat);
		const skilled = sim(gear, rat, { level: 30, autoUse: true });
		assert.ok(skilled.winRate >= plain.winRate);
		assert.ok(skilled.meanHpLeft >= plain.meanHpLeft - 0.01, `${skilled.meanHpLeft} vs ${plain.meanHpLeft}`);
		assert.ok(Math.abs(skilled.meanTimeSec - plain.meanTimeSec) < plain.meanTimeSec * 0.05, 'skills do no damage');
	}
});

test('potions carry a weak character through a fight it would lose, a skill that is not unlocked is never cast', () => {
	const rat = { type: 'thistleBoar', level: 9 } as const;
	assert.equal(sim(STARTER_EQUIPMENT, rat).winRate, 0);
	assert.equal(sim(STARTER_EQUIPMENT, rat, { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 5 }] }).winRate, 1);
	// at level 4 the bot has neither skill: the same sealed streams give the same fights as with auto-use off
	const off = sim(G('G3'), rat);
	const lowLevel = sim(G('G3'), rat, { level: 4, autoUse: true });
	assert.equal(lowLevel.winRate, off.winRate);
	assert.equal(lowLevel.meanHpLeft, off.meanHpLeft);
});

// ---- the boss by level: killable at every level it can have, never trivial -----------------------------------------------------------

const bossAt = (level: number): Foe => ({ type: 'bossGreatAuroch', level });
/** The grade whose window holds a boss level (G2 at 15, G3 at 25, G4 at 35) */
const GRADE_AT: Record<number, Grade> = { 15: 'G2', 25: 'G3', 35: 'G4' };

test('the boss is killable at every level it can have (15 to 35): the grade of that level wins, and the gear curve keeps it fair', () => {
	for (const level of [15, 25, 35]) {
		const matching = sim(atItemLevel(G(GRADE_AT[level]), level), bossAt(level));
		assert.ok(matching.winRate >= 0.9, `${GRADE_AT[level]} at item level ${level} vs the boss at ${level}: ${matching.winRate}`);
		assert.ok(matching.meanTimeSec > 30, `${level}: not a pushover (${matching.meanTimeSec} s)`);
	}
	// gear that fell behind (the G2 kit against a level 35 boss) loses; the best set still wins
	assert.ok(sim(atItemLevel(BEST, 15), bossAt(35)).winRate >= 0.9);
	assert.ok(sim(atItemLevel(G('G2'), 15), bossAt(35)).winRate < 0.5);
});

test('weak gear never beats the boss at any level', () => {
	for (const level of [15, 25, 35]) {
		assert.equal(sim(STARTER_EQUIPMENT, bossAt(level)).winRate, 0, `starter kit vs the boss at ${level}`);
		assert.equal(sim(G('G1'), bossAt(level)).winRate, 0, `the G1 kit vs the boss at ${level}`);
	}
});
