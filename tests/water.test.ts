import test from 'node:test';
import assert from 'node:assert/strict';
import { ATLAS, CELL, buildGroundGrid, depth } from '../src/utils/terrain';
import { BOAT, BUBBLE, RIPPLE_SIZE, buildRipples, buildShimmers, tileBoat, tileBubbles, tileDolphin, tileFalls, tileRipples, type Boat, type Dolphin, type Fall } from '../src/utils/water';
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
	assert.ok(open > openTiles * 1 && open < openTiles * 2.2, `${open} ripples on ${openTiles} open tiles`);
	assert.ok(shore < open / 2, `${shore} shore ripples vs ${open} open`);
});

test('shimmer: one per open-water lake tile, none on the shore, land or swamp, the same every time', () => {
	const g = block('L', 14);
	const shimmers = buildShimmers(g);
	assert.deepEqual(shimmers, buildShimmers(g));
	const openTiles = Array.from({ length: 14 * 14 }, (_, i) => ({ x: i % 14, y: Math.floor(i / 14) })).filter(({ x, y }) => depth(g, x, y) >= 1);
	assert.equal(shimmers.length, openTiles.length);
	for (const s of shimmers) {
		assert.ok(depth(g, s.tx, s.ty) >= 1, 'open water only');
		assert.equal(s.x, s.tx * CELL);
		assert.equal(s.y, s.ty * CELL);
		assert.ok(s.ms >= 3200 && s.ms < 5600 && s.offsetMs >= 0 && s.offsetMs < 6000, 'timing in range');
	}
	assert.ok(shimmers.some((s) => s.flip) && shimmers.some((s) => !s.flip), 'tiles are mirrored in a mix');
	for (const c of ['P', 'T', 'H', 'S']) assert.deepEqual(buildShimmers(block(c, 8)), [], `no shimmer on ${c}`);
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

// ------------------------------------------------------------------ life on the water
const eachTile = (g: ReturnType<typeof block>, fn: (x: number, y: number) => void) => {
	for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) fn(x, y);
};

test('bubbles: only on swamp, deterministic, inside their tile and never on the ripple spot', () => {
	const g = block('S', 16);
	let n = 0;
	eachTile(g, (x, y) => {
		const bubbles = tileBubbles(g, x, y);
		assert.deepEqual(bubbles, tileBubbles(g, x, y));
		for (const b of bubbles) {
			n++;
			assert.ok(b.x >= x * CELL - 5 && b.x + BUBBLE.size <= (x + 1) * CELL + 5 && b.y >= y * CELL - 5 && b.y + BUBBLE.size <= (y + 1) * CELL + 5);
			for (const r of tileRipples(g, x, y)) assert.ok(Math.abs(r.x - b.x) > 2 || Math.abs(r.y - b.y) > 2, 'not on a ripple');
		}
	});
	assert.ok(n > 40, `${n} bubbles on a 16x16 swamp`);
	for (const c of ['L', 'P', 'T', 'H']) eachTile(block(c, 8), (x, y) => assert.equal(tileBubbles(block(c, 8), x, y).length, 0));
});

test('waterfalls: only where a hill borders a lake to its south, never two side by side and never on a pier', () => {
	const rows = ['PPPPPPPPPP', 'HHHHHHHHHH', 'HHHHHHHHHH', 'LLLLLLLLLL', 'LLLLLLLLLL', 'LLLLLLLLLL'];
	const g = buildGroundGrid(grid(rows));
	const falls: Fall[] = [];
	eachTile(g, (x, y) => falls.push(...tileFalls(g, x, y)));
	assert.ok(falls.length > 0, 'a 10 tile shore gets some');
	for (const f of falls) assert.equal(f.ty, 2, 'on the hill row that touches the lake');
	const xs = falls.map((f) => f.tx).sort((a, b) => a - b);
	xs.slice(1).forEach((x, i) => assert.ok(x - xs[i] >= 2, 'not on neighbouring tiles'));
	eachTile(block('H', 8), (x, y) => assert.deepEqual(tileFalls(block('H', 8), x, y), [], 'no lake, no waterfall'));
	// a lake to the east or west of the hills gets nothing: only the south face is drawn
	const east = buildGroundGrid(grid(Array(8).fill('HHHHLLLL')));
	eachTile(east, (x, y) => assert.deepEqual(tileFalls(east, x, y), [], 'no side waterfalls'));
});

test('boats and dolphins: only on open water of a real lake, spread out, deterministic', () => {
	const g = block('L', 40);
	const boats: Boat[] = [];
	const dolphins: Dolphin[] = [];
	eachTile(g, (x, y) => {
		const b = tileBoat(g, x, y);
		const d = tileDolphin(g, x, y);
		if (b) boats.push(b);
		if (d) dolphins.push(d);
		if (b) assert.ok([[0, -1], [1, 0], [0, 1], [-1, 0]].every(([dx, dy]) => g[y + dy][x + dx] === 'lake'), 'lake on all four sides: never at the shore');
		assert.deepEqual(b, tileBoat(g, x, y));
		assert.ok(!(b && d), 'never both on one tile');
	});
	assert.ok(boats.length >= 10 && boats.length < 120, `${boats.length} boats on a 40x40 lake`);
	assert.ok(dolphins.length >= 1 && dolphins.length < boats.length, `${dolphins.length} dolphins`);
	for (const a of boats) for (const b of boats) if (a !== b) assert.ok(Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty)) > 2, 'boats keep apart');
	for (const b of boats) assert.ok(b.range + BOAT.w / 2 < CELL * 0.75, 'stays on water: the next tile along its course is lake');
	const pond = buildGroundGrid(grid(['PPPP', 'PLLP', 'PLLP', 'PPPP']));
	eachTile(pond, (x, y) => assert.ok(!tileBoat(pond, x, y) && !tileDolphin(pond, x, y), 'a small pond has none'));
});
