import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { plainItem } from '../src/lib/itemInstance';
import { atItemLevel, fullSet, seeded, simulateMany, spentCharacter } from '../src/lib/fightSim';
import type { Equipment } from '../src/types/game';

// The Rat King is the MVP monster: fights are not rate limited, so the tuning is checked by simulating a bot that clicks at a
// steady speed with the real combat rules. docs/generated/fight-sim.md (npm run fight-sim) has the full tables.
// More monsters will come: nothing here may depend on the King's numbers except the King rows below.

const KING = { type: 'ratKing', level: 15 } as const;
const RUNS = 40;
const sim = (equipment: Equipment, cps: number, monster: { type: 'rat' | 'ratKing'; level: number } = KING) =>
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

test('rats are basic enemies: a level 1 rat falls to the starter kit even at a slow pace, a level 9 rat still beats a slow clicker', () => {
	assert.equal(sim(STARTER_EQUIPMENT, 2, { type: 'rat', level: 1 }).winRate, 1);
	assert.ok(sim(STARTER_EQUIPMENT, 1, { type: 'rat', level: 9 }).winRate < 0.5);
	assert.equal(sim(RATTATUI, 4, { type: 'rat', level: 9 }).winRate, 1);
});

// ---- attribute builds (25 spare points is about level 30) --------------------------------------------------------------------

const simAs = (character: ReturnType<typeof spentCharacter>, equipment: Equipment, cps: number, monster: { type: 'rat' | 'ratKing'; level: number } = KING) =>
	simulateMany({ equipment, monster: { ...monster }, cps, character }, RUNS, seeded(11 + cps));

test('spending points pays off: 25 Strength makes a physical weapon clearly faster, 25 Intelligence does the same for a magic weapon, and the wrong stat does nothing', () => {
	const maul = OBSIDIAN;
	const staff = fullSet('obsidian', 'obsidian_staff');
	const none = spentCharacter({});
	const strong = spentCharacter({ strength: 25 });
	const wise = spentCharacter({ intelligence: 25 });
	const base = simAs(none, maul, 10).meanTimeSec;
	assert.ok(simAs(strong, maul, 10).meanTimeSec < base * 0.8, 'Strength speeds up the maul');
	assert.ok(Math.abs(simAs(wise, maul, 10).meanTimeSec - base) < base * 0.05, 'Intelligence does nothing for a maul');
	const staffBase = simAs(none, staff, 15).meanTimeSec;
	assert.ok(simAs(wise, staff, 15).meanTimeSec < staffBase * 0.8, 'Intelligence speeds up the staff');
	// Strength gives a staff no damage (tests/stats.test.ts), only its share of crit damage: far less than Intelligence does
	assert.ok(simAs(strong, staff, 15).meanTimeSec > staffBase * 0.92, 'Strength barely helps a staff');
});

test('points never trivialise the king: even a level 30 Strength build with the best loadout needs several seconds at an auto-clicker speed', () => {
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	const r = simAs(spentCharacter({ strength: 25 }), best, 25);
	assert.ok(r.meanTimeSec >= 6, `${r.meanTimeSec} s`);
	// and the starter kit with the same points still does not win by clicking alone
	assert.equal(simAs(spentCharacter({ strength: 25 }), STARTER_EQUIPMENT, 25).winRate, 0);
});

test('defense points matter: Vitality and Dexterity let a level 9 rat fight go better than none', () => {
	const rat5 = { type: 'rat', level: 9 } as const;
	const bare = simAs(spentCharacter({}), STARTER_EQUIPMENT, 3, rat5);
	const tank = simAs(spentCharacter({ vitality: 25, dexterity: 10 }), STARTER_EQUIPMENT, 3, rat5);
	assert.ok(tank.winRate >= bare.winRate);
	assert.ok(Number.isNaN(tank.meanHpLeft) || Number.isNaN(bare.meanHpLeft) || tank.meanHpLeft > bare.meanHpLeft, 'more HP left after the fight');
});

// ---- skills (Heal under 50 % HP and Stun on cooldown, cast by the bot at level 30) --------------------------------------------

const withSkills = (equipment: Equipment, cps: number, monster: { type: 'rat' | 'ratKing'; level: number } = KING, skillLevel = 30) =>
	simulateMany({ equipment, monster: { ...monster }, cps, skillLevel }, RUNS, seeded(7 + cps));

test('skills make a close fight winnable but never replace gear: steel wins about two clicks per second sooner, the starter kit still never beats the king', () => {
	assert.equal(sim(STEEL, 10).winRate, 0, 'without skills steel loses at 10 cps');
	assert.ok(withSkills(STEEL, 10).winRate > 0.9, 'Heal and Stun carry it over the line');
	assert.equal(withSkills(STEEL, 7).winRate, 0, 'but a slow clicker still loses');
	const wood = fullSet('woodland', 'wooden_club');
	for (const cps of [7, 15, 25]) assert.equal(withSkills(STARTER_EQUIPMENT, cps).winRate, 0, `starter at ${cps} cps`);
	for (const cps of [7, 15, 20]) assert.equal(withSkills(wood, cps).winRate, 0, `woodland at ${cps} cps`);
	// only a perfect 25 clicks per second with perfect casting scrapes past it, with seconds to spare and a sliver of HP
	const scrape = withSkills(wood, 25);
	assert.ok(scrape.winRate === 0 || (scrape.meanTimeSec > MONSTERS.ratKing.timeLimitSec * 0.8 && scrape.meanHpLeft < 0.15), `${scrape.meanTimeSec} s, ${scrape.meanHpLeft} HP left`);
});

test('skills only ever help the bot, and cost it no time: damage is still the clicks', () => {
	for (const [gear, cps] of [[STEEL, 12], [STEEL, 15], [OBSIDIAN, 7], [RATTATUI, 7]] as const) {
		const plain = sim(gear, cps);
		const skilled = withSkills(gear, cps);
		assert.ok(skilled.winRate >= plain.winRate);
		assert.ok(skilled.meanHpLeft >= plain.meanHpLeft - 0.01, `${cps} cps: ${skilled.meanHpLeft} vs ${plain.meanHpLeft}`);
		assert.ok(Math.abs(skilled.meanTimeSec - plain.meanTimeSec) < plain.meanTimeSec * 0.02, 'skills do no damage');
	}
});

test('the skills do not trivialise the king: the best loadout at 25 clicks per second still needs several seconds', () => {
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	assert.ok(withSkills(best, 25).meanTimeSec >= 6);
});

test('a skill the character has not unlocked is never cast: at level 4 the bot has neither, at level 5 only Heal', () => {
	const plain = sim(STEEL, 10);
	assert.equal(withSkills(STEEL, 10, KING, 4).winRate, plain.winRate);
	assert.equal(withSkills(STEEL, 10, KING, 4).meanHpLeft || 0, plain.meanHpLeft || 0);
	assert.ok(withSkills(STEEL, 10, KING, 5).winRate <= withSkills(STEEL, 10, KING, 30).winRate, 'Stun adds to Heal');
});

// ---- the Rat King by level: killable at every level he can have, never trivial -------------------------------------------------

const kingAt = (level: number) => ({ type: 'ratKing', level }) as const;
const simKing = (equipment: Equipment, level: number, cps: number) =>
	simulateMany({ equipment, monster: { ...kingAt(level) }, cps }, 30, seeded(5 + cps));

test('the Rat King is killable at every level he can have (15 to 35): matching obsidian gear wins at a steady pace, and the gear curve keeps him fair', () => {
	for (const level of [15, 25, 35]) {
		const matching = simKing(atItemLevel(OBSIDIAN, level), level, 7);
		assert.ok(matching.winRate >= 0.9, `obsidian at item level ${level} vs the King at ${level}: ${matching.winRate}`);
		assert.ok(matching.meanTimeSec > 30, `${level}: not a pushover (${matching.meanTimeSec} s)`);
	}
	// gear that fell behind (item level 15 against a level 35 King) is harder but still wins at a human pace with the best set
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	assert.ok(simKing(atItemLevel(best, 15), 35, 10).winRate >= 0.9);
	assert.ok(simKing(atItemLevel(OBSIDIAN, 15), 35, 10).winRate >= 0.9);
});

test('no level of the King is trivial: the best loadout at 25 clicks per second needs several seconds, and weak gear never wins', () => {
	const best = { ...RATTATUI, mainHand: plainItem('titan_maul') };
	for (const level of [15, 25, 35]) {
		assert.ok(simKing(atItemLevel(best, level), level, 25).meanTimeSec >= 5, `${level}`);
		for (const cps of [10, 25]) {
			assert.equal(simKing(STARTER_EQUIPMENT, level, cps).winRate, 0, `starter kit vs the King at ${level}, ${cps} cps`);
			assert.equal(simKing(fullSet('woodland', 'wooden_club'), level, cps).winRate, 0, `plain wood vs the King at ${level}, ${cps} cps`);
		}
	}
});
