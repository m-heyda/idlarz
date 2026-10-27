import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { plainItem } from '../src/lib/itemInstance';
import { fullSet, seeded, simulateMany } from '../src/lib/fightSim';
import type { Equipment } from '../src/types/game';

// The Rat King is the MVP monster: fights are not rate limited, so the tuning is checked by simulating a bot that clicks at a
// steady speed with the real combat rules. docs/generated/fight-sim.md (npm run fight-sim) has the full tables.
// More monsters will come: nothing here may depend on the King's numbers except the King rows below.

const KING = { type: 'ratKing', tier: 1 } as const;
const RUNS = 40;
const sim = (equipment: Equipment, cps: number, monster: { type: 'rat' | 'ratKing'; tier: number } = KING) =>
	simulateMany({ equipment, monster: { ...monster }, cps }, RUNS, seeded(7 + cps));

const OBSIDIAN = fullSet('obsidian', 'obsidian_maul');
const STEEL = fullSet('knight', 'steel_mace');
const RATTATUI = fullSet('rattatui');

test('no item exceeds the damage sanity ceiling', () => {
	for (const def of Object.values(ITEM_CATALOG)) assert.ok((def.stats?.damage ?? 0) <= COMBAT.maxItemDamage, def.id);
});

test('the starter kit and plain wood never beat the king, not even at an auto-clicker speed', () => {
	for (const cps of [7, 15, 25]) {
		assert.equal(sim(STARTER_EQUIPMENT, cps).winRate, 0, `starter at ${cps} cps`);
		assert.equal(sim(fullSet('woodland', 'wooden_club'), cps).winRate, 0, `woodland at ${cps} cps`);
	}
});

test('steel needs fast clicking: it loses at a normal pace and wins when the clicker is very quick', () => {
	assert.equal(sim(STEEL, 7).winRate, 0);
	assert.equal(sim(STEEL, 10).winRate, 0);
	assert.ok(sim(STEEL, 15).winRate > 0.9);
});

test('obsidian wins at a steady pace, Rattatui comfortably, and the best loadout is quicker still', () => {
	assert.equal(sim(OBSIDIAN, 4).winRate, 0);
	assert.ok(sim(OBSIDIAN, 7).winRate > 0.8);
	assert.ok(sim(RATTATUI, 7).winRate > 0.95);
	assert.ok(sim(RATTATUI, 7).meanTimeSec < MONSTERS.ratKing.timeLimitSec * 0.85);
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	assert.ok(sim(best, 7).meanTimeSec < sim(RATTATUI, 7).meanTimeSec);
});

test('no loadout trivialises the king: even the best gear at 25 clicks per second needs several seconds', () => {
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	assert.ok(sim(best, 25).meanTimeSec >= 6, `${sim(best, 25).meanTimeSec} s`);
});

test('rats are basic enemies: a tier-1 rat falls to the starter kit even at a slow pace, a tier-5 rat still beats a slow clicker', () => {
	assert.equal(sim(STARTER_EQUIPMENT, 2, { type: 'rat', tier: 1 }).winRate, 1);
	assert.ok(sim(STARTER_EQUIPMENT, 1, { type: 'rat', tier: 5 }).winRate < 0.5);
	assert.equal(sim(RATTATUI, 4, { type: 'rat', tier: 5 }).winRate, 1);
});
