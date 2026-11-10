import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_MAX_DISTANCE, BOSS_MIN_DISTANCE, COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { BIOMES } from '../../src/config/biomes';
import { MONSTER_CATALOG } from '../../src/catalog/monsters';

// Every monster is one entry of config/combatConfig: adding a monster (or a biome) later must not need code, so the shape is checked here.

const WATER = ['lake', 'coast'];

test('every monster says where it may spawn: a known biome, never the castle, and a sane distance from it; water only for the monsters that live there (IDL-58)', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		assert.ok(def.spawn.biomes.length > 0, `${id} needs somewhere to stand`);
		for (const biome of def.spawn.biomes) {
			assert.ok(biome in BIOMES, `${id}: ${biome} is a biome`);
			if (WATER.includes(biome))
				assert.equal(MONSTER_CATALOG.find((m) => m.id === id)?.biomes[0], biome, `${id}: only a monster of the water biome stands on it`);
			assert.notEqual(biome, 'castle');
			assert.notEqual(biome, 'empty');
		}
		assert.ok(def.spawn.minCastleDistance >= 2, `${id}: never on the neighbours of the castle`);
		assert.ok(def.spawn.maxCastleDistance >= def.spawn.minCastleDistance, id);
	}
});

test('normal monsters spawn 2 to 9 tiles from the castle and bosses 8 or more (IDL-222), each in its own biome only', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		const boss = def.grade === 'boss';
		assert.equal(def.spawn.maxCastleDistance, boss ? BOSS_MAX_DISTANCE : 9, id);
		assert.equal(def.spawn.minCastleDistance, boss ? BOSS_MIN_DISTANCE : 2, id);
		assert.equal(def.spawn.biomes.length, 1, id);
	}
	assert.deepEqual([...MONSTERS.thistleBoar.spawn.biomes], ['plains']);
	assert.deepEqual([...MONSTERS.rimeWraith.spawn.biomes], ['tundra']);
});

test('each biome is a step up: its monsters and its boss start at higher levels, hit harder and have more HP than the biome before', () => {
	// one normal monster and the boss of each biome, easiest biome first (the home ladder: plains, coast, forest, hills, swamp, lake, tundra)
	const ladder = [
		['thistleBoar', 'bossGreatAuroch'],
		['wreckCrab', 'bossReefLeviathan'],
		['mossbackWolf', 'bossElderStag'],
		['graniteRam', 'bossHillGiant'],
		['garbageOgre', 'bossMireMatriarch'],
		['mossSnapper', 'bossLakeHydra'],
		['frostHare', 'bossWinterWyrm'],
	] as const;
	for (let i = 1; i < ladder.length; i++) {
		const [before, after] = [MONSTERS[ladder[i - 1][0]], MONSTERS[ladder[i][0]]];
		assert.ok(after.reward.gold.cap > before.reward.gold.cap && after.reward.gold.rewardSec > before.reward.gold.rewardSec, 'pays more');
		assert.ok(after.spawnWindow.base > before.spawnWindow.base && after.spawnWindow.cap > before.spawnWindow.cap, 'higher levels');
		assert.ok(after.hp > before.hp * 0.6 && after.armor >= before.armor, 'tougher at the start');
		assert.ok(MONSTERS[ladder[i][1]].timeLimitSec! > MONSTERS[ladder[i - 1][1]].timeLimitSec!, 'a longer clock for the harder boss');
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
