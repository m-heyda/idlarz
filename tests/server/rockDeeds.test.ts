import test from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, DEEDS } from '../../src/catalog/achievements';
import { conditionProgress, type DeedFacts } from '../../src/lib/deeds';
import { emptyStats, isEmptyStats, readStats, recordRock, statsToJson } from '../../src/lib/offline/stats';

const facts = (stats = emptyStats()): DeedFacts => ({ stats }) as DeedFacts;

test('a broken rock is counted in all, per tier and by the Ember Coal it held', () => {
	let stats = emptyStats();
	assert.equal(isEmptyStats(stats), true);
	stats = recordRock(stats, 'common');
	stats = recordRock(stats, 'rare', 2);
	stats = recordRock(stats, 'rare', 1.9);
	assert.equal(stats.rocks, 3);
	assert.deepEqual(stats.rocksByTier, { common: 1, rare: 2 });
	assert.equal(stats.emberCoal, 3, 'whole pieces only');
	assert.equal(isEmptyStats(stats), false, 'a player who only mined is not an empty row');
});

test('the rock counters are stored only once they hold something, and an old row reads as zero', () => {
	assert.equal('rocks' in statsToJson(emptyStats()), false);
	assert.equal('rocksByTier' in statsToJson(emptyStats()), false);
	assert.equal('emberCoal' in statsToJson(emptyStats()), false);
	const stored = statsToJson(recordRock(emptyStats(), 'epic', 3));
	assert.equal(stored.rocks, 1);
	const back = readStats(stored);
	assert.equal(back.rocks, 1);
	assert.deepEqual(back.rocksByTier, { epic: 1 });
	assert.equal(back.emberCoal, 3);
	const old = readStats({ chests: 4 });
	assert.equal(old.rocks, 0);
	assert.deepEqual(old.rocksByTier, {});
	const junk = readStats({ rocks: 'many', rocksByTier: { epic: -4, common: 'x', rare: 2 }, emberCoal: Number.NaN });
	assert.equal(junk.rocks, 0);
	assert.deepEqual(junk.rocksByTier, { rare: 2 });
	assert.equal(junk.emberCoal, 0);
});

test('the rock deeds read the counters: all rocks, a tier or better, Ember Coal', () => {
	let stats = emptyStats();
	for (let i = 0; i < 9; i++) stats = recordRock(stats, 'common');
	stats = recordRock(stats, 'uncommon');
	stats = recordRock(stats, 'rare', 1);
	stats = recordRock(stats, 'epic', 2);
	assert.deepEqual(conditionProgress({ kind: 'rocks', min: 10 }, facts(stats)), { cur: 12, goal: 10 });
	assert.deepEqual(conditionProgress({ kind: 'rocksTier', tier: 'rare', min: 10 }, facts(stats)), { cur: 2, goal: 10 }, 'rare or better');
	assert.deepEqual(conditionProgress({ kind: 'rocksTier', tier: 'uncommon', min: 10 }, facts(stats)), { cur: 3, goal: 10 });
	assert.deepEqual(conditionProgress({ kind: 'emberCoal', min: 5 }, facts(stats)), { cur: 3, goal: 5 });
});

test('the mining deeds exist with ladders, and every tier gives gems and points', () => {
	for (const id of ['rock_breaker', 'ore_hoarder', 'ember_finder']) {
		const deed = DEEDS.find((d) => d.id === id);
		assert.ok(deed, id);
		assert.equal(deed.tiers.length, 5);
		for (const tier of deed.tiers) {
			const a = ACHIEVEMENTS.find((x) => x.id === tier);
			assert.ok(a && a.rewards.gems > 0 && (a.rewards.points ?? 0) > 0, tier);
			assert.ok(tier.length <= 40);
		}
	}
});
