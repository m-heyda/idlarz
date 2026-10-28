// Writes docs/generated/item-catalog.md: the sets, their items and the drop pools, straight from src/catalog (never edit that file by hand).
//   npm run catalog-report
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderItemCatalog } from './catalogDoc';

writeFileSync(resolve(__dirname, '..', 'docs', 'generated', 'item-catalog.md'), renderItemCatalog());
console.log('wrote docs/generated/item-catalog.md');
