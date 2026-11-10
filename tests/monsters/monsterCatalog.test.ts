import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MONSTER_CATALOG, labMonsters, monsterArtUrl, monsterSpriteUrl, monstersInBiome } from '../../src/catalog/monsters';
import { BIOMES } from '../../src/config/biomes';
import { MONSTERS } from '../../src/config/combatConfig';

// The roster (catalog/monsters.ts) lists every planned monster; only enabled ones may spawn, and those must have real stats in MONSTERS.

test('ids are unique and every biome has three monsters and one boss', () => {
	const ids = MONSTER_CATALOG.map((m) => m.id);
	assert.equal(new Set(ids).size, ids.length);
	const byBiome = new Map<string, typeof MONSTER_CATALOG>();
	for (const m of MONSTER_CATALOG) {
		byBiome.set(m.biomes[0], [...(byBiome.get(m.biomes[0]) ?? []), m]);
	}
	assert.equal(byBiome.size, 12);
	for (const [biome, list] of byBiome) {
		assert.equal(list.filter((m) => m.grade === 'normal').length, 3, `${biome}: 3 monsters`);
		assert.equal(list.filter((m) => m.grade === 'boss').length, 1, `${biome}: 1 boss`);
	}
});

test('the rats are gone: the seven home biomes are enabled, and exactly the enabled ones exist in MONSTERS', () => {
	assert.ok(!('rat' in MONSTERS) && !('ratKing' in MONSTERS));
	const enabledBiomes = new Set(MONSTER_CATALOG.filter((m) => m.enabled).map((m) => m.biomes[0]));
	assert.deepEqual([...enabledBiomes].sort(), ['coast', 'forest', 'hills', 'lake', 'plains', 'swamp', 'tundra']);
	assert.equal(MONSTER_CATALOG.filter((m) => m.enabled).length, 28);
	assert.deepEqual(
		Object.keys(MONSTERS).sort(),
		MONSTER_CATALOG.filter((m) => m.enabled)
			.map((m) => m.id)
			.sort(),
	);
	for (const m of MONSTER_CATALOG.filter((m) => m.enabled)) {
		assert.equal(MONSTERS[m.id as keyof typeof MONSTERS].grade, m.grade);
		assert.deepEqual([...m.biomes], [...MONSTERS[m.id as keyof typeof MONSTERS].spawn.biomes]);
	}
});

test('an entry says it has art exactly when the picture file exists', () => {
	for (const m of MONSTER_CATALOG) {
		const file = path.join(__dirname, '..', '..', 'public', monsterArtUrl(m));
		assert.equal(fs.existsSync(file), m.art, `${m.id}: ${monsterArtUrl(m)}`);
	}
});

test('a monster without its own art has a stand-in file that exists; a monster with art needs none (swapping the art is a file and the flag)', () => {
	for (const m of MONSTER_CATALOG) {
		if (m.enabled && !m.art) assert.ok(m.placeholder, `${m.id}: an enabled monster without art needs a stand-in`);
		const file = path.join(__dirname, '..', '..', 'public', monsterSpriteUrl(m));
		if (m.enabled) assert.ok(fs.existsSync(file), `${m.id}: ${monsterSpriteUrl(m)}`);
		if (m.art) assert.equal(monsterSpriteUrl(m), monsterArtUrl(m), `${m.id}: real art wins over the stand-in`);
	}
	const standIns = MONSTER_CATALOG.filter((m) => m.enabled && !m.art).map((m) => m.id);
	assert.deepEqual(standIns.sort(), ['bossHillGiant', 'boulderBeetle', 'caveGoblinMiner', 'graniteRam', 'pikeLurker']);
});

test('monstersInBiome hides disabled monsters unless asked', () => {
	assert.deepEqual(
		monstersInBiome('swamp')
			.map((m) => m.id)
			.sort(),
		['bossMireMatriarch', 'dumpback', 'garbageOgre', 'rotHeron'],
	);
	assert.equal(monstersInBiome('lake').length, 4, 'the lake roster is enabled');
	assert.equal(monstersInBiome('hills').length, 4);
	assert.equal(monstersInBiome('coast').length, 4);
	assert.equal(monstersInBiome('jungle').length, 0, 'no rebirth biome has a monster yet');
	assert.equal(monstersInBiome('jungle', false).length, 4);
});

test('the map lab always has a monster to show, every MONSTERS entry has a catalog entry and a picture, and every spawn biome exists', () => {
	// /map-lab reads the first entry of the list while it prerenders: an empty list broke `npm run build` once every monster with art was enabled
	assert.ok(labMonsters().length > 0);
	for (const [id, def] of Object.entries(MONSTERS)) {
		const entry = MONSTER_CATALOG.find((m) => m.id === id);
		assert.ok(entry, `${id} is in the catalog`);
		assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'public', monsterSpriteUrl(entry!))), `${id}: its picture exists`);
		for (const biome of def.spawn.biomes) assert.ok(biome in BIOMES, `${id}: ${biome} is a biome`);
	}
});
