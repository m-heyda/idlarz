import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ITEMS,
	ITEM_CATALOG,
	RARITIES,
	RARITY_ORDER,
	LOOT_POOLS,
	LOOT_PROFILES,
	RESOURCES,
	RESOURCE_TIERS,
	resourcesInTier,
	SETS,
	STAT_DEFS,
	setBonusStats,
	setCounts,
	shopItems,
	sumStats,
} from '../src/catalog';
import { plainItem, sellValueOf } from '../src/lib/itemInstance';
import { HEADER_DISPLAYED_RESOURCES_INFO, INITIAL_RESOURCES, MERCHANT_RESOURCE_PRICES, RESOURCE_ICONS } from '../src/config/gameConfig';
import { PIXEL_ICON_SIZES, pixelIconSrc, type PixelIconName } from '../src/config/pixelIcons';

const PUBLIC = resolve(__dirname, '..', 'public');

test('every item has a unique id and a rarity that exists (named items and consumables carry it; bases roll theirs)', () => {
	assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
	for (const def of ITEMS) assert.ok(RARITIES[def.rarity], def.id);
	for (const def of ITEMS.filter((i) => i.generation === 'named')) assert.equal(def.fixedRarity, def.rarity, def.id);
});

test('sell value at level 1 follows the rarity unless the item overrides it, and never decreases with rarity', () => {
	for (const def of ITEMS.filter((i) => i.kind !== 'consumable')) assert.equal(def.sellValue, RARITIES[def.rarity].sellValue, def.id);
	const values = RARITY_ORDER.map((r) => RARITIES[r].sellValue);
	assert.deepEqual([...values].sort((a, b) => a - b), values);
});

test('every item icon is registered, exists on disk at its registered size and has a PNG', () => {
	for (const def of ITEMS) {
		if (!def.icon) continue;
		assert.ok(def.icon in PIXEL_ICON_SIZES, `${def.id}: ${def.icon} is not in PIXEL_ICON_SIZES`);
		assert.ok(existsSync(resolve(PUBLIC, pixelIconSrc(def.icon as PixelIconName).slice(1))), `${def.id}: ${def.icon}.png missing`);
	}
});

test('items agree with their kind: weapons are main hand, consumables have no slot, gear has tier >= 1', () => {
	for (const def of ITEMS) {
		if (def.kind === 'consumable') {
			assert.equal(def.slot, undefined, def.id);
			assert.equal(def.tier, 0, def.id);
		} else {
			assert.ok(def.slot, def.id);
			assert.ok(def.tier >= 1, def.id);
		}
		assert.equal(def.kind === 'weapon', def.slot === 'mainHand', def.id);
		assert.equal(def.kind === 'offhand', def.slot === 'offHand', def.id);
	}
});

test('every set piece exists and names its set, and set bonuses only use known stats', () => {
	for (const set of Object.values(SETS)) {
		assert.ok(set.pieces.length > 0, set.id);
		for (const id of set.pieces) assert.equal(ITEM_CATALOG[id].set, set.id, id);
		for (const bonus of Object.values(set.bonuses)) for (const key of Object.keys(bonus)) assert.ok(key in STAT_DEFS, `${set.id}: ${key}`);
	}
	for (const def of ITEMS) if (def.set) assert.ok(SETS[def.set], `${def.id} names an unknown set`);
	for (const def of ITEMS) for (const key of Object.keys(def.stats ?? {})) assert.ok(key in STAT_DEFS, `${def.id}: ${key}`);
});

test('set counting and bonuses go through the registry', () => {
	const rattatui = SETS.rattatui;
	const six = Object.fromEntries(rattatui.pieces.slice(0, 6).map((id, i) => [['head', 'shoulder', 'chest', 'hands', 'legs', 'feet'][i], plainItem(id)]));
	assert.equal(setCounts(six).rattatui, 6);
	assert.deepEqual(setBonusStats(setCounts(six)), sumStats(rattatui.bonuses[2], rattatui.bonuses[4], rattatui.bonuses[6]));
	assert.deepEqual(setBonusStats({}), sumStats());
});

test('shop items exist and cost at least 3x what they sell for (bought as a plain item at its first level)', () => {
	for (const { id, price } of shopItems()) {
		assert.ok(ITEM_CATALOG[id], id);
		const sells = ITEM_CATALOG[id].kind === 'consumable' ? ITEM_CATALOG[id].sellValue : sellValueOf(plainItem(id));
		assert.ok(price >= 3 * sells, `${id} must cost at least 3x its sell value (${price} vs ${sells})`);
	}
});

test('named items sit in pools that exist, and only the King and chests reach them', () => {
	for (const piece of SETS.rattatui.pieces) {
		assert.deepEqual(ITEM_CATALOG[piece].pools, ['rattatui_set'], piece);
		assert.equal(ITEM_CATALOG[piece].generation, 'named', piece);
		assert.equal(ITEM_CATALOG[piece].fixedRarity, 'epic', piece);
	}
	for (const profile of Object.values(LOOT_PROFILES)) {
		for (const table of profile.bonusTables) assert.ok(LOOT_POOLS[table.poolId], `${profile.id}/${table.id}`);
	}
	const reach = (poolId: string) => Object.values(LOOT_PROFILES).filter((p) => p.bonusTables.some((t) => t.poolId === poolId)).map((p) => p.id);
	assert.deepEqual(reach('rattatui_set'), ['boss']);
});

test('the resource registry is the one place resources are listed', () => {
	for (const key of Object.keys(INITIAL_RESOURCES)) assert.ok(key in RESOURCES, `${key} missing from RESOURCES`);
	assert.deepEqual(Object.keys(RESOURCE_ICONS), Object.keys(RESOURCES));
	assert.deepEqual(Object.keys(HEADER_DISPLAYED_RESOURCES_INFO), Object.keys(RESOURCES).filter((k) => k !== 'gems' && k !== 'embers'));
	assert.deepEqual(
		Object.keys(MERCHANT_RESOURCE_PRICES),
		Object.entries(RESOURCES).filter(([, def]) => 'merchant' in def).map(([key]) => key)
	);
	for (const [key, def] of Object.entries(RESOURCES)) {
		assert.ok(def.label && def.description && def.usedFor && def.source && def.color, key);
	}
});

test('every header resource sits in a tier: the header groups come from the catalog', () => {
	const tiered = RESOURCE_TIERS.flatMap((tier) => resourcesInTier(tier.id));
	// every stored resource except xp (never shown) is in exactly one tier, and nothing in a tier is unknown
	for (const key of Object.keys(INITIAL_RESOURCES)) {
		assert.equal(tiered.includes(key as never), key !== 'xp', `${key} tier`);
	}
	assert.equal(new Set(tiered).size, tiered.length, 'no resource in two tiers');
	assert.deepEqual(resourcesInTier('currency'), ['gold', 'gems', 'embers']);
	assert.deepEqual(resourcesInTier('t0'), ['wood', 'stone', 'coal', 'food', 'meat']);
	assert.deepEqual(resourcesInTier('t1'), ['eggs', 'milk', 'hide']);
});
