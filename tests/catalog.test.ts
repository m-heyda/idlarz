import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
	ITEMS,
	ITEM_CATALOG,
	RARITIES,
	RARITY_ORDER,
	RESOURCES,
	SETS,
	STAT_DEFS,
	lootPool,
	pickWeighted,
	setBonusStats,
	setCounts,
	shopItems,
	sumStats,
} from '../src/catalog';
import { HEADER_DISPLAYED_RESOURCES_INFO, INITIAL_RESOURCES, MERCHANT_RESOURCE_PRICES, RESOURCE_ICONS } from '../src/config/gameConfig';
import { PIXEL_ICON_SIZES, pixelIconSrc, type PixelIconName } from '../src/config/pixelIcons';

const PUBLIC = resolve(__dirname, '..', 'public');

test('every item has a unique id and a rarity that exists', () => {
	assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
	for (const def of ITEMS) assert.ok(RARITIES[def.rarity], def.id);
});

test('sell value follows the rarity unless the item overrides it, and never decreases with rarity', () => {
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
	const six = Object.fromEntries(rattatui.pieces.slice(0, 6).map((id, i) => [['head', 'shoulder', 'chest', 'hands', 'legs', 'feet'][i], id]));
	assert.equal(setCounts(six).rattatui, 6);
	assert.deepEqual(setBonusStats(setCounts(six)), sumStats(rattatui.bonuses[3], rattatui.bonuses[6]));
	assert.deepEqual(setBonusStats({}), sumStats());
});

test('loot pools: the Rattatui set only drops from the king, and every drop and shop item exists', () => {
	for (const source of ['rat', 'ratKing', 'chest'] as const) for (const { id, weight } of lootPool(source)) assert.ok(ITEM_CATALOG[id] && weight > 0, `${source}: ${id}`);
	for (const piece of SETS.rattatui.pieces) {
		assert.ok(lootPool('ratKing').some((e) => e.id === piece), piece);
		assert.ok(!lootPool('rat').some((e) => e.id === piece), piece);
		assert.ok(!lootPool('chest').some((e) => e.id === piece), piece);
	}
	for (const { id, price } of shopItems()) {
		assert.ok(ITEM_CATALOG[id], id);
		assert.ok(price >= 3 * ITEM_CATALOG[id].sellValue, `${id} must cost at least 3x its sell value`);
	}
});

test('pickWeighted follows the weights and costs no random number for a pool of one', () => {
	assert.equal(pickWeighted([], () => 0), undefined);
	assert.equal(pickWeighted([{ id: 'a', weight: 5 }], () => assert.fail('no rng needed')), 'a');
	const pool = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
	assert.equal(pickWeighted(pool, () => 0), 'a');
	assert.equal(pickWeighted(pool, () => 0.3), 'b');
	assert.equal(pickWeighted(pool, () => 0.999), 'b');
});

test('the resource registry is the one place resources are listed', () => {
	for (const key of Object.keys(INITIAL_RESOURCES)) assert.ok(key in RESOURCES, `${key} missing from RESOURCES`);
	assert.deepEqual(Object.keys(RESOURCE_ICONS), Object.keys(RESOURCES));
	assert.deepEqual(Object.keys(HEADER_DISPLAYED_RESOURCES_INFO), Object.keys(RESOURCES).filter((k) => k !== 'gems' && k !== 'legacy'));
	assert.deepEqual(
		Object.keys(MERCHANT_RESOURCE_PRICES),
		Object.entries(RESOURCES).filter(([, def]) => 'merchant' in def).map(([key]) => key)
	);
	for (const [key, def] of Object.entries(RESOURCES)) {
		assert.ok(def.label && def.description && def.usedFor && def.source && def.color, key);
	}
});
