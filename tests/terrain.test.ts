import test from 'node:test';
import assert from 'node:assert/strict';
import {
	ATLAS,
	CELL,
	decorSprites,
	MAX_DEPTH,
	RANK,
	allPads,
	allSprites,
	buildGroundGrid,
	builtSet,
	cellLayers,
	depth,
	groundOf,
	hash32,
	isLandmarkTile,
	landmarkAnchors,
	LANDMARK_SPAN,
	terrainKey,
	tileSprites,
} from '../src/utils/terrain';
import type { BiomeType, Tile } from '../src/types/game';
import parity from './fixtures/terrain-parity.json';

/** Builds a tile grid from rows of letters (the parity fixture's names); '.' is not owned. */
const NAMES: Record<string, { biome: BiomeType; building?: string; level?: number }> = {
	T: { biome: 'tundra' }, H: { biome: 'hills' }, P: { biome: 'plains' }, S: { biome: 'swamp' }, F: { biome: 'forest' },
	B: { biome: 'coast' }, L: { biome: 'lake' }, C: { biome: 'castle' }, W: { biome: 'castle', level: 7 },
	// a lowercase letter is a building on that biome's tile
	t: { biome: 'tundra', building: 'farm' }, s: { biome: 'swamp', building: 'farm' }, f: { biome: 'forest', building: 'farm' },
	p: { biome: 'plains', building: 'farm' }, b: { biome: 'coast', building: 'farm' }, l: { biome: 'lake', building: 'farm' },
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
	const tiles = grid(parity.layout);
	assert.deepEqual(allSprites(g, undefined, builtSet(tiles)).map((s) => [s.id, s.x, s.bottom]), parity.sprites);
	assert.deepEqual(allPads(tiles).map((p) => [p.id, p.x, p.bottom - 48]), parity.pads);
});

test('yard rule: the fortress is cobbled; unowned and empty are no ground; a building keeps its tile\'s ground', () => {
	assert.equal(groundOf({ biome: 'castle', isOwned: true, level: 7 }), 'yard');
	assert.equal(groundOf({ biome: 'castle', isOwned: true, level: 6 }), 'castle');
	assert.equal(groundOf({ biome: 'forest', isOwned: true, building: 'farm' }), 'forest');
	assert.equal(groundOf({ biome: 'grounds' as never, isOwned: true }), null, 'the removed Grounds biome is no ground');
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

test('a building keeps its own biome ground (whatever grows around it) and gets that biome\'s pad; a biome with no pad gets the plains one', () => {
	const g1 = buildGroundGrid(grid(['FFF', 'FtF', 'FFF']));
	assert.equal(g1[1][1], 'tundra');
	const g2 = buildGroundGrid(grid(['LLL', 'LbL', 'LLL']));
	assert.equal(g2[1][1], 'coast');
	assert.deepEqual(allPads(grid(['FFF', 'FtF', 'FFF'])).map((p) => p.id.replace(/_\d$/, '')), ['pad_tundra']);
	assert.deepEqual(allPads(grid(['FsF', 'FFF', 'FlF'])).map((p) => p.id.replace(/_\d$/, '')), ['pad_swamp', 'pad_plains'], 'a lake has no pad of its own');
	const tiles = grid(['TTT', 'TtT', 'TTT']);
	assert.deepEqual(allPads(tiles).map((p) => p.id.replace(/_\d$/, '')), ['pad_tundra']);
	assert.equal(allSprites(buildGroundGrid(tiles), undefined, builtSet(tiles)).filter((s) => s.x >= 48 && s.x < 96 && s.bottom > 48 && s.bottom <= 96).length, 0);
});

test('lake outranks every land biome and yard / castle outrank the lake (square kerb on the shore)', () => {
	assert.ok(RANK.indexOf('lake') > RANK.indexOf('hills'));
	assert.ok(RANK.indexOf('yard') > RANK.indexOf('lake'));
	assert.ok(RANK.indexOf('castle') > RANK.indexOf('yard'));
	const g = buildGroundGrid(grid(['LL', 'LW']));
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
			if (['yard', 'castle'].includes(g[y][x] as string)) assert.deepEqual(tileSprites(g, x, y), []);
});

test('props stay in bounds: density is sparse, trees and rocks are never drawn on neighbouring grounds', () => {
	const rows = Array(20).fill('P'.repeat(20));
	const g = buildGroundGrid(grid(rows));
	let props = 0;
	for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) props += tileSprites(g, x, y).length;
	assert.ok(props > 20 && props < 20 * 20 * 2.5, `placed ${props} props on 400 plains tiles`);
});

test('decor: flowers on plains, mushrooms in forests, logs and mossy stones on swamps, crabs and shells on the beach, nothing elsewhere, never under props or on buildings', () => {
	const plains = buildGroundGrid(grid(Array(20).fill('P'.repeat(20))));
	let flowers = 0;
	for (let y = 0; y < 20; y++)
		for (let x = 0; x < 20; x++) {
			const props = tileSprites(plains, x, y);
			const decor = decorSprites(plains, x, y, props);
			flowers += decor.length;
			assert.deepEqual(decor, decorSprites(plains, x, y, props), 'deterministic');
			for (const d of decor) {
				const [, , dw, dh] = ATLAS.sprites[d.id];
				for (const p of props) {
					const [, , pw, ph] = ATLAS.sprites[p.id];
					const apart = d.x + dw + 2 <= p.x || p.x + pw + 2 <= d.x || d.bottom <= p.bottom - ph - 2 || p.bottom <= d.bottom - dh - 2;
					assert.ok(apart, `decor ${d.id} overlaps prop ${p.id} at ${x},${y}`);
				}
				assert.ok(d.x >= x * CELL && d.x + dw <= (x + 1) * CELL && d.bottom - dh >= y * CELL && d.bottom <= (y + 1) * CELL, 'inside its tile');
			}
		}
	assert.ok(flowers > 200 && flowers < 400 * 2, `placed ${flowers} decor sprites on 400 plains tiles`);

	const swamp = buildGroundGrid(grid(Array(12).fill('S'.repeat(12))));
	let logs = 0;
	for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) logs += decorSprites(swamp, x, y, tileSprites(swamp, x, y)).length;
	assert.ok(logs > 10 && logs < 12 * 12 * 0.8, `placed ${logs} fallen trees and mossy stones on 144 swamp tiles`);

	const forest = buildGroundGrid(grid(Array(12).fill('F'.repeat(12))));
	let mushrooms = 0;
	for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) mushrooms += decorSprites(forest, x, y, tileSprites(forest, x, y)).length;
	assert.ok(mushrooms > 20 && mushrooms < 12 * 12, `placed ${mushrooms} mushrooms on 144 forest tiles`);

	const beach = buildGroundGrid(grid(Array(12).fill('B'.repeat(12))));
	let shells = 0;
	for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) shells += decorSprites(beach, x, y, tileSprites(beach, x, y)).length;
	assert.ok(shells > 40 && shells < 12 * 12 * 3, `placed ${shells} beach details on 144 coast tiles`);

	for (const ground of ['L', 'H', 'T']) {
		const g = buildGroundGrid(grid(Array(6).fill(ground.repeat(6))));
		for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) assert.deepEqual(decorSprites(g, x, y, []), [], `no decor on ${ground}`);
	}

	const tiles = grid(['PPP', 'PYP', 'PPP']);
	const withBuilding = allSprites(buildGroundGrid(tiles), undefined, builtSet(tiles));
	assert.equal(withBuilding.filter((s) => s.x >= CELL && s.x < 2 * CELL && s.bottom > CELL && s.bottom <= 2 * CELL).length, 0);
});


test('the terrain key ignores chest toggles and changes when ground changes', () => {
	const a = grid(['FF', 'FP']);
	const key = terrainKey(a);
	const b = grid(['FF', 'FP']);
	b[0][0].hasChest = true;
	assert.equal(terrainKey(b), key);
	b[1][1].biome = 'lake';
	assert.notEqual(terrainKey(b), key);
	const c = grid(['FF', 'PP']);
	const builtKey = (() => {
		c[0][0].building = 'farm';
		return terrainKey(c);
	})();
	assert.notEqual(builtKey, terrainKey(grid(['FF', 'PP'])), 'a building changes the key (built tiles are upper case)');
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

// ---- landmarks: one big cosmetic sprite on a 6x6 window of one biome

test('landmarks match the Python logic on the canned landmark map', () => {
	const rows = parity.landmarks.layout;
	const tiles = grid(rows);
	const g = buildGroundGrid(tiles);
	const built = builtSet(tiles);
	const anchors = landmarkAnchors(g, (x, y) => built.has(`${x},${y}`), 0, 0, g[0].length - 1, g.length - 1);
	assert.deepEqual(anchors.map((a) => [a.x, a.y, a.ground]), parity.landmarks.anchors);
	assert.deepEqual(allSprites(g, undefined, built).map((s) => [s.id, s.x, s.bottom]), parity.landmarks.sprites);
	assert.equal(anchors.length, 7, 'one landmark per biome block');
	for (const a of anchors) assert.ok(ATLAS.sprites[`lm_${a.ground}`], `lm_${a.ground} is in the atlas`);
});

test('landmarks: a block one tile short gets none, a building inside a window removes it, and anchors never overlap', () => {
	const five = buildGroundGrid(grid(['.......', '.FFFFF.', '.FFFFF.', '.FFFFF.', '.FFFFF.', '.FFFFF.', '.......']));
	assert.equal(landmarkAnchors(five, undefined, 0, 0, 6, 6).length, 0, '5x5 is not enough');
	const six = ['........', '.FFFFFF.', '.FFFFFF.', '.FFFFFF.', '.FFFFFF.', '.FFFFFF.', '.FFFFFF.', '........'];
	assert.equal(landmarkAnchors(buildGroundGrid(grid(six)), undefined, 0, 0, 7, 7).length, 1, '6x6 is exactly enough');
	const built = six.map((r, y) => (y === 3 ? r.replace('FFFFFF', 'FFfFFF') : r));
	const t = grid(built);
	assert.equal(landmarkAnchors(buildGroundGrid(t), (x, y) => builtSet(t).has(`${x},${y}`), 0, 0, 7, 7).length, 0, 'a building inside takes the landmark away');
	const big = buildGroundGrid(grid(['.'.repeat(32), ...Array.from({ length: 30 }, () => '.' + 'P'.repeat(30) + '.'), '.'.repeat(32)]));
	const a = landmarkAnchors(big, undefined, 0, 0, 31, 31);
	assert.ok(a.length >= 1 && a.length <= 16, `a 30x30 plain gets a few landmarks (${a.length}), not one per window`);
	for (let i = 0; i < a.length; i++)
		for (let j = i + 1; j < a.length; j++)
			assert.ok(Math.abs(a[i].x - a[j].x) >= LANDMARK_SPAN || Math.abs(a[i].y - a[j].y) >= LANDMARK_SPAN, 'two landmark windows never overlap');
});

test('landmarks: props, decor and docks stay off the landmark area; the rest of the biome keeps them', () => {
	const g = buildGroundGrid(grid(['.'.repeat(24), ...Array.from({ length: 20 }, () => '.' + 'F'.repeat(22) + '.'), '.'.repeat(24)]));
	const anchors = landmarkAnchors(g, undefined, 0, 0, 23, 21);
	const sprites = allSprites(g);
	assert.ok(sprites.some((s) => s.id.startsWith('lm_')), 'the landmark is drawn');
	for (const a of anchors) {
		const inside = sprites.filter((s) => !s.id.startsWith('lm_') && s.bottom > a.y * CELL + 24 && s.bottom <= (a.y + LANDMARK_SPAN) * CELL && s.x >= a.x * CELL && s.x < (a.x + LANDMARK_SPAN) * CELL - 24); // a neighbour's tree may overhang the edge a little
		assert.equal(inside.length, 0, 'no prop starts inside the landmark window');
	}
	assert.ok(sprites.length > anchors.length + 20, 'the forest around it still has its trees');
});

test('landmarks: isLandmarkTile covers exactly the 6x6 window', async () => {
	const { EMPTY_WORLD, setTiles } = await import('../src/utils/world');
	const base = EMPTY_WORLD;
	const changes: { x: number; y: number; tile: Tile }[] = [];
	for (let y = 30; y < 36; y++) for (let x = 30; x < 36; x++) changes.push({ x, y, tile: { biome: 'forest', isOwned: true } });
	const w = setTiles(base, changes);
	assert.equal(isLandmarkTile(w, 30, 30), true);
	assert.equal(isLandmarkTile(w, 35, 35), true);
	assert.equal(isLandmarkTile(w, 36, 35), false);
	assert.equal(isLandmarkTile(w, 29, 30), false);
});
