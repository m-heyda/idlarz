import { MONSTER_CHEST, MONSTER_CHEST_TIERS, monsterChestItemId, type MonsterChestTier } from '@/config/monsterChests';
import type { ItemDef } from '@/types/game';

// Monster drop chests (IDL-163): bag items a kill sometimes drops and the player opens later. They are consumables with no effect (opening is its own op, `lib/offline/openChest.ts`), stack in the bag, are never junk (no sweep sells them) and
// sell for their `sellValue` when the bag is full. The art is the treasure-chest icon (`bonus_chest`) for the wooden tier and a recolour of it for each other tier (`public/pixel/icons/chest_<tier>.png`), until Sprite Fusion art replaces them (owner work). Ids are append-only.

const RARITY_OF_TIER: Record<MonsterChestTier, ItemDef['rarity']> = {
	wooden: 'common',
	iron: 'common',
	mossy: 'uncommon',
	coral: 'uncommon',
	frost: 'rare',
	magma: 'rare',
	royal: 'epic',
	arcane: 'epic',
};

const DESCRIPTION: Record<MonsterChestTier, string> = {
	wooden: 'Nailed shut by someone in a hurry. Open it from the bag.',
	iron: 'Heavy, banded and very proud of its lock. Open it from the bag.',
	mossy: 'Damp, green and smells of the swamp. Open it from the bag.',
	coral: 'Crusted with shells, still faintly wet. Open it from the bag.',
	frost: 'Frozen shut until you press the lid. Open it from the bag.',
	magma: 'Warm to the touch, and getting warmer. Open it from the bag.',
	royal: 'Only a boss carries one. Open it from the bag.',
	arcane: 'It hums when a golden monster is near. Open it from the bag.',
};

export const CHEST_ITEMS: ItemDef[] = MONSTER_CHEST_TIERS.map(
	(tier): ItemDef => ({
		id: monsterChestItemId(tier),
		name: MONSTER_CHEST.tiers[tier].label,
		kind: 'consumable',
		rarity: RARITY_OF_TIER[tier],
		tier: 0,
		stackMax: 99,
		sellValue: MONSTER_CHEST.tiers[tier].sellValue,
		icon: tier === 'wooden' ? 'bonus_chest' : `chest_${tier}`,
		description: DESCRIPTION[tier],
	}),
);

/** The tier of a bag item id, or undefined when it is not a monster chest. */
export const monsterChestTierOf = (id: string | undefined): MonsterChestTier | undefined => MONSTER_CHEST_TIERS.find((tier) => monsterChestItemId(tier) === id);
