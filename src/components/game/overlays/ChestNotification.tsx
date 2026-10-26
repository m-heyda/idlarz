import React from 'react';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import type { ChestLoot } from '@/lib/chests';
import ResourceIcon from '../ResourceIcon';
import PixelIcon from '../PixelIcon';
import '@/styles/ContextMenu.css';
import { RARITY_COLOR, itemIconName } from '../itemUi';

interface ChestNotificationProps {
	loot: ChestLoot | null;
	show: boolean;
	onClose: () => void;
}

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

/** The toast after opening a chest: what was inside, in the same gold-framed style for every kind. */
const ChestNotification: React.FC<ChestNotificationProps> = ({ loot, show, onClose }) => {
	if (!show || !loot) return null;

	let title: React.ReactNode;
	let detail: React.ReactNode = null;
	let hint: React.ReactNode = null;

	switch (loot.kind) {
		case 'gold':
		case 'boost':
			title = (
				<>
					<span className='text-lg font-semibold whitespace-nowrap'>
						{loot.kind === 'boost' ? 'Lucky chest! ' : 'Claimed '}
						{fmt(loot.gold)} bonus gold
					</span>
					<ResourceIcon resource='gold' scale={1} />
				</>
			);
			detail = (
				<span className='text-sm text-[#f0d27a] font-medium'>
					{loot.minutes.toFixed(1)} minutes of gold income{loot.kind === 'boost' ? ` x${loot.multiplier}` : ''}
				</span>
			);
			hint = <span className='text-xs text-[#a89878] mt-1'>Based on your current {loot.goldRate.toFixed(2)} gold/s rate</span>;
			break;
		case 'bundle':
			title = <span className='text-lg font-semibold whitespace-nowrap'>Chest of supplies</span>;
			detail = (
				<span className='flex items-center gap-3 text-sm text-[#f0d27a] font-medium'>
					{loot.items.map((i) => (
						<span key={i.resource} className='inline-flex items-center gap-1'>
							+{fmt(i.amount)} <ResourceIcon resource={i.resource} scale={1} />
						</span>
					))}
				</span>
			);
			break;
		case 'xp':
			title = (
				<>
					<span className='text-lg font-semibold whitespace-nowrap'>Chest of wisdom: +{fmt(loot.xp)} XP</span>
					<ResourceIcon resource='xp' scale={1} />
				</>
			);
			detail = <span className='text-sm text-[#f0d27a] font-medium'>{loot.minutes.toFixed(1)} minutes of XP income</span>;
			break;
		case 'item': {
			const item = ITEM_CATALOG[loot.itemId];
			title = (
				<>
					<span className='text-lg font-semibold whitespace-nowrap'>
						You found <span style={item ? { color: RARITY_COLOR[item.rarity] } : undefined}>{item?.name ?? 'an item'}</span>!
					</span>
					{item && <PixelIcon name={itemIconName(item)} alt='' />}
				</>
			);
			hint = <span className='text-xs text-[#a89878] mt-1'>Added to your bag</span>;
			break;
		}
	}

	return (
		<div
			className='fixed top-[calc(var(--header-h,76px)+20px)] left-1/2 -translate-x-1/2 px-toast text-[#ffe27a] py-2 px-4 z-[70] flex flex-col items-center gap-1 chest-toast cursor-pointer'
			onClick={onClose}>
			<div className='flex items-center gap-2'>{title}</div>
			{detail}
			{hint}
		</div>
	);
};

export default ChestNotification;
