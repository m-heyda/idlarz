import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDINGS, buildingDef } from '../../src/catalog/buildings';
import { REBIRTH_BIOME_OUTPUT } from '../../src/config/biomes';
import { BIOME_MILESTONES, BUILDINGS_FLAG } from '../../src/config/buildings';
import { CASTLE_X, CASTLE_Y } from '../../src/config/castle';
import {
	biomeBonus,
	buildingOutput,
	extractorOutput,
	milestoneBonus,
	milestoneSteps,
	milestoneThresholds,
	producerBonus,
	producerOutput,
} from '../../src/lib/buildings';
import { buildingEffectText } from '../../src/lib/buildingText';
import { calculateResourceBreakdown, incomeSources } from '../../src/utils/game/income';
import { api, freshGame, growTo, patchTileAt, tileAt } from '../helpers';

// IDL-198: biome tile milestones. 75 / 150 / 300 (plains, forest), 100 / 200 / 400 (swamp, tundra) and 125 / 250 / 500 (the five rebirth biomes) owned tiles of a biome each give its Producer and Extractor +25 %, inside the additive bracket.

const withBuildings = <T>(fn: () => T): T => {
	const was = BUILDINGS_FLAG.enabled;
	BUILDINGS_FLAG.enabled = true;
	try {
		return fn();
	} finally {
		BUILDINGS_FLAG.enabled = was;
	}
};

test('the thresholds per biome: home biomes as listed, the five rebirth biomes read from REBIRTH_BIOME_OUTPUT, hills, lake and coast have none', () => {
	assert.deepEqual(milestoneThresholds('plains'), [75, 150, 300]);
	assert.deepEqual(milestoneThresholds('forest'), [75, 150, 300]);
	assert.deepEqual(milestoneThresholds('swamp'), [100, 200, 400]);
	assert.deepEqual(milestoneThresholds('tundra'), [100, 200, 400]);
	for (const biome of Object.keys(REBIRTH_BIOME_OUTPUT)) assert.deepEqual(milestoneThresholds(biome), [125, 250, 500], biome);
	for (const biome of ['hills', 'lake', 'coast', 'castle', 'empty']) assert.deepEqual(milestoneThresholds(biome), [], biome);
});

test('a step is reached at its threshold exactly and each is +25 %', () => {
	assert.deepEqual(
		[0, 74, 75, 149, 150, 299, 300, 5000].map((n) => milestoneSteps('forest', n)),
		[0, 0, 1, 1, 2, 2, 3, 3],
	);
	assert.equal(BIOME_MILESTONES.step, 0.25);
	assert.deepEqual(
		[0, 75, 150, 300].map((n) => milestoneBonus('forest', n)),
		[0, 0.25, 0.5, 0.75],
	);
	assert.equal(milestoneBonus('hills', 9999), 0);
});

test('the milestones add inside the bracket: size bonus = per-tile bonus (capped) + milestones, no new multiplier', () => {
	assert.equal(biomeBonus('forest', 300), producerBonus(300) + 0.75);
	assert.equal(biomeBonus('forest', 300, false), producerBonus(300), 'without milestones: the per-tile bonus alone');
	const lumber = buildingDef('lumberyard')!;
	const plain = producerOutput(lumber, 1, 75, false).wood!;
	const stepped = producerOutput(lumber, 1, 75).wood!;
	// at 75 tiles the per-tile bonus is already at its +100 % cap: 1 + 1 + 0.25 against 1 + 1
	assert.ok(Math.abs(stepped / plain - 2.25 / 2) < 1e-12, `${stepped / plain}`);
	const extractor = BUILDINGS.find((b) => b.kind === 'extractor' && b.biome === 'forest')!;
	const extra = extractorOutput(extractor, 1, 150)[extractor.produces[0]]!;
	const flat = extractorOutput(extractor, 1, 150, false)[extractor.produces[0]]!;
	assert.ok(Math.abs(extra / flat - 2.5 / 2) < 1e-12);
	assert.deepEqual(buildingOutput(lumber, 3, 74), buildingOutput(lumber, 3, 74, false), 'below the first step nothing changes');
	// a biome with no milestones (hills) is exactly what it was
	const hills = BUILDINGS.find((b) => b.kind === 'producer' && b.biome === 'hills')!;
	assert.deepEqual(buildingOutput(hills, 2, 400), buildingOutput(hills, 2, 400, false));
});

test('no biome is more than twice another at the same tile count', () => {
	const biomes = BUILDINGS.filter((b) => b.kind !== 'idol' && b.kind !== 'general').map((b) => b.biome);
	for (let owned = 0; owned <= 700; owned += 5) {
		const sizes = biomes.map((biome) => 1 + biomeBonus(biome, owned));
		assert.ok(Math.max(...sizes) / Math.min(...sizes) <= 2, `${owned} tiles: ${Math.max(...sizes)} against ${Math.min(...sizes)}`);
	}
});

test('the income panel lists the milestones as their own source, and the sources still add up to the total', () => {
	withBuildings(() => {
		freshGame();
		growTo(120);
		// every owned tile but the castle becomes forest, 90 of them: past the first step (75)
		let forest = 0;
		let first: { x: number; y: number } | null = null;
		for (let y = CASTLE_Y - 12; y <= CASTLE_Y + 12; y++)
			for (let x = CASTLE_X - 12; x <= CASTLE_X + 12; x++) {
				const t = tileAt(api().tiles, x, y);
				if (!t.isOwned || t.biome === 'castle' || forest >= 90) continue;
				patchTileAt(x, y, { biome: 'forest' });
				first = first ?? { x, y };
				forest++;
			}
		assert.ok(forest >= 80, `the test world has ${forest} forest tiles`);
		const withoutBuilding = calculateResourceBreakdown(api().tiles, api().characterStats, api().farmLevels, api().prestige).wood;
		patchTileAt(first!.x, first!.y, { building: 'lumberyard', buildingLevel: 1 });
		const s = api();
		const entry = calculateResourceBreakdown(s.tiles, s.characterStats, s.farmLevels, s.prestige).wood;
		const lumber = buildingDef('lumberyard')!;
		const want = producerOutput(lumber, 1, forest).wood! - producerOutput(lumber, 1, forest, false).wood!;
		assert.ok(want > 0, 'at 90 forest tiles the first step is reached');
		assert.ok(Math.abs(entry.milestone - want) < 1e-9, `${entry.milestone} vs ${want}`);
		assert.ok(
			Math.abs(entry.base - (entry.start + entry.farm + entry.biome + entry.milestone + entry.castleArea + entry.castleXp)) < 1e-9,
			'base is the sum of its parts',
		);
		assert.ok(entry.base > withoutBuilding.base);
		const { sources } = incomeSources(entry);
		assert.ok(sources.some((src) => src.id === 'milestones' && src.value > 0));
		assert.ok(Math.abs(sources.reduce((sum, src) => sum + src.value, 0) - entry.total) < 1e-6 * Math.max(1, entry.total));
	});
});

test('the building text tells the milestone steps of a biome that has them and stays silent for one that has none', () => {
	const lumber = buildingDef('lumberyard')!;
	assert.ok(buildingEffectText(lumber, 10)?.scale.includes('75 / 150 / 300'));
	const hills = BUILDINGS.find((b) => b.kind === 'producer' && b.biome === 'hills')!;
	assert.ok(!buildingEffectText(hills, 10)?.scale.includes('tiles it grows by another'));
});
