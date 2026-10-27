import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, rawSnapshot, store } from './helpers';
import { CASTLE_X, CASTLE_Y, MERCHANT_GOODS, MERCHANT_UPGRADES, REBIRTH } from '../src/config/gameConfig';
import { ITEM_CATALOG, RARITIES } from '../src/config/itemCatalog';
import { emptyBag, gearOf } from '../src/lib/inventory';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { generateMerchantStock, refreshCost, secondsToRotation, shopPriceOf, stockDue } from '../src/lib/merchant';
import { seeded } from '../src/lib/fightSim';
import { sanitizeSave } from '../src/lib/sanitizeSave';
import { sellPayout } from '../src/utils/gameUtils';
import { patchTile } from '../src/utils/world';
import type { MerchantStock } from '../src/types/game';

const MAX_HAGGLER = 1 + MERCHANT_UPGRADES.haggler.maxLevel * MERCHANT_UPGRADES.haggler.effectPerLevel;
const stock = (castle = 1, seed = 1, at = 0) => generateMerchantStock(castle, seed ? seeded(seed) : Math.random, at);
const tick = (seconds: number) => {
	for (let i = 0; i < seconds; i++) api().tick(1000);
};

test('a shelf holds six pieces of gear, rolled by the loot pipeline, and never a legendary', () => {
	for (const castle of [1, 3, 6, 10]) {
		for (let seed = 1; seed <= 40; seed++) {
			const s = stock(castle, seed);
			assert.equal(s.offers.length, MERCHANT_GOODS.offers);
			assert.equal(s.at, 0);
			for (const item of s.offers) {
				assert.ok(ITEM_CATALOG[item.base] && ITEM_CATALOG[item.base].kind !== 'consumable', item.base);
				assert.notEqual(item.rarity, 'legendary');
				assert.ok(item.rarity in RARITIES);
			}
		}
	}
});

test('the shelf follows the world level: a castle 10 shelf holds higher level gear than a castle 1 shelf', () => {
	const level = (castle: number) => {
		const levels = Array.from({ length: 60 }, (_, i) => stock(castle, i + 1).offers.map((o) => o.level)).flat();
		return levels.reduce((a, b) => a + b, 0) / levels.length;
	};
	assert.ok(level(10) > level(1) + 15, `${level(1)} vs ${level(10)}`);
	assert.ok(level(1) < 12);
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

test('the refresh costs more as the world level grows, and the rotation is a countdown in play time', () => {
	assert.equal(refreshCost(1), MERCHANT_GOODS.refreshBase);
	assert.equal(refreshCost(5), MERCHANT_GOODS.refreshBase * 25);
	assert.ok(refreshCost(10) > refreshCost(9));
	const s: MerchantStock = { at: 100, offers: [] };
	assert.equal(secondsToRotation(s, 100), MERCHANT_GOODS.rotateSec);
	assert.equal(secondsToRotation(s, 100 + MERCHANT_GOODS.rotateSec - 1), 1);
	assert.equal(secondsToRotation(s, 100 + MERCHANT_GOODS.rotateSec), 0);
	assert.equal(secondsToRotation(s, 1e9), 0);
	assert.equal(stockDue(null, 0), true);
	assert.equal(stockDue(s, 200), false);
	assert.equal(stockDue(s, 100 + MERCHANT_GOODS.rotateSec), true);
});

test('the first tick puts goods on the shelf, and the shelf is reshuffled after 30 minutes of play time, not before', () => {
	freshGame();
	assert.equal(api().merchantStock, null);
	api().tick(1000);
	const first = api().merchantStock!;
	assert.equal(first.offers.length, MERCHANT_GOODS.offers);
	tick(60);
	assert.equal(api().merchantStock, first, 'the same shelf: nothing changes between rotations');
	store.setState({ playSeconds: first.at + MERCHANT_GOODS.rotateSec - 1 });
	api().tick(500);
	assert.equal(api().merchantStock, first, 'not yet');
	api().tick(1000);
	assert.notEqual(api().merchantStock, first);
	assert.ok(api().merchantStock!.at >= first.at + MERCHANT_GOODS.rotateSec - 1);
});

test('buyOffer: pays the price, puts the piece in the bag and takes it off the shelf', () => {
	freshGame({ gold: 1e9 });
	api().tick(1000);
	const offers = api().merchantStock!.offers;
	const item = offers[2];
	const price = shopPriceOf(item);
	const gold = api().resources.gold;
	assert.equal(api().buyOffer(2), true);
	assert.equal(api().resources.gold, gold - price);
	assert.deepEqual(api().bag.map((s) => gearOf(s)).find((g) => g && g.base === item.base && g.level === item.level && g.quality === item.quality), item);
	assert.equal(api().merchantStock!.offers.length, offers.length - 1);
	assert.deepEqual(api().merchantStock!.offers, offers.filter((_, i) => i !== 2));
	for (const bad of [-1, 1.5, 99, NaN]) assert.equal(api().buyOffer(bad), false, String(bad));
});

test('buyOffer: too little gold or a full bag buys nothing, and an empty shelf is safe', () => {
	freshGame({ gold: 10 });
	api().tick(1000);
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

test('refreshMerchantStock: costs gold, reshuffles at once and restarts the half hour', () => {
	freshGame({ gold: 1e9 });
	api().tick(1000);
	const before = api().merchantStock!;
	tick(30);
	const gold = api().resources.gold;
	assert.equal(api().refreshMerchantStock(), true);
	assert.equal(api().resources.gold, gold - refreshCost(1));
	assert.notEqual(api().merchantStock, before);
	assert.equal(api().merchantStock!.offers.length, MERCHANT_GOODS.offers);
	assert.equal(api().merchantStock!.at, api().playSeconds);
	freshGame({ gold: refreshCost(1) - 1 });
	api().tick(1000);
	const shelf = api().merchantStock;
	assert.equal(api().refreshMerchantStock(), false);
	assert.equal(api().merchantStock, shelf, 'nothing happens without the gold');
});

test('a shelf that was bought out stays empty until the next rotation: the paid refresh is the way around it', () => {
	freshGame({ gold: 1e12 });
	api().tick(1000);
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
	api().tick(1000);
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

test('a forged shelf is rejected: an unknown item, a legendary-level stat, too many offers, a price, an extra key', () => {
	freshGame();
	api().tick(1000);
	const good = rawSnapshot();
	const mutate = (fn: (raw: ReturnType<typeof rawSnapshot>) => void) => {
		const raw = JSON.parse(JSON.stringify(good));
		fn(raw);
		return sanitizeSave(raw).ok;
	};
	assert.equal(sanitizeSave(good).ok, true);
	assert.equal(mutate((r) => (r.merchantStock.offers[0].base = 'constructor')), false, 'unknown base');
	assert.equal(mutate((r) => (r.merchantStock.offers[0].level = 9999)), false, 'impossible level');
	assert.equal(mutate((r) => (r.merchantStock.offers[0].quality = 1e6)), false, 'impossible quality');
	assert.equal(mutate((r) => (r.merchantStock.offers[0].price = 1)), false, 'a stored price');
	assert.equal(mutate((r) => (r.merchantStock.offers = Array.from({ length: MERCHANT_GOODS.maxOffers + 1 }, () => r.merchantStock.offers[0]))), false, 'too many offers');
	assert.equal(mutate((r) => (r.merchantStock.cheat = true)), false, 'extra key');
	assert.equal(mutate((r) => (r.merchantStock = 'free gear')), false, 'not an object');
	assert.equal(mutate((r) => (r.merchantStock.at = -5)), false, 'negative time');
	assert.equal(mutate((r) => (r.merchantStock.offers = 'x')), false, 'offers not a list');
});

test('a rebirth clears the shelf with the castle: the next tick rolls a new one', () => {
	freshGame({ gold: 1e12 });
	growTo(REBIRTH.minTiles);
	api().tick(1000);
	const old = api().merchantStock!;
	assert.ok(old);
	store.setState((st) => ({ tiles: patchTile(st.tiles, CASTLE_X, CASTLE_Y, { level: REBIRTH.minCastleLevel }) }));
	assert.equal(api().rebirth(), true);
	assert.equal(api().merchantStock, null);
	api().tick(1000);
	assert.notEqual(api().merchantStock, old);
	assert.equal(api().merchantStock!.offers.length, MERCHANT_GOODS.offers);
});
