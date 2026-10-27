import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EQUIPMENT_PIXEL_ICONS } from '@/config/pixelIcons';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import type { EquipmentSlot } from '@/types/game';
import PixelIcon from './PixelIcon';
import ItemTooltipStack from './ItemTooltip';
import { placeTip, type Box } from '@/lib/tipPlacement';
import { RARITY_COLOR, itemIconName } from './itemUi';
import '@/styles/Inventory.css';

interface ItemSlotProps {
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
const FloatingTip: React.FC<{ anchor: Box; children: React.ReactNode }> = ({ anchor, children }) => {
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
	itemId,
	qty = 1,
	slot,
	label,
	equipped,
	locked,
	draggable,
	compare,
	onClick,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDrop,
}) => {
	const [tip, setTip] = useState<Box | null>(null);
	const [over, setOver] = useState(false);
	const def = itemId ? ITEM_CATALOG[itemId] : undefined;
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
				aria-label={def?.name ?? label ?? 'Empty slot'}
				data-filled={!!def}
				data-equipped={!!equipped}
				data-locked={!!locked}
				data-rarity={def?.rarity}
				data-pulse={def ? RARITIES[def.rarity].glow.pulse : undefined}
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
				style={def ? ({ '--glow': RARITY_COLOR[def.rarity], '--glow-blur': `${RARITIES[def.rarity].glow.blur}px`, '--glow-alpha': RARITIES[def.rarity].glow.alpha } as React.CSSProperties) : undefined}>
				{def ? (
					<PixelIcon name={itemIconName(def)} alt={def.name} className='inv-icon' />
				) : slot ? (
					<PixelIcon name={EQUIPMENT_PIXEL_ICONS[slot]} alt='' className='px-equip-empty' />
				) : null}
				{def && (def.stackMax ?? 1) > 1 && qty > 1 && <span className='inv-qty'>{qty}</span>}
				{locked && <span className='inv-lock' aria-hidden />}
			</div>
			{tip &&
				hasTip &&
				createPortal(
						<FloatingTip anchor={tip}>
							{def ? (
								<ItemTooltipStack itemId={def.id} compare={compare} />
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
