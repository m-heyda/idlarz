import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot, store } from '../helpers';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import { MERCHANT_GOODS, MERCHANT_UPGRADES } from '../../src/config/merchant';
import { REBIRTH } from '../../src/config/rebirth';
import { ITEM_CATALOG, RARITIES } from '../../src/catalog';
import { averageItemLevel, emptyBag, gearOf } from '../../src/lib/inventory';
import { plainItem, sellValueOf } from '../../src/lib/itemInstance';
import {
	afterAbsence,
	afterRefresh,
	generateMerchantStock,
	paidRefreshesNow,
	refreshCost,
	secondsToRotation,
	shelfLevels,
	shopPriceOf,
	stockDue,
} from '../../src/lib/merchant';
import { mulberry32 } from '../../src/lib/rng';
import { sanitizeSave } from '../../src/lib/sanitizeSave';
import { sellPayout } from '../../src/utils/game/merchant';
import { patchTile } from '../../src/utils/world';
import type { Equipment, MerchantStock } from '../../src/types/game';

const MAX_HAGGLER = 1 + MERCHANT_UPGRADES.haggler.maxLevel * MERCHANT_UPGRADES.haggler.effectPerLevel;
// `worn` is the average item level of the player's gear: high by default, so the world (castle) level is what sets the shelf
const stock = (castle = 1, seed = 1, at = 0, worn = 100) => generateMerchantStock(castle, worn, seed ? mulberry32(seed) : Math.random, at);
const tick = (seconds: number) => {
	for (let i = 0; i < seconds; i++) api().tick(1000);
};

test('a shelf holds six pieces of gear, rolled by the loot pipeline: common or uncommon, and now and then a blue rare one, never better', () => {
	let rares = 0;
	let pieces = 0;
	for (const castle of [1, 3, 6, 10]) {
		for (let seed = 1; seed <= 40; seed++) {
			const s = stock(castle, seed);
			assert.equal(s.offers.length, MERCHANT_GOODS.offers);
			assert.equal(s.at, 0);
			for (const item of s.offers) {
				assert.ok(ITEM_CATALOG[item.base] && ITEM_CATALOG[item.base].kind !== 'consumable', item.base);
				assert.ok(['common', 'uncommon', 'rare'].includes(item.rarity), `${item.base} is ${item.rarity}`);
				assert.ok(item.rarity in RARITIES);
				pieces++;
				if (item.rarity === 'rare') rares++;
			}
		}
	}
	// weights 60 / 40 / 4: about one piece in 26 is blue, so some show up in 160 shelves but never most
	assert.ok(rares > 0, 'a rare piece shows up now and then');
	assert.ok(rares < pieces * 0.12, `rare pieces stay rare: ${rares} of ${pieces}`);
});

test('the shelf follows the world level: a castle 10 shelf holds higher level gear than a castle 1 shelf', () => {
	const level = (castle: number) => {
		const levels = Array.from({ length: 60 }, (_, i) => stock(castle, i + 1).offers.map((o) => o.level)).flat();
		return levels.reduce((a, b) => a + b, 0) / levels.length;
	};
	assert.ok(level(10) > level(1) + 15, `${level(1)} vs ${level(10)}`);
	assert.ok(level(1) < 12);
});

test('the shelf is held to the gear the player wears: never more than 5 item levels above the average, whatever the castle', () => {
	for (const worn of [1, 4, 10, 25]) {
		for (const castle of [1, 5, 10]) {
			for (let seed = 1; seed <= 40; seed++) {
				for (const item of stock(castle, seed, 0, worn).offers) {
					assert.ok(item.level <= worn + MERCHANT_GOODS.maxAboveAverage, `worn ${worn}, castle ${castle}: level ${item.level}`);
				}
			}
		}
	}
	const { centre, max } = shelfLevels(10, 8);
	assert.equal(max, 8 + MERCHANT_GOODS.maxAboveAverage);
	assert.equal(centre, 8 + MERCHANT_GOODS.centreAboveAverage, 'a high world level is held down to the gear');
	assert.equal(shelfLevels(1, 40).centre, shelfLevels(1, 100).centre, 'and a low world level is not lifted by good gear');
	assert.ok(shelfLevels(1, 0).max >= 1, 'nothing worn counts as level 1');
});

test('averageItemLevel is the mean of the worn pieces, empty slots left out', () => {
	assert.equal(averageItemLevel({ mainHand: null, offHand: null } as unknown as Equipment), 0);
	const worn = {
		mainHand: { ...plainItem('wooden_sword'), level: 10 },
		offHand: { ...plainItem('wooden_shield'), level: 20 },
		head: null,
	} as unknown as Equipment;
	assert.equal(averageItemLevel(worn), 15);
});

test('the goods are never a bargain: every price is far above what he pays, even with a max Haggler, so buy-then-sell never gains gold', () => {
	for (const castle of [1, 5, 10]) {
		for (let seed = 1; seed <= 30; seed++) {
			for (const item of stock(castle, seed).offers) {
				const price = shopPriceOf(item);
				assert.ok(price >= sellValueOf(item) * 5, `${item.base}: ${price} vs ${sellValueOf(item)}`);
				assert.ok(price > sellPayout(sellValueOf(item), 1, { merchantUpgrades: { haggler: MERCHANT_UPGRADES.haggler.maxLevel } }) * 3);
				assert.ok(price > sellValueOf(item) * MAX_HAGGLER * 3);
			}
		}
	}
});

test('the refresh costs 10k and doubles up to 1b; the rotation is a countdown in play time', () => {
	assert.equal(refreshCost(0), 10_000, 'the first one');
	assert.equal(refreshCost(1), 20_000, 'it doubles');
	assert.equal(refreshCost(10), 10_240_000);
	assert.equal(refreshCost(40), 1_000_000_000, 'and stops at 1b');
	for (let n = 1; n < 17; n++) assert.ok(refreshCost(n) > refreshCost(n - 1));
	const s: MerchantStock = { at: 100, offers: [] };
	assert.equal(secondsToRotation(s, 100), MERCHANT_GOODS.rotateSec);
	assert.equal(secondsToRotation(s, 100 + MERCHANT_GOODS.rotateSec - 1), 1);
	assert.equal(secondsToRotation(s, 100 + MERCHANT_GOODS.rotateSec), 0);
	assert.equal(secondsToRotation(s, 1e9), 0);
	assert.equal(stockDue(null, 0), true);
	assert.equal(stockDue(s, 200), false);
	assert.equal(stockDue(s, 100 + MERCHANT_GOODS.rotateSec), true);
});

test('the browser never rolls the shelf: a tick leaves it alone and asks the server (IDL-121), which rolls and rotates it', () => {
	freshGame();
	assert.equal(api().merchantStock, null);
	tick(60);
	assert.equal(api().merchantStock, null, 'no shelf comes from the browser; it arrives with the server answer');
	const shelf = stock(1, 1, 0, 100);
	store.setState({ merchantStock: shelf, playSeconds: shelf.at + MERCHANT_GOODS.rotateSec + 100 });
	api().tick(1000);
	assert.equal(api().merchantStock, shelf, 'a due shelf is not replaced here either');
});

test('buyOffer: pays the price, puts the piece in the bag and takes it off the shelf', () => {
	freshGame({ gold: 1e9 });
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	const offers = api().merchantStock!.offers;
	const item = offers[2];
	const price = shopPriceOf(item);
	const gold = api().resources.gold;
	assert.equal(api().buyOffer(2), true);
	assert.equal(api().resources.gold, gold - price);
	assert.deepEqual(
		api()
			.bag.map((s) => gearOf(s))
			.find((g) => g && g.base === item.base && g.level === item.level && g.quality === item.quality),
		item,
	);
	assert.equal(api().merchantStock!.offers.length, offers.length - 1);
	assert.deepEqual(
		api().merchantStock!.offers,
		offers.filter((_, i) => i !== 2),
	);
	for (const bad of [-1, 1.5, 99, NaN]) assert.equal(api().buyOffer(bad), false, String(bad));
});

test('buyOffer: too little gold or a full bag buys nothing, and an empty shelf is safe', () => {
	freshGame({ gold: 10 });
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	assert.equal(api().buyOffer(0), false, 'not enough gold');
	assert.equal(api().merchantStock!.offers.length, MERCHANT_GOODS.offers);

	store.setState({ bag: emptyBag().map(() => ({ item: plainItem('wooden_sword') })), resources: { ...api().resources, gold: 1e12 } });
	assert.equal(api().buyOffer(0), false, 'a full bag');
	assert.equal(api().resources.gold, 1e12, 'nothing charged');
	assert.equal(api().merchantStock!.offers.length, MERCHANT_GOODS.offers, 'and the piece stays on the shelf');

	store.setState({ merchantStock: { at: api().playSeconds, offers: [] }, bag: emptyBag() });
	assert.equal(api().buyOffer(0), false);
	store.setState({ merchantStock: null });
	assert.equal(api().buyOffer(0), false);
});

test('refreshMerchantStock: the browser only checks the cooldown and the gold it can see; the server rolls, counts and prices the refresh (IDL-121)', () => {
	const { cooldownSec } = MERCHANT_GOODS.refresh;
	freshGame({ gold: 1e9 });
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	const before = api().merchantStock;
	const gold = api().resources.gold;
	store.setState((s) => ({ playSeconds: s.playSeconds + 30, merchantRefresh: { windowAt: 0, freeUsed: 0, lastAt: s.playSeconds + 30 - cooldownSec / 2 } }));
	assert.equal(api().refreshMerchantStock(), false, 'the cooldown');
	// out of free refreshes and without the gold for the paid one
	freshGame({ gold: refreshCost(0) - 1 });
	store.setState({ merchantStock: before, merchantRefresh: { windowAt: api().playSeconds, freeUsed: MERCHANT_GOODS.refresh.freePerWindow, lastAt: 0 } });
	assert.equal(api().refreshMerchantStock(), false, 'not enough gold');
	assert.equal(api().merchantStock, before, 'nothing happens here without the gold');
	assert.equal(api().resources.gold, refreshCost(0) - 1);
	assert.ok(gold > 0);
});

test('a shelf that was bought out stays empty until the next rotation: the paid refresh is the way around it', () => {
	freshGame({ gold: 1e12 });
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	for (let i = 0; i < MERCHANT_GOODS.offers; i++) {
		store.setState({ bag: emptyBag() });
		assert.equal(api().buyOffer(0), true);
	}
	assert.equal(api().merchantStock!.offers.length, 0);
	tick(30);
	assert.equal(api().merchantStock!.offers.length, 0);
});

test('the shelf is saved and restored, and bought pieces stay gone after a reload', () => {
	freshGame({ gold: 1e9 });
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	api().buyOffer(0);
	const shelf = api().merchantStock!;
	const result = sanitizeSave(rawSnapshot());
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (result.ok) assert.deepEqual(result.state.merchantStock, shelf);
});

test('a save from before the goods existed loads and gets a shelf on the next tick', () => {
	freshGame();
	const raw = rawSnapshot();
	delete raw.merchantStock;
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (result.ok) assert.equal(result.state.merchantStock, null);
});

test('a forged shelf never gets through: an invalid offer is dropped, damage to the stock itself is refused', () => {
	freshGame();
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	const good = rawSnapshot();
	const shelf = (fn: (raw: ReturnType<typeof rawSnapshot>) => void) => {
		const raw = JSON.parse(JSON.stringify(good));
		fn(raw);
		const result = sanitizeSave(raw);
		return result.ok ? result.state.merchantStock : 'refused';
	};
	const offers = good.merchantStock.offers.length;
	assert.ok(offers > 1);
	assert.equal(sanitizeSave(good).ok, true);
	// an offer that is no longer valid (an unknown item, an impossible level or quality, a smuggled price) is left off the shelf, the others stay
	for (const [label, fn] of [
		['unknown base', (r: typeof good) => (r.merchantStock.offers[0].base = 'constructor')],
		['impossible level', (r: typeof good) => (r.merchantStock.offers[0].level = 9999)],
		['impossible quality', (r: typeof good) => (r.merchantStock.offers[0].quality = 1e6)],
		['a stored price', (r: typeof good) => (r.merchantStock.offers[0].price = 1)],
	] as const) {
		const stockAfter = shelf(fn);
		assert.notEqual(stockAfter, 'refused', label);
		assert.equal(typeof stockAfter === 'object' && stockAfter?.offers.length, offers - 1, label);
	}
	// a key this version does not know is ignored
	assert.notEqual(
		shelf((r) => ((r.merchantStock as Record<string, unknown>).cheat = true)),
		'refused',
		'extra key',
	);
	// too many offers, a stock that is not an object, a negative time, offers that are not a list: damage, refused
	assert.equal(
		shelf((r) => (r.merchantStock.offers = Array.from({ length: MERCHANT_GOODS.maxOffers + 1 }, () => r.merchantStock.offers[0]))),
		'refused',
		'too many offers',
	);
	assert.equal(
		shelf((r) => ((r as Record<string, unknown>).merchantStock = 'free gear')),
		'refused',
		'not an object',
	);
	assert.equal(
		shelf((r) => (r.merchantStock.at = -5)),
		'refused',
		'negative time',
	);
	assert.equal(
		shelf((r) => ((r.merchantStock as Record<string, unknown>).offers = 'x')),
		'refused',
		'offers not a list',
	);
});

test('time away counts for the merchant: a shelf that would have rotated is dropped, a free-refresh window that ended gives its refreshes back', () => {
	const shelf = stock(1, 1, 100);
	const spent = { windowAt: 100, freeUsed: 3, lastAt: 150 };
	// 10 minutes away: nothing is due yet
	const short = afterAbsence(shelf, spent, 400, 600);
	assert.equal(short.merchantStock, shelf);
	assert.deepEqual(short.merchantRefresh, spent);
	// away for more than the rotation time left: the shelf goes, a new one is rolled on the next tick
	const left = secondsToRotation(shelf, 400);
	assert.equal(afterAbsence(shelf, spent, 400, left).merchantStock, null);
	assert.equal(afterAbsence(null, spent, 400, 10).merchantStock, null);
	// away for a whole window (12 h): the free refreshes are back, the cooldown record is left alone
	const long = afterAbsence(shelf, spent, 400, MERCHANT_GOODS.refresh.windowSec);
	assert.deepEqual(long.merchantRefresh, { windowAt: 0, freeUsed: 0, lastAt: 150 });
});

test('a rebirth keeps the shelf of the merchant: it is no free reshuffle', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({ tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }) }));
	store.setState({ merchantStock: stock(1, 1, 0, 100) });
	const shelf = api().merchantStock!;
	assert.ok(shelf);
	assert.equal(api().rebirth(), true);
	assert.equal(api().merchantStock, shelf, 'the same shelf, with its rotation clock');
	api().tick(1000);
	assert.equal(api().merchantStock, shelf);
});

test('the Restock price starts from its base again 24 h of play after the first paid refresh', () => {
	const day = MERCHANT_GOODS.refresh.escalationResetSec;
	// the first paid refresh (count 0) opens the run; later ones keep its start
	const first = afterRefresh({ windowAt: 0, freeUsed: 3, lastAt: 0 }, 1000, false, 0);
	assert.equal(first.paidAt, 1000);
	assert.equal(afterRefresh(first, 2000, false, 1).paidAt, 1000);
	assert.equal(afterRefresh(first, 2000, true, 1).paidAt, 1000, 'a free refresh does not touch it');
	// the count is kept for 24 h, then the price is the base price again
	assert.equal(paidRefreshesNow(10, first, 1000 + day - 1), 10);
	assert.equal(paidRefreshesNow(10, first, 1000 + day), 0);
	assert.equal(refreshCost(paidRefreshesNow(10, first, 1000 + day)), refreshCost(0));
	// an older save has no paidAt: it counts as 0, so a long-played save starts over at once
	assert.equal(paidRefreshesNow(10, { windowAt: 0, freeUsed: 0, lastAt: 0 }, day), 0);
	// time away also ends the run
	const away = afterAbsence(null, first, 1500, day);
	assert.equal(paidRefreshesNow(10, away.merchantRefresh, 1500), 0);
});

test('a rebirth sets the Restock price back to its base and gives the free refreshes back', () => {
	freshGame();
	growTo(REBIRTH.minTiles);
	store.setState((s) => ({
		tiles: patchTile(s.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }),
		merchantRefreshes: 10,
		merchantRefresh: { windowAt: 0, freeUsed: 3, lastAt: 0, paidAt: 0 },
	}));
	assert.equal(api().rebirth(), true);
	assert.equal(api().merchantRefreshes, 0);
	assert.equal(api().merchantRefresh.freeUsed, 0);
	assert.equal(refreshCost(api().merchantRefreshes), refreshCost(0));
});
