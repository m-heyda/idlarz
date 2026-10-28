import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from './helpers';
import { CASTLE_FORTRESS, SPAWN_LIMIT } from '../src/config/gameConfig';
import { castleLevelOf } from '../src/lib/castleWard';
import { freeTiles, spawnCap } from '../src/lib/spawnLimits';
import { syntheticWorld } from '../src/utils/worldGen';
import { EMPTY_WORLD } from '../src/utils/world';

test('free tiles leave out the castle, lakes, buildings and (from the fortress level) the ward', () => {
	const world = syntheticWorld(400, 3);
	const { owned, buildings, byBiome } = world.stats;
	assert.equal(freeTiles(world, 1), owned - (byBiome.castle ?? 0) - (byBiome.lake ?? 0) - buildings);
	assert.equal(freeTiles(world, CASTLE_FORTRESS.fromLevel), freeTiles(world, 1) - 8);
	assert.equal(freeTiles(EMPTY_WORLD, 1), 0);
});

test('the cap is the share of free tiles, never below the minimum', () => {
	const world = syntheticWorld(1000, 5);
	assert.equal(spawnCap(world, 1), Math.floor(freeTiles(world, 1) * SPAWN_LIMIT.maxFraction));
	assert.equal(spawnCap(EMPTY_WORLD, 1), SPAWN_LIMIT.minAllowed);
	assert.ok(spawnCap(world, 1) > 100, 'a big map holds many more than the old fixed 8 + 5');
});

test('on a small map one monster and one chest can still both exist', () => {
	freshGame();
	growTo(5);
	assert.ok(spawnCap(api().tiles, castleLevelOf(api().tiles)) >= 2);
});
