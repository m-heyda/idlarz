import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS } from '../../src/catalog/achievements';
import { DEED_BONUS_CAP_PCT, DEED_MILESTONES } from '../../src/catalog/deedMilestones';
import { claimableMilestones, deedBonuses, deedBonusText, deedPoints, nextMilestone, TOTAL_DEED_POINTS } from '../../src/lib/deeds';
import { claimAchievement, claimAllAchievements, claimMilestone, earnAchievements, reportOf } from '../../src/lib/offline/achievements';
import { newLedger } from '../../src/lib/offline/ledger';
import { killIncome } from '../../src/lib/loot/kill';
import { GEMS_CAP } from '../../src/config/economy';

// IDL-321: deed point milestones. Points count only after a tier is claimed; a milestone pays gems once and switches on a small bonus on kill rewards.

const T0 = 1_700_000_000_000;

test('every tier pays gems and deed points', () => {
	for (const a of ACHIEVEMENTS) {
		assert.ok(a.rewards.gems > 0, `${a.id} pays gems`);
		assert.ok((a.rewards.points ?? 0) > 0, `${a.id} gives deed points`);
	}
});

test('the milestones climb, their ids are dm_<points>, and the last one is reachable', () => {
	const points = DEED_MILESTONES.map((m) => m.points);
	assert.deepEqual(
		[...points].sort((a, b) => a - b),
		points,
	);
	for (const m of DEED_MILESTONES) assert.equal(m.id, `dm_${m.points}`);
	assert.ok(points[points.length - 1] <= TOTAL_DEED_POINTS, 'the top milestone is within the points the catalog can give');
	assert.ok(deedBonuses(DEED_MILESTONES.map((m) => m.id)).gold <= DEED_BONUS_CAP_PCT);
	assert.equal(nextMilestone(0)?.id, 'dm_50');
	assert.equal(nextMilestone(TOTAL_DEED_POINTS * 2), null);
});

test('deed bonuses add up per stat and stop at the cap', () => {
	assert.deepEqual(deedBonuses([]), { gold: 0, xp: 0 });
	assert.deepEqual(deedBonuses(['dm_50', 'dm_150']), { gold: 1, xp: 1 });
	assert.equal(deedBonusText(['dm_50']), '+1% kill gold');
	const all = deedBonuses(DEED_MILESTONES.map((m) => m.id));
	assert.ok(all.gold > 0 && all.xp > 0 && all.gold <= DEED_BONUS_CAP_PCT && all.xp <= DEED_BONUS_CAP_PCT);
});

test('points are counted only after the claim: an earned tier does not reach a milestone', () => {
	// tutorial, first_tile, first_building, first_fight, first_chest = 5 pts each
	const ids = ['tutorial', 'first_tile', 'first_building', 'first_fight', 'first_chest', 'castle_2', 'castle_6', 'castle_10', 'first_rebirth', 'boss_auroch'];
	const earned = earnAchievements(newLedger(T0), ids, T0).ledger;
	const early = claimMilestone(earned, 'dm_50');
	assert.ok(!early.ok && early.reason === 'not_earned', 'earned but unclaimed tiers give no points');
	const all = claimAllAchievements(earned, T0 + 1);
	assert.ok(all.ok);
	if (!all.ok) return;
	assert.equal(deedPoints(all.ledger.stats.claimed!), 5 * 6 + 15 + 30 + 20 + 15, 'claim all counts the points of what it claimed');
	assert.ok(all.claimed.includes('dm_50'), 'claim all also claims the milestone those points reach, in the same request');
	assert.equal(all.ledger.stats.milestonesClaimed.includes('dm_50'), true);
	const report = reportOf(all.ledger, []);
	assert.equal(report.bonus.gold, 1);
	assert.equal(report.bonusText, '+1% kill gold');
});

test('a milestone is claimed once, pays its gems and is capped by the gem cap', () => {
	let ledger = earnAchievements(newLedger(T0), ['castle_10', 'first_rebirth', 'boss_auroch', 'castle_6', 'golden_kill'], T0).ledger;
	for (const id of ['castle_10', 'first_rebirth', 'boss_auroch', 'castle_6', 'golden_kill']) {
		const c = claimAchievement(ledger, id, T0);
		assert.ok(c.ok);
		if (c.ok) ledger = c.ledger;
	}
	assert.deepEqual(claimableMilestones(deedPoints(ledger.stats.claimed!), ledger.stats.milestonesClaimed), ['dm_50']);
	const before = ledger.gems;
	const first = claimMilestone(ledger, 'dm_50');
	assert.ok(first.ok);
	if (!first.ok) return;
	assert.equal(first.gems, 25);
	assert.equal(first.ledger.gems, before + 25);
	const again = claimMilestone(first.ledger, 'dm_50');
	assert.ok(!again.ok && again.reason === 'already_claimed');
	assert.ok(!claimMilestone(ledger, 'dm_999').ok, 'an unknown milestone is refused');
	const nearCap = { ...ledger, gems: GEMS_CAP - 10 };
	const capped = claimMilestone(nearCap, 'dm_50');
	assert.ok(capped.ok && capped.gems === 10 && capped.ledger.gems === GEMS_CAP);
});

test('the Claim button takes a milestone id like a tier id', () => {
	const earned = earnAchievements(newLedger(T0), ['castle_10', 'first_rebirth', 'boss_auroch', 'castle_6', 'golden_kill'], T0).ledger;
	const all = claimAllAchievements(earned, T0);
	assert.ok(all.ok);
	if (!all.ok) return;
	const noMore = claimAllAchievements(all.ledger, T0 + 5);
	assert.ok(!noMore.ok && noMore.reason === 'nothing_to_claim', 'a second claim all pays nothing');
});

test('deed bonuses raise the kill gold and XP, and nothing else', () => {
	const ctx = { goldPerSec: 1000, xpPerSec: 100, luck: 0, hidePerSec: 50 };
	const base = killIncome({ type: 'thistleBoar', level: 5 }, ctx);
	const bonus = killIncome({ type: 'thistleBoar', level: 5 }, { ...ctx, deedGoldPct: 5, deedXpPct: 5 });
	assert.ok(bonus.gold >= Math.floor(base.gold * 1.05) - 1 && bonus.gold > base.gold);
	assert.ok(Math.abs(bonus.xp - base.xp * 1.05) < 1e-6);
	assert.equal(bonus.hide, base.hide);
});
