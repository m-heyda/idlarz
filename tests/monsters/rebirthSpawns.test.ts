// Spawns after rebirths (owner 2026-11-27): the window and cap rise 4 levels per rebirth, normals stand up to 40 tiles out, a boss comes after 1.5 h (1 h from the third rebirth), the Ember shop's Wild Growth shortens the growth interval.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS, NORMAL_MAX_DISTANCE } from '../../src/config/combatConfig';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { EMBER_UPGRADES } from '../../src/config/rebirth';
import { limitOf } from '../../src/lib/limits';
import { canSpawnOn, levelAtAge, rebirthLevelBonus, rollSpawnLevel, spawnLevelRange } from '../../src/lib/monsters';
import { bossIntervalSec, ticketCap, ticketCapMax } from '../../src/lib/offline/tickets';
import type { PrestigeState } from '../../src/types/game';

const prestige = (wildgrowth: number): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { wildgrowth } });

test('every completed rebirth lifts the spawn window by 4 levels; a first run is unchanged', () => {
	assert.equal(rebirthLevelBonus(0), 0);
	assert.equal(rebirthLevelBonus(4), 16);
	assert.equal(rebirthLevelBonus(-2), 0);
	assert.equal(rebirthLevelBonus(NaN), 0);
	assert.deepEqual(spawnLevelRange('thistleBoar', 5, 0), spawnLevelRange('thistleBoar', 5));
	const base = spawnLevelRange('thistleBoar', 5);
	assert.deepEqual(spawnLevelRange('thistleBoar', 5, 4), { min: base.min + 16, max: base.max + 16 });
});

test('the spawn cap rises with the rebirths, so a plains monster can reach past level 10 and is still rolled inside its window', () => {
	const cap = MONSTERS.thistleBoar.spawnWindow.cap;
	for (let id = 1; id <= 80; id++) {
		const level = rollSpawnLevel('thistleBoar', 10, id, 0, undefined, 4);
		assert.ok(level > cap, `level ${level} is above the first-run cap of ${cap}`);
		assert.ok(level <= cap + 16);
	}
	assert.equal(rollSpawnLevel('thistleBoar', 5, 9, 12), rollSpawnLevel('thistleBoar', 5, 9, 12, undefined, 0), 'no rebirths: same as before');
});

test("a weak hero's cap still pulls the roll down after rebirths, never below the lifted window bottom", () => {
	const lo = spawnLevelRange('thistleBoar', 5, 4).min;
	for (let id = 1; id <= 40; id++) assert.equal(rollSpawnLevel('thistleBoar', 5, id, 0, 1, 4), lo);
});

test('normal monsters stand 2 to 40 tiles out, so the rebirth biomes (10 to 22 tiles out) hold normal monsters', () => {
	assert.equal(NORMAL_MAX_DISTANCE, 40);
	const on = (type: keyof typeof MONSTERS, d: number, biome: string, rebirths: number) => canSpawnOn(type, CASTLE_X + d, CASTLE_Y, { biome }, 1, rebirths);
	assert.equal(on('thistleBoar', 30, 'plains', 0), true);
	assert.equal(on('thistleBoar', 41, 'plains', 0), false);
	assert.equal(on('skullVine', 12, 'jungle', 1), true, 'a jungle monster on jungle land 12 tiles out after the first rebirth');
	assert.equal(on('skullVine', 12, 'jungle', 0), false, 'not before the first rebirth');
});

test('farther bands add levels on top of the danger bonus: frontier +1, wilds +2', () => {
	const near = rollSpawnLevel('thistleBoar', 1, 7, 0, undefined, 4);
	assert.equal(rollSpawnLevel('thistleBoar', 1, 7, 16, undefined, 4), near + 2 + 1, 'distance 16: +2 (danger) +1 (frontier)');
	assert.equal(rollSpawnLevel('thistleBoar', 1, 7, 24, undefined, 4), near + 3 + 2, 'distance 24: +3 (danger) +2 (wilds)');
});

test('a boss comes every 1.5 hours, every hour from the third rebirth, and Luck still halves it at most', () => {
	assert.equal(COMBAT.spawn.bossIntervalSec, 5400);
	assert.equal(bossIntervalSec(0, 0), 5400);
	assert.equal(bossIntervalSec(0, 2), 5400);
	assert.equal(bossIntervalSec(0, 3), 3600);
	assert.equal(bossIntervalSec(0, 9), 3600);
	assert.ok(bossIntervalSec(1_000_000, 3) >= 1800 - 1e-6, 'Luck cuts it to half at most');
});

test('Wild Growth: -60 s per level on the 15 minutes a monster needs to grow, 5 minutes at level 10', () => {
	assert.equal(EMBER_UPGRADES.wildgrowth.maxLevel, 10);
	assert.equal(limitOf('monsterGrowthIntervalSec', {}), LIMITS.monsterGrowthIntervalSec);
	assert.equal(limitOf('monsterGrowthIntervalSec', { prestige: prestige(1) }), 840);
	assert.equal(limitOf('monsterGrowthIntervalSec', { prestige: prestige(10) }), 300);
	assert.equal(limitOf('monsterGrowthIntervalSec', { prestige: prestige(99) }), 300, 'never below five minutes');
	assert.equal(levelAtAge(10, 3000, {}), 13);
	assert.equal(levelAtAge(10, 3000, { prestige: prestige(10) }), 20, 'the same age gives +10 (the growth cap) at level 10');
});

test('more monsters and chests can wait after rebirths: 40 in a first run, 10 more per rebirth, 100 at most', () => {
	assert.equal(ticketCapMax(0), 40);
	assert.equal(ticketCapMax(1), 50);
	assert.equal(ticketCapMax(4), 80);
	assert.equal(ticketCapMax(6), 100);
	assert.equal(ticketCapMax(50), 100);
	assert.equal(ticketCapMax(NaN), 40);
	const wide = { luck: 0, tilesOwned: 20_000, lakesOwned: 0, castleLevel: 10 };
	assert.equal(ticketCap(wide), 40, 'a first run keeps the old cap');
	assert.equal(ticketCap({ ...wide, rebirths: 4 }), 80);
	const small = { luck: 0, tilesOwned: 60, lakesOwned: 0, castleLevel: 1, rebirths: 5 };
	assert.ok(ticketCap(small) < 40, 'a small map is still limited by its share of the free land');
});

test('the Ember shop Battle Queue adds 2 places per level (2, 4, 6, 8, 10) up to the hard limit, and a first run keeps 10', () => {
	const owned = (level: number): PrestigeState => ({ rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { battlequeue: level } });
	assert.equal(limitOf('battleQueue'), 10);
	assert.equal(limitOf('battleQueue', { prestige: owned(1) }), 12);
	assert.equal(limitOf('battleQueue', { prestige: owned(3) }), 16);
	assert.equal(limitOf('battleQueue', { prestige: owned(5) }), 20);
	assert.equal(limitOf('battleQueue', { prestige: owned(99) }), 20, 'five levels at most');
	assert.equal(EMBER_UPGRADES.battlequeue.maxLevel, 5);
	assert.ok(limitOf('battleQueue', { hardCap: true }) >= 20 && HARD_LIMITS.battleQueue >= 20);
});
