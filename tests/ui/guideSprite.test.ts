import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDE_SPRITE, GUIDE_TALK_SHEET } from '../../src/catalog/tutorial';
import { buildSheet, decodePng, encodePng, findMouth, openMouth } from '../../scripts/guide-sprite';

const ROOT = join(__dirname, '..', '..');
const source = () => decodePng(readFileSync(join(ROOT, 'public', GUIDE_SPRITE)));

test('the PNG codec reads and writes the sprite without changing a pixel', () => {
	const img = source();
	assert.equal(img.width, 67);
	assert.equal(img.height, 67);
	const again = decodePng(encodePng(img));
	assert.deepEqual(Array.from(again.data), Array.from(img.data));
});

test('the mouth is found as a short pinkish band inside the beard', () => {
	const mouth = findMouth(source());
	assert.ok(mouth.length >= 2 && mouth.length <= 8, `${mouth.length} pixels`);
	assert.ok(mouth.every((p) => p.x >= 32 && p.x <= 42 && p.y >= 13 && p.y <= 19));
});

test('the open-mouth frame changes only the mouth and the row under it', () => {
	const closed = source();
	const open = openMouth(closed);
	const mouth = findMouth(closed);
	const top = Math.min(...mouth.map((p) => p.y));
	let changed = 0;
	for (let y = 0; y < closed.height; y++)
		for (let x = 0; x < closed.width; x++) {
			const i = (y * closed.width + x) * 4;
			if (closed.data.slice(i, i + 4).some((v, k) => v !== open.data[i + k])) {
				changed++;
				assert.ok(y === top || y === top + 1, `pixel ${x},${y} is outside the mouth rows`);
			}
		}
	assert.ok(changed >= 2 && changed <= 12, `${changed} pixels changed`);
});

test('the sheet on disk is the two frames, closed then open, and is what the script writes', () => {
	const sheet = decodePng(readFileSync(join(ROOT, 'public', GUIDE_TALK_SHEET)));
	assert.equal(sheet.width, 134);
	assert.equal(sheet.height, 67);
	const expected = buildSheet(source());
	assert.deepEqual(Array.from(sheet.data), Array.from(expected.data), 'run npx tsx scripts/guide-sprite.ts');
	assert.deepEqual(readFileSync(join(ROOT, 'public', GUIDE_TALK_SHEET)), encodePng(expected), 'the bytes are deterministic');
	// the left half is the original sprite
	const closed = source();
	for (let y = 0; y < 67; y++)
		assert.deepEqual(Array.from(sheet.data.slice(y * 134 * 4, y * 134 * 4 + 67 * 4)), Array.from(closed.data.slice(y * 67 * 4, (y + 1) * 67 * 4)));
});
