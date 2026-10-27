import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { CASTLE_FORTRESS, SPAWN_LIMIT } from '../src/config/gameConfig';
import { castleLevelOf } from '../src/lib/castleWard';
import { canSpawn, freeTiles, spawnCap } from '../src/lib/spawnLimits';
import { syntheticWorld } from '../src/utils/worldGen';
import { EMPTY_WORLD, keyX, keyY } from '../src/utils/world';

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

test('canSpawn counts monsters and chests together against the cap', () => {
	const world = syntheticWorld(1000, 5);
	const cap = spawnCap(world, 1);
	assert.equal(canSpawn(world, 1, cap - 1, 0), true);
	assert.equal(canSpawn(world, 1, cap - 3, 2), true);
	assert.equal(canSpawn(world, 1, cap - 2, 2), false);
	assert.equal(canSpawn(world, 1, 0, cap), false);
});

test('on a small map one monster and one chest can still both exist', () => {
	freshGame();
	growTo(5);
	assert.ok(spawnCap(api().tiles, castleLevelOf(api().tiles)) >= 2);
});

test('the chest timer sits at 0 while monsters already fill the share of the map', () => {
	freshGame();
	growTo(12);
	const cap = spawnCap(api().tiles, castleLevelOf(api().tiles));
	const spots = [...api().tiles.map.entries()]
		.filter(([, t]) => t.biome !== 'castle' && t.biome !== 'lake')
		.slice(0, cap)
		.map(([k], i) => ({ id: i + 1, type: 'rat' as const, level: 1, spawnLevel: 1, x: keyX(k), y: keyY(k), ageSec: 0 }));
	if (spots.length < cap) return; // the grown map had too many lakes to fill the cap: nothing to check
	store.setState({ monsters: spots, nextMonsterId: cap + 1, chestSpawnTimer: 123, monsterSpawnTimer: 50 });
	api().tick(10_000);
	assert.equal(api().chestSpawnTimer, 0);
	assert.equal(api().monsterSpawnTimer, 0);
	assert.equal(api().monsters.length, cap);
});
