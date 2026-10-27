import type { PixelIconName } from '@/config/pixelIcons';
import type { DropRule, DropSource, EquipmentRarity, EquipmentSlot, ItemDef, ItemKind, WeaponType } from '@/types/game';
import { DEFAULT_ITEM_LEVEL, type ItemStats } from '../stats';
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

/** Where gear of a rarity drops by default: rats give out the common stuff, higher tiers need an older rat, chests are kinder. */
export const dropsFor = (rarity: EquipmentRarity): Partial<Record<DropSource, DropRule>> => {
	switch (rarity) {
		case 'common':
			return { rat: { weight: 10 }, chest: { weight: 10 } };
		case 'uncommon':
			return { rat: { weight: 4, minTier: 3 }, chest: { weight: 5 } };
		case 'rare':
			return { rat: { weight: 1.2, minTier: 5 }, chest: { weight: 2 } };
		case 'legendary':
			return { chest: { weight: 3 }, ratKing: { weight: 1 } };
		default:
			return {}; // epic: the Rattatui set gives its own (Rat King only)
	}
};

export interface GearOptions {
	tier: number;
	set?: string;
	description?: string;
	weaponType?: WeaponType;
	/** Icon name; by default `item_<id>` when `art` is set. Omit both to fall back to the slot silhouette. */
	icon?: PixelIconName;
	art?: boolean;
	/** Overrides the default drops of the rarity (`{}` = does not drop) */
	drops?: Partial<Record<DropSource, DropRule>>;
	shop?: number;
	sellValue?: number;
	/** Attacks per second of a weapon; by default its weapon type's (see catalog/weapons.ts) */
	attackSpeed?: number;
	itemLevel?: number;
}

export const gear = (
	id: string,
	name: string,
	slot: NonNullable<ItemDef['slot']>,
	rarity: EquipmentRarity,
	stats: ItemStats,
	{ tier, art, icon, sellValue, drops, itemLevel, attackSpeed, ...rest }: GearOptions
): ItemDef => ({
	id,
	name,
	kind: KIND_OF_SLOT[slot],
	slot,
	rarity,
	tier,
	itemLevel: itemLevel ?? DEFAULT_ITEM_LEVEL,
	...(KIND_OF_SLOT[slot] === 'weapon' ? { attackSpeed: attackSpeed ?? (rest.weaponType && WEAPON_ATTACK_SPEED[rest.weaponType]) ?? 1 } : {}),
	stats,
	sellValue: sellValue ?? RARITIES[rarity].sellValue,
	drops: drops ?? dropsFor(rarity),
	...(icon ? { icon } : art ? { icon: `item_${id}` as PixelIconName } : {}),
	...rest,
});
