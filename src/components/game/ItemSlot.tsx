import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatCompact } from '@/utils/formatters';
import { createPortal } from 'react-dom';
import { EQUIPMENT_PIXEL_ICONS } from '@/config/pixelIcons';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { resolveItem } from '@/lib/itemInstance';
import type { EquipmentSlot, ItemInstance } from '@/types/game';
import PixelIcon from './PixelIcon';
import ItemTooltipStack from './ItemTooltip';
import { placeTip, type Box } from '@/lib/tipPlacement';
import { itemIconName } from './itemUi';
import '@/styles/Inventory.css';

interface ItemSlotProps {
	/** A piece of gear (an instance) ... */
	item?: ItemInstance | null;
	/** ... or a consumable by its catalog id */
	itemId?: string | null;
	qty?: number;
	/** Equipment slot this frame stands for (shows its dim silhouette while empty) */
	slot?: EquipmentSlot;
	/** Hover text for an empty or locked frame */
	label?: string;
	equipped?: boolean;
	locked?: boolean;
	draggable?: boolean;
	/** The hover card compares the item with the gear worn in its slot (the bag) */
	compare?: boolean;
	/** On the merchant's shelf: the hover card says what it costs instead of what it sells for */
	buyPrice?: number;
	onClick?: (event: React.MouseEvent) => void;
	onDoubleClick?: () => void;
	onContextMenu?: (event: React.MouseEvent) => void;
	onDragStart?: () => void;
	onDrop?: () => void;
}

/**
 * A hover card attached to the edge of its item box (not the cursor, so it stays put while the mouse moves over the box).
 * It measures itself, so a wide one (an item next to the gear it would replace) flips to the left of the box near the right
 * edge and never leaves the screen (see lib/tipPlacement.ts).
 */
export const FloatingTip: React.FC<{ anchor: Box; children: React.ReactNode }> = ({ anchor, children }) => {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const { width, height } = el.getBoundingClientRect();
		const { left, top } = placeTip(anchor, { width, height }, { width: window.innerWidth, height: window.innerHeight });
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
		el.style.visibility = 'visible';
	});
	return (
		<div ref={ref} className='fixed z-[100] pointer-events-none' style={{ left: anchor.right + 8, top: anchor.top, visibility: 'hidden' }}>
			{children}
		</div>
	);
};

/** One 48px frame: an item (rarity glow, stack count, hover card), an empty equipment slot, or a locked slot. */
const ItemSlot: React.FC<ItemSlotProps> = ({
	item,
	itemId,
	qty = 1,
	slot,
	label,
	equipped,
	locked,
	draggable,
	compare,
	buyPrice,
	onClick,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDrop,
}) => {
	const [tip, setTip] = useState<Box | null>(null);
	const [over, setOver] = useState(false);
	const resolved = item ? resolveItem(item) : null;
	const def = resolved?.def ?? (itemId ? ITEM_CATALOG[itemId] : undefined);
	const rarityId = resolved?.instance.rarity ?? def?.rarity;
	const rarity = rarityId ? RARITIES[rarityId as keyof typeof RARITIES] : undefined;
	const hasTip = !!def || !!label;

	useEffect(() => {
		if (!tip) return;
		const close = () => setTip(null);
		window.addEventListener('scroll', close, true);
		return () => window.removeEventListener('scroll', close, true);
	}, [tip]);

	return (
		<>
			<div
				className='inv-slot'
				role='button'
				aria-label={resolved?.name ?? def?.name ?? label ?? 'Empty slot'}
				data-filled={!!def}
				data-equipped={!!equipped}
				data-locked={!!locked}
				data-rarity={rarityId}
				data-pulse={rarity?.glow.pulse}
				data-over={over}
				draggable={!!def && !!draggable}
				onDragStart={(e) => {
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', def?.id ?? '');
					setTip(null);
					onDragStart?.();
				}}
				onDragOver={(e) => {
					if (onDrop) {
						e.preventDefault();
						setOver(true);
					}
				}}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setOver(false);
					onDrop?.();
				}}
				onMouseEnter={(e) => {
					if (!hasTip) return;
					const { left, top, right, bottom } = e.currentTarget.getBoundingClientRect();
					setTip({ left, top, right, bottom });
				}}
				onMouseLeave={() => setTip(null)}
				onClick={onClick}
				onDoubleClick={onDoubleClick}
				onContextMenu={(e) => {
					if (!onContextMenu) return;
					e.preventDefault();
					setTip(null);
					onContextMenu(e);
				}}
				style={def && rarity ? ({ '--glow': rarity.color, '--glow-blur': `${rarity.glow.blur}px`, '--glow-alpha': rarity.glow.alpha } as React.CSSProperties) : undefined}>
				{def ? (
					<PixelIcon name={itemIconName(def)} alt={resolved?.name ?? def.name} className='inv-icon' />
				) : slot ? (
					<PixelIcon name={EQUIPMENT_PIXEL_ICONS[slot]} alt='' className='px-equip-empty' />
				) : null}
				{def && (def.stackMax ?? 1) > 1 && qty > 1 && <span className='inv-qty'>{formatCompact(qty)}</span>}
				{locked && <span className='inv-lock' aria-hidden />}
			</div>
			{tip &&
				hasTip &&
				createPortal(
						<FloatingTip anchor={tip}>
							{def ? (
								<ItemTooltipStack item={item ?? undefined} itemId={itemId ?? undefined} compare={compare} buyPrice={buyPrice} />
							) : (
								<div className='px-tooltip'>
									<div className='px-tip-muted text-sm'>{label}</div>
								</div>
							)}
						</FloatingTip>,
					document.body
				)}
		</>
	);
};

export default ItemSlot;
