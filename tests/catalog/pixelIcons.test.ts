import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { INITIAL_RESOURCES } from '../../src/config/economy';
import {
	ANIMAL_PIXEL_ICONS,
	PIXEL_ICON_SIZES,
	RESOURCE_PIXEL_ICONS,
	SHINE_FRAMES,
	SHINE_SHEETS,
	animalIcon,
	pixelIconSrc,
	type PixelIconName,
} from '../../src/config/pixelIcons';

const PUBLIC = resolve(__dirname, '..', '..', 'public');

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

test('embers is the rebirth currency: it has an icon (the sprite named legacy) but is not a game resource', () => {
	assert.equal(RESOURCE_PIXEL_ICONS.embers, 'legacy');
	assert.equal('embers' in INITIAL_RESOURCES, false);
	assert.ok(SHINE_SHEETS.legacy);
});

test('gems is the premium currency: the diamond, with a twinkle strip, and not a game resource', () => {
	assert.equal(RESOURCE_PIXEL_ICONS.gems, 'diamond');
	assert.equal('gems' in INITIAL_RESOURCES, false);
	assert.equal(SHINE_SHEETS.diamond, 'diamond_shine');
});

test("animalIcon: a stable pick among the kind's looks, mixed across a flock, first look without a seed", () => {
	for (const kind of ['chicken', 'cow'] as const) {
		const looks = ANIMAL_PIXEL_ICONS[kind];
		const picks = Array.from({ length: 12 }, (_, i) => animalIcon(kind, `${kind}-${i}`));
		assert.deepEqual(
			picks,
			Array.from({ length: 12 }, (_, i) => animalIcon(kind, `${kind}-${i}`)),
			'same seed, same look',
		);
		assert.equal(new Set(picks).size, looks.length, `a flock of ${kind} shows every look`);
		assert.equal(animalIcon(kind), looks[0]);
	}
	assert.equal(animalIcon('pig', 'pig-3'), 'animal_pig');
});
