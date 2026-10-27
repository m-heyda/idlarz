import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, owned, store, tileAt, gridCells, rawSnapshot } from './helpers';
import { pickPersisted, sanitizeSave } from '../src/lib/sanitizeSave';
import { decodeSave, encodeSave } from '../src/lib/saveFormat';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y, RESOURCE_CAP } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { COMBAT } from '../src/config/combatConfig';
import { emptyBag } from '../src/lib/inventory';
import { ownedCount, patchTile, setTile } from '../src/utils/world';

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
	rejects((r) => (r.chestSpawnTimer = 99999), 'chest timer out of range');
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
	setResources({ xp: 800 }); // level 2, but the tick has not awarded the point yet
	const repaired = sanitizeSave(snapshot());
	assert.equal(repaired.ok, true);
	if (repaired.ok) assert.equal(repaired.state.characterStats.availablePoints, 1);

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
const NEW_KEYS = ['equipment', 'bag', 'playerHp', 'monsters', 'monsterSpawnTimer', 'nextMonsterId'];

/** The n-th owned tile that is not the castle or a lake (the land is rolled, and a monster or a building cannot be on water). */
const spot = (n = 0) => {
	const found = gridCells()
		.filter(({ t }) => t.isOwned && t.biome !== 'castle' && t.biome !== 'lake')
		.map(({ x, y }) => ({ x, y }));
	return found[n];
};

const rat = (over: Record<string, unknown> = {}) => ({ id: 1, type: 'rat', tier: 1, ...spot(), ageSec: 100, ...over });

/** A played game with some gear, one monster and damaged HP; returns its raw snapshot after `mutate`. */
const combatSave = (mutate: (raw: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
	freshGame();
	growTo(8);
	const bag = emptyBag();
	bag[3] = { id: 'rattatui_tunic', qty: 1 };
	bag[4] = { id: 'potion_minor', qty: 20 };
	store.setState({
		equipment: { ...STARTER_EQUIPMENT, ring1: 'rattatui_ring', ring2: 'rattatui_ring', head: 'rattatui_cap' },
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
	assert.deepEqual(result.state.monsters, []);
	assert.equal(result.state.playerHp, 101);
	assert.equal(result.state.nextMonsterId, 1);
});

test('a played game with gear, a monster and damaged HP round-trips unchanged', () => {
	const raw = combatSave(() => undefined);
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.deepEqual(result.state.equipment, raw.equipment);
	assert.deepEqual(result.state.bag, raw.bag);
	assert.equal(result.state.playerHp, 50);
	assert.deepEqual(result.state.monsters, raw.monsters);
	assert.equal(result.state.monsterSpawnTimer, 123);
	assert.equal(result.state.nextMonsterId, 2);
});

test('a monster standing on a building (a save from before the spawn fix) is dropped, the save still loads', () => {
	const raw = combatSave((r) => {
		const tile = r.tiles[r.monsters[0].y][r.monsters[0].x];
		tile.biome = 'plains'; // the purchases are random: never a lake, which cannot hold a building
		tile.building = 'farm';
	});
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
	if (!result.ok) return;
	assert.deepEqual(result.state.monsters, []);
});

test('forged inventories, HP and monsters are rejected', () => {
	const bad = (mutate: (raw: any) => void, label: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
		assert.equal(sanitizeSave(combatSave(mutate)).ok, false, `${label} should be rejected`);
	};
	bad((r) => (r.equipment.head = 'mythic_crown'), 'unknown equipped item');
	bad((r) => (r.equipment.head = 'wooden_sword'), 'sword in the head slot');
	bad((r) => (r.equipment.mainHand = 'rattatui_ring'), 'ring item in the weapon slot');
	bad((r) => (r.equipment.ring1 = 'rattatui_cap'), 'cap in a ring slot');
	bad((r) => (r.equipment.head = 'potion_minor'), 'potion equipped');
	bad((r) => (r.equipment.bogus = 'wooden_sword'), 'unknown equipment slot');
	bad((r) => (r.bag = r.bag.slice(1)), 'bag of 35');
	bad((r) => (r.bag = [...r.bag, null]), 'bag of 37');
	bad((r) => (r.bag[4].qty = 21), 'potion stack of 21');
	bad((r) => (r.bag[4].qty = 0), 'empty stack');
	bad((r) => (r.bag[4].qty = 2.5), 'fractional stack');
	bad((r) => (r.bag[3].qty = 2), 'gear with qty 2');
	bad((r) => (r.bag[3].id = 'nope'), 'unknown bag item');
	bad((r) => (r.bag[0] = 'sword'), 'bag entry that is not an object');
	bad((r) => delete r.bag, 'equipment without a bag');
	bad((r) => delete r.equipment, 'bag without equipment');
	bad((r) => (r.playerHp = 1e6), 'playerHp above max');
	bad((r) => (r.playerHp = NaN), 'playerHp NaN');
	bad((r) => (r.playerHp = -1), 'negative playerHp');
	bad((r) => (r.monsters[0].x = CASTLE_X, r.monsters[0].y = CASTLE_Y), 'monster on the castle');
	bad((r) => (r.monsters[0].x = 0, r.monsters[0].y = 0), 'monster on an unowned tile');
	bad((r) => (r.tiles[r.monsters[0].y][r.monsters[0].x].hasChest = true), 'monster on a chest tile');
	bad((r) => r.monsters.push({ ...r.monsters[0], id: 2, type: 'ratKing', tier: 1 }, { ...r.monsters[0], id: 3, type: 'ratKing', tier: 1 }), 'two kings on one tile');
	bad((r) => (r.monsters = Array.from({ length: 5000 }, (_, i) => ({ ...r.monsters[0], id: i + 1 }))), 'more monsters than tiles');
	bad((r) => (r.monsters[0].tier = COMBAT.maxTier + 1), 'tier above the cap');
	bad((r) => (r.monsters[0].type = 'dragon'), 'unknown monster type');
	bad((r) => (r.monsters.push({ ...r.monsters[0], ...spot(1) }), (r.nextMonsterId = 5)), 'duplicate monster ids');
	bad((r) => (r.monsters[0].id = 5), 'monster id not below nextMonsterId');
	bad((r) => (r.monsters[0].ageSec = -1), 'negative monster age');
	bad((r) => (r.bag[0] = { id: 'constructor', qty: 1 }), 'object prototype name as a bag item');
	bad((r) => (r.bag[0] = { id: '__proto__', qty: 1 }), '__proto__ as a bag item');
	bad((r) => (r.bag[0] = { id: 'toString', qty: 1 }), 'toString as a bag item');
	bad((r) => (r.equipment.head = 'constructor'), 'object prototype name as equipped item');
	bad((r) => (r.equipment.neck = 'hasOwnProperty'), 'hasOwnProperty as equipped item');
	bad((r) => (r.tiles[r.monsters[0].y][r.monsters[0].x].biome = 'constructor'), 'object prototype name as a biome');
	bad((r) => (r.monsterSpawnTimer = COMBAT.spawn.intervalSec + 1), 'spawn timer out of range');
	bad((r) => (r.nextMonsterId = 0), 'nextMonsterId 0');
});

test('two kings are rejected even on different tiles', () => {
	const raw = combatSave((r) => {
		const other = { ...r.monsters[0] };
		r.monsters[0] = { ...r.monsters[0], type: 'ratKing', tier: 1, ageSec: 0 };
		r.monsters.push({ ...other, id: 2, type: 'ratKing', tier: 1, ageSec: 0 });
		r.nextMonsterId = 3;
	});
	// move the second king to another owned tile
	raw.monsters[1].x = spot(1).x;
	raw.monsters[1].y = spot(1).y;
	assert.equal(sanitizeSave(raw).ok, false);
});

test('a chest cannot share a tile with a monster', () => {
	freshGame();
	growTo(8);
	const { x, y } = spot();
	store.setState({ monsters: [rat()] as never, nextMonsterId: 2 });
	store.setState((s) => {
		return { tiles: patchTile(s.tiles, x, y, { hasChest: true }), activeChests: 1 };
	});
	assert.equal(sanitizeSave(snapshot()).ok, false);
});

test('a played game that started with the free ring passes validation (tiles, buildings, chests)', () => {
	api().resetGame(); // keep the starting ring
	growTo(30);
	store.setState((s) => {
		const spot = gridCells(s.tiles).find(({ t }) => t.isOwned && t.biome !== 'castle')!;
		return { tiles: setTile(s.tiles, spot.x, spot.y, { biome: 'grounds', isOwned: true, building: 'tavern', level: 2 }) };
	});
	api().tick(60_000);
	const result = sanitizeSave(snapshot());
	assert.equal(result.ok, true, result.ok ? '' : result.reason);
});

test('buildings on any land biome save and load; water, nonsense and stray levels are rejected; old Grounds lots (level 2) still load', () => {
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
	assert.equal(load({ biome: 'grounds', building: 'tavern', level: 2 }).ok, true, 'an old Grounds lot');
	assert.equal(load({ biome: 'grounds' }).ok, true, 'an old empty lot');
	assert.equal(load({ biome: 'lake', building: 'tavern' }).ok, false, 'a building on water');
	assert.equal(load({ biome: 'forest', building: 'nonsense' }).ok, false);
	assert.equal(load({ biome: 'forest', building: 'tavern', level: 2 }).ok, false, 'level 2 only belongs to old Grounds lots');
	assert.equal(load({ biome: 'forest', level: 2 }).ok, false, 'a level without a building');
	rejects((raw) => { raw.tiles[CASTLE_Y][CASTLE_X].building = 'tavern'; }, 'a building on the castle');
});
