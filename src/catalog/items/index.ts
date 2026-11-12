import type { ItemDef } from '@/types/game';
import { CLOTH_ITEMS } from './cloth';
import { CONSUMABLES } from './consumables';
import { LADDER_ITEMS, gradeLegacyItems } from './ladder';
import { JUNK_ITEMS } from './junk';
import { LEGENDARY_LORE } from './lore';
import { LEGENDARY_ITEMS } from './legendary';
import { OBSIDIAN_ITEMS } from './obsidian';
import { RESERVE_ITEMS } from './reuse';
import { WOODEN_ITEMS } from './starter';
import { STEEL_ITEMS } from './steel';

/** Fills `lore` from `lore.ts` (the legendaries' stories) so the item definitions stay as they are. */
function withLore(items: ItemDef[]): ItemDef[] {
	// in place, so the lists the families export and the catalog share the same objects
	for (const item of items) if (LEGENDARY_LORE[item.id]) item.lore = LEGENDARY_LORE[item.id];
	return items;
}

/** Every item in the game, in display order. Add a family by adding its file here. */
export const ITEMS: ItemDef[] = withLore([
	// the legacy families, put on the grade ladder or retired (IDL-243, ladder.ts `gradeLegacyItems`)
	...gradeLegacyItems(WOODEN_ITEMS),
	...CONSUMABLES,
	...JUNK_ITEMS,
	...gradeLegacyItems(CLOTH_ITEMS),
	...gradeLegacyItems(STEEL_ITEMS),
	...gradeLegacyItems(OBSIDIAN_ITEMS),
	...LEGENDARY_ITEMS,
	// disabled: art and stats are ready, nothing drops them yet (catalog/items/reuse.ts)
	...RESERVE_ITEMS,
	// disabled: the grade ladder G1-G9 and the special sets S1-S3, placeholder numbers (catalog/items/ladder.ts)
	...LADDER_ITEMS,
]);
