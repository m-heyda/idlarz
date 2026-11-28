import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINIMAP_BOX_DEFAULT, MINIMAP_BOX_MAX, clampMinimapBox, minimapLayout, minimapToTile, zoomedLayout } from '../../src/lib/minimap';

test('a dragged size inside the limits is kept, rounded to whole pixels', () => {
	assert.deepEqual(clampMinimapBox({ w: 300.4, h: 250.6 }), { w: 300, h: 251 });
});

test('the overview never gets smaller than the default or bigger than the maximum', () => {
	assert.deepEqual(clampMinimapBox({ w: 10, h: 10 }), MINIMAP_BOX_DEFAULT);
	assert.deepEqual(clampMinimapBox({ w: 9999, h: 9999 }), MINIMAP_BOX_MAX);
});

test('a small window caps it, but never below the default size', () => {
	assert.deepEqual(clampMinimapBox({ w: 500, h: 400 }, { w: 300, h: 260 }), { w: 300, h: 260 });
	assert.deepEqual(clampMinimapBox({ w: 500, h: 400 }, { w: 50, h: 50 }), MINIMAP_BOX_DEFAULT);
});

test('a damaged saved size falls back to the default', () => {
	assert.deepEqual(clampMinimapBox({ w: NaN, h: Infinity }), { w: MINIMAP_BOX_DEFAULT.w, h: MINIMAP_BOX_DEFAULT.h });
});

test('zoom 1 is the fitted layout; zooming puts the focus tile in the middle of the box at a bigger scale', () => {
	const fit = minimapLayout({ minX: 0, maxX: 199, minY: 0, maxY: 199 }, { w: 176, h: 132 });
	assert.equal(zoomedLayout(fit, 1, { x: 50, y: 50 }), fit);
	const z = zoomedLayout(fit, 4, { x: 50, y: 60 });
	assert.equal(z.scale, fit.scale * 4);
	const mid = minimapToTile(z, z.width / 2, z.height / 2);
	assert.ok(Math.abs(mid.x - 50) < 1e-9 && Math.abs(mid.y - 60) < 1e-9);
});
