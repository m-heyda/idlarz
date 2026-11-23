import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFT_COST_HEADROOM, CRAFT_DISCOUNT_MAX } from '../../src/config/crafting';
import { HARD_LIMITS } from '../../src/config/limits';
import { EMBER_UPGRADES } from '../../src/config/rebirth';
import { GEM_SHOP, NO_GEM_CRAFT, gemCraftOf } from '../../src/config/gemShop';
import { RECIPE_BY_ID } from '../../src/catalog/recipes';
import { craftCostFactor, craftLimit, craftNeeds, craftTimeSec, emptyCraft, finishedOf, maxCraftable, recipeResourceGold } from '../../src/lib/crafting';
import { applyCancel, applyCraft } from '../../src/lib/offline/craft';
import { EMPTY_PRESTIGE } from '../../src/utils/game/rebirth';
import type { LimitContext } from '../../src/lib/limits';
import type { CraftState, Inventory } from '../../src/lib/offline/types';

// IDL-235: the Ember shop (Workbench, Night Shift, Thrifty Hands) and the Gem shop (Master Workbench, Overnight Orders, Bulk Discount) speed crafting up, lengthen a batch's run and cut the resources of a craft.

const ember = (upgrades: Record<string, number>): LimitContext => ({ prestige: { ...EMPTY_PRESTIGE, upgrades } });
const inv = (): Inventory => ({ ver: 1, bag: Array.from({ length: 36 }, () => null), equipment: {}, lootPity: {}, autoSellUpTo: null }) as unknown as Inventory;
const T0 = 5_000_000;

test('the Gem shop items are one-time upgrades with the documented bonuses', () => {
	for (const id of ['master_workbench', 'overnight_orders', 'bulk_discount']) {
		const item = GEM_SHOP.find((i) => i.id === id);
		assert.ok(item && item.kind === 'once' && item.tab === 'upgrades' && item.price > 0, id);
	}
	assert.deepEqual(gemCraftOf(undefined), NO_GEM_CRAFT);
	assert.deepEqual(gemCraftOf({ master_workbench: 1 }), { speed: 0.5, hours: 0, discount: 0 });
	assert.deepEqual(gemCraftOf({ master_workbench: 1, overnight_orders: 1, bulk_discount: 1 }), { speed: 0.5, hours: 24, discount: 0.1 });
});

test('Workbench and Night Shift raise the craft speed and the batch run, the Gem shop adds on top, all under the hard ceiling', () => {
	assert.equal(craftLimit('craftSpeed'), 1);
	assert.equal(craftLimit('craftSpeed', ember({ workbench: 4 })), 2);
	assert.equal(craftLimit('craftSpeed', { ...ember({ workbench: 4 }), gemCraft: gemCraftOf({ master_workbench: 1 }) }), 2.5);
	assert.equal(craftLimit('craftOfflineHours'), 8);
	assert.equal(craftLimit('craftOfflineHours', ember({ nightshift: 3 })), 32);
	assert.equal(craftLimit('craftOfflineHours', { ...ember({ nightshift: 3 }), gemCraft: gemCraftOf({ overnight_orders: 1 }) }), 56);
	// the most the shops give stays inside the hard limits
	assert.ok(1 + EMBER_UPGRADES.workbench.maxLevel * EMBER_UPGRADES.workbench.effectPerLevel + 0.5 <= HARD_LIMITS.craftSpeed);
	assert.ok(8 + EMBER_UPGRADES.nightshift.maxLevel * EMBER_UPGRADES.nightshift.effectPerLevel + 24 <= HARD_LIMITS.craftOfflineHours);
});

test('a batch runs as long as the bonus allows: the offline hours reach finishedOf', () => {
	const entry = { recipeId: 'potion_minor', count: 100_000, startedAt: 0, timeSec: 10 };
	const nowMs = 30 * 3_600_000;
	assert.equal(finishedOf(entry, nowMs), (8 * 3600) / 10, 'eight hours without a bonus');
	assert.equal(finishedOf(entry, nowMs, ember({ nightshift: 3 })), (30 * 3600) / 10, 'Night Shift: the whole 30 hours fit under 32');
});

test('the discount: Thrifty Hands 3% a level and Bulk Discount 10%, never more than the cap, only on resources', () => {
	assert.equal(craftCostFactor(), 1);
	assert.ok(Math.abs(craftCostFactor(ember({ thrifty: 5 })) - 0.85) < 1e-9);
	assert.ok(Math.abs(craftCostFactor({ ...ember({ thrifty: 5 }), gemCraft: gemCraftOf({ bulk_discount: 1 }) }) - (1 - CRAFT_DISCOUNT_MAX)) < 1e-9);
	assert.ok(
		craftCostFactor({ ...ember({ thrifty: 99 }), gemCraft: { speed: 0, hours: 0, discount: 5 } }) >= 1 - CRAFT_DISCOUNT_MAX - 1e-9,
		'the cap holds even for absurd inputs',
	);
	const minor = RECIPE_BY_ID.potion_minor; // 40 food and one Glass Vial
	assert.deepEqual(craftNeeds(minor, 10, 0.75), { resources: [{ key: 'food', qty: 300 }], components: [{ id: 'glass_vial', qty: 10 }] });
	assert.deepEqual(craftNeeds(minor, 1, 0.01).resources, [{ key: 'food', qty: 1 }], 'never below one');
	assert.deepEqual(craftNeeds(minor, 3, 0.85).resources, [{ key: 'food', qty: 102 }], 'rounded up: 3 x 40 x 0.85');
	assert.equal(maxCraftable(minor, { craftLevel: 1, resources: { food: 300 }, stock: { glass_vial: 50 }, costFactor: 0.75 }), 10);
	assert.equal(maxCraftable(minor, { craftLevel: 1, resources: { food: 300 }, stock: { glass_vial: 50 } }), 7, 'without the discount 300 food is 7 crafts');
});

test('queueing with the bonuses: the entry keeps the speed and the discount, the spent value is the discounted one, a cancel refunds what was paid', () => {
	const limits: LimitContext = { ...ember({ workbench: 4, thrifty: 5 }), gemCraft: gemCraftOf({ bulk_discount: 1 }) };
	const minor = RECIPE_BY_ID.potion_minor;
	const craft: CraftState = { ...emptyCraft(), stock: { glass_vial: 10 } };
	const queued = applyCraft(inv(), craft, 'potion_minor', 10, T0, 0, limits);
	assert.equal(queued.ok, true);
	const entry = queued.craft.queue[0];
	assert.equal(entry.timeSec, craftTimeSec(minor, limits));
	assert.equal(entry.timeSec, 7, 'speed 2: 14 s becomes 7 s');
	assert.ok(Math.abs((entry.costFactor ?? 1) - 0.75) < 1e-9);
	assert.ok(Math.abs(queued.craft.spent - recipeResourceGold(minor) * 0.75 * 10) < 1e-6);
	// no bonus: no field, nothing changes for players without the upgrades
	const plain = applyCraft(inv(), craft, 'potion_minor', 10, T0);
	assert.equal(plain.craft.queue[0].costFactor, undefined);
	assert.equal(plain.craft.queue[0].timeSec, 14);
	// cancel at once: all ten refunded at the discounted price, spent back to nothing
	const cancelled = applyCancel(queued.inv, queued.craft, 0, T0 + 2000, { secret: 's', userId: 'u', luck: 0, intelligence: 5, limits });
	assert.equal(cancelled.ok, true);
	assert.deepEqual(cancelled.refund, [{ key: 'food', qty: 300 }]);
	assert.ok(cancelled.craft.spent < 1e-6);
	assert.equal(cancelled.craft.stock.glass_vial, 10, 'the components come back');
});

test('the gear recipes carry the headroom, so even with every discount a craft stays above the sell value (the gate is in gearRecipes.test.ts)', () => {
	assert.ok(Math.abs(CRAFT_COST_HEADROOM * (1 - CRAFT_DISCOUNT_MAX) - 1) < 1e-9);
});
