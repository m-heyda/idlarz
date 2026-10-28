import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from './helpers';
import {
	advanceMonsters,
	growthSecondsLeft,
	isBoss,
	levelAtAge,
	maxLevelOf,
	monsterAt,
	monsterStats,
	canSpawnOn,
	pickSpawnTile,
	rollSpawnLevel,
	spawnLevelRange,
	spawnTiles,
} from '../src/lib/monsters';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { LIMITS } from '../src/config/limits';
import { limitOf, LIMIT_BONUSES } from '../src/lib/limits';
import { armorReduction } from '../src/lib/combat';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { BIOMES } from '../src/config/gameConfig';
import type { Monster } from '../src/types/game';
import { ownedRowMajor, patchTile } from '../src/utils/world';

const m = (over: Partial<Monster> = {}): Monster => ({
	id: 1,
	type: 'rat',
	level: 1,
	spawnLevel: 1,
	x: 0,
	y: 0,
	ageSec: 0,
	...over,
});

const STEP = LIMITS.monsterGrowthIntervalSec;

test('levelAtAge: +1 level per growth interval, up to the growth limit above the spawn level', () => {
	assert.deepEqual(
		[0, STEP - 1, STEP, 3 * STEP, 10 * STEP, 99 * STEP].map((age) => levelAtAge(4, age)),
		[4, 4, 5, 7, 14, 14]
	);
	assert.equal(levelAtAge(8, 1e9), 18, 'a level 8 rat tops out at 18');
	assert.equal(maxLevelOf(4), 14);
	assert.equal(levelAtAge(15, 1e9), 25);
});

test('monsterAt finds a monster by tile', () => {
	const list = [m({ id: 3, x: 4, y: 5 })];
	assert.equal(monsterAt(list, 4, 5)?.id, 3);
	assert.equal(monsterAt(list, 5, 4), undefined);
});

test('a monster may stand on land of its allowlist 2 to 9 tiles from the castle: never beside it, never beyond 9, never on water or the castle', () => {
	const rule = MONSTERS.rat.spawn;
	assert.equal(rule.minCastleDistance, 2);
	assert.equal(rule.maxCastleDistance, 9);
	const land = (dx: number, dy = 0, biome = 'plains') => canSpawnOn('rat', CASTLE_X + dx, CASTLE_Y + dy, { biome }, 1);
	assert.equal(land(1), false, 'adjacent to the castle');
	assert.equal(land(1, 1), false, 'diagonal neighbour');
	assert.equal(land(2), true);
	assert.equal(land(-9, 9), true, 'Chebyshev: 9 each way is 9');
	assert.equal(land(10), false);
	assert.equal(land(0, -10), false);
	for (const water of ['lake', 'coast', 'castle', 'empty']) assert.equal(land(4, 0, water), false, water);
	for (const ground of rule.biomes) assert.equal(land(4, 0, ground), true, ground);
	assert.equal(canSpawnOn('rat', CASTLE_X + 4, CASTLE_Y, { biome: 'plains', building: 'farm' }, 1), false, 'not on a building');
	assert.equal(canSpawnOn('rat', CASTLE_X + 4, CASTLE_Y, { biome: 'plains', hasChest: true }, 1), false, 'not on a chest');
	assert.equal(canSpawnOn('rat', CASTLE_X + 4, CASTLE_Y, { biome: 'plains' }, 1, 0), true);
	assert.equal(typeof BIOMES.lake, 'object');
});

test('pickSpawnTile only returns eligible tiles, never a taken one, and nothing when none is left', () => {
	freshGame();
	growTo(40);
	const tiles = api().tiles;
	const all = spawnTiles('rat', tiles, new Set());
	assert.ok(all.length > 5);
	for (const { x, y } of all) {
		const tile = ownedRowMajor(tiles).find((e) => e.x === x && e.y === y)!.tile;
		assert.ok(['plains', 'forest', 'hills', 'swamp', 'tundra'].includes(tile.biome), tile.biome);
		assert.ok(Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) >= 2);
	}
	const keep = all[all.length - 1];
	const taken = new Set(all.filter((t) => t !== keep).map(({ x, y }) => `${x},${y}`));
	for (let i = 0; i < 30; i++) assert.deepEqual(pickSpawnTile('rat', tiles, taken, Math.random), keep);
	assert.equal(pickSpawnTile('rat', tiles, new Set(all.map(({ x, y }) => `${x},${y}`)), Math.random), null);
	let chested = tiles;
	for (const { x, y } of all.filter((t) => t !== keep)) chested = patchTile(chested, x, y, { hasChest: true });
	assert.deepEqual(pickSpawnTile('rat', chested, new Set(), Math.random), keep, 'chest tiles are skipped too');
});

test('pickSpawnTile returns null while only the castle and its neighbours are owned', () => {
	freshGame();
	assert.equal(pickSpawnTile('rat', api().tiles, new Set(), Math.random), null); // only the castle is owned
	api().resetGame();
	assert.equal(pickSpawnTile('rat', api().tiles, new Set(), Math.random), null); // castle plus the ring: all adjacent
});

test('advanceMonsters ages and raises the level', () => {
	const out = advanceMonsters([m({ ageSec: STEP - 10, level: 1, spawnLevel: 1 })], 20);
	assert.equal(out[0].ageSec, STEP + 10);
	assert.equal(out[0].level, 2);
	assert.equal(out[0].spawnLevel, 1);
});

test('advanceMonsters does not mutate its input', () => {
	const input = Object.freeze([Object.freeze(m({ ageSec: 5 }))]) as Monster[];
	advanceMonsters(input, 10);
});

test('rats no longer evolve: an old rat stays a rat at its growth limit', () => {
	const out = advanceMonsters([m({ spawnLevel: 6, level: 16, ageSec: 99 * STEP })], 5000);
	assert.equal(out[0].type, 'rat');
	assert.equal(out[0].level, 16);
});

test('growthSecondsLeft counts down to the next level and is null at the growth limit', () => {
	assert.equal(growthSecondsLeft(m({ ageSec: 600 })), STEP - 600);
	assert.equal(growthSecondsLeft(m({ spawnLevel: 3, level: 5, ageSec: 2 * STEP + 100 })), STEP - 100);
	assert.equal(growthSecondsLeft(m({ spawnLevel: 3, level: 13, ageSec: 10 * STEP })), null);
});

test('the growth limit is a config value that upgrades can raise: every reader follows', () => {
	assert.equal(limitOf('monsterGrowthLevels'), 10);
	const original = LIMIT_BONUSES.monsterGrowthLevels;
	LIMIT_BONUSES.monsterGrowthLevels = () => 5; // a future Legacy effect
	try {
		assert.equal(maxLevelOf(4), 19);
		assert.equal(levelAtAge(4, 99 * STEP), 19);
		assert.equal(growthSecondsLeft(m({ spawnLevel: 4, level: 14, ageSec: 10 * STEP })), STEP);
	} finally {
		LIMIT_BONUSES.monsterGrowthLevels = original;
	}
	assert.equal(maxLevelOf(4), 14);
});

// ---- spawn levels, bosses --------------------------------------------------------------------------------------------------

test('rats spawn up to level 10, the Rat King between 15 and 25, and the window rises with the castle level', () => {
	assert.deepEqual(spawnLevelRange('rat', 1), { min: 1, max: 3 });
	assert.deepEqual(spawnLevelRange('rat', 8), { min: 8, max: 10 });
	assert.deepEqual(spawnLevelRange('rat', 10), { min: 8, max: 10 }, 'capped at 10');
	assert.deepEqual(spawnLevelRange('ratKing', 1), { min: 15, max: 18 });
	assert.deepEqual(spawnLevelRange('ratKing', 10), { min: 22, max: 25 });
	for (let c = 2; c <= 10; c++) {
		for (const type of ['rat', 'ratKing'] as const) assert.ok(spawnLevelRange(type, c).min >= spawnLevelRange(type, c - 1).min);
	}
	for (let c = 1; c <= 10; c++) {
		for (let id = 1; id <= 60; id++) {
			const rat = rollSpawnLevel('rat', c, id);
			assert.ok(rat >= spawnLevelRange('rat', c).min && rat <= spawnLevelRange('rat', c).max && rat <= 10);
			const king = rollSpawnLevel('ratKing', c, id);
			assert.ok(king >= 15 && king <= 25);
		}
	}
	// a king can grow +10: level 35 at most
	assert.equal(maxLevelOf(25), 35);
});

test('the spawn level is rolled from the monster id alone: the same monster always rolls the same, and it spreads over the window', () => {
	assert.equal(rollSpawnLevel('rat', 1, 7), rollSpawnLevel('rat', 1, 7));
	const seen = new Set(Array.from({ length: 50 }, (_, i) => rollSpawnLevel('rat', 1, i + 1)));
	assert.deepEqual([...seen].sort(), [1, 2, 3]);
	// farther from the castle is a little more dangerous: one level per 8 tiles
	assert.equal(rollSpawnLevel('rat', 1, 7, 8), Math.min(10, rollSpawnLevel('rat', 1, 7, 0) + 1));
});

test('the Rat King is a boss; rats are not', () => {
	assert.equal(isBoss('ratKing'), true);
	assert.equal(isBoss('rat'), false);
	assert.equal(MONSTERS.ratKing.grade, 'boss');
	assert.equal(MONSTERS.ratKing.lootSourceId, 'ratKing');
	assert.ok(COMBAT.spawn.bossIntervalSec > COMBAT.spawn.intervalSec);
});

// ---- stats follow the level ------------------------------------------------------------------------------------------------

test('rat stats: level 1 is 100 HP, level 9 is the old tier 5 (506 HP); HP, attack, armor and reward all rise with the level', () => {
	assert.deepEqual([1, 3, 5, 7, 9].map((l) => monsterStats('rat', l).maxHp), [100, 150, 225, 338, 506]);
	assert.deepEqual([1, 3, 5, 7, 9].map((l) => monsterStats('rat', l).attack), [4, 5, 6, 8, 10]);
	for (let l = 2; l <= 20; l++) {
		const a = monsterStats('rat', l - 1);
		const b = monsterStats('rat', l);
		assert.ok(b.maxHp > a.maxHp && b.attack >= a.attack && b.armor >= a.armor && b.rewardSec > a.rewardSec, `level ${l}`);
	}
	assert.equal(monsterStats('rat', 1).armor, 0);
	assert.equal(monsterStats('rat', 1).critChance, 0);
	assert.equal(monsterStats('rat', 1).stunResist, 0);
});

test('the Rat King has armor, crits and resists Stun; at level 15 he is the tuned fight behind his armor, and he follows the gear curve above it', () => {
	const king = monsterStats('ratKing', 15);
	assert.equal(king.maxHp, MONSTERS.ratKing.hp);
	assert.equal(king.attack, 11);
	assert.equal(king.armor, 15);
	assert.equal(king.critChance, 8);
	assert.equal(king.stunResist, 20);
	assert.ok(king.maxHp / (1 - armorReduction(king.armor)) > king.maxHp, 'his armor makes the effective HP higher still');
	let last = king;
	for (let l = 16; l <= 35; l++) {
		const next = monsterStats('ratKing', l);
		assert.ok(next.maxHp > last.maxHp && next.attack >= last.attack && next.armor > last.armor, `level ${l}`);
		last = next;
	}
	assert.ok(monsterStats('ratKing', 35).maxHp < king.maxHp * 2, 'a level 35 king is under twice a level 15 one (the gear curve, not an exponential)');
});

test('attack speed is attacks per second, like a weapon: a rat bites every 2 s, the King every 3 s', () => {
	assert.equal(monsterStats('rat', 1).attackSpeed, 0.5);
	assert.ok(Math.abs(monsterStats('ratKing', 15).attackSpeed - 1 / 3) < 1e-9);
	assert.equal(monsterStats('rat', 9).attackSpeed, monsterStats('rat', 1).attackSpeed, 'it does not change with the level');
});
