import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS, CELL, buildGroundGrid, depth } from '../src/utils/terrain';
import { RIPPLE_SIZE, buildRipples, tileRipples } from '../src/utils/water';
import type { BiomeType, Tile } from '../src/types/game';

const NAMES: Record<string, BiomeType> = { P: 'plains', S: 'swamp', L: 'lake', T: 'tundra', H: 'hills' };
const grid = (rows: string[]): Tile[][] =>
	rows.map((row) => [...row].map((c): Tile => (NAMES[c] ? { biome: NAMES[c], isOwned: true } : { biome: 'empty', isOwned: false })));
const block = (c: string, n: number) => buildGroundGrid(grid(Array(n).fill(c.repeat(n))));

test('ripples: deterministic, only on lakes and deep swamp, none on land', () => {
	const lake = block('L', 14);
	assert.deepEqual(buildRipples(lake), buildRipples(lake));
	for (const c of ['P', 'T', 'H']) assert.deepEqual(buildRipples(block(c, 8)), [], `no ripples on ${c}`);
});

test('open lake water gets about one ripple per tile, the shore far fewer, and each stays inside its tile', () => {
	const g = block('L', 16);
	const ripples = buildRipples(g);
	const [w, h] = RIPPLE_SIZE.lake;
	let open = 0;
	let shore = 0;
	for (const r of ripples) {
		assert.ok(r.x >= r.tx * CELL && r.x + w <= (r.tx + 1) * CELL, `x inside tile ${r.tx},${r.ty}`);
		assert.ok(r.y >= r.ty * CELL && r.y + h <= (r.ty + 1) * CELL, `y inside tile ${r.tx},${r.ty}`);
		assert.ok(r.ms >= 2800 && r.ms < 4600 && r.offsetMs >= 0 && r.offsetMs < 4600, 'timing in range');
		if (depth(g, r.tx, r.ty) >= 1) open++;
		else shore++;
	}
	const openTiles = Array.from({ length: 16 * 16 }, (_, i) => depth(g, i % 16, Math.floor(i / 16))).filter((d) => d >= 1).length;
	assert.ok(open > openTiles * 0.5 && open < openTiles * 1.6, `${open} ripples on ${openTiles} open tiles`);
	assert.ok(shore < open / 2, `${shore} shore ripples vs ${open} open`);
});

test('swamp ripples sit on pool spots the terrain build found, only on deep swamp tiles', () => {
	const g = block('S', 12);
	const ripples = buildRipples(g);
	assert.ok(ripples.length > 0, 'a swamp gets ripples');
	const [w, h] = RIPPLE_SIZE.swamp;
	for (const r of ripples) {
		assert.equal(r.kind, 'swamp');
		assert.ok(depth(g, r.tx, r.ty) >= 1, 'deep swamp only');
		const spots = ATLAS.water!.swamp![(r.ty % 4) * 4 + (r.tx % 4)];
		const cx = r.x - r.tx * CELL + (w >> 1);
		const cy = r.y - r.ty * CELL + (h >> 1);
		assert.ok(spots.some(([sx, sy]) => sx === cx && sy === cy), `spot ${cx},${cy} is a known pool spot`);
	}
	assert.deepEqual(tileRipples(g, 0, 0), [], 'the edge of the swamp stays calm');
});

test('the atlas lists pool spots for every 48px block that has one, all inside the middle of the tile', () => {
	const blocks = ATLAS.water!.swamp!;
	assert.equal(blocks.length, 16);
	assert.ok(blocks.filter((b) => b.length > 0).length >= 8, 'most blocks have a spot');
	for (const spots of blocks)
		for (const [x, y] of spots) assert.ok(x >= 12 && x <= CELL - 12 && y >= 14 && y <= CELL - 14, `spot ${x},${y} in the middle`);
});
