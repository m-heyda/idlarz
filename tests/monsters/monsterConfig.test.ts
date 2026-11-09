import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { BIOMES } from '../../src/config/biomes';

// Every monster is one entry of config/combatConfig: adding a monster (or a biome) later must not need code, so the shape is checked here.

const WATER = ['lake', 'coast'];

test('every monster says where it may spawn: known land only, never water or the castle, and a sane distance from the castle', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		assert.ok(def.spawn.biomes.length > 0, `${id} needs somewhere to stand`);
		for (const biome of def.spawn.biomes) {
			assert.ok(biome in BIOMES, `${id}: ${biome} is a biome`);
			assert.ok(!WATER.includes(biome), `${id}: no water`);
			assert.notEqual(biome, 'castle');
			assert.notEqual(biome, 'empty');
		}
		assert.ok(def.spawn.minCastleDistance >= 2, `${id}: never on the neighbours of the castle`);
		assert.ok(def.spawn.maxCastleDistance >= def.spawn.minCastleDistance, id);
	}
});

test('monsters may spawn up to 9 tiles from the castle but never beside it, each in its own biome only', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		assert.equal(def.spawn.maxCastleDistance, 9, id);
		assert.equal(def.spawn.minCastleDistance, 2, id);
		assert.equal(def.spawn.biomes.length, 1, id);
	}
	assert.deepEqual([...MONSTERS.thistleBoar.spawn.biomes], ['plains']);
	assert.deepEqual([...MONSTERS.rimeWraith.spawn.biomes], ['tundra']);
});

test('each biome is a step up: its monsters and its boss start at higher levels, hit harder and have more HP than the biome before', () => {
	const ladder = [
		['thistleBoar', 'bossGreatAuroch'],
		['mossbackWolf', 'bossElderStag'],
		['garbageOgre', 'bossMireMatriarch'],
		['frostHare', 'bossWinterWyrm'],
	] as const;
	for (let i = 1; i < ladder.length; i++) {
		const [before, after] = [MONSTERS[ladder[i - 1][0]], MONSTERS[ladder[i][0]]];
		assert.ok(after.spawnWindow.base > before.spawnWindow.base && after.spawnWindow.cap > before.spawnWindow.cap, 'higher levels');
		assert.ok(after.hp > before.hp * 0.6 && after.armor >= before.armor, 'tougher at the start');
		const [kingBefore, kingAfter] = [MONSTERS[ladder[i - 1][1]], MONSTERS[ladder[i][1]]];
		assert.ok(
			kingAfter.hp > kingBefore.hp && kingAfter.armor > kingBefore.armor && kingAfter.spawnWindow.base > kingBefore.spawnWindow.base,
			'the boss climbs too',
		);
	}
});

test('the plains monster and boss carry the numbers of the retired rat and Rat King (the balance sims keep their meaning)', () => {
	assert.deepEqual(
		[MONSTERS.thistleBoar.hp, MONSTERS.thistleBoar.attack, MONSTERS.thistleBoar.attackSpeed, MONSTERS.thistleBoar.reward.gold.rewardSec],
		[100, 4, 0.5, 90],
	);
	assert.deepEqual(
		[MONSTERS.bossGreatAuroch.hp, MONSTERS.bossGreatAuroch.attack, MONSTERS.bossGreatAuroch.armor, MONSTERS.bossGreatAuroch.timeLimitSec],
		[1000, 11, 15, 75],
	);
});

test('every monster attacks at a speed (attacks per second, like a weapon), has a loot source and a reward', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		assert.ok(def.attackSpeed > 0 && def.attackSpeed < 10, `${id} attack speed`);
		assert.ok(def.reward.gold.rewardSec > 0 && def.reward.xp.rewardSec > 0 && def.reward.gold.cap > 0 && def.reward.xp.cap > 0 && def.reward.levelMult > 1);
		assert.ok(def.lootSourceId.length > 0);
	}
});

test('the combat tunables are set: a fixed tick, a poll cadence that spares the server, and the auto rules', () => {
	assert.ok(COMBAT.tickSec > 0 && COMBAT.tickSec <= 0.5);
	assert.ok(COMBAT.poll.fightSec >= 1, 'no faster than once a second');
	assert.ok(COMBAT.poll.minimizedSec > COMBAT.poll.fightSec);
	assert.ok(COMBAT.maxCatchUpSec >= 60 && COMBAT.maxFightSec > MONSTERS.bossGreatAuroch.timeLimitSec);
	assert.ok(COMBAT.auto.potionBelowHpPct < COMBAT.auto.healBelowHpPct);
	assert.ok(COMBAT.auto.resumeHpPct > COMBAT.knockoutHpFraction * 100);
});
