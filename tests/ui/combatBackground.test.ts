import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BIOMES } from '../../src/config/biomes';
import { COMBAT_BACKGROUND_STYLE, COMBAT_BACKGROUNDS, combatBackgroundUrl } from '../../src/config/combatBackground';

test('every biome a monster can live in has a combat picture and the file exists', () => {
	const biomes = [...Object.keys(BIOMES).filter((b) => b !== 'empty' && b !== 'castle'), 'lava'];
	for (const biome of biomes) {
		const url = combatBackgroundUrl(biome);
		assert.ok(url, `${biome} has no combat picture in COMBAT_BACKGROUNDS`);
		assert.ok(existsSync(join(process.cwd(), 'public', url!)), `${url} is missing`);
	}
	assert.equal(Object.keys(COMBAT_BACKGROUNDS).length, biomes.length);
});

test('no picture gives undefined', () => {
	assert.equal(combatBackgroundUrl('nowhere'), undefined);
	assert.equal(combatBackgroundUrl(undefined), undefined);
});

test('the picture glides visibly but calmly', () => {
	assert.ok(COMBAT_BACKGROUND_STYLE.panSec >= 30 && COMBAT_BACKGROUND_STYLE.panSec <= 90);
	assert.ok(COMBAT_BACKGROUND_STYLE.zoom > 1);
});
