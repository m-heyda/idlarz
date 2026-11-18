import test from 'node:test';
import assert from 'node:assert/strict';
import { MASTERY_ENTRY_KILLS, MASTERY_TIERS } from '../../src/catalog/mastery';
import { masteryReached, masteryState } from '../../src/lib/mastery';
import { claimAllMastery, claimMastery } from '../../src/lib/offline/mastery';
import { newLedger, type Ledger } from '../../src/lib/offline/ledger';
import { bestiaryOf, emptyStats, readStats, statsToJson } from '../../src/lib/offline/stats';
import { GEMS_CAP } from '../../src/config/economy';

// IDL-309: Bestiary mastery. The hybrid ladder (10 / 100 / 500 / 2,500 kills) is data; a claim is a count per monster type, judged from the server's own kills.

const T0 = 1_800_000_000_000;
const withKills = (kills: Record<string, number>, masteryClaimed: Record<string, number> = {}): Ledger => {
	const base = newLedger(T0);
	return { ...base, stats: { ...base.stats, kills, masteryClaimed } };
};

test('the ladder is the decided hybrid one and the entry fills at the first tier', () => {
	assert.deepEqual(
		MASTERY_TIERS.map((t) => t.kills),
		[10, 100, 500, 2500],
	);
	assert.equal(MASTERY_ENTRY_KILLS, 10);
	assert.equal(MASTERY_TIERS[0].reveal, 'stats');
	assert.equal(MASTERY_TIERS[1].reveal, 'drops');
	assert.deepEqual(
		MASTERY_TIERS.map((t) => t.gems > 0),
		[false, false, false, true],
		'only the top tier pays gems (decided 2026-11-17)',
	);
	assert.ok(
		MASTERY_TIERS.every((t) => t.bonuses.length > 0),
		'every tier gives a structured bonus',
	);
});

test('tier from kills, and what the entry may show once tiers are claimed', () => {
	assert.deepEqual(
		[0, 9, 10, 99, 100, 499, 500, 2499, 2500, 99999].map((k) => masteryReached(k)),
		[0, 0, 1, 1, 2, 2, 3, 3, 4, 4],
	);
	const s = masteryState(250, 1);
	assert.deepEqual([s.reached, s.claimed, s.claimable, s.next, s.from], [2, 1, 1, 500, 100]);
	assert.deepEqual([s.showStats, s.showDrops], [true, false], 'the drop table opens with its tier claimed');
	assert.deepEqual([masteryState(5000, 4).next, masteryState(5000, 4).claimable], [null, 0]);
	assert.equal(masteryState(50, 9).claimed, 1, 'a bad claimed count is cut to what the kills reach');
});

test('a claim needs the tier reached and the earlier tiers taken; a repeat or a forged one pays nothing', () => {
	const ledger = withKills({ wolf: 120 });
	assert.deepEqual(claimMastery(ledger, 'bear', 1), { ok: false, reason: 'unknown' }, 'no kills of that type');
	assert.deepEqual(claimMastery(ledger, 'wolf', 0), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 9), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 1.5), { ok: false, reason: 'unknown' });
	assert.deepEqual(claimMastery(ledger, 'wolf', 3), { ok: false, reason: 'not_reached' });
	const first = claimMastery(ledger, 'wolf', 1);
	assert.ok(first.ok);
	if (!first.ok) return;
	assert.equal(first.ledger.stats.masteryClaimed.wolf, 1);
	assert.deepEqual(claimMastery(first.ledger, 'wolf', 1), { ok: false, reason: 'already_claimed' });
	const skipped = claimMastery(withKills({ wolf: 600 }), 'wolf', 2);
	assert.deepEqual(skipped, { ok: false, reason: 'out_of_order' });
	const second = claimMastery(first.ledger, 'wolf', 2);
	assert.ok(second.ok && second.ledger.stats.masteryClaimed.wolf === 2);
});

test('Claim all takes every reached tier of every type in one write, and nothing when nothing waits', () => {
	const ledger = withKills({ wolf: 600, boar: 12, rat: 3 }, { wolf: 1 });
	const all = claimAllMastery(ledger);
	assert.ok(all.ok);
	if (!all.ok) return;
	assert.equal(all.tiers, 2 + 1);
	assert.deepEqual(all.ledger.stats.masteryClaimed, { wolf: 3, boar: 1 });
	assert.deepEqual(claimAllMastery(all.ledger), { ok: false, reason: 'not_reached' });
	assert.deepEqual(claimAllMastery(newLedger(T0)), { ok: false, reason: 'not_reached' });
});

test('legacy accounts with kills but no claims start with every tier waiting and nothing paid', () => {
	const ledger = withKills({ wolf: 50 });
	assert.deepEqual(ledger.stats.masteryClaimed, {});
	assert.equal(masteryState(50, 0).claimable, 1);
	const all = claimAllMastery(ledger);
	assert.ok(all.ok && all.gems === 0 && all.ledger.gems === ledger.gems);
	const top = claimAllMastery(withKills({ wolf: 3000 }));
	assert.ok(top.ok && top.gems === MASTERY_TIERS[3].gems, 'the top tier pays its gems');
});

test('gems per tier, once configured, are paid and capped by GEMS_CAP (exercised with a temporary tier value)', () => {
	const tiers = MASTERY_TIERS as unknown as { gems: number }[];
	const saved = tiers[0].gems;
	try {
		tiers[0].gems = 40;
		const ledger = withKills({ wolf: 20 });
		const paid = claimMastery(ledger, 'wolf', 1);
		assert.ok(paid.ok && paid.gems === 40 && paid.ledger.gems === ledger.gems + 40 && paid.ledger.granted.gems === 40);
		const rich: Ledger = { ...ledger, gems: GEMS_CAP - 10 };
		const capped = claimMastery(rich, 'wolf', 1);
		assert.ok(capped.ok && capped.gems === 10 && capped.ledger.gems === GEMS_CAP);
	} finally {
		tiers[0].gems = saved;
	}
});

test('the claimed record reads back tolerantly, stays out of the stored form while empty, and rides in the bestiary report', () => {
	assert.deepEqual(emptyStats().masteryClaimed, {});
	assert.equal('masteryClaimed' in statsToJson(emptyStats()), false);
	assert.deepEqual(readStats({ masteryClaimed: { wolf: 2, bad: -1, worse: 'x' } }).masteryClaimed, { wolf: 2 });
	const stats = { ...emptyStats(), kills: { wolf: 12 }, masteryClaimed: { wolf: 1 }, deaths: { wolf: 2 }, bestMs: { wolf: 4000 } };
	assert.deepEqual(readStats(JSON.parse(JSON.stringify(statsToJson(stats)))).masteryClaimed, { wolf: 1 });
	assert.deepEqual(bestiaryOf(stats), { seen: [], kills: { wolf: 12 }, claimed: { wolf: 1 }, biomeClaimed: {}, deaths: { wolf: 2 }, bestMs: { wolf: 4000 } });
});

// IDL-336: the boss ladder, biome goals and the structured bonuses.

import { BIOME_GOALS, BOSS_MASTERY_TIERS, MASTERY_CAPS, MASTERY_STATS, biomeRoster, masteryTiersOf } from '../../src/catalog/mastery';
import { biomeState, masteryBonusesFor, masteryReachedOf } from '../../src/lib/mastery';
import { claimBiomeGoal } from '../../src/lib/offline/mastery';

const everyKill = (biome: string, kills: number) => Object.fromEntries(biomeRoster(biome).map((id) => [id, kills]));

test('a boss has its own low ladder (1 / 5 / 25 / 100) and a normal monster the shared one', () => {
	assert.deepEqual(
		BOSS_MASTERY_TIERS.map((t) => t.kills),
		[1, 5, 25, 100],
	);
	assert.equal(masteryTiersOf('bossGreatAuroch'), BOSS_MASTERY_TIERS);
	assert.equal(masteryTiersOf('thistleBoar'), MASTERY_TIERS);
	assert.equal(masteryTiersOf('someRetiredType'), MASTERY_TIERS, 'a type the catalog does not list reads on the shared ladder');
	assert.equal(masteryReachedOf('bossGreatAuroch', 5), 2);
	assert.equal(masteryReachedOf('thistleBoar', 5), 0);
	const first = claimMastery(withKills({ bossGreatAuroch: 1 }), 'bossGreatAuroch', 1);
	assert.ok(first.ok, 'one boss kill reaches its first tier');
});

test('the claimed tiers give structured bonuses against that monster, capped', () => {
	assert.deepEqual(masteryBonusesFor('thistleBoar', {}), { damage: 0, defense: 0, gold: 0, xp: 0, loot: 0 });
	assert.deepEqual(masteryBonusesFor('thistleBoar', { thistleBoar: 2 }), { damage: 2, defense: 0, gold: 0, xp: 5, loot: 0 });
	const all = masteryBonusesFor('thistleBoar', { thistleBoar: 4 });
	assert.deepEqual(all, { damage: 6, defense: 3, gold: 5, xp: 5, loot: 5 });
	assert.equal(masteryBonusesFor('thistleBoar', { thistleBoar: 99 }).damage, 6, 'a bad claimed count is cut to the ladder');
	assert.equal(masteryBonusesFor('thistleBoar', { burrowBadger: 4 }).damage, 0, 'a bonus works against its own monster only');
	// with every biome goal claimed on top the caps still hold
	const full = masteryBonusesFor('bossGreatAuroch', { bossGreatAuroch: 4 }, { plains: 4 });
	for (const stat of MASTERY_STATS) assert.ok(full[stat] <= MASTERY_CAPS[stat], stat);
	assert.equal(full.damage, 3 + 6 + 1 + 3, 'boss tiers 3 + 6, biome goals 1 + 3 (under the cap of 20)');
});

test('a biome goal needs every live monster of the biome, its boss included, at the tier; it is claimed in order and pays its gems', () => {
	const roster = biomeRoster('plains');
	assert.ok(roster.includes('bossGreatAuroch') && roster.length === 6);
	const kills = everyKill('plains', 10);
	assert.equal(
		biomeState('plains', kills, 0).reached,
		1,
		'ten kills of each: the normals reach tier 1, the boss tier 2 (1 / 5 / 25 / 100), so the biome is at tier 1',
	);
	assert.equal(biomeState('plains', everyKill('plains', 0), 0).reached, 0);
	const near = { ...everyKill('plains', 10), bossGreatAuroch: 1 };
	assert.equal(biomeState('plains', near, 0).reached, 1);
	assert.deepEqual(biomeState('plains', { ...near, thistleBoar: 0 }, 0).missing, ['thistleBoar']);
	const ledger = withKills(near);
	const first = claimBiomeGoal(ledger, 'plains', 1);
	assert.ok(first.ok && first.ledger.stats.biomeClaimed.plains === 1);
	if (!first.ok) return;
	assert.deepEqual(claimBiomeGoal(first.ledger, 'plains', 1), { ok: false, reason: 'already_claimed' });
	assert.deepEqual(claimBiomeGoal(first.ledger, 'plains', 2), { ok: false, reason: 'not_reached' });
	assert.deepEqual(claimBiomeGoal(ledger, 'plains', 3), { ok: false, reason: 'not_reached' });
	assert.deepEqual(claimBiomeGoal(ledger, 'nowhere', 1), { ok: false, reason: 'unknown' });
	const top = claimAllMastery(withKills({ ...everyKill('plains', 2500), bossGreatAuroch: 100 }));
	assert.ok(top.ok);
	if (top.ok) assert.equal(top.ledger.stats.biomeClaimed.plains, BIOME_GOALS.length);
});

test('the biome claims read back tolerantly and stay out of the stored form while empty', () => {
	assert.deepEqual(emptyStats().biomeClaimed, {});
	assert.equal('biomeClaimed' in statsToJson(emptyStats()), false);
	assert.deepEqual(readStats({ biomeClaimed: { plains: 2, bad: -1 } }).biomeClaimed, { plains: 2 });
	assert.deepEqual(readStats({}).biomeClaimed, {}, 'an older row has none');
});
