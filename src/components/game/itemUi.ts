import { EQUIPMENT_PIXEL_ICONS, type PixelIconName } from '@/config/pixelIcons';
import type { EquipmentRarity, ItemDef } from '@/types/game';

export const RARITY_COLOR: Record<EquipmentRarity, string> = {
	common: '#c8c8c8',
	uncommon: '#4ade80',
	rare: '#60a5fa',
	epic: '#c084fc',
	legendary: '#fb923c',
};

/** The sprite of an item: its own icon, else the silhouette of its slot (potions use food until they get art). */
export const itemIconName = (def: ItemDef): PixelIconName =>
	def.icon ?? (def.consumable ? 'food' : EQUIPMENT_PIXEL_ICONS[def.slot === 'ring' ? 'ring1' : (def.slot as string)]);
