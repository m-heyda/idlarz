import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, setResources, store } from './helpers';
import { emptyBag, addDrop, stackOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { sellPayout } from '../src/utils/gameUtils';
import { applyOp, parseOp } from '../src/lib/offline/inventory';
import { requestSync } from '../src/lib/rewardsClient';
import type { Inventory, InventoryReply } from '../src/lib/offline/types';
import type { BagSlot } from '../src/types/game';

// The browser's side of the server-owned inventory: every change is previewed at once and asked of the server, one at a time, in order; the
// server's answer carries the inventory as it stands and settles what the preview got wrong.

const realFetch = globalThis.fetch;
interface Call {
	path: string;
	body: Record<string, unknown>;
	answer: (status: number, body: unknown) => void;
}
/** A fetch whose answers the test gives, one request at a time. */
const held = () => {
	const calls: Call[] = [];
	globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
		new Promise<Response>((resolve) => {
			calls.push({
				path: String(input),
				body: JSON.parse(String(init?.body ?? '{}')),
				answer: (status, body) => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
			});
		})) as typeof fetch;
	return calls;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
const restore = () => {
	globalThis.fetch = realFetch;
};

const bagOf = (...slots: BagSlot[]): BagSlot[] => {
	const out = emptyBag();
	slots.forEach((slot, i) => (out[i] = slot));
	return out;
};
/** The inventory the server would hold if it had the browser's current picture at this version. */
const serverInv = (over: Partial<Inventory> = {}): Inventory => ({ ver: (api().invVer ?? 0) + 1, bag: api().bag, equipment: api().equipment, lootPity: api().lootPity, autoSellUpTo: api().autoSellUpTo, ...over });
/** What the server answers to an operation, using its own functions on the picture it holds. */
const serverDoes = (before: Inventory, body: Record<string, unknown>, sellCtx = {}): InventoryReply => {
	const op = parseOp(body)!;
	const result = applyOp(before, op, sellCtx);
	return { ok: result.ok, gold: result.gold, count: result.count, inv: result.inv, serverNowSec: 1 };
};

const withSwordAndHelm = () => {
	freshGame();
	store.setState({ bag: bagOf({ item: plainItem('steel_helm') }, { item: plainItem('steel_mace') }, { id: 'potion_minor', qty: 2 }), invVer: 5 });
};

test('an equip is previewed at once, asked of the server with its own key, and the server\'s inventory is taken when it answers', async () => {
	withSwordAndHelm();
	const calls = held();
	try {
		const before = serverInv({ ver: 5 });
		assert.equal(api().equipItem(0), true);
		assert.equal(api().equipment.head?.base, 'steel_helm', 'the preview does not wait');
		await settle();
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, '/api/inventory');
		assert.deepEqual({ action: calls[0].body.action, index: calls[0].body.index }, { action: 'equip', index: 0 });
		assert.match(String(calls[0].body.key), /^[A-Za-z0-9_-]{8,64}$/);
		assert.equal(calls[0].body.invVer, undefined, 'the inventory route is not asked about versions');
		const reply = serverDoes(before, calls[0].body);
		calls[0].answer(200, reply);
		await settle();
		assert.equal(api().invVer, reply.inv.ver);
		assert.deepEqual(api().equipment, reply.inv.equipment);
		assert.deepEqual(api().bag, reply.inv.bag);
	} finally {
		restore();
	}
});

test('changes are sent one at a time, in the order they were made', async () => {
	withSwordAndHelm();
	const calls = held();
	try {
		api().equipItem(0);
		api().moveBagItem(2, 6);
		api().discardItem(6, 1);
		await settle();
		assert.equal(calls.length, 1, 'the second waits for the first');
		calls[0].answer(200, serverDoes(serverInv({ ver: 5 }), calls[0].body));
		await settle();
		assert.equal(calls.length, 2);
		assert.equal(calls[1].body.action, 'move');
		calls[1].answer(200, serverDoes(serverInv({ ver: 6 }), calls[1].body));
		await settle();
		assert.equal(calls.length, 3);
		assert.equal(calls[2].body.action, 'discard');
	} finally {
		restore();
	}
});

test('a picture from another answer is not taken while a change of ours is on its way; the last answer settles everything', async () => {
	withSwordAndHelm();
	const calls = held();
	try {
		const before = serverInv({ ver: 5 });
		api().equipItem(0);
		await settle();
		// a poll answer with an inventory arrives first: it does not know about the equip
		api().applyServerTickets({
			tickets: { chests: [], rats: [], king: null },
			serverNowSec: 1,
			gemsTotal: 1000,
			nextInSec: null,
			combat: { hp: 90, mp: 30, maxHp: 101, maxMp: 40, cd: { heal: 0, stun: 0, potion: 0 }, fight: null, autoBattle: false, autoUse: false, retrySec: 0, at: 9999, eventNo: 0, events: [], behind: false, nextPollSec: 8 },
			inv: serverInv({ ver: 6, equipment: {} }),
		});
		assert.equal(api().equipment.head?.base, 'steel_helm', 'our preview stays');
		calls[0].answer(200, serverDoes(before, calls[0].body));
		await settle();
		assert.equal(api().equipment.head?.base, 'steel_helm');
		assert.equal(api().invVer, 6);
	} finally {
		restore();
	}
});

test('a sale: the preview pays at once, and the gold the server says it paid is the one that stays', async () => {
	withSwordAndHelm();
	setResources({ gold: 1000 });
	store.setState({ merchantUpgrades: { haggler: 3 } });
	const calls = held();
	try {
		const preview = api().sellItem(1);
		assert.equal(preview, sellPayout(sellValueOf(plainItem('steel_mace')), 1, { merchantUpgrades: { haggler: 3 } }));
		assert.equal(api().resources.gold, 1000 + preview);
		await settle();
		assert.equal(calls[0].body.action, 'sell');
		// the server pays 7 gold more than the preview (its price is the one that counts)
		const reply = serverDoes(serverInv({ ver: 5, bag: bagOf({ item: plainItem('steel_helm') }, { item: plainItem('steel_mace') }, { id: 'potion_minor', qty: 2 }) }), calls[0].body, { merchantUpgrades: { haggler: 3 } });
		calls[0].answer(200, { ...reply, gold: preview + 7 });
		await settle();
		assert.equal(api().resources.gold, 1000 + preview + 7);
	} finally {
		restore();
	}
});

test('a sale the server refuses is undone: the gold goes back and the item comes back with the server\'s bag', async () => {
	withSwordAndHelm();
	setResources({ gold: 1000 });
	const calls = held();
	try {
		const preview = api().sellItem(1);
		assert.ok(preview > 0);
		await settle();
		const serverBag = bagOf({ item: plainItem('steel_helm') }, { item: plainItem('steel_mace') }, { id: 'potion_minor', qty: 2 });
		calls[0].answer(200, { ok: false, gold: 0, count: 0, inv: serverInv({ ver: 6, bag: serverBag }), serverNowSec: 1 });
		await settle();
		assert.equal(api().resources.gold, 1000);
		assert.deepEqual(api().bag, serverBag);
	} finally {
		restore();
	}
});

test('when the server cannot be reached the change is undone as far as the gold goes, the version is forgotten and the next poll fetches the truth', async () => {
	withSwordAndHelm();
	setResources({ gold: 1000 });
	const calls = held();
	try {
		const preview = api().sellItem(1);
		await settle();
		calls[0].answer(503, {});
		await settle();
		calls[1]?.answer(503, {}); // the one retry with the same key
		await settle();
		assert.equal(api().resources.gold, 1000, `the ${preview} gold of the sale is taken back`);
		assert.equal(api().invVer, null, 'the version is forgotten');
	} finally {
		restore();
	}
});

test('a purchase is previewed; a purchase the server refuses gives the price back and the offer returns to the shelf', async () => {
	freshGame();
	const item = plainItem('steel_helm');
	setResources({ gold: 50_000 });
	store.setState({ invVer: 3, merchantStock: { at: 0, offers: [plainItem('steel_mace'), item] } });
	const calls = held();
	try {
		const before = api().resources.gold;
		assert.equal(api().buyOffer(1), true);
		const paid = before - api().resources.gold;
		assert.ok(paid > 0);
		assert.equal(api().merchantStock!.offers.length, 1);
		await settle();
		assert.deepEqual({ action: calls[0].body.action }, { action: 'buyOffer' });
		calls[0].answer(200, { ok: false, gold: 0, count: 0, inv: serverInv({ ver: 4 }), serverNowSec: 1 });
		await settle();
		assert.equal(api().resources.gold, before, 'the price is back');
		assert.equal(api().merchantStock!.offers.length, 2);
		assert.equal(api().merchantStock!.offers[1].base, 'steel_helm', 'on the same place of the shelf');
	} finally {
		restore();
	}
});

test('a purchase the server accepts keeps the price paid and takes the server\'s bag', async () => {
	freshGame();
	setResources({ gold: 50_000 });
	store.setState({ invVer: 3 });
	const calls = held();
	try {
		const before = api().resources.gold;
		assert.equal(api().buyItem('potion_minor', 2), true);
		const paid = before - api().resources.gold;
		await settle();
		assert.deepEqual({ action: calls[0].body.action, id: calls[0].body.id, qty: calls[0].body.qty }, { action: 'buyShop', id: 'potion_minor', qty: 2 });
		calls[0].answer(200, serverDoes(serverInv({ ver: 3, bag: freshBagWithoutPotions() }), calls[0].body));
		await settle();
		assert.equal(before - api().resources.gold, paid);
		assert.ok((api().bag.map(stackOf).find((s) => s?.id === 'potion_minor')?.qty ?? 0) >= 2);
	} finally {
		restore();
	}
});

const freshBagWithoutPotions = (): BagSlot[] => addDrop(emptyBag(), { kind: 'gear', item: plainItem('wooden_club') }).bag;

test('a New Game drops the answers to what was asked in the game before it', async () => {
	withSwordAndHelm();
	const calls = held();
	try {
		api().equipItem(0);
		await settle();
		api().resetGame();
		const fresh = api().equipment;
		calls[0].answer(200, serverDoes(serverInv({ ver: 5 }), calls[0].body));
		await settle();
		assert.deepEqual(api().equipment, fresh, 'the old game\'s answer does not touch the new game');
		assert.equal(api().invVer, null);
	} finally {
		restore();
	}
});

test('every online request says which inventory version the browser holds, once it knows one', async () => {
	freshGame();
	const calls = held();
	try {
		void requestSync(3);
		await settle();
		assert.equal(calls[0].body.invVer, undefined, 'unknown: nothing is said');
		calls[0].answer(200, {});
		store.setState({ invVer: 12 });
		void requestSync(3);
		await settle();
		assert.equal(calls[1].body.invVer, 12);
		calls[1].answer(200, {});
	} finally {
		restore();
	}
});
