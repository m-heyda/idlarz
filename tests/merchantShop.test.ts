import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, store } from './helpers';
import { COMBAT } from '../src/config/combatConfig';
import {
	FARM_PRODUCT_KEYS,
	MERCHANT_BUYABLE,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_PRICES,
	MERCHANT_SHOP_ITEMS,
	GRID_CENTER_X,
	GRID_CENTER_Y,
	MERCHANT_UPGRADES,
	REBIRTH,
	type MerchantUpgradeId,
} from '../src/config/gameConfig';
import { BASIC_GEAR, ITEM_CATALOG, RARITY_ORDER, RATTATUI_SET } from '../src/config/itemCatalog';
import { emptyBag } from '../src/lib/inventory';
import { pickPersisted, sanitizeSave } from '../src/lib/sanitizeSave';
import { merchantUpgradeCost, sellMultiplier } from '../src/utils/gameUtils';

const MAX_HAGGLER = 1 + MERCHANT_UPGRADES.haggler.maxLevel * MERCHANT_UPGRADES.haggler.effectPerLevel;

test('sell values rise with rarity', () => {
	const value = (rarity: (typeof RARITY_ORDER)[number]) =>
		Object.values(ITEM_CATALOG).find((i) => i.rarity === rarity && i.slot)?.sellValue ?? 0;
	let last = 0;
	for (const rarity of RARITY_ORDER) {
		const v = value(rarity);
		if (v === 0) continue;
		assert.ok(v > last, `${rarity} sells for more than the rarity below`);
		last = v;
	}
});

test('the shop sells plain wares only, every price is at least 3x the sell value (3.9x of a max Haggler) so buying and selling never print gold', () => {
	for (const { id, price } of MERCHANT_SHOP_ITEMS) {
		const def = ITEM_CATALOG[id];
		assert.ok(def, id);
		assert.notEqual(def.set, 'rattatui', `${id} is not for sale`);
		assert.ok(price >= def.sellValue * 3, `${id}: ${price} vs ${def.sellValue}`);
		assert.ok(price > def.sellValue * MAX_HAGGLER, `${id} with a max Haggler`);
	}
	for (const id of BASIC_GEAR) assert.ok(ITEM_CATALOG[id].sellValue > 0);
	assert.ok(!MERCHANT_SHOP_ITEMS.some(({ id }) => RATTATUI_SET.pieces.includes(id)));
});

test('buy-then-sell of every shop item never gains gold, even with a max Haggler', () => {
	for (const { id, price } of MERCHANT_SHOP_ITEMS) {
		freshGame({ gold: 1e9 });
		store.setState({ merchantUpgrades: { haggler: MERCHANT_UPGRADES.haggler.maxLevel } });
		const start = api().resources.gold;
		assert.equal(api().buyItem(id, 1), true);
		const index = api().bag.findIndex((s) => s?.id === id);
		const gold = api().sellItem(index, 1);
		assert.ok(api().resources.gold <= start, `${id}: paid ${price}, got back ${gold}`);
	}
});

test('a max Haggler never makes reselling a resource profitable (buy price is 2x the base sell price)', () => {
	assert.ok(MAX_HAGGLER < MERCHANT_BUY_MULTIPLIER);
});

test('sellItem: pays the flat price, removes the item, handles stacks and refuses bad input', () => {
	freshGame({ gold: 0 });
	const sword = ITEM_CATALOG.wooden_sword;
	const potion = ITEM_CATALOG.potion_minor;
	const bag = emptyBag();
	bag[0] = { id: 'wooden_sword', qty: 1 };
	bag[1] = { id: 'potion_minor', qty: 5 };
	store.setState({ bag });

	assert.equal(api().sellItem(0), sword.sellValue);
	assert.equal(api().bag[0], null);
	assert.equal(api().resources.gold, sword.sellValue);

	assert.equal(api().sellItem(1, 2), potion.sellValue * 2);
	assert.equal(api().bag[1]?.qty, 3);
	assert.equal(api().sellItem(1), potion.sellValue); // default: one
	assert.equal(api().sellItem(1, 99), 0, 'more than the stack');

	for (const bad of [-1, 99, 1.5, NaN]) assert.equal(api().sellItem(bad), 0, String(bad));
	assert.equal(api().sellItem(0), 0, 'an empty slot');
	assert.equal(api().sellItem(2, 0), 0);
});

test('sellItem and sellJunk are refused during a fight and never touch worn gear', () => {
	freshGame({ gold: 0 });
	const bag = emptyBag();
	bag[0] = { id: 'leather_cap', qty: 1 };
	store.setState({ bag, fight: { phase: 'active' } as never });
	assert.equal(api().sellItem(0), 0);
	assert.deepEqual(api().sellJunk('uncommon'), { gold: 0, count: 0 });
	store.setState({ fight: null });
	const equipped = { ...api().equipment };
	assert.equal(api().sellJunk('common').count, 1);
	assert.deepEqual(api().equipment, equipped);
});

test('sellJunk sells gear up to the rarity but keeps potions and better gear', () => {
	freshGame({ gold: 0 });
	const bag = emptyBag();
	bag[0] = { id: 'leather_cap', qty: 1 }; // common
	bag[1] = { id: 'iron_sword', qty: 1 }; // uncommon
	bag[2] = { id: 'rattatui_tunic', qty: 1 }; // rare
	bag[3] = { id: 'potion_minor', qty: 4 };
	store.setState({ bag });
	const r = api().sellJunk('common');
	assert.equal(r.count, 1);
	assert.equal(r.gold, ITEM_CATALOG.leather_cap.sellValue);
	const r2 = api().sellJunk('uncommon');
	assert.equal(r2.count, 1);
	assert.equal(r2.gold, ITEM_CATALOG.iron_sword.sellValue);
	assert.equal(api().bag[2]?.id, 'rattatui_tunic');
	assert.equal(api().bag[3]?.qty, 4);
	assert.deepEqual(api().sellJunk('uncommon'), { gold: 0, count: 0 });
});

test('Haggler raises every payout (resources and items)', () => {
	freshGame({ gold: 0, wood: 1000 });
	api().sellResources('wood', 1000);
	const plain = api().resources.gold;
	freshGame({ gold: 0, wood: 1000 });
	store.setState({ merchantUpgrades: { haggler: 10 } });
	api().sellResources('wood', 1000);
	assert.equal(api().resources.gold, Math.floor(1000 * MERCHANT_RESOURCE_PRICES.wood * sellMultiplier({ haggler: 10 })));
	assert.ok(api().resources.gold > plain);
});

test('buyItem: charges the price, adds the item, and a full bag costs nothing', () => {
	freshGame({ gold: 10_000 });
	const { id, price } = MERCHANT_SHOP_ITEMS[0];
	assert.equal(api().buyItem(id, 3), true);
	assert.equal(api().resources.gold, 10_000 - price * 3);
	assert.ok((api().bag.find((s) => s?.id === id)?.qty ?? 0) >= 3);

	const gearId = MERCHANT_SHOP_ITEMS.find((e) => !ITEM_CATALOG[e.id].consumable)!.id;
	store.setState({ bag: emptyBag().map(() => ({ id: 'wooden_sword', qty: 1 })), resources: { ...api().resources, gold: 1e9 } });
	assert.equal(api().buyItem(gearId, 1), false);
	assert.equal(api().resources.gold, 1e9, 'nothing charged');

	for (const bad of [0, -1, 1.5, 1000, NaN]) assert.equal(api().buyItem(id, bad), false, String(bad));
	assert.equal(api().buyItem('rattatui_cap', 1), false);
	assert.equal(api().buyItem('constructor', 1), false);
});

test('merchant upgrades: cost grows, effects apply, max level stops, Pack Rat grows the bag', () => {
	freshGame({ gold: 1e12 });
	assert.equal(api().bag.length, COMBAT.bagSize);
	for (const id of Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[]) {
		assert.ok(merchantUpgradeCost(id, 1) > merchantUpgradeCost(id, 0), id);
	}
	const gold = api().resources.gold;
	assert.equal(api().buyMerchantUpgrade('packrat'), true);
	assert.equal(gold - api().resources.gold, merchantUpgradeCost('packrat', 0));
	assert.equal(api().bag.length, COMBAT.bagSize + MERCHANT_UPGRADES.packrat.effectPerLevel);
	for (let i = 1; i < MERCHANT_UPGRADES.packrat.maxLevel; i++) assert.equal(api().buyMerchantUpgrade('packrat'), true);
	assert.equal(api().buyMerchantUpgrade('packrat'), false);
	assert.equal(api().bag.length, COMBAT.bagSize + MERCHANT_UPGRADES.packrat.maxLevel * MERCHANT_UPGRADES.packrat.effectPerLevel);
	assert.equal(api().buyMerchantUpgrade('nope' as MerchantUpgradeId), false);

	freshGame({ gold: 0 });
	assert.equal(api().buyMerchantUpgrade('haggler'), false, 'cannot afford it');
});

test('merchant bonuses start again on a rebirth, except the bigger bag (the bag itself survives)', () => {
	freshGame({ gold: 1e12 });
	growTo(20);
	api().buyMerchantUpgrade('packrat');
	api().buyMerchantUpgrade('haggler');
	api().buyMerchantUpgrade('charm');
	const size = api().bag.length;
	store.setState((st) => {
		const tiles = st.tiles.map((row) => [...row]);
		tiles[GRID_CENTER_Y][GRID_CENTER_X] = { ...tiles[GRID_CENTER_Y][GRID_CENTER_X], level: REBIRTH.minCastleLevel };
		return { tiles };
	});
	assert.equal(api().rebirth(), true);
	assert.deepEqual(api().merchantUpgrades, { packrat: 1 });
	assert.equal(api().bag.length, size);
	const raw = JSON.parse(JSON.stringify(pickPersisted(api())));
	assert.equal(sanitizeSave(raw).ok, true);
});

test('saves: merchant upgrades round-trip, the bag size follows Pack Rat, and bad values are rejected', () => {
	freshGame({ gold: 1e12 });
	api().buyMerchantUpgrade('packrat');
	api().buyMerchantUpgrade('haggler');
	const raw = JSON.parse(JSON.stringify(pickPersisted(api())));
	const ok = sanitizeSave(raw);
	assert.equal(ok.ok, true, ok.ok ? '' : ok.reason);
	if (ok.ok) {
		assert.deepEqual(ok.state.merchantUpgrades, { packrat: 1, haggler: 1 });
		assert.equal(ok.state.bag.length, COMBAT.bagSize + 4);
	}

	const tooLow = JSON.parse(JSON.stringify(raw));
	tooLow.merchantUpgrades = {};
	assert.equal(sanitizeSave(tooLow).ok, false, 'the bag is bigger than the bonuses allow');
	const unknown = JSON.parse(JSON.stringify(raw));
	unknown.merchantUpgrades.cheat = 1;
	assert.equal(sanitizeSave(unknown).ok, false);
	const high = JSON.parse(JSON.stringify(raw));
	high.merchantUpgrades.haggler = 99;
	assert.equal(sanitizeSave(high).ok, false);
	const missing = JSON.parse(JSON.stringify(raw));
	delete missing.merchantUpgrades;
	missing.bag = missing.bag.slice(0, COMBAT.bagSize);
	assert.equal(sanitizeSave(missing).ok, true, 'a save from before the upgrades still loads');
});

test('saves: an older save without farm products or farm upgrades loads with zeros', () => {
	freshGame();
	const raw = JSON.parse(JSON.stringify(pickPersisted(api())));
	for (const key of FARM_PRODUCT_KEYS) delete raw.resources[key];
	delete raw.farmUpgrades;
	delete raw.merchantUpgrades;
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (result.ok) {
		for (const key of FARM_PRODUCT_KEYS) assert.equal(result.state.resources[key], 0);
		assert.deepEqual(result.state.farmUpgrades, {});
	}
	const bad = JSON.parse(JSON.stringify(pickPersisted(api())));
	bad.farmUpgrades = { feed: 99 };
	assert.equal(sanitizeSave(bad).ok, false);
	bad.farmUpgrades = { sorcery: 1 };
	assert.equal(sanitizeSave(bad).ok, false);
});

test('farm products sell but are never offered for sale; resource packs stay on the old five', () => {
	assert.deepEqual([...MERCHANT_BUYABLE], ['wood', 'stone', 'coal', 'food', 'meat']);
	for (const key of FARM_PRODUCT_KEYS) {
		assert.ok(key in MERCHANT_RESOURCE_PRICES, `${key} sells`);
		assert.ok(MERCHANT_RESOURCE_PRICES[key] > MERCHANT_RESOURCE_PRICES.meat, `${key} sells for more than meat`);
	}
	freshGame({ gold: 0, eggs: 10 });
	assert.equal(api().sellResources('eggs', 10), true);
	assert.equal(api().resources.gold, 10 * MERCHANT_RESOURCE_PRICES.eggs);
	setResources({ gold: 1e9 });
	assert.equal(api().buyResource('eggs', 5), false);
	assert.equal(api().buyResource('milk', 5), false);
	assert.equal(api().buyResource('hide', 5), false);
});
