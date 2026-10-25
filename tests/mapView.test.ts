import test from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE } from '../src/config/gameConfig';
import { PAN_MARGIN_TILES, centerOf, clampPosition, positionForCenter, visibleTileRange } from '../src/lib/mapView';
import { COORD_LIMIT, type Bounds } from '../src/utils/world';

const SIZE = { w: 1200, h: 800 };
const T = TILE_SIZE;

// The middle of the screen may roam the explored land plus PAN_MARGIN_TILES; nothing else limits the map.

test('centre and position are each other\'s inverse at every zoom', () => {
	for (const zoom of [0.75, 1, 1.5, 2]) {
		for (const [wx, wy] of [[0, 0], [1200, 1200], [-5000, 77], [123456, -98765]]) {
			const pos = positionForCenter(wx, wy, zoom, SIZE);
			const c = centerOf(pos, zoom, SIZE);
			assert.ok(Math.abs(c.x - wx) < 1e-6 && Math.abs(c.y - wy) < 1e-6, `zoom ${zoom} at ${wx},${wy}`);
		}
	}
});

test('a view that is already allowed is returned untouched (same object)', () => {
	const bounds: Bounds = { minX: 20, maxX: 30, minY: 20, maxY: 30 };
	const pos = positionForCenter(25 * T, 25 * T, 1, SIZE);
	assert.equal(clampPosition(pos, 1, SIZE, bounds), pos);
	assert.equal(clampPosition(pos, 1, SIZE, null), pos, 'no explored land: nothing to clamp to');
});

test('dragging far away stops with the centre PAN_MARGIN_TILES past the explored land, on every side', () => {
	const bounds: Bounds = { minX: 20, maxX: 30, minY: 22, maxY: 28 };
	const m = PAN_MARGIN_TILES * T;
	for (const zoom of [0.75, 1, 1.5, 2]) {
		const far = (wx: number, wy: number) => centerOf(clampPosition(positionForCenter(wx, wy, zoom, SIZE), zoom, SIZE, bounds), zoom, SIZE);
		const left = far(-1e6, 25 * T);
		assert.ok(Math.abs(left.x - (20 * T - m)) < 1e-6 && Math.abs(left.y - 25 * T) < 1e-6, `left at zoom ${zoom}`);
		const right = far(1e6, 25 * T);
		assert.ok(Math.abs(right.x - (31 * T + m)) < 1e-6, `right at zoom ${zoom}`);
		const up = far(25 * T, -1e6);
		assert.ok(Math.abs(up.y - (22 * T - m)) < 1e-6, `up at zoom ${zoom}`);
		const down = far(25 * T, 1e6);
		assert.ok(Math.abs(down.y - (29 * T + m)) < 1e-6, `down at zoom ${zoom}`);
		const corner = far(-1e6, 1e6);
		assert.ok(Math.abs(corner.x - (20 * T - m)) < 1e-6 && Math.abs(corner.y - (29 * T + m)) < 1e-6, `corner at zoom ${zoom}`);
	}
});

test('land bought in a long line to the left can be reached: the limit follows the land, not a grid', () => {
	const bounds: Bounds = { minX: -5000, maxX: 30, minY: 25, maxY: 25 };
	const target = (-4990 + 0.5) * T;
	const pos = clampPosition(positionForCenter(target, 25.5 * T, 1, SIZE), 1, SIZE, bounds);
	const c = centerOf(pos, 1, SIZE);
	assert.ok(Math.abs(c.x - target) < 1e-6, 'a point 5000 tiles to the left is reachable');
	const past = centerOf(clampPosition(positionForCenter(-6000 * T, 25.5 * T, 1, SIZE), 1, SIZE, bounds), 1, SIZE);
	assert.ok(Math.abs(past.x - (-5000 - PAN_MARGIN_TILES) * T) < 1e-6, 'but not past the margin beyond the last tile');
	// the other axis is limited to the line of land (one tile) plus the margin
	const up = centerOf(clampPosition(positionForCenter(-100 * T, -1e6, 1, SIZE), 1, SIZE, bounds), 1, SIZE);
	assert.ok(Math.abs(up.y - (25 - PAN_MARGIN_TILES) * T) < 1e-6);
});

test('zooming keeps the centre inside the allowed area', () => {
	const bounds: Bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
	// centre at the far edge allowed; zoom in/out around a screen corner and re-clamp, as the view store does
	let zoom = 1;
	let pos = clampPosition(positionForCenter(-1e6, -1e6, zoom, SIZE), zoom, SIZE, bounds);
	for (const next of [2, 0.75, 1.5, 1]) {
		const ratio = next / zoom;
		const anchor = { x: 0, y: 0 };
		pos = clampPosition({ x: anchor.x - (anchor.x - pos.x) * ratio, y: anchor.y - (anchor.y - pos.y) * ratio }, next, SIZE, bounds);
		zoom = next;
		const c = centerOf(pos, zoom, SIZE);
		assert.ok(c.x >= (0 - PAN_MARGIN_TILES) * T - 1e-6 && c.x <= (11 + PAN_MARGIN_TILES) * T + 1e-6, `zoom ${zoom}: x ${c.x}`);
		assert.ok(c.y >= (0 - PAN_MARGIN_TILES) * T - 1e-6 && c.y <= (11 + PAN_MARGIN_TILES) * T + 1e-6, `zoom ${zoom}: y ${c.y}`);
	}
});

test('a single explored tile, negative land and the extreme corners all clamp to finite positions', () => {
	const one: Bounds = { minX: 25, maxX: 25, minY: 25, maxY: 25 };
	const p = clampPosition({ x: 1e9, y: -1e9 }, 1, SIZE, one);
	assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
	const c = centerOf(p, 1, SIZE);
	assert.ok(c.x >= (25 - PAN_MARGIN_TILES) * T && c.x <= (26 + PAN_MARGIN_TILES) * T);
	const huge: Bounds = { minX: -COORD_LIMIT, maxX: COORD_LIMIT, minY: -COORD_LIMIT, maxY: COORD_LIMIT };
	const q = clampPosition(positionForCenter(1e12, -1e12, 2, SIZE), 2, SIZE, huge);
	const cq = centerOf(q, 2, SIZE);
	assert.ok(Math.abs(cq.x - (COORD_LIMIT + 1 + PAN_MARGIN_TILES) * T) < 1 && Math.abs(cq.y - (-COORD_LIMIT - PAN_MARGIN_TILES) * T) < 1);
});

test('visible tile range: tiles per axis follow the zoom, padding widens it, negative positions work', () => {
	const at100 = visibleTileRange({ x: 0, y: 0 }, 1, SIZE);
	assert.deepEqual(at100, { minX: 0, maxX: Math.ceil(SIZE.w / T), minY: 0, maxY: Math.ceil(SIZE.h / T) });
	const at75 = visibleTileRange({ x: 0, y: 0 }, 0.75, SIZE);
	assert.equal(at75.maxX, Math.ceil(SIZE.w / (T * 0.75)));
	assert.ok(at75.maxX > at100.maxX, 'zoomed out shows more tiles');
	const padded = visibleTileRange({ x: -48 * 10, y: -48 * 20 }, 1, SIZE, 2);
	assert.equal(padded.minX, 10 - 2);
	assert.equal(padded.minY, 20 - 2);
	const neg = visibleTileRange({ x: 48 * 5 + 10, y: 0 }, 1, SIZE);
	assert.equal(neg.minX, -6, 'the map is shifted right: tiles left of the origin are visible');
});
