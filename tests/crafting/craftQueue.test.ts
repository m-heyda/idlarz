import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { RECIPE_BY_ID } from '../../src/catalog/recipes';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { craftLimit, craftTimeSec, emptyCraft, finishedOf, nextDoneAt } from '../../src/lib/crafting';
import { applyCancel, applyClaim, applyCraft } from '../../src/lib/offline/craft';
import { bagCountOf } from '../../src/lib/offline/inventory';
import { addDrop } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { limitOf, LIMIT_BONUSES } from '../../src/lib/limits';
import type { CraftQueueEntry, CraftState, Inventory } from '../../src/lib/offline/types';

// The timed batch queue (docs/plan/crafting-v0.md): the finished count is derived from the clock, a claim shortens the entry, a cancel refunds
// the unfinished part, and every limit is data under a hard ceiling.

const inv = (): Inventory => ({ ver: 1, bag: Array.from({ length: 36 }, () => null), equipment: {}, lootPity: {}, autoSellUpTo: null }) as unknown as Inventory;
const HOUR = 3_600_000;
const entry = (over: Partial<CraftQueueEntry> = {}): CraftQueueEntry => ({ recipeId: 'potion_minor', count: 10, startedAt: 1_000_000, timeSec: 14, ...over });
const withQueue = (...queue: CraftQueueEntry[]): CraftState => ({ ...emptyCraft(), queue });

test('finished = min(count, floor(elapsed / timeSec)), derived from the clock only', () => {
	const e = entry();
	assert.equal(finishedOf(e, e.startedAt), 0);
	assert.equal(finishedOf(e, e.startedAt - 5000), 0, 'a clock before the start never goes negative');
	assert.equal(finishedOf(e, e.startedAt + 13_999), 0);
	assert.equal(finishedOf(e, e.startedAt + 14_000), 1);
	assert.equal(finishedOf(e, e.startedAt + 70_000), 5);
	assert.equal(finishedOf(e, e.startedAt + 1e9), 10);
	assert.equal(nextDoneAt(e, e.startedAt + 15_000), e.startedAt + 28_000);
	assert.equal(nextDoneAt(e, e.startedAt + 1e9), null);
});

test('a batch of 1,000 potions runs about 4 hours', () => {
	const e = entry({ count: 1000 });
	assert.equal(finishedOf(e, e.startedAt + 1000 * 14_000 - 1), 999);
	assert.equal(finishedOf(e, e.startedAt + 1000 * 14_000), 1000);
	assert.ok((1000 * 14) / 3600 > 3.8 && (1000 * 14) / 3600 < 4);
});

test('the offline run cap stops a batch nobody claims; the claim moves the clock on', () => {
	const e = entry({ count: 1000, timeSec: 60 });
	const cap = craftLimit('craftOfflineHours');
	const done = finishedOf(e, e.startedAt + 100 * HOUR);
	assert.equal(done, Math.floor((cap * HOUR) / 60_000));
	assert.ok(done < 1000);
	assert.equal(nextDoneAt(e, e.startedAt + 100 * HOUR), null, 'stopped at the cap');
	const claimed = applyClaim(inv(), withQueue(e), 0, e.startedAt + 100 * HOUR);
	assert.equal(claimed.ok, true);
	const paid = claimed.crafted ?? 0;
	assert.ok(paid > 0 && paid <= done);
	assert.equal(claimed.craft.queue[0].count, 1000 - paid);
	assert.equal(claimed.craft.queue[0].startedAt, e.startedAt + paid * 60_000);
});

test('a claim pays the finished part, the XP and shortens the entry; the rest keeps running', () => {
	const e = entry();
	const now = e.startedAt + 45_000; // 3 done (14 s each), 3 s into the 4th
	const r = applyClaim(inv(), withQueue(e), 0, now);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 3);
	assert.equal(bagCountOf(r.inv, 'potion_minor'), 3);
	assert.equal(r.craft.xp, 3 * RECIPE_BY_ID.potion_minor.xp);
	assert.equal(r.craft.ord, 3);
	assert.deepEqual(r.craft.queue, [{ ...e, count: 7, startedAt: e.startedAt + 42_000 }]);
	// the clock did not lose the 3 s already spent on the next craft
	assert.equal(finishedOf(r.craft.queue[0], now), 0);
	assert.equal(finishedOf(r.craft.queue[0], now + 11_000), 1);
	assert.equal(applyClaim(inv(), r.craft, 0, now + 2000).reason, 'nothing_ready');
});

test('a bag with room for only some delivers those and the rest waits in the batch (never gold)', () => {
	const max = ITEM_CATALOG.potion_minor.stackMax ?? 1;
	assert.ok(max > 3);
	let bag = addDrop(inv().bag, { kind: 'consumable', id: 'potion_minor', qty: max - 3 }).bag;
	while (true) {
		const next = addDrop(bag, { kind: 'gear', item: plainItem('iron_sword') });
		if (next.overflow > 0) break;
		bag = next.bag;
	}
	const e = entry({ count: 5 });
	const start: Inventory = { ...inv(), bag };
	const r = applyClaim(start, withQueue(e), 0, e.startedAt + 5 * 14_000);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 3, 'only the 3 that fit');
	assert.equal(bagCountOf(r.inv, 'potion_minor'), max);
	assert.equal(r.craft.xp, 3 * RECIPE_BY_ID.potion_minor.xp);
	assert.deepEqual(r.craft.queue, [{ ...e, count: 2, startedAt: e.startedAt + 3 * 14_000 }]);
	assert.equal(finishedOf(r.craft.queue[0], e.startedAt + 5 * 14_000), 2, 'the waiting ones are still finished');
	assert.equal(applyClaim(r.inv, r.craft, 0, e.startedAt + 6 * 14_000).reason, 'bag_full');
});

test('queueing needs a free slot, takes the vials now and counts the spend up front', () => {
	const c: CraftState = { ...emptyCraft(), stock: { glass_vial: 3 } };
	const q = applyCraft(inv(), c, 'potion_minor', 3, 5_000_000);
	assert.equal(q.ok, true);
	assert.equal(q.queued, 3);
	assert.deepEqual(q.craft.stock, {});
	assert.deepEqual(q.craft.queue, [{ recipeId: 'potion_minor', count: 3, startedAt: 5_000_000, timeSec: 14 }]);
	assert.equal(q.craft.xp, 0, 'the XP comes with the claim');
	assert.ok(q.craft.spent > 0);
	assert.equal(applyCraft(inv(), { ...q.craft, stock: { glass_vial: 3 } }, 'potion_minor', 1, 9_000_000).reason, 'queue_full');
});

test('cancel delivers the finished part, ends the rest and names the refund (components go back to the stock)', () => {
	const e = entry({ count: 10 });
	const c: CraftState = { ...withQueue(e), spent: 1000 };
	const r = applyCancel(inv(), c, 0, e.startedAt + 30_000); // 2 done, 8 unfinished
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 2);
	assert.deepEqual(r.craft.queue, []);
	assert.equal(r.craft.stock.glass_vial, 8);
	assert.deepEqual(r.refund, [{ key: 'food', qty: 8 * 40 }]);
	assert.equal(r.craft.xp, 2 * RECIPE_BY_ID.potion_minor.xp);
	assert.ok(r.craft.spent < 1000);
	// a batch that is all finished refunds nothing
	const done = applyCancel(inv(), withQueue(e), 0, e.startedAt + 1e9);
	assert.deepEqual(done.refund, []);
	assert.equal(done.crafted, 10);
});

test('speed shortens a craft; the time is fixed into the entry when queued', () => {
	const minor = RECIPE_BY_ID.potion_minor;
	assert.equal(craftTimeSec(minor), 14);
	const saved = LIMIT_BONUSES.craftSpeed;
	LIMIT_BONUSES.craftSpeed = () => 1;
	try {
		assert.equal(craftTimeSec(minor), 7);
		const c: CraftState = { ...emptyCraft(), stock: { glass_vial: 1 } };
		assert.equal(applyCraft(inv(), c, 'potion_minor', 1, 5_000_000).craft.queue[0].timeSec, 7);
	} finally {
		if (saved) LIMIT_BONUSES.craftSpeed = saved;
		else delete LIMIT_BONUSES.craftSpeed;
	}
});

test('every crafting limit is data with a hard ceiling: bonuses raise it, never past the ceiling', () => {
	assert.equal(LIMITS.craftBatchCap, 10);
	assert.equal(HARD_LIMITS.craftBatchCap, 1000);
	for (const key of ['craftBatchCap', 'craftQueueSlots', 'craftOfflineHours', 'craftSpeed'] as const) {
		assert.ok(LIMITS[key] <= HARD_LIMITS[key], key);
		const saved = LIMIT_BONUSES[key];
		LIMIT_BONUSES[key] = () => 1e9;
		try {
			assert.equal(craftLimit(key), HARD_LIMITS[key], `${key} stops at its ceiling`);
			assert.ok(limitOf(key) > HARD_LIMITS[key], 'the raw limit is not clamped, craftLimit is');
		} finally {
			if (saved) LIMIT_BONUSES[key] = saved;
			else delete LIMIT_BONUSES[key];
		}
	}
});

test('a raised batch cap allows a batch of 1,000 and not one more', () => {
	const saved = LIMIT_BONUSES.craftBatchCap;
	LIMIT_BONUSES.craftBatchCap = () => 1e9;
	try {
		const c: CraftState = { ...emptyCraft(), stock: { glass_vial: 2000 } };
		assert.equal(applyCraft(inv(), c, 'potion_minor', 1001, 5_000_000).reason, 'bad_request');
		const q = applyCraft(inv(), c, 'potion_minor', 1000, 5_000_000);
		assert.equal(q.ok, true);
		assert.equal(q.craft.queue[0].count, 1000);
	} finally {
		if (saved) LIMIT_BONUSES.craftBatchCap = saved;
		else delete LIMIT_BONUSES.craftBatchCap;
	}
});
