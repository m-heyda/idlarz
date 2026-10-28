import test from 'node:test';
import assert from 'node:assert/strict';
import { COMBAT, MONSTERS } from '../src/config/combatConfig';
import { ITEM_CATALOG, STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { plainItem } from '../src/lib/itemInstance';
import { atItemLevel, fullSet, simulateMany, spentCharacter } from '../src/lib/fightSim';
import type { Equipment } from '../src/types/game';

// The fights run on the server's engine (lib/offline/fight.ts) with the player swinging at the weapon's attack speed: nobody clicks, so
// the tuning is gear, attributes, potions and skills. docs/generated/fight-sim.md (npm run fight-sim) has the full tables.
// More monsters will come: nothing here may depend on the King's numbers except the King rows below.

type Foe = { type: 'rat' | 'ratKing'; level: number };
const KING: Foe = { type: 'ratKing', level: 15 };
const RUNS = 12;
const sim = (equipment: Equipment, monster: Foe = KING, extra: { level?: number; autoUse?: boolean; potions?: { id: string; qty: number }[] } = {}) =>
	simulateMany({ equipment, monster: { ...monster }, autoUse: false, ...extra }, RUNS, `bal-${monster.type}-${monster.level}`);

const OBSIDIAN = fullSet('obsidian', 'obsidian_maul');
const STEEL = fullSet('knight', 'steel_mace');
const RATTATUI = fullSet('rattatui');
const WOOD = fullSet('woodland', 'wooden_club');
const BEST = { ...RATTATUI, mainHand: plainItem('titan_maul') };

test('no item exceeds the damage sanity ceiling', () => {
	for (const def of Object.values(ITEM_CATALOG)) assert.ok((def.stats?.damage ?? 0) <= COMBAT.maxItemDamage, def.id);
});

test('the starter kit and plain wood never beat the king, with or without skills and potions', () => {
	for (const gear of [STARTER_EQUIPMENT, WOOD]) {
		assert.equal(sim(gear).winRate, 0);
		assert.equal(sim(gear, KING, { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 20 }] }).winRate, 0);
	}
});

test('steel is not enough for the king (the clock beats it), obsidian wins with the clock running down, Rattatui comfortably', () => {
	assert.ok(sim(STEEL).winRate < 0.5, `steel: ${sim(STEEL).winRate}`);
	const obsidian = sim(OBSIDIAN);
	assert.ok(obsidian.winRate >= 0.9, `obsidian: ${obsidian.winRate}`);
	assert.ok(obsidian.meanTimeSec > MONSTERS.ratKing.timeLimitSec * 0.5, `${obsidian.meanTimeSec} s: not a pushover`);
	const rattatui = sim(RATTATUI);
	assert.ok(rattatui.winRate >= 0.95);
	assert.ok(rattatui.meanTimeSec < MONSTERS.ratKing.timeLimitSec * 0.6, `${rattatui.meanTimeSec} s`);
	assert.ok(sim(BEST).meanTimeSec > sim(RATTATUI).meanTimeSec * 0.8 || sim(BEST).winRate === 1, 'the best loadout wins too');
});

test('no loadout trivialises the king: even the best gear needs several seconds', () => {
	assert.ok(sim(BEST).meanTimeSec >= 15, `${sim(BEST).meanTimeSec} s`);
});

test('rats are basic enemies: a level 1 rat falls to the starter kit, a level 9 rat does not, and good gear wins either way', () => {
	assert.equal(sim(STARTER_EQUIPMENT, { type: 'rat', level: 1 }).winRate, 1);
	assert.equal(sim(STARTER_EQUIPMENT, { type: 'rat', level: 9 }).winRate, 0);
	assert.equal(sim(RATTATUI, { type: 'rat', level: 9 }).winRate, 1);
});

test('a faster weapon kills sooner at the same damage per second: the engine really swings at the weapon speed', () => {
	// same armor and set, the bow swings 1/s and the maul 0.6/s: damage per hit and speed trade off, but both are measured in the fight time
	const rat = { type: 'rat', level: 5 } as const;
	const slow = sim(fullSet('obsidian', 'obsidian_maul'), rat);
	const fast = sim(fullSet('obsidian', 'obsidian_longbow'), rat);
	assert.ok(fast.meanTimeSec < slow.meanTimeSec, `${fast.meanTimeSec} vs ${slow.meanTimeSec}`);
});

// ---- attribute builds (25 spare points is about level 30) --------------------------------------------------------------------

const simAs = (character: ReturnType<typeof spentCharacter>, equipment: Equipment, monster: Foe = KING) =>
	simulateMany({ equipment, monster: { ...monster }, character, autoUse: false }, RUNS, `build-${monster.type}`);

test('spending points pays off: 25 Strength makes a physical weapon clearly faster, 25 Intelligence does the same for a magic weapon, and the wrong stat does nothing', () => {
	const staff = fullSet('obsidian', 'obsidian_staff');
	const none = spentCharacter({});
	const strong = spentCharacter({ strength: 25 });
	const wise = spentCharacter({ intelligence: 25 });
	const rat = { type: 'rat', level: 9 } as const;
	const base = simAs(none, OBSIDIAN, rat).meanTimeSec;
	assert.ok(simAs(strong, OBSIDIAN, rat).meanTimeSec < base * 0.8, 'Strength speeds up the maul');
	assert.ok(Math.abs(simAs(wise, OBSIDIAN, rat).meanTimeSec - base) < base * 0.05, 'Intelligence does nothing for a maul');
	const staffBase = simAs(none, staff, rat).meanTimeSec;
	assert.ok(simAs(wise, staff, rat).meanTimeSec < staffBase * 0.8, 'Intelligence speeds up the staff');
	assert.ok(simAs(strong, staff, rat).meanTimeSec > staffBase * 0.92, 'Strength barely helps a staff');
});

test('points never trivialise the king: a level 30 Strength build with the best loadout still needs a good while, and the starter kit with the same points still does not win', () => {
	const r = simAs(spentCharacter({ strength: 25 }), BEST);
	assert.ok(r.meanTimeSec >= 12, `${r.meanTimeSec} s`);
	assert.equal(simAs(spentCharacter({ strength: 25 }), STARTER_EQUIPMENT).winRate, 0);
});

test('defense points matter: Vitality and Dexterity make a level 5 rat fight end with more HP left', () => {
	const rat = { type: 'rat', level: 5 } as const;
	const bare = simAs(spentCharacter({}), STARTER_EQUIPMENT, rat);
	const tank = simAs(spentCharacter({ vitality: 25, dexterity: 10 }), STARTER_EQUIPMENT, rat);
	assert.ok(tank.winRate >= bare.winRate);
	assert.ok(tank.meanHpLeft > bare.meanHpLeft, `${tank.meanHpLeft} vs ${bare.meanHpLeft}`);
});

// ---- auto-use (potions, Heal under 50 % HP, Stun on cooldown, from level 30) -----------------------------------------------------

test('auto-use never replaces gear: steel still does not beat the king with Heal, Stun and potions, and plain wood never does', () => {
	const kit = { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 10 }] };
	assert.ok(sim(STEEL, KING, kit).winRate < 0.6);
	assert.equal(sim(WOOD, KING, kit).winRate, 0);
});

test('auto-use only ever helps, and costs no time: skills do no damage', () => {
	const rat = { type: 'rat', level: 9 } as const;
	for (const gear of [STEEL, OBSIDIAN, RATTATUI]) {
		const plain = sim(gear, rat);
		const skilled = sim(gear, rat, { level: 30, autoUse: true });
		assert.ok(skilled.winRate >= plain.winRate);
		assert.ok(skilled.meanHpLeft >= plain.meanHpLeft - 0.01, `${skilled.meanHpLeft} vs ${plain.meanHpLeft}`);
		assert.ok(Math.abs(skilled.meanTimeSec - plain.meanTimeSec) < plain.meanTimeSec * 0.05, 'skills do no damage');
	}
});

test('potions carry a weak character through a fight it would lose, a skill that is not unlocked is never cast', () => {
	const rat = { type: 'rat', level: 9 } as const;
	assert.equal(sim(STARTER_EQUIPMENT, rat).winRate, 0);
	assert.equal(sim(STARTER_EQUIPMENT, rat, { level: 30, autoUse: true, potions: [{ id: 'potion_greater', qty: 5 }] }).winRate, 1);
	// at level 4 the bot has neither skill: the same sealed streams give the same fights as with auto-use off
	const off = sim(STEEL, rat);
	const lowLevel = sim(STEEL, rat, { level: 4, autoUse: true });
	assert.equal(lowLevel.winRate, off.winRate);
	assert.equal(lowLevel.meanHpLeft, off.meanHpLeft);
});

// ---- the Rat King by level: killable at every level he can have, never trivial -----------------------------------------------------

const kingAt = (level: number): Foe => ({ type: 'ratKing', level });

test('the Rat King is killable at every level he can have (15 to 35): matching gear wins, and the gear curve keeps him fair', () => {
	for (const level of [15, 25, 35]) {
		const matching = sim(atItemLevel(OBSIDIAN, level), kingAt(level));
		assert.ok(matching.winRate >= 0.9, `obsidian at item level ${level} vs the King at ${level}: ${matching.winRate}`);
		assert.ok(matching.meanTimeSec > 30, `${level}: not a pushover (${matching.meanTimeSec} s)`);
	}
	// gear that fell behind (item level 15 against a level 35 King) is harder: the best set still wins, obsidian no longer does
	assert.ok(sim(atItemLevel(BEST, 15), kingAt(35)).winRate >= 0.9);
	assert.ok(sim(atItemLevel(OBSIDIAN, 15), kingAt(35)).winRate < 0.5);
});

test('weak gear never beats the King at any level', () => {
	for (const level of [15, 25, 35]) {
		assert.equal(sim(STARTER_EQUIPMENT, kingAt(level)).winRate, 0, `starter kit vs the King at ${level}`);
		assert.equal(sim(WOOD, kingAt(level)).winRate, 0, `plain wood vs the King at ${level}`);
	}
});
