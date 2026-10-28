import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { BIOMES } from '../src/config/gameConfig';

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

test('rats may spawn up to 9 tiles from the castle but never beside it, on land only', () => {
	assert.equal(MONSTERS.rat.spawn.maxCastleDistance, 9);
	assert.equal(MONSTERS.rat.spawn.minCastleDistance, 2);
	assert.deepEqual([...MONSTERS.rat.spawn.biomes].sort(), ['forest', 'hills', 'plains', 'swamp', 'tundra']);
});

test('every monster attacks at a speed (attacks per second, like a weapon), has a loot source and a reward', () => {
	for (const [id, def] of Object.entries(MONSTERS)) {
		assert.ok(def.attackSpeed > 0 && def.attackSpeed < 10, `${id} attack speed`);
		assert.ok(def.rewardSec > 0);
		assert.ok(def.lootSourceId.length > 0);
	}
});

test('the combat tunables are set: a fixed tick, a poll cadence that spares the server, and the auto rules', () => {
	assert.ok(COMBAT.tickSec > 0 && COMBAT.tickSec <= 0.5);
	assert.ok(COMBAT.poll.fightSec >= 1, 'no faster than once a second');
	assert.ok(COMBAT.poll.minimizedSec > COMBAT.poll.fightSec);
	assert.ok(COMBAT.maxCatchUpSec >= 60 && COMBAT.maxFightSec > MONSTERS.ratKing.timeLimitSec);
	assert.ok(COMBAT.auto.potionBelowHpPct < COMBAT.auto.healBelowHpPct);
	assert.ok(COMBAT.auto.resumeHpPct > COMBAT.knockoutHpFraction * 100);
});
