import test from 'node:test';
import assert from 'node:assert/strict';
import { brushCells, createStroke, lineCells, pointerToTile, MAX_STROKE_CELLS, type Cell } from '../src/lib/dragPaint';
import { applyStroke, chestTool, eraseTool, extendRing, extendTool, paintTool, unchestTool } from '../src/lib/mapEdit';
import { CASTLE_X, CASTLE_Y } from '../src/config/gameConfig';
import { createInitialWorld } from '../src/utils/gameUtils';
import { getTile, isOwnedAt } from '../src/utils/world';

const world = () => createInitialWorld(() => 0.5);

test('lineCells joins two cells without gaps, ends included', () => {
	const cells = lineCells({ x: 0, y: 0 }, { x: 5, y: 2 });
	assert.deepEqual(cells[0], { x: 0, y: 0 });
	assert.deepEqual(cells[cells.length - 1], { x: 5, y: 2 });
	for (let i = 1; i < cells.length; i++) {
		assert.ok(Math.abs(cells[i].x - cells[i - 1].x) <= 1 && Math.abs(cells[i].y - cells[i - 1].y) <= 1, 'neighbouring steps');
	}
	assert.deepEqual(lineCells({ x: 3, y: 3 }, { x: 3, y: 3 }), [{ x: 3, y: 3 }]);
	assert.equal(lineCells({ x: 4, y: 0 }, { x: -4, y: 0 }).length, 9);
});

test('brushCells is a centred square', () => {
	assert.equal(brushCells({ x: 0, y: 0 }, 1).length, 1);
	const three = brushCells({ x: 10, y: 10 }, 3);
	assert.equal(three.length, 9);
	assert.ok(three.some((c) => c.x === 9 && c.y === 9) && three.some((c) => c.x === 11 && c.y === 11));
});

test('pointerToTile follows pan and zoom, also for negative tiles', () => {
	assert.deepEqual(pointerToTile(100, 100, { x: 0, y: 0, zoom: 1 }, 48), { x: 2, y: 2 });
	assert.deepEqual(pointerToTile(100, 100, { x: 100, y: 100, zoom: 2 }, 48), { x: 0, y: 0 });
	assert.deepEqual(pointerToTile(0, 0, { x: 10, y: 10, zoom: 1 }, 48), { x: -1, y: -1 });
});

test('a stroke draws a click, then only new cells, and ends cleanly', () => {
	const batches: Cell[][] = [];
	let ended = 0;
	const stroke = createStroke((cells) => batches.push(cells), { onEnd: () => ended++ });
	stroke.begin(0, 0);
	assert.equal(stroke.active(), true);
	stroke.move(3, 0);
	stroke.move(3, 0); // same cell: nothing
	stroke.move(0, 0); // back over drawn cells: only nothing new
	stroke.end();
	stroke.end();
	assert.equal(stroke.active(), false);
	assert.equal(ended, 1);
	const all = batches.flat();
	assert.equal(all.length, new Set(all.map((c) => `${c.x},${c.y}`)).size, 'no cell twice in one stroke');
	assert.equal(all.length, 4);
	stroke.move(9, 9); // moving without a press does nothing
	assert.equal(batches.flat().length, 4);
});

test('a stroke skips cells outside the map and is capped', () => {
	const drawn: Cell[] = [];
	const stroke = createStroke((cells) => drawn.push(...cells));
	stroke.begin(100000, 0);
	assert.equal(drawn.length, 0);
	stroke.end();
	const big = createStroke((cells) => drawn.push(...cells), { brush: 5 });
	big.begin(0, 0);
	for (let x = 0; x < 3000; x++) big.move(x, 0);
	big.end();
	assert.ok(drawn.length <= MAX_STROKE_CELLS);
});

test('paint overwrites land and extends it only from land; the castle is never repainted', () => {
	const w = world();
	const painted = applyStroke(w, [{ x: CASTLE_X, y: CASTLE_Y }, { x: CASTLE_X + 1, y: CASTLE_Y }], paintTool('swamp'));
	assert.equal(getTile(painted, CASTLE_X, CASTLE_Y)?.biome, 'castle');
	assert.equal(getTile(painted, CASTLE_X + 1, CASTLE_Y)?.biome, 'swamp');
	const far = applyStroke(w, [{ x: CASTLE_X + 20, y: CASTLE_Y }], paintTool('swamp'));
	assert.equal(far, w, 'an island far from land is refused');
	assert.equal(w.stats.owned, getTile(w, CASTLE_X, CASTLE_Y) ? w.stats.owned : 0, 'the source world is untouched');
});

test('a stroke can grow outwards cell by cell', () => {
	const w = world();
	const edge = { x: CASTLE_X + 2, y: CASTLE_Y };
	const row = [0, 1, 2, 3].map((i) => ({ x: edge.x + i, y: edge.y }));
	const grown = applyStroke(w, row, extendTool('plains'));
	for (const c of row) if (!getTile(w, c.x, c.y)) assert.equal(isOwnedAt(grown, c.x, c.y), true);
});

test('extend never overwrites existing land', () => {
	const w = world();
	const tile = getTile(w, CASTLE_X + 1, CASTLE_Y);
	const same = applyStroke(w, [{ x: CASTLE_X + 1, y: CASTLE_Y }], extendTool('tundra'));
	assert.equal(getTile(same, CASTLE_X + 1, CASTLE_Y)?.biome, tile?.biome);
});

test('erase keeps the castle and the last tile of land', () => {
	const w = world();
	const erased = applyStroke(w, [{ x: CASTLE_X, y: CASTLE_Y }], eraseTool);
	assert.equal(getTile(erased, CASTLE_X, CASTLE_Y)?.biome, 'castle');
	const bare = applyStroke(w, [{ x: CASTLE_X + 1, y: CASTLE_Y }, { x: CASTLE_X - 1, y: CASTLE_Y }, { x: CASTLE_X, y: CASTLE_Y + 1 }, { x: CASTLE_X, y: CASTLE_Y - 1 }], eraseTool);
	assert.equal(bare.stats.owned, 1);
});

test('chests are placed on land, counted once, and removed again', () => {
	const w = world();
	const spot = { x: CASTLE_X + 1, y: CASTLE_Y };
	const once = applyStroke(w, [spot, spot], chestTool);
	assert.equal(once.stats.chests, 1);
	assert.equal(applyStroke(w, [{ x: CASTLE_X, y: CASTLE_Y }], chestTool), w, 'no chest on the castle');
	assert.equal(applyStroke(once, [spot], unchestTool).stats.chests, 0);
});

test('extendRing adds exactly one ring', () => {
	const w = world();
	const ring = extendRing(w, 'forest');
	assert.ok(ring.stats.owned > w.stats.owned);
	const twice = extendRing(ring, 'forest');
	assert.ok(twice.bounds!.maxX - ring.bounds!.maxX <= 1);
});
