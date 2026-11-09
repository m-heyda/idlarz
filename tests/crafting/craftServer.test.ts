import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { craftStep, syncTickets, type Online } from '../../src/lib/offline/online';
import { applyCancel, applyClaim, applyCraft, parseCraft, parseSlot } from '../../src/lib/offline/craft';
import { craftFromJson, isEmptyCraft } from '../../src/lib/offline/ledger';
import { emptyCraft } from '../../src/lib/crafting';
import { addDrop, stackOf } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { CRAFTING } from '../../src/config/crafting';
import { craftCumulativeXp, craftLimit } from '../../src/lib/crafting';
import { RECIPE_BY_ID } from '../../src/catalog/recipes';
import { bagCountOf } from '../../src/lib/offline/inventory';
import type { CraftReply, CraftState } from '../../src/lib/offline/types';

// /api/craft: the server checks the recipe, the level and its component stock, takes nothing it cannot give, and a refusal costs nothing.

const memory = () => {
	const rows = new Map<string, StoredSave>();
	const worlds = new Map<string, WorldPart>();
	const stats = new Map<string, StatsRow>();
	const saves: SaveRepo = {
		load: async (id, options) => {
			const row = rows.get(id);
			if (!row) return null;
			return options?.world ? { ...row, world: worlds.get(id) } : { ...row };
		},
		commit: async (id, baseRev, save, world, st) => {
			const current = rows.get(id);
			if (baseRev === 0 ? !!current : current?.rev !== baseRev) return false;
			rows.set(id, save);
			if (world) worlds.set(id, world);
			stats.set(id, st);
			return true;
		},
		archive: async () => undefined,
		pin: async () => undefined,
	};
	const { ledgers, ledgerRepo } = memoryLedgers();
	const deps: ServiceDeps = { saves, ledgers: ledgerRepo, secret: 'test-secret-test-secret' };
	return { saves, ledgers, ledgerRepo, deps };
};

const game = (): PersistedGame => {
	api().resetGame();
	growTo(60);
	api().tick(1000);
	store.setState({ playSeconds: 1000 } as never);
	return structuredClone(pickPersisted(api()));
};

const T0 = 1_800_000_000_000;
const SEC = 1000;
let keyNo = 0;
const key = () => `craft-key-${String(++keyNo).padStart(6, '0')}`;
const ok = <T>(out: Online<T>): T => {
	assert.equal(out.kind, 'ok', JSON.stringify(out));
	return (out as { kind: 'ok'; value: T }).value;
};

const player = async () => {
	const m = memory();
	await acceptSave(m.saves, 'u1', 'Zoë', encodeSave(game()), 0, T0, false, m.ledgerRepo);
	ok(await syncTickets(m.deps, 'u1', T0 + 1000)); // the first online request creates the ledger, seeded from the save
	return { m, ledger: () => m.ledgers.get('u1')! };
};

const craft = async (p: Awaited<ReturnType<typeof player>>, recipeId: string, count: number, at: number, k = key()): Promise<CraftReply> =>
	ok(await craftStep(p.m.deps, 'u1', k, { recipeId, count }, T0 + at));

const claim = async (p: Awaited<ReturnType<typeof player>>, at: number, k = key(), slot = 0): Promise<CraftReply> =>
	ok(await craftStep(p.m.deps, 'u1', k, { action: 'claim', slot }, T0 + at));

/** Queues `count` of a recipe at `at` seconds, waits until all of them are done and claims them. Returns the second the claim was made. */
const craftAndClaim = async (p: Awaited<ReturnType<typeof player>>, recipeId: string, count: number, at: number): Promise<number> => {
	const q = await craft(p, recipeId, count, at * SEC);
	assert.equal(q.ok, true, JSON.stringify(q));
	const done = at + 1 + count * RECIPE_BY_ID[recipeId].timeSec!;
	assert.equal((await claim(p, done * SEC)).ok, true);
	return done;
};

test('a queued vial batch gives nothing until it is claimed; the claim puts vials in the stock with XP and leaves the bag alone', async () => {
	const p = await player();
	const bagBefore = structuredClone(p.ledger().inv!.bag);
	const r = await craft(p, 'glass_vial', 3, 10 * SEC);
	assert.equal(r.ok, true);
	assert.equal(r.queued, 3);
	assert.equal(r.crafted, 0);
	assert.deepEqual(p.ledger().craft.stock, {});
	assert.equal(p.ledger().craft.xp, 0);
	// 10 stone + 5 coal per vial, valued at the merchant prices, counted when the batch is queued
	assert.ok(Math.abs(p.ledger().craft.spent - 3 * 14.5) < 1e-9);
	await claim(p, 50 * SEC);
	assert.deepEqual(p.ledger().craft.stock, { glass_vial: 3 });
	assert.equal(p.ledger().craft.xp, 6);
	assert.equal(p.ledger().craft.ord, 3);
	assert.deepEqual(p.ledger().inv!.bag, bagBefore);
	assert.deepEqual(p.ledger().craft.queue, []);
});

test('a potion takes a vial when it is queued and lands in the crafting stash when it is claimed', async () => {
	const p = await player();
	assert.equal((await craft(p, 'potion_minor', 1, 10 * SEC)).reason, 'no_components');
	assert.equal(p.ledger().craft.xp, 0);
	const t = await craftAndClaim(p, 'glass_vial', 2, 20);
	const before = bagCountOf(p.ledger().inv!, 'potion_minor');
	const q = await craft(p, 'potion_minor', 2, (t + 5) * SEC);
	assert.equal(q.ok, true);
	assert.equal(p.ledger().craft.stock.glass_vial, undefined, 'the vials are taken when the batch is queued');
	assert.equal(p.ledger().craft.stock.potion_minor, undefined, 'nothing in the stash yet');
	const r = await claim(p, (t + 5 + 1 + 28) * SEC);
	assert.equal(r.crafted, 2);
	assert.equal(p.ledger().craft.stock.potion_minor, 2);
	assert.equal(bagCountOf(p.ledger().inv!, 'potion_minor'), before, 'the bag is not touched');
	assert.equal(p.ledger().craft.xp, 4 + 12);
});

test('the greater potion is locked until its crafting level', async () => {
	const p = await player();
	const t = await craftAndClaim(p, 'glass_vial', 1, 10);
	assert.equal((await craft(p, 'potion_greater', 1, (t + 5) * SEC)).reason, 'locked');
	p.ledger().craft.xp = craftCumulativeXp(5);
	assert.equal((await craft(p, 'potion_greater', 1, (t + 10) * SEC)).ok, true);
	await claim(p, (t + 10 + 31) * SEC);
	assert.equal((p.ledger().craft.stock.potion_greater ?? 0) >= 1, true);
});

test('one request per second: a quicker one is refused with no charge, and three full slots refuse the next batch', async () => {
	const p = await player();
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC)).ok, true);
	const fast = await craft(p, 'glass_vial', 1, 10 * SEC + 500);
	assert.equal(fast.reason, 'too_fast');
	assert.equal(p.ledger().craft.queue.length, 1);
	assert.equal((await claim(p, 10 * SEC + 600)).reason, 'too_fast');
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC + CRAFTING.minGapMs)).ok, true);
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC + 2 * CRAFTING.minGapMs)).ok, true);
	const spent3 = p.ledger().craft.spent;
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC + 3 * CRAFTING.minGapMs)).reason, 'queue_full');
	assert.equal(p.ledger().craft.spent, spent3, 'a refused batch charges nothing');
});

test('a full bag does not stop a claim: crafted potions wait in the stash, and a withdrawal needs bag room', async () => {
	const p = await player();
	const t = await craftAndClaim(p, 'glass_vial', 1, 10);
	assert.equal((await craft(p, 'potion_minor', 1, (t + 2) * SEC)).ok, true);
	const led = p.ledger();
	let full = led.inv!.bag.map(() => null) as never[];
	for (let i = 0; i < full.length; i++) full = addDrop(full, { kind: 'gear', item: plainItem('iron_sword') }).bag as never[];
	led.inv = { ...led.inv!, bag: full };
	const r = await claim(p, (t + 2 + 20) * SEC);
	assert.equal(r.ok, true);
	assert.equal(p.ledger().craft.stock.potion_minor, 1);
	assert.deepEqual(p.ledger().craft.queue, []);
	const withdraw = async (at: number) => ok(await craftStep(p.m.deps, 'u1', key(), { action: 'withdraw', id: 'potion_minor', qty: 1 }, T0 + at * SEC));
	assert.equal((await withdraw(t + 30)).reason, 'bag_full');
	assert.equal(p.ledger().craft.stock.potion_minor, 1, 'a refused withdrawal changes nothing');
	const now = p.ledger();
	now.inv = { ...now.inv!, bag: now.inv!.bag.map(() => null) as never[] };
	const moved = await withdraw(t + 32);
	assert.equal(moved.ok, true);
	assert.equal(moved.moved, 1);
	assert.equal(bagCountOf(p.ledger().inv!, 'potion_minor'), 1);
	assert.equal(p.ledger().craft.stock.potion_minor, undefined);
});

test('the same key replays the same answer and queues once', async () => {
	const p = await player();
	const k = key();
	const a = await craft(p, 'glass_vial', 2, 10 * SEC, k);
	const b = await craft(p, 'glass_vial', 2, 20 * SEC, k);
	assert.deepEqual(b, a);
	assert.equal(p.ledger().craft.queue.length, 1);
	assert.equal(p.ledger().craft.queue[0].count, 2);
	assert.ok(Math.abs(p.ledger().craft.spent - 2 * 14.5) < 1e-9, 'paid once');
});

test('the component stock has a cap: the rest of a batch waits for room', () => {
	const inv = { ver: 1, bag: [], equipment: {}, lootPity: {}, autoSellUpTo: null };
	const queue = [{ recipeId: 'glass_vial', count: 5, startedAt: 1000, timeSec: 10 }];
	const state: CraftState = { ...emptyCraft(), stock: { glass_vial: CRAFTING.componentCap - 2 }, queue };
	const claimed = applyClaim(inv, state, 0, 1000 + 60_000);
	assert.equal(claimed.ok, true);
	assert.equal(claimed.crafted, 2);
	assert.equal(claimed.craft.stock.glass_vial, CRAFTING.componentCap);
	assert.equal(claimed.craft.queue[0].count, 3);
	assert.equal(applyClaim(inv, claimed.craft, 0, 1000 + 60_000 + 5000).reason, 'stock_full');
});

test('bad requests are refused', () => {
	const inv = { ver: 1, bag: [], equipment: {}, lootPity: {}, autoSellUpTo: null };
	const c = emptyCraft();
	for (const count of [-1, craftLimit('craftBatchCap') + 1, 1.5, NaN, 0])
		assert.equal(applyCraft(inv, c, 'glass_vial', count, 5000).reason, 'bad_request', String(count));
	assert.equal(applyCraft(inv, c, 'nope', 1, 5000).reason, 'unknown_recipe');
	assert.equal(applyCraft(inv, c, 'constructor', 1, 5000).reason, 'unknown_recipe');
	assert.equal(applyClaim(inv, c, 0, 5000).reason, 'no_batch');
	assert.equal(applyClaim(inv, c, 1.5, 5000).reason, 'no_batch');
	assert.equal(applyCancel(inv, c, -1, 5000).reason, 'no_batch');
	assert.equal(parseCraft({ recipeId: 'glass_vial', count: 2 })?.count, 2);
	assert.equal(parseCraft({ recipeId: 'glass_vial', count: '2' }), null);
	assert.equal(parseCraft({ recipeId: 5, count: 2 }), null);
	assert.deepEqual(parseSlot({}), { slot: 0 });
	assert.deepEqual(parseSlot({ slot: 2 }), { slot: 2 });
	for (const bad of [-1, 1.5, '0', 1000, null]) assert.equal(parseSlot({ slot: bad }), null, String(bad));
});

test('a ledger row without the column, or with a damaged one, reads as zeros', () => {
	for (const raw of [undefined, null, 5, 'x', [], { xp: -3, stock: { a: -1, b: 'x' }, ord: NaN, queue: 'x' }])
		assert.deepEqual(craftFromJson(raw), emptyCraft());
	assert.equal(isEmptyCraft(emptyCraft()), true);
	assert.deepEqual(craftFromJson({ xp: 7, ord: 2, stock: { glass_vial: 3.9 }, spent: 1.5, last: 9 }), {
		xp: 7,
		ord: 2,
		stock: { glass_vial: 3 },
		pity: {},
		spent: 1.5,
		last: 9,
		queue: [],
	});
	assert.equal(stackOf(null), null);
});

test('count 0 only looks: it answers the crafting state and changes nothing', async () => {
	const p = await player();
	await craft(p, 'glass_vial', 2, 10 * SEC);
	const before = structuredClone(p.ledger().craft);
	const r = await craft(p, 'glass_vial', 0, 11 * SEC);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 0);
	assert.deepEqual(r.craft, before);
	assert.deepEqual(p.ledger().craft, before);
	assert.equal(parseCraft({ recipeId: 'glass_vial', count: -1 }), null);
});

test('claiming twice with the same key delivers once; cancelling refunds the unfinished part once', async () => {
	const p = await player();
	assert.equal((await craft(p, 'glass_vial', 4, 10 * SEC)).ok, true);
	// 25 s later 2 of 4 vials are done (10 s each)
	const k = key();
	const a = await claim(p, 35 * SEC, k);
	const b = await claim(p, 99 * SEC, k);
	assert.deepEqual(b, a);
	assert.equal(a.crafted, 2);
	assert.deepEqual(p.ledger().craft.stock, { glass_vial: 2 });
	assert.deepEqual(p.ledger().craft.queue, [{ recipeId: 'glass_vial', count: 2, startedAt: T0 + 10 * SEC + 20 * SEC, timeSec: 10 }]);
	const spentBefore = p.ledger().craft.spent;
	// 6 s into the next vial: the last 2 are unfinished, their stone and coal are named in the refund
	const ck = key();
	const c = ok(await craftStep(p.m.deps, 'u1', ck, { action: 'cancel', slot: 0 }, T0 + 36 * SEC + 600));
	assert.equal(c.ok, true);
	assert.deepEqual(c.refund, [
		{ key: 'stone', qty: 20 },
		{ key: 'coal', qty: 10 },
	]);
	assert.deepEqual(p.ledger().craft.queue, []);
	assert.ok(Math.abs(p.ledger().craft.spent - (spentBefore - 2 * 14.5)) < 1e-9);
	const again = ok(await craftStep(p.m.deps, 'u1', ck, { action: 'cancel', slot: 0 }, T0 + 60 * SEC));
	assert.deepEqual(again, c);
	assert.equal((await claim(p, 70 * SEC)).reason, 'no_batch');
});

test('a trade good is level-gated, takes its components when queued, and lands in the crafting stash when claimed', () => {
	const inv = { ver: 1, bag: Array.from({ length: 36 }, () => null), equipment: {}, lootPity: {}, autoSellUpTo: null } as unknown as Parameters<
		typeof applyCraft
	>[0];
	const satchel = RECIPE_BY_ID.leather_satchel;
	const rich: CraftState = { ...emptyCraft(), xp: craftCumulativeXp(satchel.unlock), stock: { cured_leather: 7 } };

	assert.equal(applyCraft(inv, { ...rich, xp: 0 }, 'leather_satchel', 1, T0).reason, 'locked');
	assert.equal(applyCraft(inv, { ...rich, stock: { cured_leather: 2 } }, 'leather_satchel', 1, T0).reason, 'no_components');

	const queued = applyCraft(inv, rich, 'leather_satchel', 2, T0);
	assert.equal(queued.ok, true);
	assert.equal(queued.craft.stock.cured_leather, 1, '2 satchels take 6 of 7 pieces of cured leather');
	assert.equal(queued.craft.stock.leather_satchel, undefined, 'nothing in the stash before the claim');

	const claimed = applyClaim(queued.inv, queued.craft, 0, T0 + 2 * satchel.timeSec! * SEC + SEC);
	assert.equal(claimed.crafted, 2);
	assert.equal(claimed.craft.stock.leather_satchel, 2);
	assert.equal(bagCountOf(claimed.inv, 'leather_satchel'), 0);
	assert.equal(claimed.craft.xp, rich.xp + 2 * satchel.xp);

	let bag = inv.bag;
	for (let i = 0; i < 36; i++) bag = addDrop(bag, { kind: 'gear', item: plainItem('iron_sword') }).bag as typeof bag;
	const full = { ...inv, bag };
	const stuck = applyClaim(full, queued.craft, 0, T0 + 2 * satchel.timeSec! * SEC + SEC);
	assert.equal(stuck.ok, true, 'a full bag does not stop a claim');
});
