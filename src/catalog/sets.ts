import type { ItemStats } from './stats';

/**
 * Armour sets. A set's pieces are the items whose `set` field names it (see catalog/index.ts), so adding a piece to a
 * set is done on the item. `bonuses` maps "pieces worn" to the extra stats that count gives (every threshold reached
 * applies); both rings count, so a full set of 11 items fills 12 slots (Rattatui: 12 items, 13 slots).
 */
export interface SetDef {
	id: string;
	label: string;
	bonuses: Record<number, ItemStats>;
}

export const SET_DEFS: SetDef[] = [
	{
		id: 'woodland',
		label: 'Woodland Set',
		bonuses: { 3: { maxHp: 4 }, 6: { armor: 2 }, 12: { maxHp: 8, regen: 0.5 } },
	},
	{
		id: 'apprentice',
		label: 'Apprentice Set',
		bonuses: { 3: { luck: 2 }, 6: { regen: 0.5 }, 12: { critChance: 2, regen: 0.5, luck: 2 } },
	},
	{
		id: 'knight',
		label: "Knight's Set",
		bonuses: { 3: { armor: 3 }, 6: { maxHp: 8 }, 12: { armor: 4, damage: 1 } },
	},
	{
		id: 'obsidian',
		label: 'Obsidian Set',
		bonuses: { 3: { critChance: 2 }, 6: { damage: 1, critChance: 2 }, 12: { superCrit: 3, armor: 5, maxHp: 10 } },
	},
	{
		id: 'rattatui',
		label: 'Rattatui Set',
		bonuses: { 3: { armor: 3 }, 6: { damage: 1, critChance: 4, maxHp: 15 }, 13: { damage: 1, superCrit: 6, regen: 1, maxHp: 25 } },
	},
];
