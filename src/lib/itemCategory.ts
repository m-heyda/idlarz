import { monsterChestTierOf } from '@/catalog/items/chests';
import type { ItemDef } from '@/types/game';

/**
 * The type line of an item with no gear slot in its tooltip: `Junk` (a junk material, sold to the merchant), `Chest` (a monster chest, opened from the bag, IDL-163), `Consumable` (it does something when used: heals, regen, buffs) or `Crafting material` (a trade good with neither).
 * Pure; the item tooltips and the hero window's tooltip share it.
 */
export const slotlessItemLabel = (def: Pick<ItemDef, 'junk' | 'effects'> & { id?: string }): 'Junk' | 'Chest' | 'Consumable' | 'Crafting material' =>
	def.junk ? 'Junk' : monsterChestTierOf(def.id) ? 'Chest' : def.effects?.length ? 'Consumable' : 'Crafting material';
