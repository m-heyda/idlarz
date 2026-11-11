import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPE_BY_ID } from '../../src/catalog/recipes';
import { CRAFTING } from '../../src/config/crafting';
import { HARD_LIMITS, LIMITS } from '../../src/config/limits';
import { craftLimit, craftTimeSec, craftXpOf, emptyCraft, finishedOf, nextDoneAt } from '../../src/lib/crafting';
import { applyCancel, applyClaim, applyClaimAll, applyCraft, applyWithdraw } from '../../src/lib/offline/craft';
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
	assert.equal(r.craft.stock.potion_minor, 3, 'potions go to the crafting stash, not the bag');
	assert.equal(bagCountOf(r.inv, 'potion_minor'), 0);
	assert.equal(r.craft.xp, craftXpOf(RECIPE_BY_ID.potion_minor, 3));
	assert.equal(r.craft.ord, 3);
	assert.deepEqual(r.craft.queue, [{ ...e, count: 7, startedAt: e.startedAt + 42_000 }]);
	// the clock did not lose the 3 s already spent on the next craft
	assert.equal(finishedOf(r.craft.queue[0], now), 0);
	assert.equal(finishedOf(r.craft.queue[0], now + 11_000), 1);
	assert.equal(applyClaim(inv(), r.craft, 0, now + 2000).reason, 'nothing_ready');
});

test('a stash with room for only some delivers those and the rest waits in the batch (never gold)', () => {
	const cap = CRAFTING.componentCap;
	const e = entry({ count: 5 });
	const c: CraftState = { ...withQueue(e), stock: { potion_minor: cap - 3 } };
	const r = applyClaim(inv(), c, 0, e.startedAt + 5 * 14_000);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 3, 'only the 3 that fit');
	assert.equal(r.craft.stock.potion_minor, cap);
	assert.equal(r.craft.xp, craftXpOf(RECIPE_BY_ID.potion_minor, 3));
	assert.deepEqual(r.craft.queue, [{ ...e, count: 2, startedAt: e.startedAt + 3 * 14_000 }]);
	assert.equal(applyClaim(inv(), r.craft, 0, e.startedAt + 6 * 14_000).reason, 'stock_full');
});

test('the queue holds three batches side by side; a fourth is refused', () => {
	assert.equal(craftLimit('craftQueueSlots'), 3);
	let c: CraftState = { ...emptyCraft(), stock: { glass_vial: 10 } };
	for (let i = 0; i < 3; i++) {
		const q = applyCraft(inv(), c, 'potion_minor', 1, 5_000_000 + i * 2000);
		assert.equal(q.ok, true, `batch ${i + 1}`);
		c = q.craft;
	}
	assert.equal(c.queue.length, 3);
	assert.equal(applyCraft(inv(), c, 'potion_minor', 1, 5_100_000).reason, 'queue_full');
});

test('a batch is not limited to a handful: a million crafts queue in one request', () => {
	const c: CraftState = { ...emptyCraft(), stock: { glass_vial: 2_000_000 } };
	const q = applyCraft(inv(), c, 'potion_minor', 1_000_000, 5_000_000);
	assert.equal(q.ok, true);
	assert.equal(q.craft.queue[0].count, 1_000_000);
	assert.equal(applyCraft(inv(), c, 'potion_minor', HARD_LIMITS.craftBatchCap + 1, 5_000_000).reason, 'bad_request');
});

test('Collect all delivers every finished batch in one request and keeps the unfinished ones', () => {
	const a = entry({ recipeId: 'potion_minor', count: 4, startedAt: 1_000_000, timeSec: 14 });
	const b = entry({ recipeId: 'glass_vial', count: 5, startedAt: 1_000_000, timeSec: 10 });
	const late = entry({ recipeId: 'potion_greater', count: 2, startedAt: 1_000_000 + 100_000, timeSec: 30 });
	const now = 1_000_000 + 60_000; // a: 4 done, b: 5 done, late: not started
	const r = applyClaimAll(inv(), withQueue(a, b, late), now);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 9);
	assert.equal(r.craft.stock.potion_minor, 4);
	assert.equal(r.craft.stock.glass_vial, 5);
	assert.deepEqual(r.craft.queue, [late]);
	assert.equal(applyClaimAll(inv(), r.craft, now + 2000).reason, 'nothing_ready');
});

test('the crafting stash is what a withdrawal draws from: as many as fit move to the bag', () => {
	const c: CraftState = { ...emptyCraft(), stock: { potion_minor: 150, glass_vial: 4 } };
	const r = applyWithdraw(inv(), c, 'potion_minor', 120, 5_000_000);
	assert.equal(r.ok, true);
	assert.equal(r.moved, 120);
	assert.equal(bagCountOf(r.inv, 'potion_minor'), 120);
	assert.equal(r.craft.stock.potion_minor, 30);
	assert.equal(applyWithdraw(inv(), c, 'glass_vial', 1, 5_000_000).reason, 'bad_request', 'components stay in the stash');
	assert.equal(applyWithdraw(inv(), emptyCraft(), 'potion_minor', 1, 5_000_000).reason, 'not_in_stash');
	// only the room there is moves
	let bag = inv().bag;
	while (true) {
		const next = addDrop(bag, { kind: 'gear', item: plainItem('iron_sword') });
		if (next.overflow > 0) break;
		bag = next.bag;
	}
	assert.equal(applyWithdraw({ ...inv(), bag }, c, 'potion_minor', 5, 5_000_000).reason, 'bag_full');
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
	assert.equal(q.craft.queue.length, 1);
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
	assert.equal(r.craft.xp, craftXpOf(RECIPE_BY_ID.potion_minor, 2));
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
	assert.equal(LIMITS.craftBatchCap, 1_000_000_000);
	assert.equal(HARD_LIMITS.craftBatchCap, 1_000_000_000);
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
