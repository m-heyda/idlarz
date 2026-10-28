import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, patchTileAt } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { MONSTERS } from '../src/config/combatConfig';
import { castleDistance } from '../src/lib/monsters';
import { isChestPlaced, isPlaced, needsLook, placeTickets, siteKey, worldFromPart } from '../src/lib/offline/placement';
import { emptyBank, type TicketBank } from '../src/lib/offline/tickets';
import { sealedRng } from '../src/lib/offline/seal';
import { packBody } from '../src/lib/saveFormat';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { splitBody } from '../src/lib/cloudSave/pipeline';
import { summarize } from '../src/lib/cloudSave/summary';
import { ownedRowMajor } from '../src/utils/world';

// The server puts each monster on a tile: land of its allowlist, 2 to 9 tiles from the castle, one monster per tile.

const rollFor = (kind: string, n: number) => sealedRng('placement-secret-0123456789', 'u1', 1, kind, n);
const bankWith = (rats: number, king = false): TicketBank => ({
	...emptyBank(0),
	rats: Array.from({ length: rats }, (_, i) => ({ n: i + 1, at: 0, lucky: false })),
	king: king ? { n: 100, at: 0, lucky: false } : null,
});

const world = (tiles: number) => {
	freshGame();
	growTo(tiles);
	return api().tiles;
};

test('every ticket gets a tile on land 2 to 9 tiles from the castle, never twice the same, and the level it appeared at', () => {
	const tiles = world(60);
	const out = placeTickets(bankWith(6, true), tiles, 'k', 0, rollFor);
	const all = [...out.rats, out.king!];
	assert.ok(all.every(isPlaced));
	assert.equal(new Set(all.map((t) => `${t.x},${t.y}`)).size, all.length);
	const rule = MONSTERS.rat.spawn;
	for (const t of all) {
		const d = castleDistance({ x: t.x!, y: t.y! });
		assert.ok(d >= rule.minCastleDistance && d <= rule.maxCastleDistance, `distance ${d}`);
		const tile = ownedRowMajor(tiles).find((e) => e.x === t.x && e.y === t.y)!.tile;
		assert.ok((rule.biomes as readonly string[]).includes(tile.biome), tile.biome);
		assert.ok(t.spawnLevel! >= 1);
	}
	assert.ok(out.sites!.rat > 6, 'the land says how many tiles there are for monsters');
	assert.equal(out.sitesKey, 'k');
});

test('the same land and the same seal always give the same map', () => {
	const tiles = world(60);
	const a = placeTickets(bankWith(4), tiles, 'k', 0, rollFor);
	const b = placeTickets(bankWith(4), tiles, 'k', 0, rollFor);
	assert.deepEqual(a, b);
});

test('a map with no tile for them leaves the tickets hidden, and they appear once the land grows', () => {
	const ringOnly = world(1); // the castle and its 4 neighbours: all adjacent
	const hidden = placeTickets(bankWith(2), ringOnly, 'ring', 0, rollFor);
	assert.equal(hidden.rats.filter(isPlaced).length, 0);
	assert.deepEqual({ rat: hidden.sites!.rat, king: hidden.sites!.king }, { rat: 0, king: 0 });
	assert.equal(needsLook(hidden, 'ring'), false, 'nothing to do until the land changes');
	assert.equal(needsLook(hidden, 'grown'), true, 'a different land is looked at again');
	const grown = placeTickets(hidden, world(40), 'grown', 0, rollFor);
	assert.equal(grown.rats.filter(isPlaced).length, 2);
});

test('a monster keeps its tile while it is valid, and is placed again when it stops being so', () => {
	const tiles = world(60);
	const first = placeTickets(bankWith(1), tiles, 'k', 0, rollFor);
	const { x, y } = first.rats[0];
	assert.deepEqual(placeTickets(first, tiles, 'k2', 0, rollFor).rats[0].x, x, 'valid: stays');
	patchTileAt(x!, y!, { building: 'farm' });
	const moved = placeTickets(first, api().tiles, 'k3', 0, rollFor);
	assert.ok(isPlaced(moved.rats[0]));
	assert.notDeepEqual([moved.rats[0].x, moved.rats[0].y], [x, y], 'a built-on tile is no place for a rat');
});

test('an old ticket (placed by the browser, before the server placed monsters) has no tile until the server looks', () => {
	const old = bankWith(2);
	assert.equal(needsLook(old, 'k'), true);
	assert.deepEqual(old.rats.map(isPlaced), [false, false]);
});

test('the map the server reads is the one the save wrote: castle, land and chests', () => {
	world(30);
	patchTileAt(CASTLE_X + 3, CASTLE_Y, { hasChest: true });
	const state = pickPersisted(api());
	const summary = summarize(state);
	const part = splitBody(packBody(state), summary.tilesOwned).world;
	const read = worldFromPart(part)!;
	assert.equal(read.stats.owned, api().tiles.stats.owned);
	assert.equal(read.stats.chests, 1);
	assert.notEqual(siteKey(summary), siteKey({ ...summary, tilesOwned: summary.tilesOwned + 1 }));
});

// ---------------------------------------------------------------------------------------------------- chests

const chestBank = (chests: number): TicketBank => ({
	...emptyBank(0),
	nextN: chests + 1,
	chests: Array.from({ length: chests }, (_, i) => ({ n: i + 1, at: 0 })),
});

test('every chest gets a tile the browser may draw it on: owned, no castle, no building, outside the ward, one per tile', () => {
	const tiles = world(60);
	const out = placeTickets(chestBank(8), tiles, 'k', 0, rollFor);
	assert.ok(out.chests.every(isChestPlaced));
	assert.equal(new Set(out.chests.map((c) => `${c.x},${c.y}`)).size, 8);
	for (const c of out.chests) {
		const tile = ownedRowMajor(tiles).find((e) => e.x === c.x && e.y === c.y)!.tile;
		assert.notEqual(tile.biome, 'castle');
		assert.ok(!tile.building && !tile.hasChest);
	}
	assert.ok(out.sites!.chest! > 8);
});

test('chests and monsters never share a tile, and the same land and seal always give the same map', () => {
	const tiles = world(60);
	const bank: TicketBank = { ...bankWith(6, true), chests: chestBank(8).chests, nextN: 200 };
	const a = placeTickets(bank, tiles, 'k', 0, rollFor);
	const b = placeTickets(bank, tiles, 'k', 0, rollFor);
	assert.deepEqual(a, b);
	const spots = [...a.rats, a.king!, ...a.chests].map((t) => `${t.x},${t.y}`);
	assert.equal(new Set(spots).size, spots.length);
});

test('a chest keeps its tile while the tile is valid, and is placed again when a building takes it', () => {
	const tiles = world(60);
	const first = placeTickets(chestBank(3), tiles, 'k', 0, rollFor);
	const again = placeTickets(first, tiles, 'k2', 0, rollFor);
	assert.deepEqual(again.chests, first.chests, 'nothing changed: nothing moved');
	const { x, y } = first.chests[0] as { x: number; y: number };
	patchTileAt(x, y, { building: 'tavern' });
	const moved = placeTickets(first, api().tiles, 'k3', 0, rollFor);
	assert.ok(isChestPlaced(moved.chests[0]));
	assert.notDeepEqual([moved.chests[0].x, moved.chests[0].y], [x, y]);
	assert.deepEqual(moved.chests.slice(1), first.chests.slice(1));
});

test('a chest with no tile left stays hidden until the land grows', () => {
	const tiles = world(1);
	const hidden = placeTickets(chestBank(2), tiles, 'ring', 0, rollFor);
	const free = hidden.sites!.chest!;
	assert.equal(hidden.chests.filter(isChestPlaced).length, Math.min(2, free));
	const grown = placeTickets(hidden, world(60), 'grown', 0, rollFor);
	assert.equal(grown.chests.filter(isChestPlaced).length, 2);
	assert.equal(needsLook(grown, 'grown'), false);
	assert.equal(needsLook({ ...grown, chests: [...grown.chests, { n: 9, at: 1 }] }, 'grown'), true, 'a new chest is looked at');
});
