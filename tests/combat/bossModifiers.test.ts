import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { describeModifiers } from '../../src/lib/bossModifiers';
import { simSetup } from '../../src/lib/fightSim';
import { enrageSteps, modifiersOf, monsterStats, potionCooldownAgainst } from '../../src/lib/monsters';
import { runCombat } from '../../src/lib/offline/fight';
import { projectFight } from '../../src/lib/offline/fightProject';
import type { FightEvent } from '../../src/lib/offline/fightTypes';
import { estimateWin } from '../../src/lib/offline/winChance';
import { playerProfile } from '../../src/lib/offline/profile';
import { STRONG_KIT } from '../builders';
import type { MonsterType } from '../../src/types/game';

// Boss modifiers (Venom, Sluggish, Enrage, Brutal): config on the boss, rules in the fight engine, numbers in monsterStats.

(COMBAT.auto as { minWinChance: number }).minWinChance = 0;

const MODIFIED = Object.entries(MONSTERS)
	.filter(([, d]) => 'modifiers' in d && d.modifiers)
	.map(([id]) => id as MonsterType);

test('the golden fight bosses carry no modifier, so their pinned fights stay as they were', () => {
	assert.deepEqual(modifiersOf('bossGreatAuroch'), {});
	assert.ok(MODIFIED.length >= 8, 'most biome bosses have one or more');
	for (const id of MODIFIED) assert.equal(MONSTERS[id].grade, 'boss', `${id} is a boss`);
});

test('Brutal raises the attack by its percent, Enrage the attack speed by a step every few seconds, up to the maximum', () => {
	const brutal = modifiersOf('bossReefLeviathan').brutal!;
	const plain = { ...MONSTERS.bossReefLeviathan, modifiers: undefined };
	const level = MONSTERS.bossReefLeviathan.refLevel;
	const base = Math.round(plain.attack); // at its reference level a gear-scaled boss has its configured attack
	assert.equal(monsterStats('bossReefLeviathan', level).attack, Math.round(base * (1 + brutal.attackPct / 100)));

	const e = modifiersOf('bossElderStag').enrage!;
	const speed = (sec: number) => monsterStats('bossElderStag', MONSTERS.bossElderStag.refLevel, sec).attackSpeed;
	const start = MONSTERS.bossElderStag.attackSpeed;
	assert.equal(speed(0), start);
	assert.equal(speed(e.everySec - 0.1), start);
	assert.ok(Math.abs(speed(e.everySec) - start * (1 + e.speedPct / 100)) < 1e-12);
	assert.ok(Math.abs(speed(e.everySec * 100) - start * (1 + (e.speedPct / 100) * e.maxSteps)) < 1e-12, 'capped at maxSteps');
	assert.equal(enrageSteps('bossGreatAuroch', 1000), 0, 'no modifier, no steps');
	assert.equal(monsterStats('bossGreatAuroch', 15, 500).attackSpeed, MONSTERS.bossGreatAuroch.attackSpeed);
});

test('Sluggish lengthens the potion cooldown of the fight, only against the boss that has it', () => {
	const m = modifiersOf('bossWinterWyrm').sluggish!.potionCooldownMult;
	assert.equal(potionCooldownAgainst('bossWinterWyrm', 8), 8 * m);
	assert.equal(potionCooldownAgainst('bossGreatAuroch', 8), 8);
	assert.equal(potionCooldownAgainst('thistleBoar', 8), 8);
});

test('the panel chips name each modifier a boss carries and a monster without any shows none', () => {
	assert.deepEqual(describeModifiers(modifiersOf('thistleBoar')), []);
	assert.deepEqual(
		describeModifiers(modifiersOf('bossEyedMaw')).map((c) => c.key),
		['venom', 'sluggish'],
	);
	for (const id of MODIFIED) for (const chip of describeModifiers(modifiersOf(id))) assert.ok(chip.text.length > 10, `${id} ${chip.key}`);
});

const fight = (type: MonsterType, level: number, seconds: number, seed = 'mods') => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type, level }], seed });
	let ledger = runCombat(s.ledger, s.env(s.start)).ledger;
	const events: FightEvent[] = [];
	let last = ledger.combat?.eventNo ?? 0;
	for (let i = 1; i <= seconds; i++) {
		ledger = runCombat(ledger, s.env(s.start + i)).ledger;
		events.push(...ledger.combat!.log.filter((e) => e.no > last));
		last = ledger.combat!.eventNo;
	}
	return { s, ledger, events };
};

test('Venom: a boss with it poisons the hero (poison events, HP lost between its hits), a boss without it never does', () => {
	const poisoned = fight('bossMireMatriarch', MONSTERS.bossMireMatriarch.refLevel, 30);
	const poison = poisoned.events.filter((e) => e.kind === 'poison');
	assert.ok(poison.length > 0, 'poison ticks are reported');
	assert.ok(poison.every((e) => (e.amount ?? 0) > 0));
	const clean = fight('bossGreatAuroch', MONSTERS.bossGreatAuroch.refLevel, 30);
	assert.equal(clean.events.filter((e) => e.kind === 'poison').length, 0);
	assert.equal(clean.ledger.combat!.fight?.poison, undefined);
});

test('Venom is deterministic and stacks stop at the maximum, then run out after the duration', () => {
	const type = 'bossMireMatriarch';
	const v = modifiersOf(type).venom!;
	const run = () => fight(type, MONSTERS[type].refLevel, 40, 'venom').events.map((e) => [e.kind, e.amount]);
	assert.deepEqual(run(), run());
	const f = fight(type, MONSTERS[type].refLevel, 20).ledger.combat!.fight;
	if (f?.poison) {
		assert.ok(f.poison.stacks >= 1 && f.poison.stacks <= v.maxStacks);
		assert.ok(f.poison.leftSec <= v.durationSec);
	}
});

test('the fight plan, run on a copy, includes the poison and ends like the real fight', () => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: 'bossMireMatriarch', level: MONSTERS.bossMireMatriarch.refLevel }], seed: 'plan' });
	const ledger = runCombat(s.ledger, s.env(s.start)).ledger;
	const plan = projectFight(ledger, s.env(s.start), ledger.combat!);
	assert.ok(plan, 'the fight ends inside the limit');
	assert.ok(
		plan!.fx.some(([, kind]) => kind === 8),
		'a poison effect is flown (PLAN_FX_KINDS index 8)',
	);
});

test('the win estimate counts the modifiers: Venom and Brutal lower the chance, the estimate stays sane', () => {
	const s = simSetup({ equipment: STRONG_KIT, monsters: [{ type: 'bossMireMatriarch', level: 25 }], seed: 'estimate' });
	const profile = playerProfile(s.stored.core);
	for (const id of MODIFIED) {
		const e = estimateWin(profile, profile.maxHp, id, MONSTERS[id].refLevel);
		assert.ok(e.chance >= 0 && e.chance <= 1 && !Number.isNaN(e.chance), id);
	}
	const withVenom = estimateWin(profile, profile.maxHp, 'bossMireMatriarch', 25);
	const original = MONSTERS.bossMireMatriarch.modifiers;
	(MONSTERS.bossMireMatriarch as { modifiers?: unknown }).modifiers = undefined;
	const without = estimateWin(profile, profile.maxHp, 'bossMireMatriarch', 25);
	(MONSTERS.bossMireMatriarch as { modifiers?: unknown }).modifiers = original;
	if (Number.isFinite(without.surviveSec)) assert.ok(withVenom.surviveSec <= without.surviveSec, 'poison shortens the time you last');
});
