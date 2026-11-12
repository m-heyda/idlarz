import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GameWindow from '../../src/components/game/GameWindow';
import { DEFAULT_WINDOW_POS, useWindowStore } from '../../src/stores/windowStore';

// IDL-324: the adapter that draws a game window with the design system's WindowShell, driven by the window store.

const h = React.createElement;
// a server render reads zustand's initial state, not the live one, so the tests write the state to both
const put = (patch: Partial<ReturnType<typeof useWindowStore.getState>>) => {
	useWindowStore.setState(patch);
	Object.assign(useWindowStore.getInitialState(), patch);
};
const reset = () => put({ order: [], positions: { ...DEFAULT_WINDOW_POS }, sizes: {} });
const open = (...ids: Array<'equipment' | 'merchant' | 'farm'>) => put({ order: ids });
const draw = () => renderToStaticMarkup(h(GameWindow, { id: 'merchant', title: 'Merchant', width: 980, height: 720, children: h('p', null, 'inside') }));

test('a closed window draws nothing', () => {
	reset();
	assert.equal(draw(), '');
});

test('an open window sits at its stored position and default size, in front of the older ones', () => {
	reset();
	open('equipment', 'merchant');
	const out = draw();
	assert.match(out, /inside/);
	assert.match(out, /position:fixed/);
	assert.match(out, new RegExp(`left:${DEFAULT_WINDOW_POS.merchant.x}px`));
	assert.match(out, new RegExp(`top:${DEFAULT_WINDOW_POS.merchant.y}px`));
	assert.match(out, /width:980px/);
	assert.match(out, /height:720px/);
	assert.match(out, /z-index:41/, 'second open window: base 40 + rank 1');
	assert.match(out, /data-active="true"/);
});

test('a size the player dragged to wins over the default, and a window behind another is not active', () => {
	reset();
	open('merchant', 'farm');
	put({ sizes: { merchant: { w: 700, h: 500 } } });
	const out = draw();
	assert.match(out, /width:700px/);
	assert.match(out, /height:500px/);
	assert.match(out, /data-active="false"/);
});

test('the Hero window draws the new bag with the hero card, gear, skills, footer buttons and the tabs', async () => {
	const { default: HeroWindow } = await import('../../src/components/game/hero/HeroWindow');
	reset();
	put({ order: ['equipment'] });
	const out = renderToStaticMarkup(h(HeroWindow));
	assert.match(out, /aria-label="Hero"/);
	for (const word of ['Bag', 'Stats', 'Crafting', 'Crafting bag', 'Armor', 'Jewelry', 'Hands', 'Skills', 'slots used', 'Organise', 'Sell junk']) {
		assert.ok(out.includes(word), `the window shows "${word}"`);
	}
	assert.match(out, /ds-baggrid/);
	assert.match(out, /ds-hero-left/);
});

test('the Stats tab keeps every figure of the old Character window: attributes, overview, combat, bonuses and income', async () => {
	const { default: HeroStats } = await import('../../src/components/game/hero/HeroStats');
	reset();
	const out = renderToStaticMarkup(h(HeroStats));
	for (const word of [
		'Strength',
		'Dexterity',
		'Intelligence',
		'Vitality',
		'Charisma',
		'Overview',
		'Combat',
		'Bonuses',
		'Resource income',
		'Where the income comes from',
		'Rebirths',
	]) {
		assert.ok(out.includes(word), `the tab shows "${word}"`);
	}
	for (const line of ['Crit chance', 'Super crit damage', 'Life leech', 'Luck', 'Gold find', 'Offline progress', 'Per second', 'Crafting level']) {
		assert.ok(out.includes(line), `the tab lists "${line}"`);
	}
	assert.match(out, /Respec/, 'at 0 points the corner holds the red Respec button');
	assert.match(out, /data-tutorial="stat-add"/, 'the guide can point at the first + button');
});

test('the Crafting tab shows the level bar, the queue, the recipe groups and the ticket with its Queue button', async () => {
	const { default: HeroCrafting } = await import('../../src/components/game/hero/HeroCrafting');
	reset();
	const out = renderToStaticMarkup(h(HeroCrafting));
	for (const word of ['Crafting level', 'Queue 0', 'Components', 'Potions', 'Cost', 'Amount', 'XP']) {
		assert.ok(out.includes(word), `the tab shows "${word}"`);
	}
	assert.match(out, /ds-craft-ticket/);
	assert.match(out, /Amount to craft/, 'the typed amount field is there');
});
