import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { EQUIPMENT_PIXEL_ICONS } from '@/config/pixelIcons';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import type { EquipmentSlot } from '@/types/game';
import PixelIcon from './PixelIcon';
import ItemTooltipBody from './ItemTooltip';
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
	onClick?: (event: React.MouseEvent) => void;
	onDoubleClick?: () => void;
	onContextMenu?: (event: React.MouseEvent) => void;
	onDragStart?: () => void;
	onDrop?: () => void;
}

/** One 48px frame: an item (rarity glow, stack count, hover card), an empty equipment slot, or a locked slot. */
const ItemSlot: React.FC<ItemSlotProps> = ({
	itemId,
	qty = 1,
	slot,
	label,
	equipped,
	locked,
	draggable,
	onClick,
	onDoubleClick,
	onContextMenu,
	onDragStart,
	onDrop,
}) => {
	const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
	const [over, setOver] = useState(false);
	const def = itemId ? ITEM_CATALOG[itemId] : undefined;
	const hasTip = !!def || !!label;

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
				onMouseMove={(e) => hasTip && setTip({ x: e.clientX, y: e.clientY })}
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
					<div
						className='fixed z-[100] pointer-events-none'
						style={{
							left: Math.min(tip.x + 16, window.innerWidth - 300),
							top: Math.min(tip.y + 16, window.innerHeight - 300),
						}}>
						<div className='px-tooltip'>
							{def ? <ItemTooltipBody itemId={def.id} /> : <div className='px-tip-muted text-sm'>{label}</div>}
						</div>
					</div>,
					document.body
				)}
		</>
	);
};

export default ItemSlot;
