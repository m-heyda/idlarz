import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from '../helpers';
import { CASTLE_FORTRESS } from '../../src/config/castle';
import { SPAWN_LIMIT } from '../../src/config/spawns';
import { castleLevelOf } from '../../src/lib/castleWard';
import { freeTiles, spawnCap } from '../../src/lib/spawnLimits';
import { ticketCap, TICKET_CAP } from '../../src/lib/offline/tickets';
import { pickPersisted } from '../../src/lib/sanitizeSave';
import { summarize } from '../../src/lib/cloudSave/summary';
import { syntheticWorld } from '../../src/utils/worldGen';
import { biomeCount, EMPTY_WORLD } from '../../src/utils/world';

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

test('IDL-221: the server cap (from the save counts) equals the client cap for the same map, lakes included', () => {
	for (const [size, seed, castleLevel] of [
		[400, 3, 1],
		[1000, 5, 1],
		[1000, 5, CASTLE_FORTRESS.fromLevel],
		[120, 9, 1],
	] as const) {
		const world = syntheticWorld(size, seed);
		const { owned, buildings } = world.stats;
		const lakes = biomeCount(world, 'lake');
		const server = ticketCap({ luck: 0, tilesOwned: owned, buildingsOwned: buildings, lakesOwned: lakes, castleLevel });
		const client = Math.min(TICKET_CAP, spawnCap(world, castleLevel));
		assert.equal(server, client, `size ${size} seed ${seed} castle ${castleLevel} (${lakes} lakes)`);
	}
	const lakey = syntheticWorld(400, 3);
	assert.ok(biomeCount(lakey, 'lake') > 0, 'the test map has lakes, otherwise it proves nothing');
});

test('IDL-221: the save summary counts the lakes the cap subtracts', () => {
	freshGame();
	growTo(40);
	const s = summarize(pickPersisted(api()));
	assert.equal(s.derived.lakesOwned, biomeCount(api().tiles, 'lake'));
});
