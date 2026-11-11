import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBootSnapshot, sendsBootSnapshot } from '@/lib/offline/bootSnapshot';
import { clearBootSnapshot, stageBootSnapshot, takeBootSnapshot } from '@/lib/bootSnapshot';
import { useCraftStore } from '@/stores/craftStore';
import { fetchMe } from '@/lib/authClient';
import type { BootSnapshot, Inventory } from '@/lib/offline/types';
import { emptyCraft } from '@/lib/crafting';

// IDL: the Bag's Crafting tab opened empty for a second because the crafting state was only asked when the window opened. `/api/auth/me?game=1`
// now carries the bag and crafting state of the first load; these tests hold the response, the hydration and the account switch.

const inv = (ver = 3): Inventory => ({ ver, bag: [null, null], equipment: {}, lootPity: {}, autoSellUpTo: null });

/** A stand-in for the Supabase client: `from('player_ledger').select(..).eq(..).maybeSingle()` answers `result`. */
const fakeDb = (result: { data: unknown; error: unknown }, seen: { select?: string; user?: string } = {}) =>
	({
		from: (table: string) => {
			assert.equal(table, 'player_ledger');
			return {
				select: (columns: string) => {
					seen.select = columns;
					return { eq: (_col: string, id: string) => ((seen.user = id), { maybeSingle: async () => result }) };
				},
			};
		},
	}) as never;

test('a populated ledger answers its bag and crafting state, read with one select of the two columns', async () => {
	const seen: { select?: string; user?: string } = {};
	const craft = {
		xp: 40,
		ord: 2,
		stock: { glass_vial: 5 },
		pity: {},
		spent: 0,
		last: 0,
		queue: [{ recipeId: 'glass_vial', count: 2, startedAt: 10, timeSec: 30 }],
	};
	const snap = await loadBootSnapshot(fakeDb({ data: { inv: inv(), craft }, error: null }, seen), 'u1', 5_500);
	assert.equal(seen.select, 'inv, craft');
	assert.equal(seen.user, 'u1');
	assert.deepEqual(snap?.inv, inv());
	assert.equal(snap?.craft.stock.glass_vial, 5);
	assert.equal(snap?.craft.queue.length, 1);
	assert.equal(snap?.serverNowSec, 5);
});

test('an empty ledger (a new account) answers no inventory and an empty crafting state', async () => {
	assert.deepEqual(await loadBootSnapshot(fakeDb({ data: null, error: null }), 'u1', 1000), { inv: null, craft: emptyCraft(), serverNowSec: 1 });
	// a row that never crafted has a null craft column
	assert.deepEqual((await loadBootSnapshot(fakeDb({ data: { inv: inv(), craft: null }, error: null }), 'u1', 1000))?.craft, emptyCraft());
});

test('a failed read is no snapshot, never an error for the sign-in', async () => {
	assert.equal(await loadBootSnapshot(fakeDb({ data: null, error: { message: 'down' } }), 'u1', 1000), null);
	const throwing = {
		from: () => {
			throw new Error('boom');
		},
	} as never;
	assert.equal(await loadBootSnapshot(throwing, 'u1', 1000), null);
});

test('gameplay data is sent only when asked for, for an account with a profile, and never on a stale epoch (needsReset)', () => {
	assert.equal(sendsBootSnapshot({ wanted: true, hasProfile: true, needsReset: false }), true);
	assert.equal(sendsBootSnapshot({ wanted: true, hasProfile: true, needsReset: true }), false);
	assert.equal(sendsBootSnapshot({ wanted: true, hasProfile: false, needsReset: false }), false);
	assert.equal(sendsBootSnapshot({ wanted: false, hasProfile: true, needsReset: false }), false);
});

test('the client takes the game part of the answer and asks for it with ?game=1 only when it wants it', async () => {
	const urls: string[] = [];
	const game: BootSnapshot = { inv: inv(), craft: emptyCraft(), serverNowSec: 9 };
	const original = globalThis.fetch;
	globalThis.fetch = (async (url: string) => {
		urls.push(url);
		return new Response(JSON.stringify({ user: { id: 'u1' }, profile: null, epoch: 1, game: url.includes('game=1') ? game : undefined }), { status: 200 });
	}) as never;
	try {
		const withGame = await fetchMe({ game: true });
		const plain = await fetchMe();
		assert.deepEqual(urls, ['/api/auth/me?game=1', '/api/auth/me']);
		assert.equal(withGame.status === 'ok' && withGame.game?.serverNowSec, 9);
		assert.equal(plain.status === 'ok' && plain.game, undefined);
	} finally {
		globalThis.fetch = original;
	}
});

test('the crafting store is filled synchronously by the first load: it never passes through an empty state', () => {
	useCraftStore.getState().reset();
	const seen: (object | null)[] = [];
	const unsubscribe = useCraftStore.subscribe((state) => seen.push(state.craft));
	const craft = { ...emptyCraft(), xp: 12, stock: { glass_vial: 3 } };
	useCraftStore.getState().hydrate('u1', { craft, serverNowSec: 100 });
	unsubscribe();
	assert.equal(useCraftStore.getState().craft?.stock.glass_vial, 3, 'populated right after the call');
	assert.deepEqual(seen, [craft], 'one change, straight to the data (no null in between)');
	assert.equal(useCraftStore.getState().ownerId, 'u1');
	// the overlay's refresh finding the state already there does not blank it
	useCraftStore.getState().hydrate('u1', null);
	assert.equal(useCraftStore.getState().craft, craft);
});

test("account switch: sign-out empties the stores and one account never gets the other one's snapshot", () => {
	useCraftStore.getState().reset();
	const a: BootSnapshot = { inv: inv(), craft: { ...emptyCraft(), stock: { glass_vial: 9 } }, serverNowSec: 1 };
	stageBootSnapshot('a', a);
	useCraftStore.getState().hydrate('a', takeBootSnapshot('a'));
	assert.equal(useCraftStore.getState().craft?.stock.glass_vial, 9);
	assert.equal(takeBootSnapshot('a'), null, 'taken once');

	// a snapshot staged for A is not handed to B
	stageBootSnapshot('a', a);
	assert.equal(takeBootSnapshot('b'), null);

	// sign-out
	stageBootSnapshot('a', a);
	clearBootSnapshot();
	assert.equal(useCraftStore.getState().craft, null);
	assert.equal(useCraftStore.getState().ownerId, null);
	assert.equal(takeBootSnapshot('a'), null);

	// B signs in on the same page without a reload: A's state is replaced, not merged, even when B's first load failed
	useCraftStore.getState().hydrate('a', a);
	useCraftStore.getState().hydrate('b', null);
	assert.equal(useCraftStore.getState().craft, null);
	assert.equal(useCraftStore.getState().ownerId, 'b');
});
