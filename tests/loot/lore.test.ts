import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../../src/catalog';
import { ITEMS } from '../../src/catalog/items';
import { LEGENDARY_LORE } from '../../src/catalog/items/lore';

// IDL-317: every legendary weapon (the 3 live and the 11 in reserve) has a story, and nothing else does.

test('every legendary weapon has lore, and only they do', () => {
	const legendaries = ITEMS.filter((i) => i.pools?.includes('legendary_weapons'));
	assert.equal(legendaries.length, 14);
	for (const item of legendaries) assert.ok((ITEM_CATALOG[item.id].lore ?? '').length > 40, `${item.id} has lore`);
	for (const id of Object.keys(LEGENDARY_LORE))
		assert.ok(
			legendaries.some((i) => i.id === id),
			`${id} is a legendary`,
		);
	assert.ok(ITEMS.filter((i) => i.lore).length === 14);
});
