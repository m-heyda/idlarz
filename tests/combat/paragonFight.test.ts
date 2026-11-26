import test from 'node:test';
import assert from 'node:assert/strict';
import { GRADE_INFO, type Grade } from '../../src/catalog/items/grades';
import { PARAGON_BEHIND_WIN_MAX, PARAGON_COMBAT_SPENDS, PARAGON_FIGHT_MIN_SEC, atItemLevel, kit, simulateMany } from '../../src/lib/fightSim';

// The Paragon combat gate (docs/plan/paragon.md, IDL-187; the table is in docs/generated/fight-sim.md). Paragon makes fights faster and safer after level 100 but never takes the place of gear.

const RUNS = 12;
const boss = (level: number) => ({ type: 'bossGreatAuroch' as const, level });
const worn = (grade: Grade, level: number) => atItemLevel(kit(grade, 'mace'), Math.max(level, GRADE_INFO[grade].levels[0]));
const spend = (name: string) => PARAGON_COMBAT_SPENDS.find((p) => p.name.includes(name))!.paragon;

test('no paragon points: the fight is exactly the one without the option', () => {
	for (const [grade, level] of [
		['G2', 15],
		['G4', 35],
	] as const) {
		const equipment = worn(grade, level);
		const a = simulateMany({ equipment, monster: boss(level), autoUse: false }, RUNS, 'pf0');
		const b = simulateMany({ equipment, monster: boss(level), autoUse: false, paragon: {} }, RUNS, 'pf0');
		assert.deepEqual(a, b);
	}
});

test('every spend makes the boss fight at least as fast and safe as the one before', () => {
	const equipment = worn('G4', 35);
	let last = simulateMany({ equipment, monster: boss(35), autoUse: false }, RUNS, 'pfm');
	for (const { paragon } of PARAGON_COMBAT_SPENDS.slice(1)) {
		const now = simulateMany({ equipment, monster: boss(35), autoUse: false, paragon }, RUNS, 'pfm');
		assert.ok(now.winRate >= last.winRate);
		assert.ok(now.meanTimeSec <= last.meanTimeSec + 1e-9);
		last = now;
	}
});

test('a kit two grades behind a boss still loses at the realistic spend (275 points)', () => {
	for (const [level, grade] of [
		[35, 'G2'],
		[45, 'G3'],
	] as const) {
		const equipment = atItemLevel(kit(grade, 'mace'), GRADE_INFO[grade].levels[0]);
		const none = simulateMany({ equipment, monster: boss(level), autoUse: false }, RUNS, 'pfb');
		const withParagon = simulateMany({ equipment, monster: boss(level), autoUse: false, paragon: spend('275') }, RUNS, 'pfb');
		assert.equal(none.winRate, 0, `${grade} at ${level}: paragon 0`);
		assert.ok(withParagon.winRate <= PARAGON_BEHIND_WIN_MAX, `${grade} at ${level}: ${withParagon.winRate}`);
	}
});

test('the biggest spend still leaves a boss fight of several seconds', () => {
	const r = simulateMany({ equipment: worn('G5', 45), monster: boss(45), autoUse: false, paragon: spend('4,075') }, RUNS, 'pfs');
	assert.equal(r.winRate, 1);
	assert.ok(r.meanTimeSec >= PARAGON_FIGHT_MIN_SEC, `${r.meanTimeSec} s`);
});
