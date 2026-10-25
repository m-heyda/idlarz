import { EQUIPMENT_PIXEL_ICONS, type PixelIconName } from '@/config/pixelIcons';
import { RARITIES } from '@/catalog/rarity';
import type { EquipmentRarity, ItemDef } from '@/types/game';

/** Rarity colours come from the catalog (catalog/rarity.ts); kept here as a lookup the item UI imports. */
export const RARITY_COLOR = Object.fromEntries(Object.values(RARITIES).map((r) => [r.id, r.color])) as Record<EquipmentRarity, string>;

/** The sprite of an item: its own icon, else the silhouette of its slot (potions use food until they get art). */
export const itemIconName = (def: ItemDef): PixelIconName =>
	def.icon ?? (def.consumable ? 'food' : EQUIPMENT_PIXEL_ICONS[def.slot === 'ring' ? 'ring1' : (def.slot as string)]);
