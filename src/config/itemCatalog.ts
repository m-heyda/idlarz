// The item catalog lives in src/catalog (items, sets, rarities, stats, resources, loot config). This file only derives the
// few views of it the rest of the game and the tests use.
import { STARTER_EQUIPMENT_BY_CLASS, STARTER_EQUIPMENT_IDS } from '@/catalog';
import { LOOT_DATA } from '@/lib/loot/data';
import { eligibleCandidates } from '@/lib/loot/pools';
import { plainItem } from '@/lib/itemInstance';
import type { Equipment, EquipmentSlot } from '@/types/game';

/** What a new character wears. */
export const STARTER_EQUIPMENT: Equipment = Object.fromEntries(
	Object.entries(STARTER_EQUIPMENT_IDS).map(([slot, id]) => [slot as EquipmentSlot, plainItem(id as string)]),
);

/** What a new character of this class wears (the sword and shield, a bow or a staff, see `STARTER_EQUIPMENT_BY_CLASS`); anything else gets the default kit. */
export const starterEquipmentFor = (playerClass: string | undefined): Equipment => {
	const ids =
		playerClass !== undefined && Object.hasOwn(STARTER_EQUIPMENT_BY_CLASS, playerClass)
			? STARTER_EQUIPMENT_BY_CLASS[playerClass as keyof typeof STARTER_EQUIPMENT_BY_CLASS]
			: STARTER_EQUIPMENT_IDS;
	return Object.fromEntries(Object.entries(ids).map(([slot, id]) => [slot as EquipmentSlot, plainItem(id as string)]));
};

/** Plain gear a level-1 source (a fresh rat or chest) can drop: the bases whose window includes item level 1. */
export const BASIC_GEAR: readonly string[] = eligibleCandidates(LOOT_DATA, 'general_equipment', 1).map((c) => c.def.id);
