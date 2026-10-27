import type { ItemDef } from '@/types/game';
import { DEFAULT_ITEM_LEVEL } from '../stats';

// Potions. On a rat kill a potion drops from the `rat` pool (heavier tiers unlock the better one); the Rat King always
// drops `qty` of each potion that lists him. The first three potion stacks in the bag get the fight hotkeys 1-3.
export const CONSUMABLES: ItemDef[] = [
	{
		id: 'potion_minor',
		name: 'Minor Healing Potion',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		itemLevel: DEFAULT_ITEM_LEVEL,
		consumable: { healHp: 35 },
		stackMax: 20,
		sellValue: 20,
		icon: 'item_potion_hp',
		description: 'Restores 35 health. Can be drunk in the middle of a fight.',
		drops: { rat: { weight: 4 }, ratKing: { weight: 1, qty: 2 }, chest: { weight: 60 } },
		shop: 80,
	},
	{
		id: 'potion_greater',
		name: 'Greater Healing Potion',
		kind: 'consumable',
		rarity: 'uncommon',
		tier: 0,
		itemLevel: DEFAULT_ITEM_LEVEL,
		consumable: { healHp: 90 },
		stackMax: 20,
		sellValue: 90,
		icon: 'item_potion_greater',
		description: 'Restores 90 health. Can be drunk in the middle of a fight.',
		drops: { rat: { weight: 1, minTier: 4 }, ratKing: { weight: 1, qty: 1 }, chest: { weight: 25 } },
		shop: 360,
	},
];
