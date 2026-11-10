import type { ItemDef } from '@/types/game';
import { baseStat } from '../stats';
import { gear } from './define';

// Wood and leather: what you start with and what rats and chests hand out most. Every piece has an `item_<id>` icon
// from scripts/pixel/sprites_gear.py (the wooden sword and shield keep their original sprites).
const wood = { tier: 1, family: 'woodland', art: true } as const;

export const WOODEN_ITEMS: ItemDef[] = [
	gear(
		'wooden_sword',
		'Wooden Sword',
		'mainHand',
		'common',
		{ damage: 6 },
		{ tier: 1, weaponType: 'sword', icon: 'item_wooden_sword', description: 'A simple training sword.' },
	),
	// The class starter weapons: a Ranger starts with a bow and a Mage with a staff instead of the sword and shield (`STARTER_EQUIPMENT_BY_CLASS`). They match the sword's damage per second
	// (sword 6 x 1.2 = 7.2; bow 7 x 1.0; staff 8 x 0.9 = 7.2) and wear the picture of the hunting bow and the oak staff (`LADDER_ALIAS` in scripts/pixel/sprites_gear.py). Retired like the sword: never dropped, but owned and worn pieces load.
	gear(
		'wooden_bow',
		'Wooden Bow',
		'mainHand',
		'common',
		{ damage: 7 },
		{ tier: 1, weaponType: 'bow', icon: 'item_wooden_bow', description: 'A simple training bow. A good first shot is half the hunt.' },
	),
	gear(
		'wooden_staff',
		'Wooden Staff',
		'mainHand',
		'common',
		{ damage: 8 },
		{ tier: 1, weaponType: 'staff', icon: 'item_wooden_staff', description: 'A plain staff for a first spell. It still hums, a little.' },
	),
	gear(
		'wooden_club',
		'Wooden Club',
		'mainHand',
		'common',
		{ damage: 9 },
		{ tier: 1, weaponType: 'mace', art: true, description: 'Heavy, simple and good for knocking.' },
	),
	gear(
		'hunting_bow',
		'Hunting Bow',
		'mainHand',
		'common',
		{ damage: 8, critChance: 6 },
		{ tier: 1, weaponType: 'bow', art: true, description: 'Springy yew. Aims for the weak spot.' },
	),
	gear(
		'wooden_shield',
		'Wooden Shield',
		'offHand',
		'common',
		{ armor: 2 },
		{ ...wood, art: false, weaponType: 'shield', icon: 'item_wooden_shield', description: 'Simple defensive gear.' },
	),
	gear('leather_cap', 'Leather Cap', 'head', 'common', { armor: 1, maxHp: 2 }, { ...wood, description: 'Boiled leather. Better than nothing on your head.' }),
	gear('leather_pauldrons', 'Leather Shoulderpads', 'shoulder', 'common', { armor: 1, maxHp: 2 }, { ...wood, description: 'Layered hide over the shoulders.' }),
	gear('leather_vest', 'Leather Vest', 'chest', 'common', { armor: 2, maxHp: 4 }, { ...wood, description: 'Stiff, creaky and surprisingly warm.' }),
	gear('leather_gloves', 'Leather Gloves', 'hands', 'common', { armor: 1, maxHp: 1 }, { ...wood, description: 'Keeps the splinters out.' }),
	gear('leather_leggings', 'Leather Leggings', 'legs', 'common', { armor: 2, maxHp: 3 }, { ...wood, description: 'Patched at the knees.' }),
	gear('leather_boots', 'Leather Boots', 'feet', 'common', { armor: 1, maxHp: 2 }, { ...wood, description: 'Made for walking the whole realm.' }),
	gear(
		'wooden_pendant',
		'Wooden Pendant',
		'neck',
		'common',
		{ maxHp: 3, goldFind: baseStat('goldFind', 1) },
		{ ...wood, description: 'A carved disc with a green bead.' },
	),
	gear(
		'leather_cloak',
		'Leather Cloak',
		'cape',
		'common',
		{ armor: 1, maxHp: 2, dodge: baseStat('dodge', 1) },
		{ ...wood, description: 'Keeps off the rain, mostly.' },
	),
	gear('wooden_ring', 'Wooden Ring', 'ring', 'common', { maxHp: 2 }, { ...wood, description: 'Whittled from a branch. Fits either hand.' }),
	gear('acorn_charm', 'Acorn Charm', 'charm', 'common', { maxHp: 3, luck: 1 }, { ...wood, description: 'Mighty oaks, little acorns.' }),
];
