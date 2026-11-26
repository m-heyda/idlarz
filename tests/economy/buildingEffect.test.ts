import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS } from '../../src/catalog/buildings';
import { buildingEffect, nextBuildingTile, tilesWithBuilding } from '../../src/lib/buildingEffect';
import { createWorld } from '../../src/utils/world';

// What a building gives, as the Kingdom overview's hover text states it, and which copy a pressed name shows.

test('every building has an effect text: an Idol its bonus, a general building its percent, a Producer or Extractor its output per hour', () => {
	for (const def of BUILDINGS) {
		const e = buildingEffect(def.id, 3, 12);
		assert.ok(e.lines.length > 0, `${def.id} says what it gives`);
		assert.ok(
			e.lines.every((line) => line.length > 0 && !line.includes('NaN') && !line.includes('undefined')),
			`${def.id}: ${e.lines.join(' | ')}`,
		);
		if (def.kind === 'producer' || def.kind === 'extractor')
			assert.ok(
				e.lines.every((line) => line.endsWith('per hour')),
				def.id,
			);
	}
});

test('a building that is not built shows what level 1 would give, and says it is not built', () => {
	const def = BUILDINGS.find((b) => b.kind === 'idol')!;
	const none = buildingEffect(def.id, 0, 0);
	assert.equal(none.built, false);
	assert.deepEqual(none.lines, buildingEffect(def.id, 1, 0).lines);
	assert.equal(buildingEffect(def.id, 1, 0).built, true);
});

test('a higher level gives more, and an unknown building gives nothing', () => {
	const producer = BUILDINGS.find((b) => b.kind === 'producer')!;
	assert.notDeepEqual(buildingEffect(producer.id, 1, 10).lines, buildingEffect(producer.id, 5, 10).lines);
	assert.deepEqual(buildingEffect('no_such_building', 2, 0).lines, []);
});

test('pressing the same name walks through the copies and wraps round; with none there is nothing to show', () => {
	const copies = [
		{ x: 2, y: 1 },
		{ x: 5, y: 5 },
		{ x: 7, y: 0 },
	];
	assert.deepEqual(nextBuildingTile(copies, null), copies[0]);
	assert.deepEqual(nextBuildingTile(copies, copies[0]), copies[1]);
	assert.deepEqual(nextBuildingTile(copies, copies[2]), copies[0]);
	assert.deepEqual(nextBuildingTile(copies, { x: 99, y: 99 }), copies[0], 'a copy that is gone starts again at the first');
	assert.equal(nextBuildingTile([], null), null);
	assert.deepEqual(tilesWithBuilding(createWorld([]), 'anything'), []);
});
