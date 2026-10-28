import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo } from './helpers';
import type { CombatView } from '../src/lib/offline/fightTypes';
import type { ChestReward, PublicChest, PublicTickets, SyncResult } from '../src/lib/offline/types';
import { ownedRowMajor } from '../src/utils/world';

// A chest opened while a poll answer is on its way must not come back. While a fight is open the browser polls /api/spawn every two
// seconds; an answer computed before the server opened the chest still counts it, and used to put a "missing" chest back on the map.

const view: CombatView = {
	hp: 90, mp: 30, maxHp: 101, maxMp: 40, cd: { heal: 0, stun: 0, potion: 0 }, fight: null, autoBattle: true, autoUse: true,
	retrySec: 0, at: 1, eventNo: 0, events: [], behind: false, nextPollSec: 8,
};
const tickets = (chests: PublicChest[], opened?: number): PublicTickets => ({ chests, rats: [], king: null, ...(opened === undefined ? {} : { opened }) });
const sync = (chests: PublicChest[], opened?: number): SyncResult => ({ tickets: tickets(chests, opened), serverNowSec: 1_800_000_000, gemsTotal: 1000, nextInSec: null, combat: view });
const reward = (chests: PublicChest[], opened: number): ChestReward => ({
	ok: true, loot: { kind: 'gold', gold: 10, minutes: 1, goldRate: 1 }, gems: 0, gemsTotal: 1000, tickets: tickets(chests, opened), serverNowSec: 1_800_000_000,
});

const realFetch = globalThis.fetch;
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

/** /api/chest answers only when `release` is called */
const heldChestRequest = () => {
	let release!: (reply: ChestReward) => void;
	const held = new Promise<ChestReward>((resolve) => (release = resolve));
	globalThis.fetch = (async () => new Response(JSON.stringify(await held), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
	return release;
};

const chestTiles = () => ownedRowMajor(api().tiles).filter(({ tile }) => tile.hasChest);

/** Chests the server has put on four tiles of the land (none on the castle) */
const listed = (): PublicChest[] =>
	ownedRowMajor(api().tiles)
		.filter(({ tile }) => tile.biome !== 'castle')
		.slice(0, 4)
		.map(({ x, y }, i) => ({ n: 100 + i, x, y }));

/** A game whose map holds the three chests the server lists */
const gameWithChests = () => {
	freshGame();
	growTo(30);
	const four = listed();
	const three = four.slice(0, 3);
	api().applyServerTickets(sync(three, 0));
	assert.equal(api().activeChests, 3);
	assert.equal(chestTiles().length, 3);
	return { three, four };
};

test('a poll answer that still lists the chest being opened does not put it back', async () => {
	const { three } = gameWithChests();
	const release = heldChestRequest();
	try {
		const { x, y } = three[0];
		assert.equal(api().collectChest(x, y), true);
		assert.equal(api().activeChests, 2);

		// the poll was answered before the server opened the chest: it still lists three, and the open has not been answered yet
		api().applyServerTickets(sync(three, 0));
		assert.equal(api().activeChests, 2, 'no chest comes back while the open is in flight');
		assert.equal(chestTiles().length, 2);

		release(reward(three.slice(1), 1));
		await flush();
		assert.equal(api().activeChests, 2);

		// a poll answer that was slow and arrives after the open was answered is still older than the open
		api().applyServerTickets(sync(three, 0));
		assert.equal(api().activeChests, 2, 'an older answer (opened 0 < 1) does not put it back either');
		assert.equal(chestTiles().length, 2);
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('a chest the server really minted after the open is placed', async () => {
	const { three, four } = gameWithChests();
	const release = heldChestRequest();
	try {
		const { x, y } = three[0];
		api().collectChest(x, y);
		release(reward(three.slice(1), 1));
		await flush();
		api().applyServerTickets(sync([...three.slice(1), four[3]], 1));
		assert.equal(api().activeChests, 3, 'a new ticket after the open shows');
		assert.equal(chestTiles().length, 3);
	} finally {
		globalThis.fetch = realFetch;
	}
});

test('extra chests on the map are still taken off while an open is in flight', async () => {
	const { three } = gameWithChests();
	const release = heldChestRequest();
	try {
		const { x, y } = three[0];
		api().collectChest(x, y);
		api().applyServerTickets(sync([three[1]], 0));
		assert.equal(api().activeChests, 1);
		release(reward([three[1]], 1));
		await flush();
	} finally {
		globalThis.fetch = realFetch;
	}
});
