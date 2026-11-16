import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BossWindow from '../../src/components/game/BossWindow';
import { pixelIconSrc } from '../../src/config/pixelIcons';
import { DEFAULT_WINDOW_POS, useWindowStore, WIN_IDS } from '../../src/stores/windowStore';

// The Boss window is a coming-soon placeholder for the world boss (a shared summon and fight, designed later).

const put = (patch: Partial<ReturnType<typeof useWindowStore.getState>>) => {
	useWindowStore.setState(patch);
	Object.assign(useWindowStore.getInitialState(), patch);
};

test('the Boss window is a known window with a default position', () => {
	assert.ok(WIN_IDS.includes('boss'));
	assert.ok(DEFAULT_WINDOW_POS.boss);
});

test('the Boss button icon is a file in ui/', () => {
	assert.equal(pixelIconSrc('menu_boss'), '/pixel/ui/menu_boss.png');
	assert.ok(existsSync('public/pixel/ui/menu_boss.png'));
});

test('an open Boss window says world boss spawns are coming soon', () => {
	put({ order: ['boss'], positions: { ...DEFAULT_WINDOW_POS }, sizes: {} });
	const out = renderToStaticMarkup(React.createElement(BossWindow));
	assert.match(out, /World boss spawns coming soon/);
	assert.match(out, /menu_boss\.png/);
});
