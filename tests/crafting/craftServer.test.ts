import test from 'node:test';
import assert from 'node:assert/strict';
import { api, growTo, store } from '../helpers';
import { memoryLedgers } from '../builders';
import { pickPersisted, type PersistedGame } from '../../src/lib/sanitizeSave';
import { encodeSave } from '../../src/lib/saveFormat';
import { acceptSave, type SaveRepo, type StatsRow, type StoredSave, type WorldPart } from '../../src/lib/cloudSave/pipeline';
import type { ServiceDeps } from '../../src/lib/offline/service';
import { craftStep, syncTickets, type Online } from '../../src/lib/offline/online';
import { applyCraft, parseCraft } from '../../src/lib/offline/craft';
import { craftFromJson, isEmptyCraft } from '../../src/lib/offline/ledger';
import { emptyCraft } from '../../src/lib/crafting';
import { addDrop, stackOf } from '../../src/lib/inventory';
import { plainItem } from '../../src/lib/itemInstance';
import { CRAFTING } from '../../src/config/crafting';
import { craftCumulativeXp } from '../../src/lib/crafting';
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

test('a vial goes to the component stock, with XP, and leaves the bag alone', async () => {
	const p = await player();
	const bagBefore = structuredClone(p.ledger().inv!.bag);
	const r = await craft(p, 'glass_vial', 3, 10 * SEC);
	assert.equal(r.ok, true);
	assert.equal(r.crafted, 3);
	assert.deepEqual(p.ledger().craft.stock, { glass_vial: 3 });
	assert.equal(p.ledger().craft.xp, 6);
	assert.equal(p.ledger().craft.ord, 3);
	assert.deepEqual(p.ledger().inv!.bag, bagBefore);
	assert.deepEqual(r.craft, p.ledger().craft);
	// 10 stone + 5 coal per vial, valued at the merchant prices
	assert.ok(Math.abs(p.ledger().craft.spent - 3 * 14.5) < 1e-9);
});

test('a potion takes a vial and lands in the bag as a stack next to the shop potions', async () => {
	const p = await player();
	assert.equal((await craft(p, 'potion_minor', 1, 10 * SEC)).reason, 'no_components');
	assert.equal(p.ledger().craft.xp, 0);
	await craft(p, 'glass_vial', 2, 20 * SEC);
	const before = bagCountOf(p.ledger().inv!, 'potion_minor');
	const verBefore = p.ledger().inv!.ver;
	const r = await craft(p, 'potion_minor', 2, 30 * SEC);
	assert.equal(r.ok, true);
	assert.equal(bagCountOf(p.ledger().inv!, 'potion_minor'), before + 2);
	assert.ok(p.ledger().inv!.ver > verBefore);
	assert.equal(r.inv.ver, p.ledger().inv!.ver);
	assert.equal(p.ledger().craft.stock.glass_vial, undefined);
	assert.equal(p.ledger().craft.xp, 4 + 12);
});

test('the greater potion is locked until its crafting level', async () => {
	const p = await player();
	await craft(p, 'glass_vial', 1, 10 * SEC);
	assert.equal((await craft(p, 'potion_greater', 1, 20 * SEC)).reason, 'locked');
	p.ledger().craft.xp = craftCumulativeXp(5);
	assert.equal((await craft(p, 'potion_greater', 1, 30 * SEC)).ok, true);
	assert.equal(bagCountOf(p.ledger().inv!, 'potion_greater') >= 1, true);
});

test('one request per second: a quicker one is refused with no charge', async () => {
	const p = await player();
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC)).ok, true);
	const fast = await craft(p, 'glass_vial', 1, 10 * SEC + 500);
	assert.equal(fast.reason, 'too_fast');
	assert.equal(p.ledger().craft.stock.glass_vial, 1);
	assert.equal((await craft(p, 'glass_vial', 1, 10 * SEC + CRAFTING.minGapMs)).ok, true);
	assert.equal(p.ledger().craft.stock.glass_vial, 2);
});

test('a full bag refuses a potion craft and keeps the vials and the XP', async () => {
	const p = await player();
	await craft(p, 'glass_vial', 1, 10 * SEC);
	const led = p.ledger();
	let full = led.inv!.bag.map(() => null) as never[];
	for (let i = 0; i < full.length; i++) full = addDrop(full, { kind: 'gear', item: plainItem('iron_sword') }).bag as never[];
	led.inv = { ...led.inv!, bag: full };
	const xp = led.craft.xp;
	const r = await craft(p, 'potion_minor', 1, 20 * SEC);
	assert.equal(r.ok, false);
	assert.equal(r.reason, 'bag_full');
	assert.equal(p.ledger().craft.stock.glass_vial, 1);
	assert.equal(p.ledger().craft.xp, xp);
	assert.equal(p.ledger().craft.last, T0 + 10 * SEC, 'a refused craft does not start the cooldown');
});

test('a full bag still takes a potion into a stack that has room', async () => {
	const p = await player();
	await craft(p, 'glass_vial', 1, 10 * SEC);
	const led = p.ledger();
	let full = led.inv!.bag.map(() => null) as never[];
	full = addDrop(full, { kind: 'consumable', id: 'potion_minor', qty: 5 }).bag as never[];
	for (let i = 0; i < full.length; i++) full = addDrop(full, { kind: 'gear', item: plainItem('iron_sword') }).bag as never[];
	led.inv = { ...led.inv!, bag: full };
	assert.equal((await craft(p, 'potion_minor', 1, 20 * SEC)).ok, true);
	assert.equal(bagCountOf(p.ledger().inv!, 'potion_minor'), 6);
});

test('the same key replays the same answer and crafts once', async () => {
	const p = await player();
	const k = key();
	const a = await craft(p, 'glass_vial', 2, 10 * SEC, k);
	const b = await craft(p, 'glass_vial', 2, 20 * SEC, k);
	assert.deepEqual(b, a);
	assert.equal(p.ledger().craft.stock.glass_vial, 2);
	assert.equal(p.ledger().craft.ord, 2);
});

test('the component stock has a cap', () => {
	const inv = { ver: 1, bag: [], equipment: {}, lootPity: {}, autoSellUpTo: null };
	let state: CraftState = { ...emptyCraft(), stock: { glass_vial: CRAFTING.componentCap - 1 } };
	const first = applyCraft(inv, state, 'glass_vial', 1, 5000);
	assert.equal(first.ok, true);
	state = first.craft;
	assert.equal(applyCraft(inv, state, 'glass_vial', 1, 9000).reason, 'stock_full');
});

test('bad requests are refused', () => {
	const inv = { ver: 1, bag: [], equipment: {}, lootPity: {}, autoSellUpTo: null };
	const c = emptyCraft();
	for (const count of [-1, 11, 1.5, NaN, 0]) assert.equal(applyCraft(inv, c, 'glass_vial', count, 5000).reason, 'bad_request', String(count));
	assert.equal(applyCraft(inv, c, 'nope', 1, 5000).reason, 'unknown_recipe');
	assert.equal(applyCraft(inv, c, 'constructor', 1, 5000).reason, 'unknown_recipe');
	assert.equal(parseCraft({ recipeId: 'glass_vial', count: 2 })?.count, 2);
	assert.equal(parseCraft({ recipeId: 'glass_vial', count: '2' }), null);
	assert.equal(parseCraft({ recipeId: 5, count: 2 }), null);
});

test('a ledger row without the column, or with a damaged one, reads as zeros', () => {
	for (const raw of [undefined, null, 5, 'x', [], { xp: -3, stock: { a: -1, b: 'x' }, ord: NaN }]) assert.deepEqual(craftFromJson(raw), emptyCraft());
	assert.equal(isEmptyCraft(emptyCraft()), true);
	assert.deepEqual(craftFromJson({ xp: 7, ord: 2, stock: { glass_vial: 3.9 }, spent: 1.5, last: 9 }), {
		xp: 7,
		ord: 2,
		stock: { glass_vial: 3 },
		pity: {},
		spent: 1.5,
		last: 9,
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
