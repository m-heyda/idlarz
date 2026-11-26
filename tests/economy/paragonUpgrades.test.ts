import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PARAGON_CAP_POINTS, PARAGON_IDS, PARAGON_UPGRADES, paragonEffect, paragonRoom, paragonUpgrade } from '../../src/config/paragon';
import { gearIncome } from '../../src/lib/gearEconomy';
import { NO_IDOL_ECONOMY, idolEconomy, xpPctAt } from '../../src/lib/idolEconomy';
import {
	allocateParagon,
	fitParagon,
	newParagon,
	paragonBonuses,
	paragonBudget,
	paragonFree,
	paragonSpent,
	readParagon,
	respecParagon,
} from '../../src/lib/offline/paragon';
import { cumulativeParagonXp, cumulativeXp } from '../../src/utils/game/character';
import { effectiveTileDiscount } from '../../src/utils/game/rebirth';
import { LEVELING } from '../../src/config/character';
import { createWorld } from '../../src/utils/world';
import { playerProfile } from '../../src/lib/offline/profile';

// Paragon points and the 20 upgrades (docs/plan/paragon.md): the grid, the budget, the server's record and how the bonuses join the numbers the game already derives.

const base = cumulativeXp(LEVELING.maxLevel);
/** XP that is exactly `n` paragon levels (plus a little) */
const xpOf = (n: number) => base + cumulativeParagonXp(n) + 1;

test('the grid is 4 categories of 5: three capped and two uncapped each, ids unique', () => {
	assert.equal(PARAGON_UPGRADES.length, 20);
	assert.equal(new Set(PARAGON_IDS).size, 20);
	for (const cat of ['combat', 'economy', 'fortune', 'realm'] as const) {
		const mine = PARAGON_UPGRADES.filter((u) => u.category === cat);
		assert.equal(mine.length, 5, cat);
		assert.equal(mine.filter((u) => u.capped).length, 3, `${cat} capped`);
		assert.equal(mine.filter((u) => !u.capped).length, 2, `${cat} uncapped`);
	}
});

test('every upgrade: nothing at 0 points, positive at 1, a capped one stops at its cap, an uncapped one keeps growing slower and slower', () => {
	for (const u of PARAGON_UPGRADES) {
		assert.equal(paragonEffect(u, 0), 0, `${u.id} at 0`);
		assert.ok(paragonEffect(u, 1) > 0, `${u.id} at 1`);
		if (u.capped) {
			assert.equal(paragonEffect(u, PARAGON_CAP_POINTS), u.rate * PARAGON_CAP_POINTS, `${u.id} at the cap`);
			assert.equal(paragonEffect(u, PARAGON_CAP_POINTS + 100), paragonEffect(u, PARAGON_CAP_POINTS), `${u.id} over the cap`);
			assert.equal(paragonRoom(u, 10), 15);
			assert.equal(paragonRoom(u, 30), 0);
		} else {
			assert.equal(paragonRoom(u, 5000), Number.POSITIVE_INFINITY);
			const a = paragonEffect(u, 101) - paragonEffect(u, 100);
			const b = paragonEffect(u, 1001) - paragonEffect(u, 1000);
			assert.ok(a > b && b > 0, `${u.id}: each point is worth less than the last, never nothing`);
			assert.ok(Math.abs(paragonEffect(u, 100) - u.rate * 10) < 1e-9, `${u.id} is k x sqrt(points)`);
		}
	}
});

test('the budget is one point per paragon level, free = budget - spent', () => {
	assert.equal(paragonBudget(base - 1), 0);
	assert.equal(paragonBudget(xpOf(25)), 25);
	assert.equal(paragonFree(xpOf(25), { damage: 10, luck: 5 }), 10);
	assert.equal(paragonFree(xpOf(3), { damage: 10 }), 0);
});

test('allocating: within the budget, refused for a bad body, past the budget or past a cap, and nothing changes when refused', () => {
	const p = newParagon();
	const ok = allocateParagon(p, { damage: 3, luck: 2 }, 10);
	assert.ok(ok.ok);
	if (ok.ok) {
		assert.equal(ok.paragon.ver, p.ver + 1);
		assert.deepEqual(ok.paragon.spent, { damage: 3, luck: 2 });
		assert.equal(paragonSpent(ok.paragon.spent), 5);
	}
	assert.deepEqual(allocateParagon(p, {}, 10), { ok: false, reason: 'bad_request' });
	assert.deepEqual(allocateParagon(p, { nope: 1 }, 10), { ok: false, reason: 'bad_request' });
	assert.deepEqual(allocateParagon(p, { damage: -1 }, 10), { ok: false, reason: 'bad_request' });
	assert.deepEqual(allocateParagon(p, { damage: 1.5 }, 10), { ok: false, reason: 'bad_request' });
	assert.deepEqual(allocateParagon(p, 'x', 10), { ok: false, reason: 'bad_request' });
	assert.deepEqual(allocateParagon(p, { damage: 11 }, 10), { ok: false, reason: 'no_points' });
	assert.deepEqual(allocateParagon(p, { luck: PARAGON_CAP_POINTS + 1 }, 100), { ok: false, reason: 'capped' });
	const full = allocateParagon(p, { luck: PARAGON_CAP_POINTS }, 100);
	assert.ok(full.ok);
	if (full.ok) assert.deepEqual(allocateParagon(full.paragon, { luck: 1 }, 100), { ok: false, reason: 'capped' });
	assert.equal(paragonSpent(p.spent), 0, 'the record that was asked is untouched');
});

test('respec gives every point back, marks the free one used and moves the version', () => {
	const p = { ver: 4, spent: { damage: 3 }, freeUsed: false };
	const r = respecParagon(p);
	assert.deepEqual(r, { ver: 5, spent: {}, freeUsed: true });
});

test('a record above what the XP earned goes back; one within it is returned as it is', () => {
	const within = { ver: 2, spent: { damage: 5 }, freeUsed: false };
	assert.equal(fitParagon(within, xpOf(10)), within);
	const over = fitParagon(within, xpOf(3));
	assert.deepEqual(over.spent, {});
	assert.equal(over.ver, 3);
	assert.equal(over.freeUsed, false);
});

test('the stored column is read tolerantly: nothing for a missing or odd column, unknown ids dropped, bad points zero, a capped upgrade clamped', () => {
	assert.equal(readParagon(null), null);
	assert.equal(readParagon('x'), null);
	assert.equal(readParagon({ ver: 1 }), null);
	const read = readParagon({ ver: 3, freeUsed: true, spent: { damage: 7.9, luck: 999, old_upgrade: 5, income: -2, xpGain: 'x' } });
	assert.deepEqual(read, { ver: 3, freeUsed: true, spent: { damage: 7, luck: PARAGON_CAP_POINTS } });
	assert.deepEqual(readParagon({ spent: {} }), { ver: 1, spent: {}, freeUsed: false });
});

test('paragonBonuses carries each upgrade in its own unit and is all zeros with nothing spent', () => {
	assert.deepEqual(
		Object.values(paragonBonuses({})).filter((v) => v !== 0),
		[],
	);
	assert.deepEqual(
		Object.values(paragonBonuses(null)).filter((v) => v !== 0),
		[],
	);
	const b = paragonBonuses({ income: 25, damage: 100, bossTimer: 25, luck: 10 });
	assert.equal(b.income, 20);
	assert.equal(b.damage, 20);
	assert.equal(b.bossTimer, 15);
	assert.equal(b.luck, 12);
	assert.equal(paragonUpgrade('damage')?.unit, '%');
});

test('the points join the Idol economy: the fields that already exist add up, the new ones fill their own', () => {
	const tiles = createWorld([]);
	const none = idolEconomy(tiles, {});
	assert.deepEqual(none, NO_IDOL_ECONOMY);
	const e = idolEconomy(tiles, {}, { damage: 100, maxLife: 100, luck: 10, killRewards: 100, buildSpeed: 25, goldFind: 25, critDamage: 25, bossTimer: 25 });
	assert.equal(e.damagePct, 20);
	assert.equal(e.maxHpPct, 20);
	assert.equal(e.luck, 12);
	assert.equal(e.killRewardPct, 15);
	assert.equal(e.buildTimePct, 10);
	assert.equal(e.goldFindPct, 10);
	assert.equal(e.critDamagePct, 50);
	assert.equal(e.bossTimerSec, 15);
});

test('the Paragon XP upgrade counts only from level 100 on', () => {
	const e = idolEconomy(createWorld([]), {}, { xpGain: 25, paragonXp: 100 });
	assert.equal(xpPctAt(e, 99), 20);
	assert.equal(xpPctAt(e, 100), 20 + 20);
});

test('the Income upgrade is its own multiplicative bucket on the gear income, and gear income is unchanged without points', () => {
	const none = gearIncome({}, undefined);
	assert.equal(gearIncome({}, {}).incomePct, none.incomePct);
	assert.ok(Math.abs(gearIncome({}, { income: 25 }).incomePct - 20) < 1e-9, 'no gear: just the paragon bucket');
});

test('the tile discount upgrade adds under the same cap as every other source', () => {
	const stats = { tileCostDiscount: 10 };
	assert.equal(effectiveTileDiscount(stats, undefined, undefined, undefined, undefined, 0), 10);
	assert.equal(effectiveTileDiscount(stats, undefined, undefined, undefined, undefined, 10), 20);
	assert.equal(effectiveTileDiscount({ tileCostDiscount: 40 }, undefined, undefined, undefined, undefined, 10), 45, 'capped at 45');
});

test('the fight profile reads the Paragon combat upgrades the save pipeline stamped (idolFx): max life, crit damage, life leech, boss clock, potion power', () => {
	const plain = playerProfile({});
	const fx = playerProfile({ idolFx: { maxHpPct: 20, critDamagePct: 50, lifeLeechPct: 3, bossTimerSec: 10, potionPowerPct: 15 } });
	assert.equal(fx.maxHp, Math.round(plain.maxHp * 1.2));
	assert.ok(Math.abs(fx.critExtra - plain.critExtra * 1.5) < 1e-9);
	assert.ok(Math.abs(fx.leechPct - plain.leechPct - 3) < 1e-9);
	assert.equal(fx.bossTimerSec, (plain.bossTimerSec ?? 0) + 10);
	assert.ok(Math.abs((fx.potionPower ?? 1) - (plain.potionPower ?? 1) - 0.15) < 1e-9);
	// no points = the profile there was before
	assert.deepEqual(playerProfile({ idolFx: {} }), plain);
});
