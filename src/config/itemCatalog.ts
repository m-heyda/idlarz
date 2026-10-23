import type { PixelIconName } from '@/config/pixelIcons';
import type { Equipment, EquipmentRarity, EquipmentSlot, ItemDef, ItemStats } from '@/types/game';

// Every item in the game. Saves store item ids only (see sanitizeSave), so stats here are the single source of truth.

const SELL_VALUE: Record<EquipmentRarity, number> = {
	common: 5,
	uncommon: 60,
	rare: 150,
	epic: 400,
	legendary: 1000,
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

export const ITEM_CATALOG: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((item) => [item.id, item]));

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
