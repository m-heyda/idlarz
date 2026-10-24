import type { PixelIconName } from '@/config/pixelIcons';
import type { Equipment, EquipmentRarity, EquipmentSlot, ItemDef, ItemStats } from '@/types/game';

// Every item in the game. Saves store item ids only (see sanitizeSave), so stats here are the single source of truth.

// Flat gold the merchant pays for an item. Deliberately not tied to income: the shop sells gear at several times
// these prices, so buying and selling the same item can never print gold (tests/economy.test.ts sweeps this).
const SELL_VALUE: Record<EquipmentRarity, number> = {
	common: 8,
	uncommon: 90,
	rare: 250,
	epic: 700,
	legendary: 2000,
};

const gear = (
	id: string,
	name: string,
	slot: ItemDef['slot'],
	rarity: EquipmentRarity,
	stats: ItemStats,
	extra: Partial<ItemDef> = {}
): ItemDef => ({ id, name, slot, rarity, stats, sellValue: SELL_VALUE[rarity], ...extra });

const rattatui = (
	suffix: string,
	name: string,
	slot: ItemDef['slot'],
	rarity: EquipmentRarity,
	stats: ItemStats,
	description: string
): ItemDef =>
	gear(`rattatui_${suffix}`, `Rattatui ${name}`, slot, rarity, stats, {
		set: 'rattatui',
		description,
		icon: `item_rattatui_${suffix}` as PixelIconName,
	});

const ITEMS: ItemDef[] = [
	gear('wooden_sword', 'Wooden Sword', 'mainHand', 'common', { damage: 2 }, { description: 'A simple training sword.', icon: 'item_wooden_sword' }),
	gear('wooden_shield', 'Wooden Shield', 'offHand', 'common', { armor: 2 }, { description: 'Simple defensive gear.', icon: 'item_wooden_shield' }),
	{
		id: 'potion_minor',
		name: 'Minor Healing Potion',
		rarity: 'common',
		consumable: { healHp: 35 },
		stackMax: 20,
		sellValue: 20,
		icon: 'item_potion_hp',
		description: 'Restores 35 health. Can be drunk in the middle of a fight.',
	},
	gear('leather_cap', 'Leather Cap', 'head', 'common', { armor: 1, maxHp: 2 }, { description: 'Boiled leather. Better than nothing on your head.' }),
	gear('leather_vest', 'Leather Vest', 'chest', 'common', { armor: 2, maxHp: 4 }, { description: 'Stiff, creaky and surprisingly warm.' }),
	gear('leather_gloves', 'Leather Gloves', 'hands', 'common', { armor: 1, maxHp: 1 }, { description: 'Keeps the splinters out.' }),
	gear('leather_boots', 'Leather Boots', 'feet', 'common', { armor: 1, maxHp: 2 }, { description: 'Made for walking the whole realm.' }),
	gear('iron_sword', 'Iron Sword', 'mainHand', 'uncommon', { damage: 3 }, { description: 'A plain blade that holds an edge.' }),
	rattatui('cap', 'Cap', 'head', 'uncommon', { armor: 3, maxHp: 4 }, 'Stitched from the fur of a very brave rat.'),
	rattatui('shoulderpads', 'Shoulderpads', 'shoulder', 'uncommon', { armor: 3, maxHp: 3 }, 'Surprisingly bite-proof.'),
	rattatui('tunic', 'Tunic', 'chest', 'rare', { armor: 6, maxHp: 8 }, 'Beta testers wear it with pride.'),
	rattatui('gloves', 'Gloves', 'hands', 'uncommon', { armor: 2, maxHp: 2 }, 'Good for gripping cheese.'),
	rattatui('trousers', 'Trousers', 'legs', 'uncommon', { armor: 4, maxHp: 5 }, 'Tailored by a rat tailor.'),
	rattatui('boots', 'Boots', 'feet', 'uncommon', { armor: 2, maxHp: 3 }, 'Quiet on stone floors.'),
	rattatui('amulet', 'Amulet', 'neck', 'rare', { maxHp: 8 }, 'A gnawed coin on a string.'),
	rattatui('cloak', 'Cloak', 'cape', 'uncommon', { armor: 2, maxHp: 3 }, 'Smells faintly of sewer.'),
	rattatui('ring', 'Ring', 'ring', 'rare', { maxHp: 5 }, 'Fits either hand.'),
	rattatui('charm', 'Charm', 'charm', 'epic', { armor: 2, maxHp: 10 }, 'A lucky whisker in a glass bead.'),
	rattatui('fang_blade', 'Fang Blade', 'mainHand', 'rare', { damage: 3 }, 'A rat fang, polished and sharp.'),
	rattatui('buckler', 'Buckler', 'offHand', 'rare', { armor: 5, maxHp: 4 }, 'A cheese-wheel shield with a metal rim.'),
];

// No prototype: `ITEM_CATALOG['constructor']` must be undefined, or a forged save could name an item that is not one
export const ITEM_CATALOG: Record<string, ItemDef> = Object.assign(
	Object.create(null) as Record<string, ItemDef>,
	Object.fromEntries(ITEMS.map((item) => [item.id, item]))
);

/** Beta-tester set: one piece per slot (the ring fits both ring slots, so 12 items fill 13 slots). */
export const RATTATUI_SET = {
	id: 'rattatui',
	label: 'Rattatui Set',
	size: 13,
	pieces: ITEMS.filter((item) => item.set === 'rattatui').map((item) => item.id),
	// extra stats once this many pieces are equipped (both rings count)
	bonuses: {
		6: { maxHp: 10 },
		13: { maxHp: 15 },
	} as Record<number, ItemStats>,
};

/** Plain gear: what rats drop, what chests hold and what the merchant sells. The Rattatui set is NOT here: it drops only from the Rat King. */
export const BASIC_GEAR = ['wooden_sword', 'wooden_shield', 'leather_cap', 'leather_vest', 'leather_gloves', 'leather_boots'] as const;

export const STARTER_EQUIPMENT: Equipment = { mainHand: 'wooden_sword', offHand: 'wooden_shield' };
export const STARTER_BAG_ITEMS = [{ id: 'potion_minor', qty: 2 }];

export const EQUIPMENT_LAYOUT: {
	left: EquipmentSlot[];
	right: EquipmentSlot[];
	bottom: EquipmentSlot[];
} = {
	left: ['head', 'shoulder', 'chest', 'hands', 'legs', 'feet'],
	right: ['neck', 'cape', 'ring1', 'ring2', 'charm'],
	bottom: ['mainHand', 'offHand'],
};

export const EQUIPMENT_SLOT_LABEL: Record<EquipmentSlot, string> = {
	head: 'Head',
	shoulder: 'Shoulder',
	chest: 'Chest',
	hands: 'Hands',
	legs: 'Legs',
	feet: 'Feet',
	neck: 'Neck',
	cape: 'Cape',
	ring1: 'Ring',
	ring2: 'Ring',
	charm: 'Charm',
	mainHand: 'Weapon',
	offHand: 'Shield',
};
