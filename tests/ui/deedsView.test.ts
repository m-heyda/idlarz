import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEDS } from '../../src/catalog/achievements';
import { bonusLine, deedViewsOf, milestoneViewsOf, waitingCount, type DeedsInput } from '../../src/lib/deedsView';
import { tierGems } from '../../src/catalog/deedRewards';

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
		['claimed', 'earned', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked'],
	);
	assert.deepEqual(
		slayer.tiers.map((t) => t.goal),
		[100, 500, 2500, 10000, 50_000, 250_000, 1_000_000, 5_000_000],
	);
	assert.equal(slayer.cur, 642);
	assert.equal(slayer.tiers[1].gems, 75, 'gems: 50 for the first tier, 25 more for each further one');
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

test('gems follow the tier position: 50 for the first tier and 25 more for each further tier of a deed', () => {
	for (const d of deedViewsOf(input())) {
		if (d.id === 'early_tester' || d.id === 'beta_tester') continue;
		d.tiers.forEach((t, i) => assert.equal(t.gems, tierGems(i), `${d.id} tier ${i + 1}`));
	}
	assert.deepEqual([0, 1, 2].map(tierGems), [50, 75, 100]);
});

test('titles and avatars a tier unlocks are listed as special unlocks', () => {
	const slayer = deed(deedViewsOf(input()), 'slayer');
	assert.deepEqual(slayer.tiers[3].unlocks, ['Title: Slayer']);
	assert.deepEqual(slayer.tiers[0].unlocks, []);
	assert.deepEqual(deed(deedViewsOf(input()), 'hoarder').tiers.at(-1)?.unlocks, ["Title: Dragon's Hoard"]);
});

test('a deed with only a stand-in picture shows the shared medal as a placeholder; real art stays', () => {
	const views = deedViewsOf(input());
	assert.equal(deed(views, 'slayer').placeholder, false);
	assert.equal(deed(views, 'cluster_tundra').placeholder, true);
	assert.match(deed(views, 'cluster_tundra').icon, /badge_star_bronze/);
});

test('the grind ladders reach billions and trillions', () => {
	const hoarder = deed(deedViewsOf(input()), 'hoarder');
	assert.ok(hoarder.tiers.at(-1)!.goal >= 1e12);
	assert.ok(deed(deedViewsOf(input()), 'market').tiers.at(-1)!.goal >= 1e10);
});
