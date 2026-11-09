import test from 'node:test';
import assert from 'node:assert/strict';
import { BUFF_FAMILIES, describeEffect, healHpOf, healMpOf, type ConsumableEffect } from '../../src/catalog/buffs';
import { ITEM_CATALOG } from '../../src/catalog';
import {
	MAX_ACTIVE_BUFFS,
	activeBuffs,
	addBuff,
	buffTotals,
	clearBuffsOnRebirth,
	drink,
	readBuffs,
	type ActiveBuff,
	type DrinkState,
} from '../../src/lib/buffs';

type BuffEffect = Extract<ConsumableEffect, { kind: 'buff' }>;
const might = (amount = 10, durationSec = 120): BuffEffect => ({ kind: 'buff', family: 'might', stat: 'damagePct', amount, durationSec });
const haste = (amount = 8, durationSec = 120): BuffEffect => ({ kind: 'buff', family: 'haste', stat: 'atkSpeedPct', amount, durationSec });
const NOW = 1_000_000;

const state = (over: Partial<DrinkState> = {}): DrinkState => ({ hp: 50, maxHp: 100, mp: 10, maxMp: 60, buffs: [], ...over });

test('the two existing potions keep their ids and heal as before (data migration only)', () => {
	assert.equal(healHpOf(ITEM_CATALOG.potion_minor), 35);
	assert.equal(healHpOf(ITEM_CATALOG.potion_greater), 90);
	assert.equal(healMpOf(ITEM_CATALOG.potion_mana), 40);
	assert.equal(healHpOf(ITEM_CATALOG.potion_mana), 0);
	assert.equal(healHpOf(ITEM_CATALOG.preserved_rations), 0);
});

test('applies: a buff is recorded with its end time and the family stat', () => {
	const result = addBuff([], might(), NOW);
	assert.ok(result.ok);
	assert.deepEqual(result.buffs, [{ family: 'might', stat: 'damagePct', amount: 10, untilSec: NOW + 120 }]);
});

test('refreshes: the same family never stacks, the longer remaining time wins', () => {
	const first = addBuff([], might(10, 120), NOW);
	assert.ok(first.ok);
	// 60 s later a 120 s potion beats the 60 s left
	const longer = addBuff(first.buffs, might(10, 120), NOW + 60);
	assert.ok(longer.ok);
	assert.equal(longer.buffs.length, 1);
	assert.equal(longer.buffs[0].untilSec, NOW + 180);
	// a short potion does not shorten what is left; the potion is still used up (ok)
	const shorter = addBuff(first.buffs, might(25, 30), NOW);
	assert.ok(shorter.ok);
	assert.deepEqual(shorter.buffs, first.buffs);
	// a tie keeps the larger amount
	const tie = addBuff(first.buffs, might(15, 120), NOW);
	assert.ok(tie.ok);
	assert.equal(tie.buffs[0].amount, 15);
});

test('stacks: different families run together and their percent adds per stat', () => {
	const a = addBuff([], might(10), NOW);
	assert.ok(a.ok);
	const b = addBuff(a.buffs, haste(8), NOW);
	assert.ok(b.ok);
	assert.equal(b.buffs.length, 2);
	assert.deepEqual(buffTotals(b.buffs, NOW + 1), { damagePct: 10, atkSpeedPct: 8 });
	const sameStat: ActiveBuff[] = [
		{ family: 'might', stat: 'damagePct', amount: 10, untilSec: NOW + 50 },
		{ family: 'ironskin', stat: 'damagePct', amount: 5, untilSec: NOW + 50 },
	];
	assert.equal(buffTotals(sameStat, NOW).damagePct, 15, 'amounts on one stat are additive');
});

test('caps at 5: a sixth family is refused with a message, a refresh still works', () => {
	assert.equal(MAX_ACTIVE_BUFFS, 5);
	const families = Object.keys(BUFF_FAMILIES) as (keyof typeof BUFF_FAMILIES)[];
	assert.ok(families.length > MAX_ACTIVE_BUFFS, 'the cap must be reachable with real families');
	let buffs: ActiveBuff[] = [];
	for (const family of families.slice(0, MAX_ACTIVE_BUFFS)) {
		const added = addBuff(buffs, { kind: 'buff', family, stat: BUFF_FAMILIES[family].stat, amount: 5, durationSec: 100 }, NOW);
		assert.ok(added.ok);
		buffs = added.buffs;
	}
	assert.equal(buffs.length, MAX_ACTIVE_BUFFS);
	const sixthFamily = families[MAX_ACTIVE_BUFFS];
	const sixth = addBuff(buffs, { kind: 'buff', family: sixthFamily, stat: BUFF_FAMILIES[sixthFamily].stat, amount: 5, durationSec: 100 }, NOW);
	assert.equal(sixth.ok, false);
	if (!sixth.ok) assert.match(sixth.message, /5/);
	assert.ok(addBuff(buffs, might(10, 500), NOW).ok, 'refreshing a running family is allowed at the cap');
});

test('expires: a buff stops counting at its end second', () => {
	const buffs: ActiveBuff[] = [{ family: 'might', stat: 'damagePct', amount: 10, untilSec: NOW + 10 }];
	assert.deepEqual(buffTotals(buffs, NOW + 9), { damagePct: 10 });
	assert.deepEqual(buffTotals(buffs, NOW + 10), {});
	assert.deepEqual(activeBuffs(buffs, NOW + 10), []);
	// an expired buff does not hold a slot: the cap counts the running ones only
	const expired: ActiveBuff[] = Array.from({ length: 5 }, () => ({ family: 'ironskin', stat: 'armorPct', amount: 1, untilSec: NOW - 1 }));
	assert.ok(addBuff(expired, might(), NOW).ok);
});

test('unknown family dropped on read: a bad row never rejects the rest', () => {
	const read = readBuffs(
		[
			{ family: 'might', stat: 'damagePct', amount: 10, untilSec: NOW + 30 },
			{ family: 'berserk', stat: 'damagePct', amount: 99, untilSec: NOW + 30 },
			{ family: 'haste', amount: 'lots', untilSec: NOW + 30 },
			{ family: 'ironskin', amount: 5, untilSec: NOW - 5 },
			null,
			'junk',
			{ family: 'keenEye', stat: 'damagePct', amount: 4, untilSec: NOW + 60 },
			{ family: 'keenEye', amount: 9, untilSec: NOW + 20 },
		],
		NOW,
	);
	assert.deepEqual(
		read.map((b) => [b.family, b.stat, b.amount]).sort(),
		[
			['keenEye', 'critChance', 4],
			['might', 'damagePct', 10],
		],
		'unknown, malformed and ended rows are dropped, the stat comes from the family, one row per family (the longest)',
	);
	assert.deepEqual(readBuffs(undefined, NOW), []);
	assert.deepEqual(readBuffs({ family: 'might' }, NOW), []);
});

test('no change with no potions', () => {
	assert.deepEqual(buffTotals([], NOW), {});
	assert.deepEqual(readBuffs([], NOW), []);
	assert.deepEqual(activeBuffs([], NOW), []);
});

test('buffs end at rebirth', () => {
	assert.deepEqual(clearBuffsOnRebirth(), []);
});

test('mana potion: an instant healMp effect proves the pipeline and caps at max mana', () => {
	const result = drink(ITEM_CATALOG.potion_mana.effects!, state({ mp: 30 }), NOW);
	assert.ok(result.ok);
	assert.equal(result.mp, 60, '30 + 40 is capped at 60');
	assert.equal(result.hp, 50, 'HP untouched');
	assert.deepEqual(result.buffs, []);
});

test('drink: refused when it could do nothing, and a refused buff consumes nothing', () => {
	const fullMana = drink(ITEM_CATALOG.potion_mana.effects!, state({ mp: 60 }), NOW);
	assert.equal(fullMana.ok, false);
	const fullHp = drink(ITEM_CATALOG.potion_minor.effects!, state({ hp: 100 }), NOW);
	assert.equal(fullHp.ok, false);
	assert.equal(drink([], state(), NOW).ok, false);
	const heal = drink(ITEM_CATALOG.potion_minor.effects!, state(), NOW);
	assert.ok(heal.ok);
	assert.equal(heal.hp, 85);

	const running: ActiveBuff[] = Array.from({ length: 5 }, (_, i) => ({
		family: 'ironskin' as const,
		stat: 'armorPct' as const,
		amount: 1,
		untilSec: NOW + 100 + i,
	}));
	// a potion with a heal and a new buff: the buff does not fit, so the heal does not happen either
	const mixed = drink([{ kind: 'healHp', amount: 20 }, might()], state({ buffs: running }), NOW);
	assert.equal(mixed.ok, false);
});

test('drink: a buff potion works at full HP and records the buff', () => {
	const result = drink([might()], state({ hp: 100 }), NOW);
	assert.ok(result.ok);
	assert.equal(result.buffs.length, 1);
	assert.equal(result.hp, 100);
});

test('the effect text reads well', () => {
	assert.equal(describeEffect({ kind: 'healHp', amount: 35 }), 'Restores 35 HP');
	assert.equal(describeEffect({ kind: 'healMp', amount: 40 }), 'Restores 40 Mana');
	assert.equal(describeEffect(might(10, 120)), '+10% Damage for 2 min (Might)');
});
