import test from 'node:test';
import assert from 'node:assert/strict';
import { placeTip } from '../src/lib/tipPlacement';

const viewport = { width: 1000, height: 700 };
const box = { left: 100, top: 200, right: 148, bottom: 248 }; // a 48px item slot
const tip = { width: 300, height: 220 };

test('the card sits flush to the right edge of the item box, lined up with its top', () => {
	assert.deepEqual(placeTip(box, tip, viewport), { left: 156, top: 200, side: 'right' });
});

test('it does not depend on where the cursor is: only the box matters', () => {
	assert.deepEqual(placeTip(box, tip, viewport), placeTip({ ...box }, tip, viewport));
});

test('with no room on the right it flips to the left edge of the box', () => {
	const near = { left: 900, top: 200, right: 948, bottom: 248 };
	assert.deepEqual(placeTip(near, tip, viewport), { left: 900 - 8 - 300, top: 200, side: 'left' });
});

test('it slides up to stay inside the bottom edge and never above the top margin', () => {
	assert.equal(placeTip({ ...box, top: 600, bottom: 648 }, tip, viewport).top, 700 - 8 - 220);
	assert.equal(placeTip({ ...box, top: 0, bottom: 48 }, tip, viewport).top, 8);
});

test('a card wider than either side picks the roomier side and stays on screen', () => {
	const wide = { width: 900, height: 200 };
	const p = placeTip({ left: 600, top: 100, right: 648, bottom: 148 }, wide, viewport);
	assert.equal(p.side, 'left');
	assert.ok(p.left >= 8);
});
