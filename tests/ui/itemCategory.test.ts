import test from 'node:test';
import assert from 'node:assert/strict';
import { slotlessItemLabel } from '../../src/lib/itemCategory';
import { ITEM_CATALOG } from '../../src/catalog';

test('a slotless item is Junk, a Consumable (it has effects) or a Crafting material', () => {
	assert.equal(slotlessItemLabel(ITEM_CATALOG['junk_bones']), 'Junk');
	assert.equal(slotlessItemLabel({ effects: [{ kind: 'heal', amount: 10 }] as never }), 'Consumable');
	assert.equal(slotlessItemLabel({}), 'Crafting material');
});
