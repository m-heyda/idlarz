import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CASTLE_UPGRADE } from '../../src/config/castle';
import { castleIconName, pixelIconSrc, PIXEL_ICON_SIZES } from '../../src/config/pixelIcons';

const castles = path.join(process.cwd(), 'public/pixel/castles');

test('every castle level has its own 64px sprite and no level is clamped', () => {
	for (let level = 1; level <= CASTLE_UPGRADE.maxLevel; level++) {
		const name = castleIconName(level);
		assert.equal(name, `castle_${level}`);
		assert.deepEqual(PIXEL_ICON_SIZES[name], [64, 64]);
		assert.ok(fs.existsSync(path.join(process.cwd(), 'public', pixelIconSrc(name))), `${name}.png exists`);
	}
});

test('the 7 premium skins are shipped (not wired to a shop yet)', () => {
	for (let i = 1; i <= 7; i++) assert.ok(fs.existsSync(path.join(castles, `castle_skin_${i}.png`)), `castle_skin_${i}.png`);
});
