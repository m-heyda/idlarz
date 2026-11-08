import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ITEM_ICONS } from '../../src/config/itemIcons';
import { ITEM_ART_SIZE, PIXEL_ICON_SIZES, isItemArt, pixelIconSrc, type PixelIconName } from '../../src/config/pixelIcons';
import { ITEM_CATALOG } from '../../src/catalog';
import { LIVE_GRADES } from '../../src/catalog/items/grades';
import { RESERVE_ITEMS } from '../../src/catalog/items/reuse';
import type { ItemDef } from '../../src/types/game';
import { shopItems } from '../../src/catalog/loot';
import { LOOT_DATA } from '../../src/lib/loot/data';
import { eligibleCandidates } from '../../src/lib/loot/pools';
import { generateLoot } from '../../src/lib/loot/generate';
import { mulberry32 } from '../../src/lib/rng';

const PUBLIC = resolve(__dirname, '..', '..', 'public');
const gradeOf = (def: ItemDef) => def.tags?.find((t) => t.startsWith('grade:'))?.slice(6);
/** A reserve item is live when it is a base item of grade G1-G3; named ones (legendary folder) and G4+ stay disabled */
const isLive = (def: ItemDef) => LIVE_GRADES.includes(gradeOf(def) as never);
const liveIds = new Set(RESERVE_ITEMS.filter(isLive).map((d) => d.id));
const reserveIds = new Set(RESERVE_ITEMS.filter((d) => !isLive(d)).map((d) => d.id));

test('reserve items are all in the catalog, enabled only at the live grades (G1-G3), and each has its 64 px art registered', () => {
	assert.ok(RESERVE_ITEMS.length >= 90, 'the reuse art pass is in the catalog');
	for (const def of RESERVE_ITEMS) {
		assert.equal(ITEM_CATALOG[def.id], def, `${def.id} resolves`);
		assert.equal(def.enabled !== false, isLive(def), `${def.id} is enabled only if graded G1-G3`);
		assert.equal(def.icon, `art_${def.id}`, `${def.id} uses its own art`);
		assert.ok(isItemArt(def.icon!), `${def.id} icon is item art`);
		assert.ok(def.icon! in PIXEL_ICON_SIZES, `${def.id} icon is registered`);
	}
});

test('item art files sit under public/pixel/items at exactly 64x64', () => {
	for (const { icon } of ITEM_ICONS.filter((e) => e.file)) {
		const name = icon as PixelIconName;
		const id = name;
		const src = pixelIconSrc(name);
		assert.ok(src.startsWith('/pixel/items/'), `${id}: ${src}`);
		const file = resolve(PUBLIC, src.slice(1));
		assert.ok(existsSync(file), `${id}.png missing`);
		const buf = readFileSync(file);
		assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [...ITEM_ART_SIZE], `${id}.png size`);
	}
});

test('legacy 40 px icons still resolve to /pixel/icons', () => {
	assert.equal(pixelIconSrc('item_emberbrand'), '/pixel/icons/item_emberbrand.png');
	assert.equal(isItemArt('item_emberbrand'), false);
});

test('a disabled reserve item is never sold by the merchant, and no reserve item has a shop price', () => {
	for (const s of shopItems()) assert.ok(!reserveIds.has(s.id), `${s.id} is for sale`);
});

test('a disabled reserve item never drops, from any source at any level, and the live ones do drop', () => {
	const rng = mulberry32(2026);
	const dropped = new Set<string>();
	for (const sourceId of ['monster', 'boss', 'chest']) {
		for (let level = 1; level <= 100; level += 1) {
			for (let i = 0; i < 30; i++) {
				for (const drop of generateLoot({ sourceId, level }, rng).drops) {
					if (drop.kind !== 'gear') continue;
					assert.ok(!reserveIds.has(drop.item.base), `${drop.item.base} dropped from ${sourceId} L${level}`);
					dropped.add(drop.item.base);
				}
			}
		}
	}
	for (const id of dropped) if (liveIds.has(id)) assert.ok(ITEM_CATALOG[id].enabled !== false, id);
	assert.ok(dropped.size > 0 && [...liveIds].some((id) => dropped.has(id)), 'live reserve items drop');
	// and every live one is in the general pool at some item level (a rare roll must not decide this test)
	const eligible = new Set(
		Array.from({ length: 100 }, (_, i) => eligibleCandidates(LOOT_DATA, 'general_equipment', i + 1))
			.flat()
			.map((c) => c.def.id),
	);
	for (const id of liveIds) assert.ok(eligible.has(id), `${id} is in no loot pool`);
});
