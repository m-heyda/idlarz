import React from 'react';
import { formatStack } from '@/utils/formatters';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { resolveItem } from '@/lib/itemInstance';
import type { ItemInstance } from '@/types/game';
import { HoverTip } from '../../../packages/design-system/src/components/primitives';
import PixelIcon from './PixelIcon';
import GameItemTip from './hero/GameItemTip';
import { itemIconName } from './itemUi';
import '@/styles/Inventory.css';

interface ItemSlotProps {
	/** A piece of gear (an instance) ... */
	item?: ItemInstance | null;
	/** ... or a consumable by its catalog id */
	itemId?: string | null;
	qty?: number;
}

/**
 * One 48px frame of an item with its hover card: the design system's item card (`GameItemTip`, the same one the Bag, the Merchant and the rebirth keep list use) in a `HoverTip`, so it can be entered and its text copied.
 * Used where a fight shows items (the victory loot, the potion bar); the Hero window's bag and gear are drawn by the design system's `Slot`.
 */
const ItemSlot: React.FC<ItemSlotProps> = ({ item, itemId, qty = 1 }) => {
	const resolved = item ? resolveItem(item) : null;
	const def = resolved?.def ?? (itemId ? ITEM_CATALOG[itemId] : undefined);
	const rarityId = resolved?.instance.rarity ?? def?.rarity;
	const rarity = rarityId ? RARITIES[rarityId as keyof typeof RARITIES] : undefined;
	const frame = (
		<div
			className='inv-slot'
			role='img'
			aria-label={resolved?.name ?? def?.name ?? 'Empty slot'}
			data-filled={!!def}
			data-rarity={rarityId}
			data-pulse={rarity?.glow.pulse}
			style={
				def && rarity
					? ({ '--glow': rarity.color, '--glow-blur': `${rarity.glow.blur}px`, '--glow-alpha': rarity.glow.alpha } as React.CSSProperties)
					: undefined
			}
		>
			{def ? <PixelIcon name={itemIconName(def)} alt={resolved?.name ?? def.name} className='inv-icon' /> : null}
			{def && (def.stackMax ?? 1) > 1 && qty > 1 && <span className='inv-qty'>{formatStack(qty)}</span>}
		</div>
	);
	if (!def) return frame;
	return (
		<HoverTip interactive closeDelayMs={100} tip={<GameItemTip item={item ?? undefined} itemId={itemId ?? undefined} />}>
			{frame}
		</HoverTip>
	);
};

export default ItemSlot;
