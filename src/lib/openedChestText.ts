import { ITEM_CATALOG } from '@/catalog';
import type { OpenedChest } from '@/lib/offline/openChest';
import { formatCompact } from '@/utils/formatters';

/**
 * The one-line notice for an opened monster chest (IDL-163): "Mossy chest: +1.2K Gold and a Minor Potion". Lists what the chest paid (the resources and XP of its grant, in the order they come, never the zeros) and the potion that came with it.
 * Pure, so the wording is tested without the game.
 */
export const openedChestText = (opened: Pick<OpenedChest, 'label' | 'grant' | 'potion'>): string => {
	const paid = Object.entries(opened.grant.resources)
		.filter(([, amount]) => amount > 0)
		.map(([key, amount]) => `+${formatCompact(amount)} ${key === 'xp' ? 'XP' : key[0].toUpperCase() + key.slice(1)}`);
	const potion = opened.potion ? (ITEM_CATALOG[opened.potion.id]?.name ?? 'a potion') : null;
	const parts = [...paid, ...(potion ? [`a ${potion}`] : [])];
	return `${opened.label}: ${parts.length > 0 ? parts.join(' and ') : 'empty'}`;
};
