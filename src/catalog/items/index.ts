import type { ItemDef } from '@/types/game';
import { CLOTH_ITEMS } from './cloth';
import { CONSUMABLES } from './consumables';
import { LEGENDARY_ITEMS } from './legendary';
import { OBSIDIAN_ITEMS } from './obsidian';
import { RATTATUI_ITEMS } from './rattatui';
import { WOODEN_ITEMS } from './starter';
import { STEEL_ITEMS } from './steel';

/** Every item in the game, in display order. Add a family by adding its file here. */
export const ITEMS: ItemDef[] = [
	...WOODEN_ITEMS,
	...CONSUMABLES,
	...CLOTH_ITEMS,
	...STEEL_ITEMS,
	...OBSIDIAN_ITEMS,
	...RATTATUI_ITEMS,
	...LEGENDARY_ITEMS,
];
