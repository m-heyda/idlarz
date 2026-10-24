import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, owned, store } from './helpers';
import { pickPersisted, sanitizeSave } from '../src/lib/sanitizeSave';
import { decryptText, encryptText, exportSave, parseSave } from '../src/lib/saveVault';
import { CASTLE_UPGRADE, GRID_CENTER_X, GRID_CENTER_Y, RESOURCE_CAP } from '../src/config/gameConfig';
import { STARTER_EQUIPMENT } from '../src/config/itemCatalog';
import { COMBAT } from '../src/config/combatConfig';
import { emptyBag } from '../src/lib/inventory';

/** A plain JSON copy of a (valid) persisted game, as it would come out of a save file. */
const snapshot = () => JSON.parse(JSON.stringify(pickPersisted(api())));

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
		assert.equal(result.state.tiles.flat().filter((t) => t.isOwned).length, owned());
	}
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
	rejects((r) => (r.tiles[GRID_CENTER_Y][GRID_CENTER_X].level = CASTLE_UPGRADE.maxLevel + 1), 'castle above max level');
	rejects((r) => (r.tiles[GRID_CENTER_Y][GRID_CENTER_X].level = 0), 'castle level 0');
	rejects((r) => (r.tiles[0][0] = { biome: 'forest', isOwned: true }), 'territory not connected to the castle');
	rejects((r) => (r.tiles[0][1] = { biome: 'castle', isOwned: true, level: 1 }), 'second castle');
	rejects((r) => (r.tiles[0][0] = { biome: 'empty', isOwned: false, building: 'market', level: 2 }), 'building on an unowned tile');
	rejects((r) => (r.tiles[0][0] = { biome: 'forest', isOwned: false }), 'unowned tile with a biome');
	rejects((r) => (r.tiles[GRID_CENTER_Y][GRID_CENTER_X + 1] = { biome: 'forest', isOwned: true, building: 'market', level: 2 }), 'building on a forest');
	rejects((r) => (r.tiles[GRID_CENTER_Y][GRID_CENTER_X + 1].hasChest = 'yes'), 'bad chest flag');
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
	raw.tiles[GRID_CENTER_Y][GRID_CENTER_X].upgradeCost = { gold: 1 };
	const result = sanitizeSave(raw);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.state.characterStats.reputation, 1000 + 100 * (owned() - 1));
	assert.ok(result.state.characterStats.hp < 100);
	assert.ok(result.state.characterStats.tileCostDiscount <= 25);
	assert.equal(result.state.level.level, api().level.level);
	assert.ok((result.state.tiles[GRID_CENTER_Y][GRID_CENTER_X].upgradeCost?.gold ?? 0) > 1);
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

test('encrypt/decrypt round trip, and any edit of the ciphertext is detected', async () => {
	const text = JSON.stringify({ hello: 'world', n: 12345, nested: { a: [1, 2, 3] } });
	const envelope = await encryptText(text);
	assert.ok(envelope.startsWith('IDLZ1.'));
	assert.ok(!envelope.includes('world'));
	assert.equal(await decryptText(envelope), text);
	assert.notEqual(await encryptText(text), envelope, 'fresh IV every time');

	const body = envelope.slice(6);
	const flipped = envelope.slice(0, 6) + body.slice(0, 40) + (body[40] === 'A' ? 'B' : 'A') + body.slice(41);
	await assert.rejects(() => decryptText(flipped));
	await assert.rejects(() => decryptText(envelope.slice(0, envelope.length - 8)));
	await assert.rejects(() => decryptText('plain json {"gold": 1e15}'));
	await assert.rejects(() => decryptText(''));
});

test('export -> parse accepts a real save and rejects edited / foreign ones', async () => {
	freshGame();
	growTo(9);
	api().tick(30_000);
	const file = await exportSave(pickPersisted(api()));
	const parsed = await parseSave(file);
	assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.reason);
	if (parsed.ok) assert.equal(parsed.state.tiles.flat().filter((t) => t.isOwned).length, owned());

	// swap one character for a different one (a fixed 'x' is a no-op 1 time in 64 and made this test flaky)
	const bad = await parseSave(file.slice(0, 50) + (file[50] === 'x' ? 'y' : 'x') + file.slice(51));
	assert.equal(bad.ok, false);
	assert.equal((await parseSave('{"state":{}}')).ok, false);

	// a perfectly encrypted file whose content is impossible is rejected by validation
	const forged = snapshot();
	forged.resources.gold = 1e300;
	const forgedFile = await encryptText(JSON.stringify({ v: 12, savedAt: 'x', state: forged }));
	assert.equal((await parseSave(forgedFile)).ok, false);

	// wrong save version
	const old = await encryptText(JSON.stringify({ v: 11, savedAt: 'x', state: snapshot() }));
	assert.equal((await parseSave(old)).ok, false);
});

// ---- combat / inventory state ------------------------------------------------------------------------------------
const NEW_KEYS = ['equipment', 'bag', 'playerHp', 'monsters', 'monsterSpawnTimer', 'nextMonsterId'];

/** The n-th owned tile that is not the castle. */
const spot = (n = 0) => {
	const found: { x: number; y: number }[] = [];
	api().tiles.forEach((row, y) =>
		row.forEach((t, x) => {
			if (t.isOwned && t.biome !== 'castle') found.push({ x, y });
		})
	);
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
	bad((r) => (r.monsters[0].x = GRID_CENTER_X, r.monsters[0].y = GRID_CENTER_Y), 'monster on the castle');
	bad((r) => (r.monsters[0].x = 0, r.monsters[0].y = 0), 'monster on an unowned tile');
	bad((r) => (r.tiles[r.monsters[0].y][r.monsters[0].x].hasChest = true), 'monster on a chest tile');
	bad((r) => r.monsters.push({ ...r.monsters[0], id: 2, type: 'ratKing', tier: 1 }, { ...r.monsters[0], id: 3, type: 'ratKing', tier: 1 }), 'two kings on one tile');
	bad((r) => (r.monsters = Array.from({ length: COMBAT.maxMonsters + 1 }, (_, i) => ({ ...r.monsters[0], id: i + 1 }))), 'nine monsters');
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
		const tiles = s.tiles.map((row) => [...row]);
		tiles[y][x] = { ...tiles[y][x], hasChest: true };
		return { tiles, activeChests: 1 };
	});
	assert.equal(sanitizeSave(snapshot()).ok, false);
});
