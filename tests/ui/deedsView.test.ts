import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEDS } from '../../src/catalog/achievements';
import { bonusLine, deedViewsOf, milestoneViewsOf, waitingCount, type DeedsInput } from '../../src/lib/deedsView';
import { crystalSrc } from '../../packages/design-system/src/views/deeds';

// IDL-321: what the Hall of Deeds window shows, built from the server's report.

const input = (over: Partial<DeedsInput> = {}): DeedsInput => ({
	earned: [],
	claimed: [],
	earnedAt: {},
	claimedAt: {},
	milestonesClaimed: [],
	progress: {},
	points: 0,
	...over,
});
const deed = (views: ReturnType<typeof deedViewsOf>, id: string) => views.find((d) => d.id === id)!;

test('every deed is listed with its tiers, goals ascending and the tier states from the report', () => {
	const views = deedViewsOf(input({ earned: ['slayer_100', 'slayer_500'], claimed: ['slayer_100'], progress: { slayer: 642 } }));
	assert.equal(views.length, DEEDS.length);
	const slayer = deed(views, 'slayer');
	assert.deepEqual(
		slayer.tiers.map((t) => t.state),
		['claimed', 'earned', 'locked', 'locked'],
	);
	assert.deepEqual(
		slayer.tiers.map((t) => t.goal),
		[100, 500, 2500, 10000],
	);
	assert.equal(slayer.cur, 642);
	assert.equal(slayer.tiers[1].gems, 50);
	assert.equal(slayer.tiers[1].points, 25);
});

test('a tier that is not in the earned list is locked even when the number is past its goal (the server settles it, the window does not guess)', () => {
	const slayer = deed(deedViewsOf(input({ progress: { slayer: 9999 } })), 'slayer');
	assert.ok(slayer.tiers.every((t) => t.state === 'locked'));
});

test('a secret deed is ??? until one of its tiers is earned', () => {
	const secret = DEEDS.find((d) => d.tags.includes('secret'));
	assert.ok(secret, 'the catalog has a secret deed');
	const hidden = deed(deedViewsOf(input()), secret!.id);
	assert.equal(hidden.name, '???');
	assert.equal(hidden.lore, '???');
	const shown = deed(deedViewsOf(input({ earned: [secret!.tiers[0]] })), secret!.id);
	assert.equal(shown.name, secret!.title);
});

test('Claim all is available for exactly one waiting reward, and counts the milestone those points reach', () => {
	assert.equal(waitingCount(input()), 0);
	assert.equal(waitingCount(input({ earned: ['slayer_100'] })), 1, 'one waiting tier is still claimable');
	// ten earned tiers worth 50 points together reach the first milestone once claimed
	const ids = ['tutorial', 'first_tile', 'first_building', 'first_fight', 'first_chest', 'castle_2', 'castle_6', 'castle_10', 'first_rebirth', 'boss_auroch'];
	assert.equal(waitingCount(input({ earned: ids })), ids.length + 1);
	assert.equal(waitingCount(input({ earned: ids, claimed: ids, points: 115 })), 1, 'a reached milestone waits for its own claim');
});

test('milestones follow the claimed points and the claimed list', () => {
	const rows = milestoneViewsOf(input({ points: 160, milestonesClaimed: ['dm_50'] }));
	assert.deepEqual(
		rows.slice(0, 3).map((m) => m.state),
		['claimed', 'ready', 'locked'],
	);
	assert.equal(bonusLine({ milestonesClaimed: [] }), 'None yet: claim a milestone');
	assert.equal(bonusLine({ milestonesClaimed: ['dm_50'] }), '+1% kill gold');
});

test('crystals: yellow for tiers I to IV, violet from the fifth, and all violet once the deed is complete', () => {
	assert.equal(crystalSrc(0, false), '/pixel/ui/deeds/crystal_yellow_1.png');
	assert.equal(crystalSrc(3, false), '/pixel/ui/deeds/crystal_yellow_4.png');
	assert.equal(crystalSrc(4, false), '/pixel/ui/deeds/crystal_violet_1.png');
	assert.equal(crystalSrc(9, false), '/pixel/ui/deeds/crystal_violet_4.png');
	assert.equal(crystalSrc(1, true), '/pixel/ui/deeds/crystal_violet_2.png');
});
