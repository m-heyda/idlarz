// The item catalog lives in src/catalog (items, sets, rarities, stats, resources, loot config). This file keeps the
// long-standing import path working and derives the few views the rest of the game and the tests use.
import { SETS, STARTER_EQUIPMENT_IDS } from '@/catalog';
import { LOOT_DATA } from '@/lib/loot/data';
import { eligibleCandidates } from '@/lib/loot/pools';
import { plainItem } from '@/lib/itemInstance';
import type { Equipment, EquipmentSlot } from '@/types/game';

export * from '@/catalog';

/** Beta-tester set (alias of the registry entry). */
export const RATTATUI_SET = SETS.rattatui;

/** What a new character wears. */
export const STARTER_EQUIPMENT: Equipment = Object.fromEntries(
	Object.entries(STARTER_EQUIPMENT_IDS).map(([slot, id]) => [slot as EquipmentSlot, plainItem(id as string)])
);

/** Plain gear a level-1 source (a fresh rat or chest) can drop: the bases whose window includes item level 1. The Rattatui set is NOT here: it drops only from the Rat King. */
export const BASIC_GEAR: readonly string[] = eligibleCandidates(LOOT_DATA, 'general_equipment', 1).map((c) => c.def.id);
