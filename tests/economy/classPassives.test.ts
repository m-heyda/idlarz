// Class passives (IDL-70): one test per passive, the caps, and the proof that the class is the profile row's, not the upload's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { honestGame, memoryRepo, T0 } from '../audit/cheats';
import { fullSet } from '../../src/lib/fightSim';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave } from '../../src/lib/cloudSave/pipeline';
import { summarize } from '../../src/lib/cloudSave/summary';
import { bankContext } from '../../src/lib/offline/service';
import { chestIntervalSec } from '../../src/lib/luck';
import { classPassives, classXpBucket, withClassBonus } from '../../src/lib/classPassives';
import { armorOf, maxMana, NO_COMBAT_BONUS } from '../../src/lib/combat';
import { effectiveStats } from '../../src/lib/effectiveStats';
import { xpGainPct } from '../../src/lib/gearEconomy';
import { healAmount } from '../../src/lib/skills';
import { offlineEfficiency } from '../../src/lib/offline/limits';
import { playerProfile } from '../../src/lib/offline/profile';
import { effectiveTileDiscount } from '../../src/utils/game/rebirth';
import { PERK_CAPS } from '../../src/catalog/perkCaps';
import { HARD_LIMITS } from '../../src/config/limits';
import { REBIRTH } from '../../src/config/rebirth';
import { INITIAL_CHARACTER_STATS } from '../../src/config/character';
import type { PersistedGame } from '../../src/lib/sanitizeSave';
import type { StoredSave } from '../../src/lib/cloudSave/pipeline';

const stats = { ...INITIAL_CHARACTER_STATS };
const core = (playerClass?: string) => ({
	characterStats: { strength: 5, dexterity: 5, intelligence: 5, vitality: 5, charisma: 5 },
	equipment: {},
	merchantUpgrades: {},
	resources: { xp: 0 },
	...(playerClass ? { playerClass } : {}),
});
const delta = (pick: (profile: ReturnType<typeof playerProfile>) => number, playerClass: string) =>
	pick(playerProfile(core(playerClass))) - pick(playerProfile(core()));

test('the decided numbers: one economy and one combat passive per class', () => {
	const nonZero = (c: string) => Object.entries(classPassives(c)).filter(([, v]) => v !== 0);
	assert.deepEqual(nonZero('warrior'), [
		['armor', 2],
		['tileDiscountPct', 3],
	]);
	assert.deepEqual(nonZero('paladin'), [
		['hpRegen', 0.25],
		['offlineEffPct', 5],
	]);
	assert.deepEqual(nonZero('ranger'), [
		['critPct', 2],
		['chestSpeedPct', 5],
	]);
	assert.deepEqual(nonZero('mage'), [
		['maxMana', 8],
		['spellPowerPct', 5],
		['xpPct', 5],
	]);
	assert.deepEqual(nonZero('necromancer'), [], 'an unknown class gives nothing');
	assert.deepEqual(Object.values(classPassives(undefined)).filter(Boolean), [], 'no class gives nothing');
});

test('Warrior: +2 armor in the fight profile and in the Character window', () => {
	assert.equal(
		delta((p) => p.armor, 'warrior'),
		2,
	);
	assert.equal(armorOf({}, stats, 'warrior') - armorOf({}, stats), 2);
	assert.equal(
		effectiveStats({ characterStats: stats, equipment: {}, playerClass: 'warrior' }).armor - effectiveStats({ characterStats: stats, equipment: {} }).armor,
		2,
	);
});

test('Warrior: +3 points of tile discount, inside the 45 % cap shared with Charisma, Thrift and Bulk', () => {
	const charisma = { tileCostDiscount: 10 };
	assert.equal(effectiveTileDiscount(charisma, undefined, {}, 'warrior') - effectiveTileDiscount(charisma, undefined, {}), 3);
	const rich = { rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { thrift: 50 } };
	assert.equal(effectiveTileDiscount({ tileCostDiscount: 25 }, rich, { bulk: 50 }), REBIRTH.discountCapPercent);
	assert.equal(effectiveTileDiscount({ tileCostDiscount: 25 }, rich, { bulk: 50 }, 'warrior'), REBIRTH.discountCapPercent, 'at the cap the class adds nothing');
	assert.equal(
		effectiveStats({ characterStats: { ...stats, tileCostDiscount: 5 }, equipment: {}, playerClass: 'warrior' }).tileDiscount,
		8,
		'the window shows the same discount the purchase uses',
	);
});

test('Paladin: +0.25 HP/s regeneration, in fights too (the profile holds it)', () => {
	assert.equal(
		delta((p) => p.hpRegen, 'paladin'),
		0.25,
	);
	assert.equal(withClassBonus(NO_COMBAT_BONUS, 'paladin').regen, 0.25);
	assert.equal(
		effectiveStats({ characterStats: stats, equipment: {}, playerClass: 'paladin' }).hpRegen - effectiveStats({ characterStats: stats, equipment: {} }).hpRegen,
		0.25,
	);
});

test('Paladin: +5 points of offline efficiency (50 % to 55 %), under the hard limit', () => {
	assert.ok(Math.abs(offlineEfficiency({ playerClass: 'paladin' }) - offlineEfficiency() - 0.05) < 1e-12);
	assert.ok(Math.abs(offlineEfficiency({ playerClass: 'paladin' }) - 0.55) < 1e-12);
	// the server's summary (what an offline grant pays from) carries it
	const state = honestGame();
	assert.ok(
		Math.abs(
			summarize({ ...state, playerClass: 'paladin' }).derived.offlineEfficiency -
				summarize({ ...state, playerClass: 'warrior' }).derived.offlineEfficiency -
				0.05,
		) < 1e-12,
	);
});

test('Ranger: +2 crit chance points in the profile and the window', () => {
	assert.ok(Math.abs(delta((p) => p.crit, 'ranger') - 0.02) < 1e-12);
	assert.ok(
		Math.abs(
			effectiveStats({ characterStats: stats, equipment: {}, playerClass: 'ranger' }).critChance -
				effectiveStats({ characterStats: stats, equipment: {} }).critChance -
				2,
		) < 1e-9,
	);
});

test('Ranger: +5 % chest speed shortens the chest interval on the server (the ticket bank) and shows in the window', () => {
	assert.ok(Math.abs(chestIntervalSec(0, 5) - chestIntervalSec(0) / 1.05) < 1e-9);
	const stored = (playerClass?: string) =>
		({ core: playerClass ? { playerClass } : {}, summary: { derived: { luck: 0 }, tilesOwned: 1, castleLevel: 1 } }) as unknown as StoredSave;
	assert.equal(bankContext(stored('ranger')).chestSpeedPct, 5);
	assert.equal(bankContext(stored('warrior')).chestSpeedPct, 0);
	assert.ok(effectiveStats({ characterStats: stats, equipment: {}, playerClass: 'ranger' }).chestRateBonus > 4.7);
});

test('Mage: +8 max mana and +5 % spell power (the heal) in the profile', () => {
	assert.equal(
		delta((p) => p.maxMp, 'mage'),
		8,
	);
	assert.equal(maxMana(stats, {}, 'mage') - maxMana(stats, {}), 8);
	const big = { ...stats, hp: 1000 };
	assert.ok(Math.abs(healAmount(big, {}, undefined, 'mage') / healAmount(big, {}) - 1.05) < 0.01, 'a big heal shows the 5 %');
	assert.equal(effectiveStats({ characterStats: stats, equipment: {}, playerClass: 'mage' }).spellPower, 5);
});

test('Mage: +5 % XP gain in the summary, inside the XP perk cap', () => {
	assert.equal(xpGainPct({ xpGainMultiplier: 5 }, {}, 'mage'), 10);
	const state = honestGame();
	assert.equal(summarize({ ...state, playerClass: 'mage' }).xpGainPct - summarize({ ...state, playerClass: 'warrior' }).xpGainPct, 5);
	assert.equal(classXpBucket(10, 'mage'), 15);
	assert.equal(classXpBucket(10, 'warrior'), 10);
});

test('the caps hold for every class: tile discount, XP bucket and offline efficiency never pass their limits, however much else stacks', () => {
	const rich = { rebirths: 1, legacyPoints: 0, legacyEarned: 0, upgrades: { thrift: 50 } };
	for (const c of ['warrior', 'paladin', 'ranger', 'mage']) {
		assert.ok(effectiveTileDiscount({ tileCostDiscount: 25 }, rich, { bulk: 50 }, c) <= REBIRTH.discountCapPercent, c);
		assert.ok(classXpBucket(1000, c) <= PERK_CAPS.xpPct, c);
		assert.ok(offlineEfficiency({ playerClass: c, gear: { offlineEff: 500, offlineCapHours: 0 } }) <= HARD_LIMITS.offlineEfficiency, c);
	}
	assert.equal(classXpBucket(PERK_CAPS.xpPct, 'mage'), PERK_CAPS.xpPct, 'gear already at the XP cap: the class adds nothing');
	assert.equal(classXpBucket(PERK_CAPS.xpPct - 2, 'mage'), PERK_CAPS.xpPct);
	assert.ok(xpGainPct({ xpGainMultiplier: 0 }, fullSet('obsidian'), 'mage') <= PERK_CAPS.xpPct);
});

test("the class is the profile row's: the save route stamps it over whatever the upload claimed", async () => {
	const { repo, rows } = memoryRepo();
	const claimed: PersistedGame = { ...honestGame(), playerClass: 'mage' };
	const outcome = await acceptSave(repo, 'u', 'Z', encodeSave(claimed), 0, T0, false, null, undefined, 'warrior');
	assert.equal(outcome.kind, 'ok');
	const stored = rows.get('u')!;
	assert.equal(stored.core.playerClass, 'warrior', "the stored copy carries the profile row's class");
	assert.equal(stored.summary.xpGainPct, summarize({ ...claimed, playerClass: 'warrior' }).xpGainPct, 'and the summary was worked out from it');
	const profile = playerProfile(stored.core as Record<string, unknown>);
	assert.equal(profile.armor - playerProfile({ ...stored.core, playerClass: undefined } as Record<string, unknown>).armor, 2, 'the fight profile reads it');
});
