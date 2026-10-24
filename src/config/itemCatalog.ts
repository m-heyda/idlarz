// The item catalog lives in src/catalog (items, sets, rarities, stats, resources, loot pools). This file keeps the
// long-standing import path working and derives the few legacy views the rest of the game and the tests use.
import { SETS, lootPool, isGear } from '@/catalog';

export * from '@/catalog';

/** Beta-tester set (alias of the registry entry). */
export const RATTATUI_SET = SETS.rattatui;

/** Plain gear: what rats drop, what chests hold and what the merchant sells. The Rattatui set is NOT here: it drops only from the Rat King. */
export const BASIC_GEAR: readonly string[] = lootPool('rat', 1, isGear).map((entry) => entry.id);
