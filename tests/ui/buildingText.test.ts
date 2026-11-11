import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS } from '../../src/catalog/buildings';
import { BUILDING_RULES } from '../../src/config/buildings';
import { buildingEffectText } from '../../src/lib/buildingText';
import { buildingOutput } from '../../src/lib/buildingOutput';

const def = (id: string) => BUILDINGS.find((b) => b.id === id)!;

test('the Lumberyard text says what it makes per hour, what a level adds and what the tile count means, from the config', () => {
	const text = buildingEffectText(def('lumberyard'), 10)!;
	assert.match(text.produces, /^Produces \+[\d.,]+[KMB]? wood and \+[\d.,]+[KMB]? gold per hour\.$/);
	assert.match(text.perLevel, /^Each level adds \+.* wood and \+.* gold per hour\.$/);
	assert.match(text.scale, new RegExp(`${BUILDING_RULES.producer.tileEquivalents} forest tiles working at once`));
	assert.match(text.scale, /Every forest tile you own adds \+2 %/);
	assert.match(text.levels, new RegExp(`Levels 1 to ${BUILDING_RULES.maxLevel}`));
	assert.doesNotMatch(text.produces + text.perLevel + text.scale, /like \d+ tiles/);
});

test('the per-level step is the output formula: level 2 minus level 1', () => {
	const d = def('lumberyard');
	const one = buildingOutput(d, 1, 0).wood!;
	const two = buildingOutput(d, 2, 0).wood!;
	assert.ok(two > one);
	assert.ok(Math.abs(two - one - one * BUILDING_RULES.producer.levelStep) < 1e-9);
});

test('an Extractor states its hourly rate; an Idol has no effect text here (IdolInfo shows it)', () => {
	const text = buildingEffectText(def('saptapper'), 0)!;
	assert.match(text.produces, /sap per hour/);
	assert.equal(buildingEffectText(def('idol_forest'), 0), null);
});
