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
		effects: [{ kind: 'healHp', amount: 35 }],
		stackMax: 100,
		sellValue: 20,
		icon: 'art_healing_flask',
		description: 'Restores 35 health. Can be drunk in the middle of a fight.',
		shop: 80,
	},
	{
		id: 'potion_greater',
		name: 'Greater Healing Potion',
		kind: 'consumable',
		rarity: 'uncommon',
		tier: 0,
		effects: [{ kind: 'healHp', amount: 90 }],
		stackMax: 100,
		sellValue: 90,
		icon: 'art_greater_healing_flask',
		description: 'Restores 90 health. Can be drunk in the middle of a fight.',
		shop: 360,
	},
	{
		id: 'potion_mana',
		name: 'Mana Potion',
		kind: 'consumable',
		rarity: 'common',
		tier: 0,
		effects: [{ kind: 'healMp', amount: 40 }],
		stackMax: 100,
		sellValue: 30,
		icon: 'art_mana_potion',
		description: 'Restores 40 mana. Not sold or dropped yet: it proves the effect model.',
	},
];
