// Paragon 3/3 (docs/plan/paragon.md, IDL-394): the Paragon deed and its milestone tiers (titles, one bonus point each) and the name frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DEEDS, achievementById, deedById } from '../../src/catalog/achievements';
import { PARAGON_MILESTONE_FROM, PARAGON_MILESTONE_IDS, PARAGON_TIER_GOALS } from '../../src/catalog/achievementsParagon';
import { titleOptions } from '../../src/catalog/badges';
import { PARAGON_FRAMES, paragonFrame } from '../../src/config/paragon';
import { conditionHolds, conditionProgress, deedState, type DeedFacts } from '../../src/lib/deeds';
import { emptyStats } from '../../src/lib/offline/stats';
import { paragonBonusPoints, paragonBudget, paragonFree } from '../../src/lib/offline/paragon';

const facts = (paragon: number): DeedFacts => ({ stats: emptyStats(), castleLevel: 0, rebirths: 0, buildings: 0, paragon });

test('the Paragon deed has the tiers of the design (1, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1000) and every tier is a real achievement', () => {
	assert.deepEqual(PARAGON_TIER_GOALS, [1, 10, 25, 50, 100, 200, 300, 400, 500, 750, 1000]);
	const deed = deedById('paragon');
	assert.ok(deed);
	assert.deepEqual(
		deed.tiers,
		PARAGON_TIER_GOALS.map((g) => `paragon_${g}`),
	);
	for (const id of deed.tiers) assert.ok(achievementById(id), id);
	assert.equal(DEEDS.filter((d) => d.id === 'paragon').length, 1);
	assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length, 'no id is used twice');
});

test('the deed tiers follow the paragon level, and nothing below level 100 (paragon 0) earns one', () => {
	const tier = (g: number) => achievementById(`paragon_${g}`)!.when;
	assert.deepEqual(conditionProgress(tier(100), facts(37)), { cur: 37, goal: 100 });
	assert.equal(conditionHolds(tier(1), facts(0)), false);
	assert.equal(conditionHolds(tier(1), facts(1)), true);
	assert.equal(conditionHolds(tier(100), facts(99)), false);
	assert.equal(conditionHolds(tier(100), facts(100)), true);
	assert.equal(conditionHolds(tier(1000), facts(999)), false);
	const deed = deedById('paragon')!;
	assert.equal(deedState(deed, facts(250), [], []).earned, 6, 'paragon 250 has earned 1, 10, 25, 50, 100 and 200');
	assert.equal(deedState(deed, facts(250), [], []).claimable, 6);
	assert.equal(deedState(deed, facts(1000), [], []).complete, true);
});

test('only the tiers from paragon 100 up are milestones: each has a title; the lower ones have none', () => {
	assert.deepEqual(
		PARAGON_MILESTONE_IDS,
		[100, 200, 300, 400, 500, 750, 1000].map((g) => `paragon_${g}`),
	);
	for (const g of PARAGON_TIER_GOALS) {
		const a = achievementById(`paragon_${g}`)!;
		assert.equal(Boolean(a.rewards.titleId), g >= PARAGON_MILESTONE_FROM, `paragon_${g} title`);
		assert.ok((a.rewards.gems ?? 0) > 0, 'every tier pays gems on Claim');
		assert.ok((a.rewards.points ?? 0) > 0, 'and deed points');
	}
	const earned = PARAGON_MILESTONE_IDS.slice(0, 2);
	assert.deepEqual(
		titleOptions(earned).map((t) => t.name),
		['Paragon', 'Exalted'],
		'an earned milestone offers its title for the name',
	);
});

test('a claimed milestone adds one point to the budget; an unclaimed one or a lower tier adds nothing, and a repeated id counts once per milestone', () => {
	assert.equal(paragonBonusPoints([]), 0);
	assert.equal(paragonBonusPoints(['paragon_50']), 0);
	assert.equal(paragonBonusPoints(['paragon_100']), 1);
	assert.equal(paragonBonusPoints(['paragon_100', 'paragon_200', 'paragon_1000', 'first_tile']), 3);
	assert.equal(paragonBonusPoints([...PARAGON_MILESTONE_IDS, ...PARAGON_MILESTONE_IDS]), PARAGON_MILESTONE_IDS.length);
	assert.equal(paragonBudget(0, 2), 2);
	assert.equal(paragonFree(0, { damage: 1 }, 2), 1);
	assert.equal(paragonFree(0, {}, 0), 0);
});

test('the name frame follows the paragon level: none below 100, then bronze to diamond at the milestone levels', () => {
	assert.equal(paragonFrame(0), null);
	assert.equal(paragonFrame(99), null);
	assert.equal(paragonFrame(100)?.name, 'Bronze');
	assert.equal(paragonFrame(299)?.name, 'Silver');
	assert.equal(paragonFrame(300)?.name, 'Gold');
	assert.equal(paragonFrame(749)?.name, 'Emerald');
	assert.equal(paragonFrame(5000)?.name, 'Diamond');
	assert.deepEqual(
		PARAGON_FRAMES.map((f) => f.from),
		[100, 200, 300, 400, 500, 750, 1000],
		'a frame starts at each milestone level',
	);
	assert.equal(new Set(PARAGON_FRAMES.map((f) => f.color)).size, PARAGON_FRAMES.length, 'every frame has its own colour');
});
