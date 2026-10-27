import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from './helpers';
import {
	advanceMonsters,
	monsterAt,
	pickSpawnTile,
	spawnThreshold,
	tierFor,
	tierSecondsLeft,
} from '../src/lib/monsters';
import { COMBAT } from '../src/config/combatConfig';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import type { Monster } from '../src/types/game';
import { ownedRowMajor, patchTile } from '../src/utils/world';

const m = (over: Partial<Monster> = {}): Monster => ({
	id: 1,
	type: 'rat',
	tier: 1,
	x: 0,
	y: 0,
	ageSec: 0,
	...over,
});

const TIER5_AGE = 4 * COMBAT.tierIntervalSec; // 7200

test('tierFor ages 0/1799/1800/7200/99999 -> 1/1/2/5/5; king stays tier 1', () => {
	assert.deepEqual(
		[0, 1799, 1800, 7200, 99999].map((age) => tierFor('rat', age)),
		[1, 1, 2, 5, 5]
	);
	assert.equal(tierFor('ratKing', 99999), 1);
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

test('advanceMonsters ages and retiers', () => {
	const out = advanceMonsters([m({ ageSec: 1790 })], 20, () => 0.99, null);
	assert.equal(out[0].ageSec, 1810);
	assert.equal(out[0].tier, 2);
});

test('a frozen monster does not age', () => {
	const out = advanceMonsters([m({ id: 7, ageSec: 100 })], 500, () => 0.99, 7);
	assert.equal(out[0].ageSec, 100);
});

test('advanceMonsters does not mutate its input', () => {
	const input = Object.freeze([Object.freeze(m({ ageSec: 5 }))]) as Monster[];
	advanceMonsters(input, 10, () => 0, null);
});

test('evolution needs tier 5 age: a young rat never evolves even with a lucky roll', () => {
	const out = advanceMonsters([m({ ageSec: TIER5_AGE - 1000 })], 900, () => 0, null);
	assert.equal(out[0].type, 'rat');
});

test('a tier-5 rat evolves when it crosses a check boundary with a lucky roll, not with an unlucky one', () => {
	const before = m({ ageSec: TIER5_AGE + 590 });
	assert.equal(advanceMonsters([before], 20, () => 0, null)[0].type, 'ratKing');
	assert.equal(advanceMonsters([before], 20, () => 0.99, null)[0].type, 'rat');
	// no boundary crossed -> no roll
	assert.equal(advanceMonsters([m({ ageSec: TIER5_AGE + 100 })], 20, () => 0, null)[0].type, 'rat');
});

test('only one king ever exists', () => {
	const rats = [
		m({ id: 1, x: 1, y: 1, ageSec: TIER5_AGE + 590 }),
		m({ id: 2, x: 2, y: 2, ageSec: TIER5_AGE + 590 }),
	];
	const out = advanceMonsters(rats, 20, () => 0, null);
	assert.equal(out.filter((x) => x.type === 'ratKing').length, 1);
	const withKing = advanceMonsters([...rats, m({ id: 3, type: 'ratKing' })], 20, () => 0, null);
	assert.equal(withKing.filter((x) => x.type === 'ratKing').length, 1);
});

test('evolution keeps the tile and id', () => {
	const out = advanceMonsters([m({ id: 9, x: 3, y: 4, ageSec: TIER5_AGE + 595 })], 10, () => 0, null);
	assert.equal(out[0].type, 'ratKing');
	assert.equal(out[0].id, 9);
	assert.equal(out[0].x, 3);
	assert.equal(out[0].y, 4);
	assert.equal(out[0].tier, 1);
});

test('tierSecondsLeft counts down to the next tier and is null at the cap and for the king', () => {
	assert.equal(tierSecondsLeft(m({ ageSec: 600 })), COMBAT.tierIntervalSec - 600);
	assert.equal(tierSecondsLeft(m({ tier: 5, ageSec: TIER5_AGE })), null);
	assert.equal(tierSecondsLeft(m({ type: 'ratKing' })), null);
});

// ---- monsters scale with the world (castle) level on the same curve as item level -------------------------------------
import { monsterLevel, monsterPower, monsterStats } from '../src/lib/monsters';
import { LOOT_SOURCES } from '../src/catalog/lootConfig';
import { resolveSourceLevel } from '../src/lib/loot/generate';
import { newFight, stepFight } from '../src/lib/combat';
import { levelScale } from '../src/catalog/stats';

test('monster level is the level its loot drops at, and the world level only ever raises it', () => {
	for (const type of ['rat', 'ratKing'] as const) {
		for (const tier of [1, 3, 5]) {
			assert.equal(monsterLevel(type, tier, 4), resolveSourceLevel(LOOT_SOURCES[type].level, type === 'ratKing' ? 1 : tier, 4));
			assert.ok(monsterLevel(type, tier, 5) > monsterLevel(type, tier, 1));
		}
	}
});

test('at castle level 1 every monster number is exactly what it always was; higher castle levels scale HP and attack, not rewards', () => {
	for (const type of ['rat', 'ratKing'] as const) {
		for (const tier of [1, 2, 3, 4, 5]) {
			assert.equal(monsterPower(type, tier, 1), 1);
			assert.deepEqual(monsterStats(type, tier, 1), monsterStats(type, tier));
		}
	}
	assert.deepEqual([1, 2, 3, 4, 5].map((t) => monsterStats('rat', t).maxHp), [100, 150, 225, 338, 506]);
	assert.equal(monsterStats('ratKing', 1).maxHp, 15600);
	const strong = monsterStats('rat', 3, 6);
	const base = monsterStats('rat', 3, 1);
	const power = levelScale(monsterLevel('rat', 3, 6)) / levelScale(monsterLevel('rat', 3, 1));
	assert.equal(strong.maxHp, Math.round(base.maxHp * power));
	assert.equal(strong.attack, Math.round(4 * Math.pow(1.25, 2) * power));
	assert.equal(strong.attackIntervalSec, base.attackIntervalSec);
	assert.equal(strong.rewardSec, base.rewardSec);
	for (let c = 2; c <= 10; c++) assert.ok(monsterStats('ratKing', 1, c).maxHp > monsterStats('ratKing', 1, c - 1).maxHp);
});

test('a fight keeps the castle level it started at: HP and attack are fixed for its whole length', () => {
	const fight = newFight({ id: 1, type: 'rat', tier: 3 }, 6);
	assert.equal(fight.castleLevel, 6);
	assert.equal(fight.monsterMaxHp, monsterStats('rat', 3, 6).maxHp);
	const plain = newFight({ id: 1, type: 'rat', tier: 3 });
	assert.equal(plain.castleLevel, 1);
	const hpAfter = (start: typeof fight) => {
		let f = start;
		let hp = 1000;
		for (let i = 0; i < 6; i++) ({ fight: f, playerHp: hp } = stepFight(f, 1, hp, 0, () => 0));
		return hp;
	};
	assert.ok(hpAfter(fight) < hpAfter(plain), 'a stronger monster hits harder');
});
