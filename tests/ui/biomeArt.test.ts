import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { BIOME_RULES } from '../../src/config/biomeRules';
import { BIOME_ART, biomeArtUrl } from '../../src/config/biomeArt';

test('every biome a rebirth unlocks has a picture and the file exists', () => {
	for (const biome of Object.keys(BIOME_RULES.unlockAfterRebirths)) {
		const url = biomeArtUrl(biome);
		assert.ok(url, `${biome} has no picture in BIOME_ART`);
		assert.ok(existsSync(join(process.cwd(), 'public', url!)), `${url} is missing`);
	}
});

test('biomes without a picture give undefined', () => {
	assert.equal(biomeArtUrl('nowhere'), undefined);
	assert.ok(Object.keys(BIOME_ART).length >= 5);
});
