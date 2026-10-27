import type { ItemDef } from '@/types/game';

// Potions. Where and how often they drop is loot config (catalog/lootConfig: the potions_* pools and the profiles' bonus
// tables). The first three potion stacks in the bag get the fight hotkeys 1-3.
export const CONSUMABLES: ItemDef[] = [
	{
		id: 'potion_minor',
		name: 'Minor Healing Potion',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		consumable: { healHp: 35 },
		stackMax: 20,
		sellValue: 20,
		icon: 'item_potion_hp',
		description: 'Restores 35 health. Can be drunk in the middle of a fight.',
		shop: 80,
	},
	{
		id: 'potion_greater',
		name: 'Greater Healing Potion',
		kind: 'consumable',
		rarity: 'uncommon',
		tier: 0,
		consumable: { healHp: 90 },
		stackMax: 20,
		sellValue: 90,
		icon: 'item_potion_greater',
		description: 'Restores 90 health. Can be drunk in the middle of a fight.',
		shop: 360,
	},
];
