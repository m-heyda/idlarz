import { RARITIES } from '@/catalog/rarity';
import { resolveItem } from '@/lib/itemInstance';
import type { Drop } from '@/types/game';

/** The rarities that get their own notice when a piece drops (epic and better, by rank so a new tier above joins by itself). */
const ANNOUNCED_FROM = RARITIES.epic.order;

export interface DropAnnouncement {
	/** "Epic drop: Keen Steel Sledge" */
	text: string;
	/** The rarity id, which picks the notice's colour */
	rarity: 'epic' | 'legendary';
}

/**
 * The notices a kill's drops earn: one line for every piece of gear of epic rank or better that reached the bag ("Epic drop: Keen Steel Sledge"), strongest first. Everything below epic is left to the fight result and the bag.
 *
 * @category Loot/Pipeline
 * @order 7
 */
export const announceDrops = (drops: readonly Drop[]): DropAnnouncement[] =>
	drops
		.flatMap((drop) => {
			if (drop.kind !== 'gear') return [];
			const rarity = RARITIES[drop.item.rarity as keyof typeof RARITIES];
			const resolved = resolveItem(drop.item);
			if (!rarity || !resolved || rarity.order < ANNOUNCED_FROM) return [];
			return [
				{ text: `${rarity.label} drop: ${resolved.name}`, rarity: rarity.id === 'epic' ? ('epic' as const) : ('legendary' as const), order: rarity.order },
			];
		})
		.sort((a, b) => b.order - a.order)
		.map(({ text, rarity }) => ({ text, rarity }));
