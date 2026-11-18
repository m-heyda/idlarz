import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_WINDOW_POS, useWindowStore, WIN_IDS } from '../../src/stores/windowStore';
import { kingdomSummary } from '../../src/lib/kingdomSummary';
import { BUILDINGS } from '../../src/catalog/buildings';
import { limitOf } from '../../src/lib/limits';
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
});
