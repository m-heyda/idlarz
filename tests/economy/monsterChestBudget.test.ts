import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTER_CHEST, MONSTER_CHEST_TIERS } from '../../src/config/monsterChests';

// IDL-163: the average monster chest of every tier is worth at most 10 % of an hour of income (minutes of income, worked out from the config; `npm run loot-sim` prints the same table).

test('the average chest of every tier is at most 10 % of an hour of income', () => {
	for (const tier of MONSTER_CHEST_TIERS) {
		const [lo, hi] = MONSTER_CHEST.tiers[tier].minutes;
		const average = (lo + hi) / 2;
		assert.ok(lo > 0 && hi >= lo, `${tier}: a sane range`);
		assert.ok(
			average / 60 <= MONSTER_CHEST.maxHourlyShare + 1e-12,
			`${tier} averages ${average} minutes, over ${MONSTER_CHEST.maxHourlyShare * 100} % of an hour`,
		);
	}
	assert.equal(MONSTER_CHEST.maxHourlyShare, 0.1);
});

test('the tiers grow: a later biome chest is worth at least as much as the one before, and the boss chest is the richest of the lot', () => {
	const average = (tier: keyof typeof MONSTER_CHEST.tiers) => (MONSTER_CHEST.tiers[tier].minutes[0] + MONSTER_CHEST.tiers[tier].minutes[1]) / 2;
	const order = ['wooden', 'iron', 'mossy', 'coral', 'frost', 'magma'] as const;
	for (let i = 1; i < order.length; i++) assert.ok(average(order[i]) >= average(order[i - 1]), `${order[i]} is not below ${order[i - 1]}`);
	assert.ok(average('royal') >= average('magma') && average('arcane') >= average('magma'));
});

test('the contents: no gems, no stat gifts, weights add up to a whole roll', () => {
	assert.deepEqual(Object.keys(MONSTER_CHEST.kinds).sort(), ['gold', 'resource', 'xp']);
	assert.equal(MONSTER_CHEST.kinds.gold + MONSTER_CHEST.kinds.resource + MONSTER_CHEST.kinds.xp, 100);
	assert.equal(MONSTER_CHEST.dropChance, 0.02);
});
