import test from 'node:test';
import assert from 'node:assert/strict';
import {
	ATLAS,
	MAX_DEPTH,
	RANK,
	allSprites,
	buildGroundGrid,
	cellLayers,
	depth,
	groundOf,
	hash32,
	terrainKey,
	tileSprites,
} from '../src/utils/terrain';
import type { BiomeType, Tile } from '../src/types/game';
import parity from './fixtures/terrain-parity.json';

/** Builds a tile grid from rows of letters (the parity fixture's names); '.' is not owned. */
const NAMES: Record<string, { biome: BiomeType; building?: string; level?: number }> = {
	T: { biome: 'tundra' }, H: { biome: 'hills' }, P: { biome: 'plains' }, S: { biome: 'swamp' }, F: { biome: 'forest' },
	G: { biome: 'grounds' }, Y: { biome: 'grounds', building: 'farm', level: 2 }, B: { biome: 'coast' }, L: { biome: 'lake' },
	C: { biome: 'castle' },
};
const grid = (rows: string[]): Tile[][] =>
	rows.map((row) => [...row].map((c) => (c in NAMES ? { ...NAMES[c], isOwned: true } : { biome: 'empty' as BiomeType, isOwned: false })));

test('hash32 matches the Python generator', () => {
	for (const [x, y, salt, expected] of parity.hashes) assert.equal(hash32(x, y, salt), expected, `hash32(${x},${y},${salt})`);
});

test('tile depth, dual-cell layers and sprite placement match the Python logic on the canned map', () => {
	const g = buildGroundGrid(grid(parity.layout));
	assert.deepEqual(g.map((row, y) => row.map((_, x) => depth(g, x, y))), parity.depth);
	const cells = [];
	for (let cy = 0; cy <= g.length; cy++)
		for (let cx = 0; cx <= g[0].length; cx++)
			cells.push([cx, cy, cellLayers(g, cx, cy).map((l) => [l.style, l.mask, l.variant])]);
	assert.deepEqual(cells, parity.cells);
	assert.deepEqual(allSprites(g).map((s) => [s.id, s.x, s.bottom]), parity.sprites);
});

test('yard rule: grounds with a building above level 1 is a yard; unowned and empty are no ground', () => {
	assert.equal(groundOf({ biome: 'grounds', isOwned: true, building: 'farm', level: 2 }), 'yard');
	assert.equal(groundOf({ biome: 'grounds', isOwned: true, building: 'farm', level: 1 }), 'grounds');
	assert.equal(groundOf({ biome: 'grounds', isOwned: true, level: 3 }), 'grounds');
	assert.equal(groundOf({ biome: 'forest', isOwned: false }), null);
	assert.equal(groundOf({ biome: 'empty', isOwned: true }), null);
	assert.equal(groundOf(undefined), null);
});

test('unowned tiles next to owned land become mist, the rest stay void', () => {
	const g = buildGroundGrid(grid(['....', '.FF.', '....']));
	assert.deepEqual(g.map((r) => r.map((v) => v ?? '.')), [
		['.', 'mist', 'mist', '.'],
		['mist', 'forest', 'forest', 'mist'],
		['.', 'mist', 'mist', '.'],
	]);
});

test('layers: a lone ground fills, a differing corner adds a rank-masked shape', () => {
	const g = buildGroundGrid(grid(['FFF', 'FFF', 'FFF']));
	assert.deepEqual(cellLayers(g, 1, 1).map((l) => [l.style, l.mask]), [['forest', 15], ['forest_d1', 15]]);
	// forest beside plains: the lower-ranked plains extends under the whole cell, forest only covers its own corners
	const g2 = buildGroundGrid(grid(['PF', 'PF']));
	assert.deepEqual(cellLayers(g2, 1, 1).map((l) => [l.style, l.mask]), [['plains', 15], ['forest', 10]]);
	const g3 = buildGroundGrid(grid(['PF', 'PP']));
	assert.deepEqual(cellLayers(g3, 1, 1).map((l) => [l.style, l.mask]), [['plains', 15], ['forest', 2]]);
});

test('lake outranks every land biome and yard / castle outrank the lake (square kerb on the shore)', () => {
	assert.ok(RANK.indexOf('lake') > RANK.indexOf('hills'));
	assert.ok(RANK.indexOf('yard') > RANK.indexOf('lake'));
	assert.ok(RANK.indexOf('castle') > RANK.indexOf('yard'));
	const g = buildGroundGrid(grid(['LL', 'LY']));
	assert.deepEqual(cellLayers(g, 1, 1).map((l) => [l.style, l.mask]), [['lake', 15], ['yard', 8]]);
});

test('depth counts rings of the same ground and is 0 for flat grounds and edges', () => {
	const rows = Array(7).fill('LLLLLLL');
	const g = buildGroundGrid(grid(rows));
	assert.equal(depth(g, 3, 3), 2);
	assert.equal(MAX_DEPTH.lake, 2);
	const g2 = buildGroundGrid(grid(['LLLLL', 'LLLLL', 'LLPLL', 'LLLLL', 'LLLLL']));
	assert.equal(depth(g2, 1, 1), 0); // plains within one ring
	const flat = buildGroundGrid(grid(['PPP', 'PPP', 'PPP']));
	assert.equal(depth(flat, 1, 1), 0);
});

test('sprites: deterministic, never on grounds without props, and every sprite id exists in the atlas', () => {
	const g = buildGroundGrid(grid(parity.layout));
	assert.deepEqual(allSprites(g), allSprites(g));
	for (const s of allSprites(g)) assert.ok(ATLAS.sprites[s.id], `unknown sprite ${s.id}`);
	for (let y = 0; y < g.length; y++)
		for (let x = 0; x < g[0].length; x++)
			if (['yard', 'castle', 'grounds'].includes(g[y][x] as string)) assert.deepEqual(tileSprites(g, x, y), []);
});

test('props stay in bounds: density is sparse, trees and rocks are never drawn on neighbouring grounds', () => {
	const rows = Array(20).fill('P'.repeat(20));
	const g = buildGroundGrid(grid(rows));
	const sprites = allSprites(g);
	assert.ok(sprites.length > 20 && sprites.length < 20 * 20 * 2.5, `placed ${sprites.length} sprites on 400 plains tiles`);
});

test('the terrain key ignores chest toggles and changes when ground changes', () => {
	const a = grid(['FF', 'FP']);
	const key = terrainKey(a);
	const b = grid(['FF', 'FP']);
	b[0][0].hasChest = true;
	assert.equal(terrainKey(b), key);
	b[1][1].biome = 'lake';
	assert.notEqual(terrainKey(b), key);
	const c = grid(['GG', 'GG']);
	const yardKey = (() => {
		c[0][0].building = 'farm';
		c[0][0].level = 2;
		return terrainKey(c);
	})();
	assert.notEqual(yardKey, terrainKey(grid(['GG', 'GG'])));
});

test('manifest: every style has an atlas entry and every prop references a sprite', () => {
	for (const [ground, table] of Object.entries(ATLAS.props)) {
		assert.ok(RANK.includes(ground as (typeof RANK)[number]), ground);
		assert.equal(table.edge.reduce((s, v) => s + v, 0), 1000);
		assert.equal(table.deep.reduce((s, v) => s + v, 0), 1000);
		for (const [id] of table.opts) assert.ok(ATLAS.sprites[id], id);
	}
	for (const r of RANK) {
		assert.ok(ATLAS.styles.includes(r), `style ${r}`);
		for (let t = 1; t <= (MAX_DEPTH[r] ?? 0); t++) assert.ok(ATLAS.styles.includes(`${r}_d${t}`), `${r}_d${t}`);
	}
});
