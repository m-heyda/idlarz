import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResourceTooltip } from '../../packages/design-system/src/components/tooltips';
import { MAX_SOURCE_ROWS, sourceRows } from '../../src/lib/incomeRows';
import type { ResourceBreakdownEntry } from '../../src/utils/game/income';

// IDL-339: the "Sources" block of the header resource tooltips: where the income comes from and what lifts it.

const entry = (over: Partial<ResourceBreakdownEntry>): ResourceBreakdownEntry => ({
	start: 0,
	farm: 0,
	biome: 0,
	castleArea: 0,
	castleXp: 0,
	base: 0,
	castleMod: 0,
	plainsMod: 0,
	statMod: 0,
	emberMult: 1,
	merchantMult: 1,
	gearMult: 1,
	modifier: 0,
	total: 0,
	...over,
});

test('nothing to list, or one source with no bonus: no Sources block (the Income line already says it)', () => {
	assert.deepEqual(sourceRows(undefined), []);
	assert.deepEqual(sourceRows(entry({})), []);
	assert.deepEqual(sourceRows(entry({ biome: 2, base: 2, total: 2 })), []);
});

test('sources are rates that add up to the income, bonuses follow as green percentages', () => {
	const rows = sourceRows(entry({ biome: 4, farm: 1, base: 5, modifier: 0.2, total: 6, merchantMult: 1.03 }));
	assert.deepEqual(
		rows.map((r) => r.label),
		['Tiles', 'Farm', 'Foreman'],
	);
	// 4 x 1.2 and 1 x 1.2 per second
	assert.match(rows[0].value, /^\+4\.8/);
	assert.match(rows[1].value, /^\+1\.2/);
	assert.equal(rows[2].value, '+3%');
	assert.equal(rows[2].tone, 'green');
});

test(`more than ${MAX_SOURCE_ROWS} lines fold into "and N more"`, () => {
	const rows = sourceRows(
		entry({ start: 1, biome: 2, farm: 3, castleArea: 4, castleXp: 5, base: 15, modifier: 0.5, total: 22, castleMod: 0.2, merchantMult: 1.05, gearMult: 1.06 }),
	);
	assert.equal(rows.length, MAX_SOURCE_ROWS);
	assert.match(rows[rows.length - 1].label, /^and \d+ more$/);
	assert.equal(rows[rows.length - 1].value, '');
});

test('a tooltip with sources draws the Sources section, one without does not', () => {
	const h = React.createElement;
	const withSources = renderToStaticMarkup(
		h(ResourceTooltip, {
			icon: '/x.png',
			name: 'Wood',
			rows: [{ label: 'Stock', value: '10' }],
			sources: [
				{ label: 'Tiles', value: '+4/s' },
				{ label: 'Farm', value: '+1/s' },
			],
		}),
	);
	assert.match(withSources, /Sources/);
	assert.match(withSources, /Tiles/);
	assert.doesNotMatch(renderToStaticMarkup(h(ResourceTooltip, { icon: '/x.png', name: 'Wood', rows: [{ label: 'Stock', value: '10' }] })), /Sources/);
});

test('the Bestiary line about golden monsters follows the Luck numbers and the panel shows it only when given (IDL-56)', async () => {
	const { goldenTextOf } = await import('../../src/lib/bestiary/entries');
	const { LUCK } = await import('../../src/config/spawns');
	const { BestiaryPanel } = await import('../../packages/design-system/src/views/bestiary');
	const text = goldenTextOf();
	assert.match(text, new RegExp(`${Math.round(LUCK.goldenMonster.base * 100)}% of new monsters`));
	assert.match(text, new RegExp(`up to ${Math.round(LUCK.goldenMonster.cap * 100)}%`));
	assert.match(text, new RegExp(`x${LUCK.goldenMonster.rewardMultiplier} gold and XP`));
	const base = { entries: [], biomes: [], activeText: 'None yet' };
	// with no entries the panel draws nothing at all, so only check the contract of the prop here
	assert.equal(renderToStaticMarkup(React.createElement(BestiaryPanel, { ...base, goldenText: text })), '');
});
