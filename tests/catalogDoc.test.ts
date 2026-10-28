import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderItemCatalog } from '../scripts/catalogDoc';

// docs/generated/item-catalog.md is produced from src/catalog by `npm run catalog-report`; this keeps the committed file honest.
test('the generated item catalog doc matches the catalog (run npm run catalog-report after changing items or sets)', () => {
	const committed = readFileSync(resolve(process.cwd(), 'docs', 'generated', 'item-catalog.md'), 'utf8').replace(/\r\n/g, '\n');
	assert.equal(committed, renderItemCatalog());
});

test('the generated catalog lists the two sets with every threshold and no plain loot family as a set', () => {
	const doc = renderItemCatalog();
	assert.match(doc, /### Obsidian Set/);
	assert.match(doc, /### Rattatui Set/);
	assert.doesNotMatch(doc, /### (Woodland|Apprentice|Knight)/);
	assert.match(doc, /\| 12 \|/);
	assert.match(doc, /\| 13 \|/);
});
