import type { ItemDef } from '@/types/game';

/**
 * The type line of an item with no gear slot in its tooltip: `Junk` (a junk material, sold to the merchant), `Consumable` (it does something when used: heals, regen, buffs) or `Crafting material` (a trade good with neither).
 * Pure; the item tooltips and the hero window's tooltip share it.
 */
export const slotlessItemLabel = (def: Pick<ItemDef, 'junk' | 'effects'>): 'Junk' | 'Consumable' | 'Crafting material' =>
	def.junk ? 'Junk' : def.effects?.length ? 'Consumable' : 'Crafting material';
