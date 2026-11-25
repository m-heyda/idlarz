import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ItemInstance } from '../../src/types/game';

// IDL-383: the item frame of the fight window (victory loot, potion bar) wraps its item in the design system's HoverTip with the shared item card. Static markup is enough to pin the frame; the card itself only mounts on hover.

// The component imports stylesheets; node has no CSS loader, so the import is made a no-op before the component is loaded.
(require as unknown as { extensions: Record<string, () => void> }).extensions['.css'] = () => undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ItemSlot = (require('../../src/components/game/ItemSlot') as typeof import('../../src/components/game/ItemSlot')).default;

const h = React.createElement;
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const sword: ItemInstance = { base: 'wooden_sword', level: 1, rarity: 'common', quality: 50, affixes: [] };

test('an item frame sits in the design system hover host and no longer draws the old px-tooltip', () => {
	const out = html(h(ItemSlot, { item: sword }));
	assert.match(out, /class="ds-hovertip"/);
	assert.match(out, /class="inv-slot"/);
	assert.match(out, /data-filled="true"/);
	assert.doesNotMatch(out, /px-tooltip|data-floating-tip/);
});

test('a stack shows its count above one, a single potion does not', () => {
	assert.match(html(h(ItemSlot, { itemId: 'potion_minor', qty: 7 })), /class="inv-qty"[^>]*>7</);
	assert.doesNotMatch(html(h(ItemSlot, { itemId: 'potion_minor', qty: 1 })), /inv-qty/);
});

test('an unknown or empty item is a bare frame with no hover host', () => {
	for (const props of [{}, { itemId: 'no_such_item' }]) {
		const out = html(h(ItemSlot, props));
		assert.match(out, /data-filled="false"/);
		assert.doesNotMatch(out, /ds-hovertip/);
	}
});
