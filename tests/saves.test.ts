import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, owned, store, tileAt, gridCells, rawSnapshot } from './helpers';
import { pickPersisted, sanitizeSave } from '../src/lib/sanitizeSave';
import { decodeSave, encodeSave, packBody, sealWire } from '../src/lib/saveFormat';
import { readFileSync } from 'node:fs';
import { aggregateStats } from '../src/lib/inventory';
import { resolveItem } from '../src/lib/itemInstance';
import { RETUNED_STATS } from './retunedItems';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, RESOURCE_CAP } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { plainItem } from '../src/lib/itemInstance';
import { emptyBag } from '../src/lib/inventory';
import { ownedCount, setTile } from '../src/utils/world';
import { totalStatPoints, xpToNextLevel } from '../src/utils/gameUtils';

/** A plain JSON copy of a (valid) persisted game, as it would come out of a save file. */
const snapshot = () => rawSnapshot();

const rejects = (mutate: (raw: any) => void, label: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
	const raw = snapshot();
	mutate(raw);
	const result = sanitizeSave(raw);
	assert.equal(result.ok, false, `${label} should be rejected`);
};

test('a normally played game passes validation unchanged', () => {
	freshGame();
	growTo(12);
	api().tick(60_000);
	const raw = snapshot();
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (result.ok) {
		assert.equal(result.state.resources.gold, raw.resources.gold);
		assert.equal(ownedCount(result.state.tiles), owned());
	}
});

test('a real new game (castle + free ring) saves and loads; an old castle-only save loads with its own count', () => {
	api().resetGame(); // not freshGame(): keep the starting ring
	assert.equal(api().freeTiles, 9);
	const fresh = sanitizeSave(snapshot());
	assert.equal(fresh.ok, true, fresh.ok ? '' : fresh.reason);
	if (fresh.ok) assert.equal(fresh.state.freeTiles, 9);

	freshGame(); // castle only
	growTo(6);
	const legacy = snapshot();
	delete legacy.freeTiles; // a save from before the starting ring
	const loaded = sanitizeSave(legacy);
	assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.reason);
	if (loaded.ok) assert.equal(loaded.state.freeTiles, 1);
});

test('free tiles cannot be forged: only 1 or 9, and 9 needs the whole ring owned', () => {
	freshGame();
	growTo(4);
	rejects((r) => (r.freeTiles = 9), 'free ring claimed without owning it');
	rejects((r) => (r.freeTiles = 5), 'odd free tile count');
	rejects((r) => (r.freeTiles = 0), 'zero free tiles');
	rejects((r) => (r.freeTiles = 1.5), 'fractional free tiles');
});

test('tampered saves are rejected', () => {
	freshGame();
	growTo(10);
	api().tick(60_000);
	rejects((r) => (r.resources.gold = -1), 'negative gold');
	rejects((r) => (r.resources.gold = RESOURCE_CAP * 10), 'gold above the cap');
	rejects((r) => (r.resources.wood = 'lots'), 'non-numeric wood');
	rejects((r) => (r.resources.stone = null), 'null stone');
	rejects((r) => delete r.resources.coal, 'missing resource');
	rejects((r) => (r.characterStats.strength += 50), 'extra strength points');
	rejects((r) => (r.characterStats.availablePoints += 50), 'extra available points');
	rejects((r) => (r.characterStats.charisma = 2.5), 'fractional stat');
	rejects((r) => (r.tiles[CASTLE_Y][CASTLE_X].level = CASTLE_UPGRADE.maxLevel + 1), 'castle above max level');
	rejects((r) => (r.tiles[CASTLE_Y][CASTLE_X].level = 0), 'castle level 0');
	rejects((r) => (r.tiles[0][0] = { biome: 'forest', isOwned: true }), 'territory not connected to the castle');
	rejects((r) => (r.tiles[0][1] = { biome: 'castle', isOwned: true, level: 1 }), 'second castle');
	rejects((r) => (r.tiles[0][0] = { biome: 'empty', isOwned: false, building: 'market', level: 2 }), 'building on an unowned tile');
	rejects((r) => (r.tiles[0][0] = { biome: 'forest', isOwned: false }), 'unowned tile with a biome');
	rejects((r) => (r.tiles[CASTLE_Y][CASTLE_X + 1] = { biome: 'forest', isOwned: true, building: 'market', level: 2 }), 'building on a forest');
	rejects((r) => (r.tiles[CASTLE_Y][CASTLE_X + 1].hasChest = 'yes'), 'bad chest flag');
	rejects((r) => (r.farmLevels = { dragon: 3 }), 'unknown animal');
	rejects((r) => (r.farmLevels = { chicken: -4 }), 'negative animals');
	rejects((r) => (r.clickLevel = 9), 'click level above the ladder');
	rejects((r) => (r.castleUpgrade = { toLevel: 6, remainingSec: 1 }), 'castle upgrade to a level that is not next');
	rejects((r) => (r.castleUpgrade = { toLevel: 2, remainingSec: -5 }), 'negative upgrade timer');
	rejects((r) => (r.playSeconds = -1), 'negative play time');
	rejects((r) => (r.tiles = r.tiles.slice(1)), 'grid with a missing row');
	rejects((r) => (r.resources.xp = 0), 'tiles owned without the XP that paid for them');
	rejects((r) => (r.tiles = null), 'no grid');
	assert.equal(sanitizeSave(null).ok, false);
	assert.equal(sanitizeSave('hello').ok, false);
	assert.equal(sanitizeSave([]).ok, false);
});

test('derived values cannot be forged: rates, reputation, level, combat stats and castle cost are recomputed', () => {
	freshGame();
	growTo(6);
	api().tick(1000);
	const raw = snapshot();
	raw.characterStats.reputation = 999999;
	raw.characterStats.hp = 1e9;
	raw.characterStats.tileCostDiscount = 99;
	raw.level = { level: 99, progress: 0.5 };
	raw.tiles[CASTLE_Y][CASTLE_X].upgradeCost = { gold: 1 };
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.state.characterStats.reputation, 1000 + 100 * (owned() - 1));
	assert.ok(result.state.characterStats.hp < 100);
	assert.ok(result.state.characterStats.tileCostDiscount <= 25);
	assert.equal(result.state.level.level, api().level.level);
	assert.ok((tileAt(result.state.tiles, CASTLE_X, CASTLE_Y).upgradeCost?.gold ?? 0) > 1);
});

test('a save one level-up behind (written between a purchase and the next tick) is repaired, a far-behind one is rejected', () => {
	freshGame();
	setResources({ xp: xpToNextLevel(1) + 100 }); // level 2, but the tick has not awarded the points yet
	const repaired = sanitizeSave(snapshot());
	assert.equal(repaired.ok, true);
	if (repaired.ok) assert.equal(repaired.state.characterStats.availablePoints, totalStatPoints(2));

	setResources({ xp: 100_000 }); // many levels without any points: not a one-tick gap
	assert.equal(sanitizeSave(snapshot()).ok, false);
	api().tick(100);
	assert.equal(sanitizeSave(snapshot()).ok, true);
});

test('export -> decode accepts a real save and rejects edited / foreign ones', () => {
	freshGame();
	growTo(9);
	api().tick(30_000);
	const file = encodeSave(pickPersisted(api()));
	const parsed = decodeSave(file);
	assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.reason);
	if (parsed.ok) assert.equal(ownedCount(parsed.state.tiles), owned());

	// swap one character for a different one: the check code catches it
	const bad = decodeSave(file.slice(0, 50) + (file[50] === 'x' ? 'y' : 'x') + file.slice(51));
	assert.equal(bad.ok, false);
	assert.equal(decodeSave('{"state":{}}').ok, false);

	// a well-formed file whose content is impossible is rejected by validation
	const forged = structuredClone(pickPersisted(api()));
	forged.resources.gold = 1e300;
	assert.equal(decodeSave(encodeSave(forged)).ok, false);
});

// ---- combat / inventory state ------------------------------------------------------------------------------------
const NEW_KEYS = ['equipment', 'bag', 'playerHp', 'playerMp', 'monsters', 'monsterSpawnTimer', 'nextMonsterId', 'lootPity', 'autoSellUpTo'];

/** The n-th owned tile that is not the castle or a lake (the land is rolled, and a monster or a building cannot be on water). */
const spot = (n = 0) => {
	const found = gridCells()
		.filter(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')
		.map(({ x, y }) => ({ x, y }));
	return found[n];
};

const rat = (over: Record<string, unknown> = {}) => ({ id: 1, type: 'rat', level: 1, spawnLevel: 1, ...spot(), ageSec: 100, ...over });

/** A played game with some gear, one monster and damaged HP; returns its raw snapshot after `mutate`. */
const combatSave = (mutate: (raw: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
	freshGame();
	growTo(8);
	const bag = emptyBag();
	bag[3] = { item: plainItem('rattatui_tunic') };
	bag[4] = { id: 'potion_minor', qty: 20 };
	store.setState({
		equipment: { ...STARTER_EQUIPMENT, ring1: plainItem('rattatui_ring'), ring2: plainItem('rattatui_ring'), head: plainItem('rattatui_cap') },
		bag,
		playerHp: 50,
		monsters: [rat()],
		nextMonsterId: 2,
		monsterSpawnTimer: 123,
	} as never);
	const raw = snapshot();
	mutate(raw);
	return raw;
};

test('an old save without the combat fields loads with the starter kit', () => {
	freshGame();
	growTo(6);
	const raw = snapshot();
	NEW_KEYS.forEach((k) => delete raw[k]);
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.deepEqual(result.state.equipment, STARTER_EQUIPMENT);
	assert.deepEqual(result.state.bag[0], { id: 'potion_minor', qty: 2 });
	assert.equal(result.state.bag.length, 36);
	assert.equal(result.state.playerHp, 101);
	assert.equal(result.state.playerMp, 40, 'a save from before mana starts with a full pool');
});

test('a played game with gear and damaged HP round-trips unchanged', () => {
	const raw = combatSave(() => undefined);
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.deepEqual(result.state.equipment, raw.equipment);
	assert.deepEqual(result.state.bag, raw.bag);
	assert.equal(result.state.playerHp, 50);
});

test('forged inventories and HP are rejected', () => {
	const bad = (mutate: (raw: any) => void, label: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
		assert.equal(sanitizeSave(combatSave(mutate)).ok, false, `${label} should be rejected`);
	};
	bad((r) => (r.equipment.head = 'mythic_crown'), 'a bare item id (the old format) is not an item');
	bad((r) => (r.equipment.head = plainItem('wooden_sword')), 'sword in the head slot');
	bad((r) => (r.equipment.mainHand = plainItem('rattatui_ring')), 'ring item in the weapon slot');
	bad((r) => (r.equipment.ring1 = plainItem('rattatui_cap')), 'cap in a ring slot');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), base: 'potion_minor' }), 'potion equipped');
	bad((r) => (r.equipment.bogus = plainItem('wooden_sword')), 'unknown equipment slot');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), base: 'nope' }), 'unknown base item');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'mythic' }), 'unknown rarity');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), level: 500 }), 'item level above the cap');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), level: 0 }), 'item level 0');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), level: 1.5 }), 'fractional item level');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), level: 90 }), 'item level past the base window');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), quality: 101 }), 'quality out of range');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), stats: { damage: 9999 } }), 'a stat field smuggled into an instance');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), affixes: [{ id: 'maxHp_prefix', roll: 5 }, { id: 'armor_prefix', roll: 5 }] }), 'two affixes on a common item');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'uncommon', affixes: [{ id: 'nope', roll: 5 }] }), 'unknown affix');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'uncommon', affixes: [{ id: 'damage_prefix', roll: 5 }] }), 'a weapon affix on a cap');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'uncommon', affixes: [{ id: 'maxHp_prefix', roll: 500 }] }), 'affix roll out of range');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'uncommon', affixes: [{ id: 'maxHp_prefix', roll: 5, value: 9999 }] }), 'a value smuggled into an affix');
	bad((r) => (r.equipment.head = { ...plainItem('rattatui_cap'), rarity: 'common' }), 'a named item with another rarity');
	bad((r) => (r.bag[3].item.rarity = 'mythic'), 'a bag item with an unknown rarity');
	bad((r) => (r.bag[3] = { item: plainItem('rattatui_tunic'), extra: 1 }), 'a stray key on a gear entry');
	bad((r) => (r.bag[3] = { id: 'rattatui_tunic', qty: 1 }), 'gear stored as a stack (the old format)');
	bad((r) => (r.lootPity = { 'boss:nope': 1 }), 'pity for an unknown table');
	bad((r) => (r.lootPity = { 'boss:king_legendary': -1 }), 'negative pity');
	bad((r) => (r.lootPity = { 'boss:king_legendary': 1e9 }), 'absurd pity');
	bad((r) => (r.autoSellUpTo = 'mythic'), 'auto-sell up to an unknown rarity');
	bad((r) => (r.autoSellUpTo = 'constructor'), 'auto-sell up to a prototype name');
	bad((r) => (r.bag = r.bag.slice(1)), 'bag of 35');
	bad((r) => (r.bag = [...r.bag, null]), 'bag of 37');
	bad((r) => (r.bag[4].qty = 21), 'potion stack of 21');
	bad((r) => (r.bag[4].qty = 0), 'empty stack');
	bad((r) => (r.bag[4].qty = 2.5), 'fractional stack');
	bad((r) => (r.bag[3].qty = 2), 'gear with qty 2');
	bad((r) => (r.bag[4].id = 'nope'), 'unknown bag item');
	bad((r) => (r.bag[0] = 'sword'), 'bag entry that is not an object');
	bad((r) => delete r.bag, 'equipment without a bag');
	bad((r) => delete r.equipment, 'bag without equipment');
	bad((r) => (r.playerHp = 1e6), 'playerHp above max');
	bad((r) => (r.playerHp = NaN), 'playerHp NaN');
	bad((r) => (r.playerHp = -1), 'negative playerHp');
	bad((r) => (r.playerMp = 1e6), 'playerMp above the mana pool');
	bad((r) => (r.playerMp = NaN), 'playerMp NaN');
	bad((r) => (r.playerMp = -1), 'negative playerMp');
	bad((r) => (r.playerMp = '40'), 'playerMp as text');
	bad((r) => (r.bag[0] = { id: 'constructor', qty: 1 }), 'object prototype name as a bag item');
	bad((r) => (r.bag[0] = { id: '__proto__', qty: 1 }), '__proto__ as a bag item');
	bad((r) => (r.bag[0] = { id: 'toString', qty: 1 }), 'toString as a bag item');
	bad((r) => (r.equipment.head = 'constructor'), 'object prototype name as equipped item');
	bad((r) => (r.equipment.neck = 'hasOwnProperty'), 'hasOwnProperty as equipped item');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), base: 'constructor' }), 'prototype name as an item base');
	bad((r) => (r.equipment.head = { ...plainItem('leather_cap'), rarity: 'constructor' }), 'prototype name as a rarity');
});

test('a played game that started with the free ring passes validation (tiles, buildings, chests)', () => {
	api().resetGame(); // keep the starting ring
	growTo(30);
	store.setState((s) => {
		const spot = gridCells(s.tiles).find(({ t }) => t.isOwned && t.biome !== 'castle')!;
		return { tiles: setTile(s.tiles, spot.x, spot.y, { biome: 'forest', isOwned: true, building: 'tavern' }) };
	});
	api().tick(60_000);
	const result = sanitizeSave(snapshot());
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
});

test('buildings on any land biome save and load; water, nonsense and stray levels are rejected; the removed Grounds biome is refused', () => {
	api().resetGame();
	growTo(12);
	const spot = gridCells().find(({ t }) => t.isOwned && t.biome !== 'castle')!;
	const place = (tile: Record<string, unknown>) => (raw: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
		raw.tiles[spot.y][spot.x] = { isOwned: true, ...tile };
	};
	const load = (tile: Record<string, unknown>) => {
		const raw = snapshot();
		place(tile)(raw);
		return sanitizeSave(raw);
	};
	assert.equal(load({ biome: 'forest', building: 'tavern' }).ok, true, 'a forest building');
	assert.equal(load({ biome: 'hills', building: 'quarry' }).ok, true);
	assert.equal(load({ biome: 'grounds', building: 'tavern' }).ok, false, 'Grounds is no biome any more (schema 3 saves are converted when they are read)');
	assert.equal(load({ biome: 'grounds' }).ok, false, 'an old empty lot');
	assert.equal(load({ biome: 'lake', building: 'tavern' }).ok, false, 'a building on water');
	assert.equal(load({ biome: 'forest', building: 'nonsense' }).ok, false);
	assert.equal(load({ biome: 'forest', building: 'tavern', level: 2 }).ok,false, 'a building never has a level');
	assert.equal(load({ biome: 'forest', level: 2 }).ok, false, 'a level without a building');
	rejects((raw) => { raw.tiles[CASTLE_Y][CASTLE_X].building = 'tavern'; }, 'a building on the castle');
});

// ---- schema 2 -> 3: gear ids become item instances -------------------------------------------------------------------
const legacy = JSON.parse(readFileSync(new URL('./fixtures/legacy-items.json', import.meta.url), 'utf8')) as Record<string, { kind: string; slot: string | null; rarity: string; stats: Record<string, number> }>;
const legacyGear = Object.entries(legacy).filter(([, item]) => item.kind !== 'consumable');

/** A v2 save: the current game written the way schema 2 did (gear as bare ids). */
const v2Text = (gear: { equipment?: Record<string, string>; bag?: unknown[] }) => {
	freshGame();
	growTo(8);
	const body = packBody(pickPersisted(api())) as Record<string, unknown>;
	const { lootPity: _p, autoSellUpTo: _a, ...rest } = body; // schema 2 had neither
	void _p;
	void _a;
	return sealWire({ v: 2, t: 1, s: { ...rest, equipment: gear.equipment ?? {}, bag: gear.bag ?? Array.from({ length: 36 }, () => null) } });
};

test('a schema 2 save keeps every item: each old gear id converts to an instance with exactly its old stats', () => {
	const ids = legacyGear.map(([id]) => id);
	for (let from = 0; from < ids.length; from += 36) {
		const chunk = ids.slice(from, from + 36);
		const bag: unknown[] = Array.from({ length: 36 }, (_, i) => (chunk[i] ? { id: chunk[i], qty: 1 } : null));
		const r = decodeSave(v2Text({ bag }));
		assert.equal(r.ok, true, r.ok ? '' : r.reason);
		if (!r.ok) continue;
		chunk.forEach((id, i) => {
			const slot = r.state.bag[i];
			assert.ok(slot && 'item' in slot, id);
			if (!slot || !('item' in slot)) return;
			assert.equal(slot.item.base, id);
			assert.equal(slot.item.rarity, legacy[id].rarity, `${id} keeps its old rarity`);
			assert.deepEqual(resolveItem(slot.item)!.stats, RETUNED_STATS[id] ?? legacy[id].stats, `${id} keeps its old stats (or its pinned retuned ones)`);
		});
	}
});

test('a schema 2 save keeps worn gear and stacks, and its derived stats do not change', () => {
	const r = decodeSave(v2Text({ equipment: { mainHand: 'wooden_sword', offHand: 'wooden_shield', head: 'rattatui_cap' }, bag: [{ id: 'potion_minor', qty: 5 }, ...Array.from({ length: 35 }, () => null)] }));
	assert.equal(r.ok, true, r.ok ? '' : r.reason);
	if (!r.ok) return;
	assert.deepEqual(r.state.equipment.mainHand, { base: 'wooden_sword', level: 1, rarity: 'common', quality: 50, affixes: [] });
	assert.equal(r.state.equipment.head?.rarity, 'epic');
	assert.deepEqual(r.state.bag[0], { id: 'potion_minor', qty: 5 });
	assert.deepEqual(aggregateStats(r.state.equipment), { ...aggregateStats({ mainHand: plainItem('wooden_sword'), offHand: plainItem('wooden_shield'), head: plainItem('rattatui_cap') }) });
	assert.deepEqual(r.state.lootPity, {});
	assert.equal(r.state.autoSellUpTo, null);
});

test('a forged schema 2 save is still refused: unknown ids, prototype names, stacked gear, potions as armour', () => {
	const bad = (gear: { equipment?: Record<string, string>; bag?: unknown[] }) => decodeSave(v2Text(gear)).ok;
	const row = (entry: unknown) => [entry, ...Array.from({ length: 35 }, () => null)];
	assert.equal(bad({ equipment: { head: 'mythic_crown' } }), false);
	assert.equal(bad({ equipment: { head: 'constructor' } }), false);
	assert.equal(bad({ equipment: { head: 'potion_minor' } }), false);
	assert.equal(bad({ equipment: { head: 'wooden_sword' } }), false, 'wrong slot');
	assert.equal(bad({ bag: row({ id: 'steel_helm', qty: 2 }) }), false, 'two helms in one slot');
	assert.equal(bad({ bag: row({ id: '__proto__', qty: 1 }) }), false);
	assert.equal(bad({ bag: row({ id: 'toString', qty: 1 }) }), false);
	assert.equal(bad({ bag: row({ id: 'steel_helm', qty: 1 }) }), true);
});

test('the frozen schema 3 fixture holds rolled gear, pity and the auto-sell filter, and re-encodes unchanged', () => {
	const text = readFileSync(new URL('./fixtures/saves/v3.sav', import.meta.url), 'utf8').trim();
	const r = decodeSave(text);
	assert.equal(r.ok, true, r.ok ? '' : r.reason);
	if (!r.ok) return;
	assert.equal(r.schema, 3);
	const gear = r.state.bag.flatMap((slot) => (slot && 'item' in slot ? [slot.item] : []));
	assert.ok(gear.length >= 9);
	assert.ok(gear.some((item) => item.affixes.length > 0 && item.level > 1), 'rolled items with affixes and a level above 1');
	assert.ok(gear.every((item) => resolveItem(item)), 'every instance resolves');
	assert.deepEqual(r.state.lootPity, { 'boss:king_legendary': 3 });
	assert.equal(r.state.autoSellUpTo, 'common');
	assert.ok(r.state.equipment.head && r.state.equipment.neck && r.state.equipment.head.affixes.length > 0, 'rolled gear is worn too');
	const again = decodeSave(encodeSave(r.state));
	assert.equal(again.ok, true);
	if (again.ok) assert.deepEqual(again.state.bag, r.state.bag);
});
