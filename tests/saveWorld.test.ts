import test from 'node:test';
import assert from 'node:assert/strict';
import { api, freshGame, growTo, setResources, store } from './helpers';
import { BIOMES, XP_CAP } from '../src/config/gameConfig';
import { pickPersisted } from '../src/lib/sanitizeSave';
import { BIOME_CODES, SAVE_SCHEMA, decodeSave, encodeSave, packBody, packLand, sealWire } from '../src/lib/saveFormat';
import { calculateXpGain } from '../src/utils/gameUtils';
import { COORD_LIMIT, ownedBounds, ownedCount, ownedEntries, patchTile, type World } from '../src/utils/world';
import { syntheticWorld } from '../src/utils/worldGen';

// The map in the save: runs per row, negative coordinates, schema 1 upgrade, and what a hand-edited land list may not do.

const sorted = (w: World) =>
	ownedEntries(w)
		.map((e) => `${e.x},${e.y},${e.tile.biome},${e.tile.level ?? ''},${e.tile.building ?? ''},${e.tile.hasChest ? 'c' : ''}`)
		.sort();

/** The game with a synthetic map of `count` tiles that is valid for sanitizeSave (XP pays for it, stat points follow the level). */
const bigGame = (count: number, seed = 5) => {
	freshGame();
	let xp = 0;
	for (let k = 2; k <= count; k++) xp += calculateXpGain(k);
	store.setState((s) => ({ tiles: syntheticWorld(count, seed), resources: { ...s.resources, xp: Math.min(xp * 1.01, XP_CAP) } }));
	api().tick(1000); // level-ups award the stat points
	return pickPersisted(api());
};

test('every biome except empty has one save letter, and letters are unique', () => {
	const biomes = Object.keys(BIOMES).filter((b) => b !== 'empty');
	assert.deepEqual(Object.keys(BIOME_CODES).sort(), biomes.sort());
	const letters = Object.values(BIOME_CODES);
	assert.equal(new Set(letters).size, letters.length);
	assert.ok(letters.every((l) => l.length === 1));
});

test('the map is written as runs per row: a 3x2 block is two rows, extras only for decorated tiles', () => {
	freshGame();
	growTo(7);
	const packed = packLand(api().tiles);
	assert.equal(packed.land.reduce((n, r) => n + r[2].length, 0), ownedCount(api().tiles));
	assert.ok(packed.land.length < ownedCount(api().tiles), 'neighbours share a run');
	assert.ok(packed.land.every((_row, i, all) => i === 0 || all[i - 1][0] < all[i][0] || all[i - 1][1] < all[i][1]), 'rows ordered');
	assert.deepEqual(packed.extra.map(([x, y, e]) => [x, y, Object.keys(e)]), [[25, 25, ['level']]], 'the castle carries its level');
	assert.equal(packLand(api().tiles), packed, 'cached per world');
});

test('a map with negative coordinates survives encode -> decode exactly', () => {
	const game = bigGame(3000);
	assert.ok((ownedBounds(game.tiles)?.minX ?? 0) < 0, 'the synthetic map reaches x < 0');
	const withExtras = patchTile(patchTile(game.tiles, 25, 25, { level: 3 }), 26, 25, { hasChest: true });
	const text = encodeSave({ ...game, tiles: withExtras, activeChests: 1 });
	const back = decodeSave(text);
	assert.equal(back.ok, true, back.ok ? '' : back.reason);
	if (back.ok) {
		const expected = sorted(withExtras);
		const got = sorted(back.state.tiles);
		// the loaded castle gets its upgrade cost back; everything else is identical
		assert.deepEqual(got, expected);
		assert.deepEqual(ownedBounds(back.state.tiles), ownedBounds(withExtras));
	}
});

test('schema 1 saves (one object per tile) are upgraded to the runs layout on load', () => {
	freshGame();
	growTo(12);
	const game = pickPersisted(api());
	const v2 = packBody(game);
	const oldLand = sorted(game.tiles).map((line) => {
		const [x, y, biome, level, building, chest] = line.split(',');
		const entry: Record<string, unknown> = { x: Number(x), y: Number(y), biome };
		if (level) entry.level = Number(level);
		if (building) entry.building = building;
		if (chest) entry.chest = true;
		return entry;
	});
	const { land: _land, extra: _extra, ...rest } = v2;
	void _land;
	void _extra;
	const v1 = sealWire({ v: 1, t: 1, s: { ...rest, land: oldLand } });
	const loaded = decodeSave(v1);
	assert.equal(loaded.ok, true, loaded.ok ? '' : loaded.reason);
	if (loaded.ok) {
		assert.equal(loaded.schema, 1);
		assert.deepEqual(sorted(loaded.state.tiles), sorted(game.tiles));
	}
	// a v1 body with a broken land list is refused with a reason, not thrown
	const broken = decodeSave(sealWire({ v: 1, t: 1, s: { ...rest, land: [{ x: 'a' }] } }));
	assert.equal(broken.ok, false);
});

test('50,000 tiles: the text stays small and encoding / decoding are quick', () => {
	const game = bigGame(50_000, 9);
	assert.equal(ownedCount(game.tiles), 50_000);
	const t0 = performance.now();
	const text = encodeSave(game);
	const encode = performance.now() - t0;
	assert.ok(text.length < 200_000, `${text.length} characters`);
	assert.ok(encode < 400, `encode ${encode.toFixed(0)}ms`);
	// a second save of the same map (only resources changed) reuses the packed land
	const t1 = performance.now();
	encodeSave({ ...game, playSeconds: game.playSeconds + 1 });
	assert.ok(performance.now() - t1 < encode + 50);
	const t2 = performance.now();
	const back = decodeSave(text);
	const decode = performance.now() - t2;
	assert.equal(back.ok, true, back.ok ? '' : back.reason);
	assert.ok(decode < 1500, `decode ${decode.toFixed(0)}ms`);
	if (back.ok) assert.equal(ownedCount(back.state.tiles), ownedCount(game.tiles));
});

// ---- a hand-edited land list ---------------------------------------------------------------------------------------------

type Body = Record<string, unknown> & { land: [number, number, string][]; extra: [number, number, Record<string, unknown>][] };

const tampered = (mutate: (body: Body) => void): boolean => {
	freshGame();
	growTo(10);
	setResources({ xp: api().resources.xp });
	const body = JSON.parse(JSON.stringify(packBody(pickPersisted(api())))) as Body;
	mutate(body);
	return decodeSave(sealWire({ v: SAVE_SCHEMA, t: 1, s: body })).ok;
};

test('a hand-edited land list is refused', () => {
	assert.equal(tampered(() => undefined), true, 'the untouched body loads');
	assert.equal(tampered((b) => (b.land[0][2] = 'p?')), false, 'unknown biome letter');
	assert.equal(tampered((b) => (b.land[0][1] = COORD_LIMIT + 5)), false, 'run off the map');
	assert.equal(tampered((b) => (b.land[0][1] = 0.5)), false, 'fractional position');
	assert.equal(tampered((b) => b.land.push([b.land[0][0], b.land[0][1], 'p'])), false, 'two runs share a tile');
	assert.equal(tampered((b) => b.land.push([2, 2, 'p'])), false, 'territory not connected to the castle');
	assert.equal(tampered((b) => b.land.push([2, 2, 'K'])), false, 'a second castle');
	assert.equal(tampered((b) => (b.land = b.land.map(([y, x, l]) => [y, x, l.replace('K', 'p')]))), false, 'no castle');
	assert.equal(tampered((b) => b.extra.push([-5, -5, { level: 2 }])), false, 'extra for a tile that is not there');
	assert.equal(tampered((b) => b.extra.push([25, 25, { gold: 99 }])), false, 'unknown extra key');
	assert.equal(tampered((b) => (b.land = 'nonsense' as never)), false, 'land is not a list');
	assert.equal(tampered((b) => (b.land = [[25, 0, 'p'.repeat(300_000)]])), false, 'more tiles than the map may hold');
	assert.equal(tampered((b) => (b.extra = 7 as never)), false, 'extra is not a list');
});
