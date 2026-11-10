import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from '../helpers';
import {
	advanceMonsters,
	growthSecondsLeft,
	isBoss,
	levelAtAge,
	growthInfo,
	maxLevelOf,
	monsterAt,
	monsterStats,
	rewardLevelMult,
	canSpawnOn,
	pickSpawnTile,
	rollSpawnLevel,
	spawnLevelRange,
	spawnTiles,
} from '../../src/lib/monsters';
import { COMBAT, MONSTERS } from '../../src/config/combatConfig';
import { LIMITS } from '../../src/config/limits';
import { limitOf, LIMIT_BONUSES } from '../../src/lib/limits';
import { armorReduction } from '../../src/lib/combat';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { BIOMES } from '../../src/config/biomes';
import type { Monster } from '../../src/types/game';
import { ownedRowMajor, patchTile } from '../../src/utils/world';

const m = (over: Partial<Monster> = {}): Monster => ({
	id: 1,
	type: 'thistleBoar',
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
		[4, 4, 5, 7, 14, 14],
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
	const rule = MONSTERS.thistleBoar.spawn;
	assert.equal(rule.minCastleDistance, 2);
	assert.equal(rule.maxCastleDistance, 9);
	const land = (dx: number, dy = 0, biome = 'plains') => canSpawnOn('thistleBoar', CASTLE_X + dx, CASTLE_Y + dy, { biome }, 1);
	assert.equal(land(1), false, 'adjacent to the castle');
	assert.equal(land(1, 1), false, 'diagonal neighbour');
	assert.equal(land(2), true);
	assert.equal(land(-9, 9), true, 'Chebyshev: 9 each way is 9');
	assert.equal(land(10), false);
	assert.equal(land(0, -10), false);
	for (const water of ['lake', 'coast', 'castle', 'empty']) assert.equal(land(4, 0, water), false, water);
	for (const ground of rule.biomes) assert.equal(land(4, 0, ground), true, ground);
	assert.equal(canSpawnOn('thistleBoar', CASTLE_X + 4, CASTLE_Y, { biome: 'plains', hasChest: true }, 1), false, 'not on a chest');
	assert.equal(canSpawnOn('thistleBoar', CASTLE_X + 4, CASTLE_Y, { biome: 'plains' }, 1, 0), true);
	assert.equal(typeof BIOMES.lake, 'object');
});

test('pickSpawnTile only returns eligible tiles, never a taken one, and nothing when none is left', () => {
	freshGame();
	growTo(150);
	const tiles = api().tiles;
	const all = spawnTiles('thistleBoar', tiles, new Set());
	assert.ok(all.length > 2);
	for (const { x, y } of all) {
		const tile = ownedRowMajor(tiles).find((e) => e.x === x && e.y === y)!.tile;
		assert.equal(tile.biome, 'plains', 'a Thistle Boar stands on the plains only');
		assert.ok(Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) >= 2);
	}
	const keep = all[all.length - 1];
	const taken = new Set(all.filter((t) => t !== keep).map(({ x, y }) => `${x},${y}`));
	for (let i = 0; i < 30; i++) assert.deepEqual(pickSpawnTile('thistleBoar', tiles, taken, Math.random), keep);
	assert.equal(pickSpawnTile('thistleBoar', tiles, new Set(all.map(({ x, y }) => `${x},${y}`)), Math.random), null);
	let chested = tiles;
	for (const { x, y } of all.filter((t) => t !== keep)) chested = patchTile(chested, x, y, { hasChest: true });
	assert.deepEqual(pickSpawnTile('thistleBoar', chested, new Set(), Math.random), keep, 'chest tiles are skipped too');
});

test('pickSpawnTile returns null while only the castle and its neighbours are owned', () => {
	freshGame();
	assert.equal(pickSpawnTile('thistleBoar', api().tiles, new Set(), Math.random), null); // only the castle is owned
	api().resetGame();
	assert.equal(pickSpawnTile('thistleBoar', api().tiles, new Set(), Math.random), null); // castle plus the ring: all adjacent
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
	assert.equal(out[0].type, 'thistleBoar');
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
	LIMIT_BONUSES.monsterGrowthLevels = () => 5; // a future Ember effect
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

test('normal monsters spawn up to level 10, the plains boss between 15 and 25, and the window rises with the castle level', () => {
	assert.deepEqual(spawnLevelRange('thistleBoar', 1), { min: 1, max: 3 });
	assert.deepEqual(spawnLevelRange('thistleBoar', 8), { min: 8, max: 10 });
	assert.deepEqual(spawnLevelRange('thistleBoar', 10), { min: 8, max: 10 }, 'capped at 10');
	assert.deepEqual(spawnLevelRange('bossGreatAuroch', 1), { min: 15, max: 18 });
	assert.deepEqual(spawnLevelRange('bossGreatAuroch', 10), { min: 22, max: 25 });
	for (let c = 2; c <= 10; c++) {
		for (const type of ['thistleBoar', 'bossGreatAuroch'] as const) assert.ok(spawnLevelRange(type, c).min >= spawnLevelRange(type, c - 1).min);
	}
	for (let c = 1; c <= 10; c++) {
		for (let id = 1; id <= 60; id++) {
			const rat = rollSpawnLevel('thistleBoar', c, id);
			assert.ok(rat >= spawnLevelRange('thistleBoar', c).min && rat <= spawnLevelRange('thistleBoar', c).max && rat <= 10);
			const king = rollSpawnLevel('bossGreatAuroch', c, id);
			assert.ok(king >= 15 && king <= 25);
		}
	}
	// a boss can grow +10: level 35 at most
	assert.equal(maxLevelOf(25), 35);
});

test('the spawn level is rolled from the monster id alone: the same monster always rolls the same, and it spreads over the window', () => {
	assert.equal(rollSpawnLevel('thistleBoar', 1, 7), rollSpawnLevel('thistleBoar', 1, 7));
	const seen = new Set(Array.from({ length: 50 }, (_, i) => rollSpawnLevel('thistleBoar', 1, i + 1)));
	assert.deepEqual([...seen].sort(), [1, 2, 3]);
	// farther from the castle is a little more dangerous: one level per 8 tiles
	assert.equal(rollSpawnLevel('thistleBoar', 1, 7, 8), Math.min(10, rollSpawnLevel('thistleBoar', 1, 7, 0) + 1));
});

test('the plains boss is a boss; normal monsters are not', () => {
	assert.equal(isBoss('bossGreatAuroch'), true);
	assert.equal(isBoss('thistleBoar'), false);
	assert.equal(MONSTERS.bossGreatAuroch.grade, 'boss');
	assert.equal(MONSTERS.bossGreatAuroch.lootSourceId, 'boss');
	assert.ok(COMBAT.spawn.bossIntervalSec > COMBAT.spawn.intervalSec);
});

// ---- stats follow the level ------------------------------------------------------------------------------------------------

test('rat stats: level 1 is 100 HP, level 9 is the old tier 5 (506 HP); HP, attack, armor and reward all rise with the level', () => {
	assert.deepEqual(
		[1, 3, 5, 7, 9].map((l) => monsterStats('thistleBoar', l).maxHp),
		[100, 150, 225, 338, 506],
	);
	assert.deepEqual(
		[1, 3, 5, 7, 9].map((l) => monsterStats('thistleBoar', l).attack),
		[4, 5, 6, 8, 10],
	);
	for (let l = 2; l <= 20; l++) {
		const a = monsterStats('thistleBoar', l - 1);
		const b = monsterStats('thistleBoar', l);
		assert.ok(
			b.maxHp > a.maxHp && b.attack >= a.attack && b.armor >= a.armor && rewardLevelMult('thistleBoar', l) > rewardLevelMult('thistleBoar', l - 1),
			`level ${l}`,
		);
	}
	assert.equal(monsterStats('thistleBoar', 1).armor, 0);
	assert.equal(monsterStats('thistleBoar', 1).critChance, 0);
	assert.equal(monsterStats('thistleBoar', 1).stunResist, 0);
});

test('the plains boss has armor, crits and resists Stun; at level 15 it is the tuned fight behind its armor, and it follows the gear curve above it', () => {
	const king = monsterStats('bossGreatAuroch', 15);
	assert.equal(king.maxHp, MONSTERS.bossGreatAuroch.hp);
	assert.equal(king.attack, 11);
	assert.equal(king.armor, 15);
	assert.equal(king.critChance, 8);
	assert.equal(king.stunResist, 20);
	assert.ok(king.maxHp / (1 - armorReduction(king.armor)) > king.maxHp, 'its armor makes the effective HP higher still');
	let last = king;
	for (let l = 16; l <= 35; l++) {
		const next = monsterStats('bossGreatAuroch', l);
		assert.ok(next.maxHp > last.maxHp && next.attack >= last.attack && next.armor > last.armor, `level ${l}`);
		last = next;
	}
	assert.ok(monsterStats('bossGreatAuroch', 35).maxHp < king.maxHp * 2, 'a level 35 boss is under twice a level 15 one (the gear curve, not an exponential)');
});

test('attack speed is attacks per second, like a weapon: a normal monster bites every 2 s, the boss every 3 s', () => {
	assert.equal(monsterStats('thistleBoar', 1).attackSpeed, 0.5);
	assert.ok(Math.abs(monsterStats('bossGreatAuroch', 15).attackSpeed - 1 / 3) < 1e-9);
	assert.equal(monsterStats('thistleBoar', 9).attackSpeed, monsterStats('thistleBoar', 1).attackSpeed, 'it does not change with the level');
});

test('growthInfo says how far a monster has grown: the top level, the time to the next one and the share of the wait that has passed', () => {
	const interval = LIMITS.monsterGrowthIntervalSec;
	const top = maxLevelOf(5);
	assert.equal(top, 5 + LIMITS.monsterGrowthLevels);
	// just appeared
	const fresh = growthInfo({ spawnLevel: 5, level: 5, ageSec: 0 });
	assert.deepEqual(fresh, { max: top, maxed: false, leftSec: interval, fraction: 0 });
	// halfway to level 6
	const half = growthInfo({ spawnLevel: 5, level: 5, ageSec: interval / 2 });
	assert.equal(half.leftSec, interval / 2);
	assert.equal(half.fraction, 0.5);
	// the wait for level 8 is counted from level 7, not from the spawn
	const later = growthInfo({ spawnLevel: 5, level: 7, ageSec: interval * 2 + interval / 4 });
	assert.equal(later.leftSec, interval * 0.75);
	assert.ok(Math.abs(later.fraction - 0.25) < 1e-9);
	// at the top: maxed, nothing left to wait for
	assert.deepEqual(growthInfo({ spawnLevel: 5, level: top, ageSec: interval * 100 }), { max: top, maxed: true, leftSec: null, fraction: 1 });
	// a monster the ticks have aged follows the same numbers
	let aged: Monster[] = [{ id: 1, type: 'thistleBoar', level: 5, spawnLevel: 5, x: 3, y: 3, ageSec: 0, ticket: 1 }];
	aged = advanceMonsters(aged, interval * (LIMITS.monsterGrowthLevels + 1));
	assert.equal(aged[0].level, top);
	assert.equal(growthInfo(aged[0]).maxed, true);
});
