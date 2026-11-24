import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_WINDOW_POS, useWindowStore, WIN_IDS } from '../../src/stores/windowStore';
import { kingdomSummary } from '../../src/lib/kingdomSummary';
import { BUILDINGS } from '../../src/catalog/buildings';
import { limitOf } from '../../src/lib/limits';
import { MONSTERS } from '../../src/config/combatConfig';
import type { Monster } from '../../src/types/game';
import { useGameStore } from '../../src/stores/gameStore';
import { api, freshGame } from '../helpers';

// The Kingdom overview: a pure summary of the realm and the window that draws it. (node has no CSS loader: the imports are made no-ops before the component loads.)
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;

test('the Kingdom overview is a known window with a default position', () => {
	assert.ok(WIN_IDS.includes('kingdom'));
	assert.ok(DEFAULT_WINDOW_POS.kingdom);
});

test('the summary reports the castle against its cap, the builders, the land per biome, every building and the monsters', () => {
	freshGame();
	const s = kingdomSummary(api());
	assert.equal(s.castle.level, 1);
	assert.equal(s.castle.cap, limitOf('castleMaxLevel', { prestige: api().prestige }));
	assert.equal(s.castle.upgradingTo, null);
	assert.equal(s.builders.busy, 0);
	assert.ok(s.builders.total >= 1);
	assert.ok(s.land.owned >= 1);
	assert.equal(
		s.land.byBiome.reduce((sum, row) => sum + row.count, 0) <= s.land.owned,
		true,
		'the castle is not a biome row, so the rows never add up to more than the land',
	);
	assert.deepEqual(
		s.land.byBiome.map((row) => row.count),
		[...s.land.byBiome.map((row) => row.count)].sort((a, b) => b - a),
		'biomes are listed from the most tiles down',
	);
	assert.equal(s.buildings.total, BUILDINGS.length);
	assert.equal(s.buildings.built, 0);
	assert.ok(s.buildings.rows.every((row) => row.level === 0 && row.cap >= 1));
	assert.ok(
		s.buildings.rows.filter((row) => row.kind !== 'idol').every((row) => row.cap === 5),
		'the cap is the Ember cap (5 to start), not held down by the castle level',
	);
	assert.equal(s.monsters.total, api().monsters.length);
});

test('an open Kingdom overview shows the castle, land, buildings and monsters sections', () => {
	freshGame();
	const patch = { order: ['kingdom' as const], positions: { ...DEFAULT_WINDOW_POS }, sizes: {} };
	useWindowStore.setState(patch);
	Object.assign(useWindowStore.getInitialState(), patch);
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const KingdomWindow = require('../../src/components/game/KingdomWindow').default;
	const out = renderToStaticMarkup(React.createElement(KingdomWindow));
	assert.match(out, /Kingdom overview/);
	assert.match(out, /Castle/);
	assert.match(out, /Land/);
	assert.match(out, /Buildings \(0 of /);
	assert.match(out, /Monsters on the map/);
	assert.match(out, /kingdom-heatmap/, 'the land is a heatmap of squares');
	// (a static render reads the store's initial state, which already owns its starter land)
	const landTiles = kingdomSummary(useGameStore.getInitialState()).land.byBiome.reduce((sum, row) => sum + row.count, 0);
	assert.ok(landTiles > 0);
	assert.equal((out.match(/class="kd-cell"/g) ?? []).length, landTiles, 'one square per owned tile');
});

test('IDL-377: land rows carry their share of the owned tiles, buildings are grouped by biome in the fixed order, locked is not missing', () => {
	freshGame();
	const s = kingdomSummary(api());
	for (const row of s.land.byBiome) assert.ok(Math.abs(row.pct - (row.count / s.land.owned) * 100) < 1e-9);
	assert.equal(s.buildings.groups.flatMap((g) => g.rows).length, BUILDINGS.length, 'every building is in exactly one group');
	const order = { producer: 0, extractor: 1, idol: 2, general: 3 };
	for (const group of s.buildings.groups) {
		const kinds = group.rows.map((row) => order[row.kind]);
		assert.deepEqual(
			kinds,
			[...kinds].sort((a, b) => a - b),
			`${group.biome}: Producer, Extractor, Idol, then general`,
		);
	}
	const jungle = s.buildings.groups.find((g) => g.biome === 'jungle');
	assert.ok(jungle && jungle.rows.every((row) => row.lockedUntilRebirth === 1), 'jungle needs one rebirth on a fresh account');
	const plains = s.buildings.groups.find((g) => g.biome === 'plains');
	assert.ok(plains && plains.rows.every((row) => row.lockedUntilRebirth === 0));
	assert.equal(s.buildings.available, s.buildings.rows.filter((row) => row.lockedUntilRebirth === 0).length);
	assert.ok(s.buildings.available < s.buildings.total, 'the later biomes are locked, not missing');
});

test('IDL-378: the map counters: golden is a subset of the monsters, fully grown plus still growing is all of them, chests and ore nodes are read', () => {
	freshGame();
	const base = api();
	const type = Object.keys(MONSTERS)[0] as Monster['type'];
	const monsters: Monster[] = [
		{ id: 9001, type, x: 1, y: 1, lucky: true, level: 5, spawnLevel: 5, ageSec: 0 },
		{ id: 9002, type, x: 2, y: 2, level: 5 + limitOf('monsterGrowthLevels', { prestige: base.prestige }), spawnLevel: 5, ageSec: 1e9 },
	];
	const s = kingdomSummary({ ...base, monsters }, 4);
	assert.equal(s.monsters.total, 2);
	assert.equal(s.monsters.lucky, 1);
	assert.equal(s.monsters.maxed, 1);
	assert.equal(s.monsters.growing, 1);
	assert.equal(s.monsters.maxed + s.monsters.growing, s.monsters.total);
	assert.equal(s.monsters.rocks, 4);
	assert.equal(s.monsters.chests, base.tiles.stats.chests);
});
