import type { Equipment, EquipmentSlot, ItemDef } from '@/types/game';
import { ITEMS } from './items';
import { TRADE_GOODS } from './recipes';
import { SET_DEFS, type SetDef } from './sets';
import { sumStats, type ItemStats, type StatTotals } from './stats';

// The one catalog the game reads: items, sets, rarities, stats and resources, plus the equipment layout and the starter kit.
export { ITEMS } from './items';
export * from './rarity';
export * from './resources';
export * from './stats';
export * from './weapons';
export * from './loot';
export * from './affixes';
export * from './lootConfig';
export * from './monsters';
export * from './resourceArt';
export type { SetDef } from './sets';

// No prototype: `ITEM_CATALOG['constructor']` must be undefined, or a forged save could name an item that is not one
export const ITEM_CATALOG: Record<string, ItemDef> = Object.assign(
	Object.create(null) as Record<string, ItemDef>,
	Object.fromEntries([...ITEMS, ...TRADE_GOODS].map((item) => [item.id, item])),
);

export interface ArmourSet extends SetDef {
	/** Slots a full set fills (both rings count, so 12 items fill 13 slots) */
	size: number;
	pieces: string[];
}

export const SETS: Record<string, ArmourSet> = Object.assign(
	Object.create(null) as Record<string, ArmourSet>,
	Object.fromEntries(
		SET_DEFS.map((def) => {
			const pieces = ITEMS.filter((item) => item.set === def.id);
			const size = pieces.reduce((sum, item) => sum + (item.slot === 'ring' ? 2 : 1), 0);
			return [def.id, { ...def, pieces: pieces.map((item) => item.id), size }];
		}),
	),
);

/** Every piece of a set, or of a plain loot family (wood, cloth, steel) that has no set bonus. */
export const familyPieces = (id: string): string[] => ITEMS.filter((item) => item.set === id || item.family === id).map((item) => item.id);

/** How many pieces of each set are worn (both rings count). */
export const setCounts = (equipment: Equipment): Record<string, number> => {
	const counts: Record<string, number> = {};
	for (const item of Object.values(equipment)) {
		const set = item ? ITEM_CATALOG[item.base]?.set : undefined;
		if (set && SETS[set]) counts[set] = (counts[set] ?? 0) + 1;
	}
	return counts;
};

/** Extra stats a set gives for the number of pieces worn: every threshold reached counts. */
export const setBonusStats = (counts: Record<string, number>): StatTotals => {
	const blocks: ItemStats[] = [];
	for (const [setId, count] of Object.entries(counts)) {
		for (const [threshold, bonus] of Object.entries(SETS[setId].bonuses)) if (count >= Number(threshold)) blocks.push(bonus);
	}
	return sumStats(...blocks);
};

/** What a new character wears: the base items worn at their authored level (see `STARTER_EQUIPMENT` in config/itemCatalog for the instances). */
export const STARTER_EQUIPMENT_IDS: Partial<Record<EquipmentSlot, string>> = { mainHand: 'wooden_sword', offHand: 'wooden_shield' };

/**
 * What each class starts with, so the first gear fits the hero: the Warrior and the Paladin wear the sword and shield, the Ranger a bow and the Mage a staff (no off-hand: a
 * bow and a staff take both hands). Their damage per second matches the sword's, so no class starts stronger; a Ranger or a Mage gives up the shield's 2 armor. Used by a new game,
 * "A new chapter" and a rebirth (`starterEquipmentFor`).
 *
 * @category Progression/Class passives
 * @order 3
 */
export const STARTER_EQUIPMENT_BY_CLASS: Record<'warrior' | 'paladin' | 'ranger' | 'mage', Partial<Record<EquipmentSlot, string>>> = {
	warrior: STARTER_EQUIPMENT_IDS,
	paladin: STARTER_EQUIPMENT_IDS,
	ranger: { mainHand: 'wooden_bow' },
	mage: { mainHand: 'wooden_staff' },
};
export const STARTER_BAG_ITEMS = [{ id: 'potion_minor', qty: 2 }];

export const EQUIPMENT_LAYOUT: {
	left: EquipmentSlot[];
	right: EquipmentSlot[];
	bottom: EquipmentSlot[];
} = {
	left: ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet'],
	right: ['neck', 'cape', 'ring1', 'ring2', 'charm', 'belt'],
	bottom: ['mainHand', 'offHand'],
};

export const EQUIPMENT_SLOT_LABEL: Record<EquipmentSlot, string> = {
	head: 'Head',
	shoulder: 'Shoulders',
	chest: 'Chest',
	hands: 'Hands',
	legs: 'Legs',
	feet: 'Feet',
	neck: 'Neck',
	cape: 'Cape',
	ring1: 'Ring',
	ring2: 'Ring',
	charm: 'Charm',
	belt: 'Belt',
	mainHand: 'Main Hand',
	offHand: 'Off Hand',
};
