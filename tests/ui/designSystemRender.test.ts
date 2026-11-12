import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Slot, Tabs, WindowShell } from '../../packages/design-system/src/components/primitives';
import { AmountInput } from '../../packages/design-system/src/components/composites';
import { ItemTooltip, TileTooltip, TipCostList, TipDiff } from '../../packages/design-system/src/components/tooltips';

// IDL-327: a light render harness for the design system. No test library: the components render to static markup on the server (react-dom/server is already a dependency),
// which is enough to pin their props contract (what a prop turns into) without a browser.

const h = React.createElement;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

test('Slot passes native button props through and marks rarity, empty and equipped states', () => {
	const out = html(
		h(Slot, { icon: '/x.png', rarity: 'epic', count: 12, equipped: true, 'aria-label': 'Helm', 'data-testid': 'slot-1', onClick: () => undefined } as never),
	);
	assert.match(out, /aria-label="Helm"/);
	assert.match(out, /data-testid="slot-1"/);
	assert.match(out, /data-rarity="epic"/);
	assert.match(out, /data-equipped="true"/);
	assert.match(out, />12</, 'a stack count above one is shown');
	assert.doesNotMatch(html(h(Slot, { rarity: 'common', count: 1 })), /data-rarity|ds-slot-count/);
});

test('Tabs mark the active item, a badge and a disabled one', () => {
	const out = html(
		h(Tabs, {
			items: [
				{ id: 'bag', label: 'Bag' },
				{ id: 'stats', label: 'Stats', badge: 3 },
				{ id: 'craft', label: 'Crafting', disabled: true },
			],
			active: 'stats',
			onChange: () => undefined,
		} as never),
	);
	assert.match(out, /Stats/);
	assert.match(out, />3</);
	assert.match(out, /disabled/);
});

test('WindowShell: controlled geometry is fixed at the given point, uncontrolled stays in the layout', () => {
	const controlled = html(h(WindowShell, { title: 'Hero', position: { x: 40, y: 90 }, size: { w: 700, h: 500 }, children: h('div', null, 'body') }));
	assert.match(controlled, /position:fixed/);
	assert.match(controlled, /left:40px/);
	assert.match(controlled, /top:90px/);
	assert.match(controlled, /Hero/);
	const free = html(h(WindowShell, { title: 'Hero', children: h('div', null, 'body') }));
	assert.doesNotMatch(free, /position:fixed/);
});

test('AmountInput: a typed amount wins over a preset, unknown text is invalid, the slider shows the readout', () => {
	const base = { value: 1000, max: 5000, onTextChange: () => undefined, presets: [{ id: 1000, label: '1K' }], activePreset: 1000 as const };
	const idle = html(h(AmountInput, { ...base, text: '' }));
	assert.match(idle, /aria-pressed="true"/);
	assert.match(idle, /data-invalid="false"/);
	const typed = html(h(AmountInput, { ...base, text: '2m' }));
	assert.match(typed, /aria-pressed="false"/, 'the preset is not active while text is typed');
	assert.match(typed, /data-active="true"/);
	const bad = html(h(AmountInput, { ...base, text: '12x' }));
	assert.match(bad, /data-invalid="true"/);
	assert.match(bad, /ds-amount-error/);
	assert.match(html(h(AmountInput, { ...base, text: '', onSlider: () => undefined })), /1K \/ 5K/);
});

test('tooltip lines: diffs colour by better or worse, costs by affordable or not, an unexplored tile lists its cost', () => {
	assert.match(html(h(TipDiff, { value: '86', diff: 12 })), /data-tone="green"[^>]*>[^<]*\(\+12\)/);
	assert.match(html(h(TipDiff, { value: '1.20', diff: -0.1, digits: 2 })), /data-tone="red"/);
	assert.match(html(h(TipDiff, { value: '1.0', diff: -0.2, lowerIsBetter: true, digits: 1 })), /data-tone="green"/);
	assert.doesNotMatch(html(h(TipDiff, { value: '5', diff: 0 })), /ds-tip-diff"/);
	const costs = html(
		h(TipCostList, {
			costs: [
				{ label: 'Gold', have: 10, cost: 5 },
				{ label: 'Wood', have: 1, cost: 5, discount: '-10%' },
			],
		}),
	);
	assert.match(costs, /data-tone="green"/);
	assert.match(costs, /data-tone="red"/);
	assert.match(costs, /\(-10%\)/);
	const tile = html(
		h(TileTooltip, { icon: '/x.png', name: 'Forest', unexplored: true, costs: [{ label: 'Gold', have: 1, cost: 2 }], cta: 'Click to explore' }),
	);
	assert.match(tile, /Unexplored Land/);
	assert.match(tile, /Click to explore/);
});

test('ItemTooltip shows the set block, lost properties, the Equipped mark and the hints only when given', () => {
	const full = html(
		h(ItemTooltip, {
			rarity: 'epic',
			icon: '/x.png',
			name: 'Blade',
			type: 'Epic sword',
			equippedLabel: true,
			lost: ['+3% Life leech'],
			set: { title: 'Cloudwalker set (1/5)', pieces: [{ name: 'Blade', worn: true }], bonuses: [{ count: 2, text: '+4% Income', active: false }] },
			hints: 'Shift + click sell',
		}),
	);
	for (const text of ['Equipped', 'Properties lost when equipped', '+3% Life leech', 'Cloudwalker set (1/5)', 'Shift + click sell'])
		assert.ok(full.includes(text), text);
	const bare = html(h(ItemTooltip, { rarity: 'common', icon: '/x.png', name: 'Stick', type: 'Common' }));
	assert.doesNotMatch(bare, /Equipped|ds-tip-set|Shift/);
});

test('AttributeStrip: points to spend with enabled + buttons, then a Respec button at 0 points with the + buttons off', async () => {
	const { AttributeStrip, PaperSection } = await import('../../packages/design-system/src/components/composites');
	const attrs = [{ id: 'str', label: 'Strength', value: 17 }];
	const some = html(h(AttributeStrip, { attrs, points: 2, onAdd: () => undefined }));
	assert.match(some, /2 points to spend/);
	assert.doesNotMatch(some, /Respec/);
	assert.doesNotMatch(some, /ds-plus"[^>]*disabled/);
	const none = html(h(AttributeStrip, { attrs, points: 0, onAdd: () => undefined, onRespec: () => undefined }));
	assert.match(none, /Respec/);
	assert.match(none, /disabled/);
	const shut = html(h(PaperSection, { title: 'Combat', open: false, onToggle: () => undefined, children: h('p', null, 'inside') }));
	assert.doesNotMatch(shut, /inside/, 'a folded block hides its body');
	assert.match(shut, /aria-expanded="false"/);
});
