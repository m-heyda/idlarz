import test from 'node:test';
import assert from 'node:assert/strict';
import { CASTLE_UPGRADE } from '../../src/config/castle';
import { RESOURCES } from '../../src/catalog/resources';

// The castle's later steps eat the biome extracts (owner 2026-11-24): the Extractors feed the main progression, but the rebirth gate (castle 6) never needs one.

const EXTRACTS = ['herbs', 'sap', 'ironOre', 'spores', 'frostshard', 'pearls', 'salt'] as const;
const extractsOf = (cost: Record<string, number>) => EXTRACTS.filter((key) => (cost[key] ?? 0) > 0);

test('no castle step up to level 6 needs an extract, so the rebirth gate and the first hours never wait for an Extractor', () => {
	for (let i = 0; i < 5; i++) assert.deepEqual(extractsOf(CASTLE_UPGRADE.upgradeCosts[i]), [], `level ${i + 1} to ${i + 2}`);
});

test('from level 7 on each step eats one extract, the home biomes first, about three times more every step', () => {
	const order = ['herbs', 'sap', 'ironOre', 'spores', 'frostshard', 'pearls', 'salt', 'herbs', 'sap'];
	order.forEach((key, k) => {
		const cost = CASTLE_UPGRADE.upgradeCosts[5 + k];
		assert.deepEqual(extractsOf(cost), [key], `level ${6 + k} to ${7 + k}`);
		assert.ok(Math.abs(cost[key] / (1500 * 3 ** k) - 1) < 0.25, `${key}: ${cost[key]}`);
	});
	assert.equal(CASTLE_UPGRADE.upgradeCosts.length, 14);
});

test('the extracts keep their cheap merchant sale and count for more as crafting inputs', () => {
	for (const key of EXTRACTS) {
		assert.equal(RESOURCES[key].merchant.price, 5, key);
		assert.equal((RESOURCES[key] as { craftValue?: number }).craftValue, 50, key);
	}
});
