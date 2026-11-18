import test from 'node:test';
import assert from 'node:assert/strict';
import { placeHoverTip } from '../../packages/design-system/src/logic';

const viewport = { w: 1280, h: 800 };
const tip = { w: 200, h: 150 };
const box = (left: number, top: number) => ({ left, top, right: left + 40, bottom: top + 40 });

test('a tooltip stays fully inside the screen next to every edge, and below the top bar', () => {
	for (const [left, top] of [
		[0, 0],
		[1240, 0],
		[0, 760],
		[1240, 760],
		[600, 20],
		[600, 780],
		[10, 400],
		[1270, 400],
	] as const) {
		for (const placement of ['above', 'below'] as const) {
			for (const align of ['start', 'center'] as const) {
				const at = placeHoverTip(box(left, top), tip, viewport, { placement, align, topInset: 56 });
				assert.ok(at.x >= 4 && at.x + tip.w <= viewport.w - 4, `x in ${left},${top} ${placement} ${align}`);
				assert.ok(at.y >= 56 && at.y + tip.h <= viewport.h - 4, `y in ${left},${top} ${placement} ${align}`);
			}
		}
	}
});

test('it prefers the asked side and flips when that side has no room', () => {
	assert.equal(placeHoverTip(box(500, 400), tip, viewport, { placement: 'above' }).y, 400 - 150 - 8);
	assert.equal(placeHoverTip(box(500, 400), tip, viewport, { placement: 'below' }).y, 440 + 8);
	assert.equal(placeHoverTip(box(500, 70), tip, viewport, { placement: 'above', topInset: 56 }).y, 110 + 8, 'under the top bar: below the anchor');
	assert.equal(placeHoverTip(box(500, 740), tip, viewport, { placement: 'below' }).y, 740 - 150 - 8, 'no room below: above');
});

test('a start-aligned tooltip that would run off the right edge lines up with the anchor right edge', () => {
	const at = placeHoverTip(box(1200, 300), tip, viewport, { align: 'start' });
	assert.equal(at.x, 1240 - 200);
});
