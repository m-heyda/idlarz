import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, store } from './helpers';
import { CASTLE_FORTRESS, CASTLE_RANGE, GRID_CENTER_X, GRID_CENTER_Y } from '../src/config/gameConfig';
import { castleLevelOf, isInWard, monstersOutsideWard } from '../src/lib/castleWard';
import { pickSpawnTile } from '../src/lib/monsters';
import { pickPersisted, sanitizeSave } from '../src/lib/sanitizeSave';
import type { Monster } from '../src/types/game';

const L7 = CASTLE_FORTRESS.fromLevel;
const R = CASTLE_RANGE.radius;

const setCastle = (level: number) =>
	store.setState((s) => {
		const tiles = s.tiles.map((row) => [...row]);
		tiles[GRID_CENTER_Y][GRID_CENTER_X] = { ...tiles[GRID_CENTER_Y][GRID_CENTER_X], level };
		return { tiles };
	});

const ring = () => {
	const out: { x: number; y: number }[] = [];
	for (let dy = -R; dy <= R; dy++) {
		for (let dx = -R; dx <= R; dx++) {
			if (dx || dy) out.push({ x: GRID_CENTER_X + dx, y: GRID_CENTER_Y + dy });
		}
	}
	return out;
};

/** Make all 8 tiles around the castle owned (growTo buys the nearest tiles, which is not always the full 3x3). */
const ownRing = () =>
	store.setState((s) => {
		const tiles = s.tiles.map((row) => [...row]);
		for (const { x, y } of ring()) tiles[y][x] = { biome: 'plains', isOwned: true };
		return { tiles };
	});

const rat = (id: number, x: number, y: number): Monster => ({ id, type: 'rat', tier: 1, x, y, ageSec: 0 });

test('the fortress starts at castle level 7', () => {
	assert.equal(L7, 7);
});

test('isInWard: the 3x3 around the castle from level 7, nothing before and nothing outside', () => {
	for (const { x, y } of ring()) {
		assert.equal(isInWard(x, y, L7 - 1), false, `${x},${y} at level ${L7 - 1}`);
		assert.equal(isInWard(x, y, L7), true, `${x},${y} at level ${L7}`);
		assert.equal(isInWard(x, y, 10), true);
	}
	assert.equal(isInWard(GRID_CENTER_X + R + 1, GRID_CENTER_Y, 10), false);
	assert.equal(isInWard(GRID_CENTER_X, GRID_CENTER_Y - R - 1, 10), false);
	assert.equal(isInWard(GRID_CENTER_X + R + 1, GRID_CENTER_Y + R + 1, 10), false);
});

test('castleLevelOf reads the castle tile', () => {
	freshGame();
	assert.equal(castleLevelOf(api().tiles), 1);
	setCastle(8);
	assert.equal(castleLevelOf(api().tiles), 8);
});

test('monstersOutsideWard drops ring monsters but keeps the one being fought', () => {
	const list = [rat(1, GRID_CENTER_X + 1, GRID_CENTER_Y), rat(2, GRID_CENTER_X + 2, GRID_CENTER_Y), rat(3, GRID_CENTER_X, GRID_CENTER_Y - 1)];
	assert.deepEqual(monstersOutsideWard(list, L7, null).map((m) => m.id), [2]);
	assert.deepEqual(monstersOutsideWard(list, L7, 3).map((m) => m.id), [2, 3]);
	assert.equal(monstersOutsideWard(list, L7 - 1, null), list);
});

test('pickSpawnTile never picks a ward tile from level 7, but does before', () => {
	freshGame();
	ownRing();
	const ringKeys = new Set(ring().map((p) => `${p.x},${p.y}`));
	for (let i = 0; i < 40; i++) {
		const pick = pickSpawnTile(api().tiles, [], Math.random)!;
		assert.ok(pick && ringKeys.has(`${pick.x},${pick.y}`), 'before level 7 the ring is fair game');
	}
	setCastle(L7);
	assert.equal(pickSpawnTile(api().tiles, [], Math.random), null); // the ring was all there was
	growTo(14);
	for (let i = 0; i < 60; i++) {
		const pick = pickSpawnTile(api().tiles, [], Math.random)!;
		assert.ok(pick);
		assert.ok(!isInWard(pick.x, pick.y, L7), `${pick.x},${pick.y} is inside the ward`);
	}
});

test('reaching level 7 clears the monsters inside the ward, a fought one stays until the fight ends', () => {
	freshGame();
	growTo(14);
	const outside = api()
		.tiles.flatMap((row, y) => row.map((t, x) => ({ t, x, y })))
		.find(({ t, x, y }) => t.isOwned && t.biome !== 'castle' && !isInWard(x, y, L7))!;
	store.setState({
		monsters: [rat(1, GRID_CENTER_X + 1, GRID_CENTER_Y), rat(2, outside.x, outside.y), rat(3, GRID_CENTER_X - 1, GRID_CENTER_Y + 1)],
		nextMonsterId: 4,
		castleUpgrade: { toLevel: L7, remainingSec: 0.05 },
	});
	setCastle(L7 - 1);
	api().startFight(3);
	api().tick(1000);
	assert.equal(castleLevelOf(api().tiles), L7);
	assert.deepEqual(api().monsters.map((m) => m.id).sort(), [2, 3], 'the fought one stays, the other ring monster is cleared');
	api().leaveFight();
	api().tick(100);
	assert.deepEqual(api().monsters.map((m) => m.id), [2]);
});

test('no chest ever spawns inside the ward from level 7', () => {
	freshGame();
	ownRing(); // only the ring is owned
	setCastle(L7);
	for (let i = 0; i < 4; i++) api().tick(300_000);
	assert.equal(api().activeChests, 0);
	assert.ok(ring().every(({ x, y }) => !api().tiles[y][x].hasChest));
	growTo(12);
	for (let i = 0; i < 4; i++) api().tick(300_000);
	assert.ok(api().activeChests > 0, 'chests still spawn outside the ward');
	assert.ok(ring().every(({ x, y }) => !api().tiles[y][x].hasChest));
});

test('a save with a monster inside the ward of a level 7+ castle is rejected', () => {
	freshGame();
	growTo(12);
	const snapshot = () => JSON.parse(JSON.stringify(pickPersisted(api())));
	store.setState({ monsters: [rat(1, GRID_CENTER_X + 1, GRID_CENTER_Y)], nextMonsterId: 2 });
	setCastle(L7 - 1);
	assert.equal(sanitizeSave(snapshot()).ok, true, 'fine below level 7');
	setCastle(L7);
	// castle level 7 needs the castle upgrade cost map: take it from sanitize's own recomputation, only the level matters
	const result = sanitizeSave(snapshot());
	assert.equal(result.ok, false);
});
