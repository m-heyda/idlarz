import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INITIAL_RESOURCES } from '../src/config/gameConfig';
import {
	PIXEL_ICON_SIZES,
	RESOURCE_PIXEL_ICONS,
	SHINE_FRAMES,
	SHINE_SHEETS,
	pixelIconSrc,
	type PixelIconName,
} from '../src/config/pixelIcons';

const PUBLIC = resolve(__dirname, '..', 'public');

/** Width and height from a PNG's IHDR chunk */
const pngSize = (file: string): [number, number] => {
	const buf = readFileSync(file);
	return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
};

test('every registered pixel icon exists on disk at exactly its registered size', () => {
	for (const [name, size] of Object.entries(PIXEL_ICON_SIZES)) {
		const file = resolve(PUBLIC, pixelIconSrc(name as PixelIconName).slice(1));
		assert.deepEqual(pngSize(file), [...size], `${name}.png size`);
	}
});

test('shine strips are SHINE_FRAMES frames wide and as tall as their sprite', () => {
	for (const [name, sheet] of Object.entries(SHINE_SHEETS) as [PixelIconName, PixelIconName][]) {
		const [w, h] = PIXEL_ICON_SIZES[name];
		assert.deepEqual([...PIXEL_ICON_SIZES[sheet]], [w * SHINE_FRAMES, h], `${sheet} matches ${name}`);
	}
});

test('gems is the rebirth currency: it has an icon but is not a game resource', () => {
	assert.equal(RESOURCE_PIXEL_ICONS.gems, 'gems');
	assert.equal('gems' in INITIAL_RESOURCES, false);
	assert.ok(SHINE_SHEETS.gems);
});
