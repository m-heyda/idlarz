import type { PixelIconName } from '@/config/pixelIcons';
import type { EquipmentRarity, EquipmentSlot, ItemDef, ItemKind, WeaponType } from '@/types/game';
import { MAX_ITEM_LEVEL, type ItemStats } from '../stats';
import { RARITIES } from '../rarity';
import { WEAPON_ATTACK_SPEED } from '../weapons';

// Builders shared by the item files. They fill in what is derivable (kind, sell value, icon name, default drops) so an
// item definition only says what is special about it.

const KIND_OF_SLOT: Record<EquipmentSlot | 'ring', ItemKind> = {
	mainHand: 'weapon',
	offHand: 'offhand',
	head: 'armor',
	shoulder: 'armor',
	chest: 'armor',
	hands: 'armor',
	legs: 'armor',
	feet: 'armor',
	neck: 'accessory',
	cape: 'accessory',
	ring: 'accessory',
	ring1: 'accessory',
	ring2: 'accessory',
	charm: 'accessory',
};

/**
 * The item level window of a material tier. Gear is authored at the window's start (`minItemLevel`) and stronger at higher
 * levels (catalog/stats `levelScale`). Wood and cloth stop dropping once the game is past them; the rest scale to the cap.
 * Rat tier 1-5 are source levels 1,3,5,7,9, the Rat King 12 (see catalog/lootConfig), so the old "steel from tier 3,
 * obsidian from tier 5" gating survives as these windows.
 */
const LEVEL_WINDOW_BY_TIER: Record<number, readonly [number, number]> = {
	1: [1, 20],
	2: [4, 50],
	3: [8, MAX_ITEM_LEVEL],
	4: [10, MAX_ITEM_LEVEL],
	5: [3, MAX_ITEM_LEVEL],
};

/** What affixes and pools match an item by: its category, slot, weapon type and set (or plain family). */
const tagsFor = (kind: ItemKind, slot: string, weaponType: WeaponType | undefined, set: string | undefined, named: boolean): string[] => [
	'gear',
	kind,
	slot.toLowerCase(),
	...(weaponType ? [weaponType] : []),
	...(set ? [set] : []),
	...(named ? ['named'] : []),
];

export interface GearOptions {
	/** A named item: fixed identity and rarity (always the `rarity` argument), dropped from its `pools` instead of the general pool */
	named?: boolean;
	/** Named items: pool ids they belong to */
	pools?: string[];
	tier: number;
	set?: string;
	/** A plain loot family with no set bonus (see ItemDef.family) */
	family?: string;
	description?: string;
	weaponType?: WeaponType;
	/** Icon name; by default `item_<id>` when `art` is set. Omit both to fall back to the slot silhouette. */
	icon?: PixelIconName;
	art?: boolean;
	shop?: number;
	sellValue?: number;
	/** Attacks per second of a weapon; by default its weapon type's (see catalog/weapons.ts) */
	attackSpeed?: number;
}

export const gear = (
	id: string,
	name: string,
	slot: NonNullable<ItemDef['slot']>,
	rarity: EquipmentRarity,
	stats: ItemStats,
	{ tier, art, icon, sellValue, attackSpeed, named = false, pools, ...rest }: GearOptions
): ItemDef => ({
	id,
	name,
	kind: KIND_OF_SLOT[slot],
	slot,
	rarity,
	tier,
	generation: named ? 'named' : 'base',
	tags: tagsFor(KIND_OF_SLOT[slot], slot, rest.weaponType, rest.set ?? rest.family, named),
	minItemLevel: LEVEL_WINDOW_BY_TIER[tier][0],
	maxItemLevel: LEVEL_WINDOW_BY_TIER[tier][1],
	...(named ? { fixedRarity: rarity, pools: pools ?? [] } : { allowedRarities: Object.keys(RARITIES) }),
	poolWeight: named ? 1 : 10,
	...(KIND_OF_SLOT[slot] === 'weapon' ? { attackSpeed: attackSpeed ?? (rest.weaponType && WEAPON_ATTACK_SPEED[rest.weaponType]) ?? 1 } : {}),
	stats,
	sellValue: sellValue ?? RARITIES[rarity].sellValue,
	...(icon ? { icon } : art ? { icon: `item_${id}` as PixelIconName } : {}),
	...rest,
});
