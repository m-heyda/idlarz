import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from './helpers';
import {
	advanceMonsters,
	bossThreshold,
	growthSecondsLeft,
	isBoss,
	levelAtAge,
	maxLevelOf,
	monsterAt,
	monsterStats,
	newMonster,
	nextBossType,
	pickSpawnTile,
	rollSpawnLevel,
	spawnLevelRange,
	spawnThreshold,
} from '../src/lib/monsters';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { LIMITS } from '../src/config/limits';
import { limitOf, LIMIT_BONUSES } from '../src/lib/limits';
import { newFight, stepFight } from '../src/lib/combat';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
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

test('pickSpawnTile never returns the castle, chest tiles, monster tiles or unowned tiles', () => {
	freshGame();
	growTo(8);
	let tiles = api().tiles;
	const ownedTiles = ownedRowMajor(tiles)
		.filter((e) => e.tile.biome !== 'castle' && e.tile.biome !== 'lake') // a monster cannot stand on water
		.map(({ x, y }) => ({ x, y }));
	// block all but one tile with a chest or a monster
	const keep = ownedTiles[ownedTiles.length - 1];
	const monsters: Monster[] = [];
	ownedTiles.filter((t) => t !== keep).forEach(({ x, y }, i) => {
		if (i % 2 === 0) tiles = patchTile(tiles, x, y, { hasChest: true });
		else monsters.push(m({ id: i + 1, x, y }));
	});
	for (let i = 0; i < 50; i++) {
		const pick = pickSpawnTile(tiles, monsters, Math.random)!;
		assert.deepEqual(pick, { x: keep.x, y: keep.y });
		assert.ok(!(pick.x === CASTLE_X && pick.y === CASTLE_Y));
	}
});

test('pickSpawnTile returns null when nothing is eligible', () => {
	freshGame();
	assert.equal(pickSpawnTile(api().tiles, [], Math.random), null); // only the castle is owned
});

test('spawnThreshold: first spawn is quicker than the rest', () => {
	assert.equal(spawnThreshold(1), COMBAT.spawn.firstSec);
	assert.equal(spawnThreshold(2), COMBAT.spawn.intervalSec);
});

test('advanceMonsters ages and raises the level', () => {
	const out = advanceMonsters([m({ ageSec: STEP - 10, level: 1, spawnLevel: 1 })], 20, null);
	assert.equal(out[0].ageSec, STEP + 10);
	assert.equal(out[0].level, 2);
	assert.equal(out[0].spawnLevel, 1);
});

test('a frozen monster does not age', () => {
	const out = advanceMonsters([m({ id: 7, ageSec: 100 })], 500, 7);
	assert.equal(out[0].ageSec, 100);
});

test('advanceMonsters does not mutate its input', () => {
	const input = Object.freeze([Object.freeze(m({ ageSec: 5 }))]) as Monster[];
	advanceMonsters(input, 10, null);
});

test('rats no longer evolve: an old rat stays a rat at its growth limit', () => {
	const out = advanceMonsters([m({ spawnLevel: 6, level: 16, ageSec: 99 * STEP })], 5000, null);
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
	const mon = newMonster('ratKing', 4, { x: 2, y: 3 }, 1);
	assert.equal(mon.id, 4);
	assert.equal(mon.type, 'ratKing');
	assert.equal(mon.ageSec, 0);
	assert.equal(mon.level, mon.spawnLevel);
});

test('the Rat King is a boss; rats are not', () => {
	assert.equal(isBoss('ratKing'), true);
	assert.equal(isBoss('rat'), false);
	assert.equal(MONSTERS.ratKing.grade, 'boss');
	assert.equal(MONSTERS.ratKing.lootSourceId, 'ratKing');
	assert.equal(nextBossType([]), 'ratKing');
	assert.equal(nextBossType([m({ type: 'ratKing', level: 15, spawnLevel: 15 })]), null, 'one at a time');
	assert.equal(bossThreshold(), COMBAT.spawn.bossIntervalSec);
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

test('the Rat King has armor, crits and resists Stun; at level 15 he is exactly the old tuning behind his armor, and he follows the gear curve above it', () => {
	const king = monsterStats('ratKing', 15);
	assert.equal(king.maxHp, 10400);
	assert.equal(king.attack, 14);
	assert.equal(king.armor, 20);
	assert.equal(king.critChance, 10);
	assert.equal(king.stunResist, 25);
	assert.equal(Math.round(king.maxHp / (1 - king.armor / (king.armor + COMBAT.armorK))), 15600, 'the old 15600 HP once the armor is counted');
	let last = king;
	for (let l = 16; l <= 35; l++) {
		const next = monsterStats('ratKing', l);
		assert.ok(next.maxHp > last.maxHp && next.attack >= last.attack && next.armor > last.armor, `level ${l}`);
		last = next;
	}
	assert.ok(monsterStats('ratKing', 35).maxHp < king.maxHp * 2, 'a level 35 king is under twice a level 15 one (the gear curve, not an exponential)');
});

test('a fight keeps the level it started at: HP and attack are fixed for its whole length', () => {
	const fight = newFight({ id: 1, type: 'rat', level: 7 });
	assert.equal(fight.level, 7);
	assert.equal(fight.monsterMaxHp, monsterStats('rat', 7).maxHp);
	const weak = newFight({ id: 1, type: 'rat', level: 1 });
	const hpAfter = (start: typeof fight) => {
		let f = start;
		let hp = 1000;
		for (let i = 0; i < 6; i++) ({ fight: f, playerHp: hp } = stepFight(f, 1, hp, 0, () => 0));
		return hp;
	};
	assert.ok(hpAfter(fight) < hpAfter(weak), 'a stronger monster hits harder');
});

test('a boss crit hits harder by its multiplier, and only the high rolls crit; rats never roll for it', () => {
	const king = newFight({ id: 2, type: 'ratKing', level: 15 });
	const hit = (roll: number) => stepFight({ ...king, attackTimer: 2.9 }, 0.2, 1000, 0, () => roll);
	const plain = hit(0);
	const crit = hit(0.99);
	assert.deepEqual(plain.events.map((e) => e.kind), ['hurt']);
	assert.equal(plain.events[0].kind === 'hurt' && plain.events[0].crit, false);
	assert.equal(crit.events[0].kind === 'hurt' && crit.events[0].crit, true);
	assert.equal(1000 - plain.playerHp, 14);
	assert.equal(1000 - crit.playerHp, Math.round(14 * 1.5));
	let calls = 0;
	stepFight({ ...newFight({ id: 1, type: 'rat', level: 1 }), attackTimer: 1.9 }, 0.2, 1000, 0, () => (calls++, 0));
	assert.equal(calls, 0, 'a monster that cannot crit takes no random number');
});
