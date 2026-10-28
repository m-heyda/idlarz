import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, patchTileAt } from './helpers';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { MONSTERS } from '../src/config/combatConfig';
import { castleDistance } from '../src/lib/monsters';
import { isPlaced, needsLook, placeTickets, siteKey, worldFromPart } from '../src/lib/offline/placement';
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
	assert.deepEqual(hidden.sites, { rat: 0, king: 0 });
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
