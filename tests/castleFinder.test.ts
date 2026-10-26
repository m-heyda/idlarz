import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers';
import { CASTLE_X, CASTLE_Y, TILE_SIZE } from '../src/config/gameConfig';
import { ARROW_MARGIN, castleScreenPoint, compassArrow, isCastleOnScreen, NO_INSETS, type Insets, type ViewLike } from '../src/lib/castleFinder';
import { positionForCenter } from '../src/lib/mapView';
import { useViewStore } from '../src/stores/viewStore';

const W = 1000;
const H = 700;
/** A view whose screen centre is the world point (wx, wy) in tiles. */
const looking = (tx: number, ty: number, zoom = 1): ViewLike => {
	const p = positionForCenter(tx * TILE_SIZE, ty * TILE_SIZE, zoom, { w: W, h: H });
	return { ...p, zoom, w: W, h: H };
};
const INSETS: Insets = { top: 60, right: 0, bottom: 0, left: 0, avoid: { w: 200, h: 300 } };

test('the castle on screen: no arrow', () => {
	assert.equal(isCastleOnScreen(looking(CASTLE_X, CASTLE_Y)), true);
	assert.equal(compassArrow(looking(CASTLE_X, CASTLE_Y)), null);
	// only the edge of the tile showing still counts
	const edge = looking(CASTLE_X + W / 2 / TILE_SIZE + 0.4, CASTLE_Y);
	assert.equal(isCastleOnScreen(edge), true);
	assert.equal(isCastleOnScreen(looking(CASTLE_X + W / 2 / TILE_SIZE + 1.2, CASTLE_Y)), false);
});

test('under the header counts as hidden', () => {
	// the castle is 20 px below the top of the window: visible, unless a 60 px header covers it
	const far = looking(CASTLE_X, CASTLE_Y + 0.5 + (H / 2 - 20) / TILE_SIZE);
	assert.equal(isCastleOnScreen(far, NO_INSETS), true);
	assert.equal(isCastleOnScreen(far, { ...NO_INSETS, top: 60 }), false, 'a castle behind a 60 px header is not visible');
});

const DIRECTIONS: [string, number, number, (a: NonNullable<ReturnType<typeof compassArrow>>) => boolean][] = [
	['castle to the east', 1, 0, (a) => Math.abs(a.angle) < 20],
	['castle to the west', -1, 0, (a) => Math.abs(Math.abs(a.angle) - 180) < 20],
	['castle to the south', 0, 1, (a) => Math.abs(a.angle - 90) < 20],
	['castle to the north', 0, -1, (a) => Math.abs(a.angle + 90) < 20],
	['castle to the south east', 1, 1, (a) => a.angle > 10 && a.angle < 80],
	['castle to the north west', -1, -1, (a) => a.angle < -100 && a.angle > -170],
];

for (const [name, dx, dy, ok] of DIRECTIONS) {
	for (const zoom of [0.75, 1, 2]) {
		test(`arrow: ${name} (zoom ${zoom}) sits on the screen border inside the margins and points the right way`, () => {
			// look far away from the castle in the opposite direction, in any quadrant (negative coordinates included)
			const v = looking(CASTLE_X - dx * 120, CASTLE_Y - dy * 90, zoom);
			const a = compassArrow(v, INSETS)!;
			assert.ok(a, 'an arrow');
			assert.ok(ok(a), `angle ${a.angle.toFixed(0)}`);
			assert.ok(a.x >= ARROW_MARGIN - 1e-6 && a.x <= W - ARROW_MARGIN + 1e-6, `x ${a.x}`);
			assert.ok(a.y >= INSETS.top + ARROW_MARGIN - 1e-6 && a.y <= H - ARROW_MARGIN + 1e-6, `y ${a.y} stays under the header`);
			// on the border of the shrunk screen, or slid along it out of the minimap box
			const onBorder = Math.abs(a.x - ARROW_MARGIN) < 1 || Math.abs(a.x - (W - ARROW_MARGIN)) < 1 || Math.abs(a.y - (INSETS.top + ARROW_MARGIN)) < 1 || Math.abs(a.y - (H - ARROW_MARGIN)) < 1 || a.y <= H - 300 - ARROW_MARGIN + 1 || a.x <= W - 200 - ARROW_MARGIN + 1;
			assert.ok(onBorder, `${a.x},${a.y}`);
			// never in the box of the minimap and statistics
			assert.ok(!(a.x > W - 200 - ARROW_MARGIN + 1e-6 && a.y > H - 300 - ARROW_MARGIN + 1e-6), `${a.x},${a.y} is in the minimap box`);
			// the distance is the real one, in tiles
			const expected = Math.round(Math.hypot(dx * 120, dy * 90));
			assert.ok(Math.abs(a.tiles - expected) <= 2,`${a.tiles} tiles, expected about ${expected}`);
		});
	}
}

test('the arrow points at the castle from where it sits', () => {
	const v = looking(CASTLE_X - 80, CASTLE_Y + 30);
	const a = compassArrow(v, INSETS)!;
	const c = castleScreenPoint(v);
	const toCastle = (Math.atan2(c.y - a.y, c.x - a.x) * 180) / Math.PI;
	assert.ok(Math.abs(toCastle - a.angle) < 1e-9);
});

test('a tiny window does not break the maths', () => {
	const v: ViewLike = { x: -5000, y: -5000, zoom: 1, w: 60, h: 40 };
	const a = compassArrow(v, { top: 30, right: 0, bottom: 0, left: 0 })!;
	assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.angle));
});

test('centerOnCastle brings the castle back from anywhere the view can be dragged', () => {
	const api = useViewStore;
	api.getState().setSize(W, H);
	for (const [x, y] of [[-100000, 0], [100000, 50000], [0, -90000], [30000, 30000]]) {
		api.getState().setPosition({ x, y });
		api.getState().centerOnCastle();
		const s = api.getState();
		assert.equal(isCastleOnScreen({ x: s.x, y: s.y, zoom: s.zoom, w: s.w, h: s.h }), true);
	}
});
