import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DEEDS, achievementById, deedOfAchievement } from '../../src/catalog/achievements';
import { conditionHolds, conditionProgress, deedPoints, deedState, entriesFilled, TOTAL_DEED_POINTS, type DeedFacts } from '../../src/lib/deeds';
import { emptyStats } from '../../src/lib/offline/stats';

// IDL-306: the Hall of Deeds model on top of the achievements. Every tier is an ordinary achievement, so the ledger needs no change.

const facts = (over: Partial<DeedFacts['stats']> = {}, rest: Partial<Omit<DeedFacts, 'stats'>> = {}): DeedFacts => ({
	stats: { ...emptyStats(), ...over },
	castleLevel: 1,
	rebirths: 0,
	buildings: 0,
	...rest,
});
const deed = (id: string) => DEEDS.find((d) => d.id === id)!;

test('every achievement is a tier of exactly one deed, and every tier id is an achievement', () => {
	for (const a of ACHIEVEMENTS) assert.equal(DEEDS.filter((d) => d.tiers.includes(a.id)).length, 1, `${a.id} belongs to one deed`);
	for (const d of DEEDS) for (const id of d.tiers) assert.ok(achievementById(id), `${d.id}: ${id} exists`);
	assert.equal(new Set(DEEDS.map((d) => d.id)).size, DEEDS.length, 'deed ids are unique');
	assert.equal(deedOfAchievement('castle_6')?.id, 'castle');
});

test('the tiers of a deed climb: every goal is above the one before', () => {
	for (const d of DEEDS) {
		const goals = d.tiers.map((id) => conditionProgress(achievementById(id)!.when, facts()).goal);
		assert.deepEqual(
			[...goals].sort((a, b) => a - b),
			goals,
			`${d.id} goals ascend`,
		);
	}
});

test('the launch achievements keep their ids and rewards (they are tier 1 of their deeds)', () => {
	assert.deepEqual(achievementById('first_rebirth')?.rewards, { gems: 75, avatarId: 'reborn', points: 20 });
	assert.equal(achievementById('castle_10')?.rewards.avatarId, 'architect');
	assert.equal(achievementById('beta_tester')?.rewards.gems, 200);
	assert.equal(deed('reborn').tiers[0], 'first_rebirth');
});

test('deedState: tier, next goal and progress along the bar', () => {
	const s = deedState(deed('slayer'), facts({ kills: { wolf: 1000, bear: 842 } }), ['slayer_100', 'slayer_500'], ['slayer_100']);
	assert.deepEqual([s.earned, s.claimed, s.claimable, s.complete], [2, 1, 1, false]);
	assert.deepEqual([s.from, s.goal, s.cur], [500, 2500, 1842]);
	assert.ok(Math.abs(s.progress - 1342 / 2000) < 1e-9);
});

test('deedState: a tier whose condition holds counts as earned before the server has recorded it', () => {
	const s = deedState(deed('landlord'), facts({ tiles: 60 }), [], []);
	assert.equal(s.earned, 2, 'first_tile and landlord_50');
	assert.equal(s.claimable, 2);
	assert.equal(s.goal, 200);
});

test('deedState: a finished deed is complete with a full bar; a manual tier counts only when recorded', () => {
	const done = deedState(deed('reborn'), facts({}, { rebirths: 20 }), [], []);
	assert.deepEqual([done.complete, done.progress, done.goal], [true, 1, 20]);
	assert.equal(deedState(deed('early_tester'), facts(), [], []).earned, 0);
	assert.equal(deedState(deed('early_tester'), facts(), ['early_tester'], []).earned, 1);
});

test('deed points come from the claimed tiers only', () => {
	assert.equal(deedPoints([]), 0);
	assert.equal(deedPoints(['slayer_100', 'slayer_500', 'not_an_id']), 35);
	assert.ok(TOTAL_DEED_POINTS > 500);
});

test('the new counters drive the new conditions', () => {
	assert.equal(conditionHolds({ kind: 'goldPeak', min: 100_000 }, facts({ goldPeak: 100_000 })), true);
	assert.equal(conditionHolds({ kind: 'flawless', min: 25 }, facts({ flawless: 24 })), false);
	assert.equal(conditionHolds({ kind: 'unitsSold', min: 5 }, facts({ unitsSold: 5 })), true);
	assert.equal(conditionHolds({ kind: 'crafted', min: 100 }, facts({ crafted: 100 })), true);
	assert.equal(entriesFilled({ ...emptyStats(), kills: { a: 10, b: 9, c: 40 } }, 10), 2);
	assert.equal(conditionHolds({ kind: 'entries', kills: 10, min: 2 }, facts({ kills: { a: 10, b: 9, c: 40 } })), true);
	assert.equal(conditionHolds({ kind: 'manual' }, facts()), false);
});
