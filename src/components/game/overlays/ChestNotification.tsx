import React from 'react';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import type { ChestLoot } from '@/lib/chests';
import GemIcon from '../GemIcon';
import { resolveItem } from '@/lib/itemInstance';
import ResourceIcon from '../ResourceIcon';
import PixelIcon from '../PixelIcon';
import '@/styles/ContextMenu.css';
import { RARITY_COLOR, itemIconName } from '../itemUi';

interface ChestNotificationProps {
	loot: (ChestLoot & { gems?: number }) | null;
	show: boolean;
	onClose: () => void;
}

const fmt = (n: number) => formatNumber(Math.floor(n));

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
					{formatCompact(loot.minutes)} minutes of gold income{loot.kind === 'boost' ? ` x${formatCompact(loot.multiplier)}` : ''}
				</span>
			);
			hint = <span className='text-xs text-[#a89878] mt-1'>Based on your current {formatNumber(loot.goldRate)} gold/s rate</span>;
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
			detail = <span className='text-sm text-[#f0d27a] font-medium'>{formatCompact(loot.minutes)} minutes of XP income</span>;
			break;
		case 'item': {
			const drop = loot.drop;
		const resolved = drop.kind === 'gear' ? resolveItem(drop.item) : null;
		const def = resolved?.def ?? (drop.kind === 'consumable' ? ITEM_CATALOG[drop.id] : undefined);
		const color = RARITY_COLOR[(resolved?.instance.rarity ?? def?.rarity ?? 'common') as keyof typeof RARITY_COLOR];
		title = (
			<>
				<span className='text-lg font-semibold whitespace-nowrap'>
					You found <span style={def ? { color } : undefined}>{resolved?.name ?? def?.name ?? 'an item'}</span>!
				</span>
				{def && <PixelIcon name={itemIconName(def)} alt='' />}
			</>
		);
		hint = <span className='text-xs text-[#a89878] mt-1'>{resolved ? `Item level ${formatCompact(resolved.instance.level)} - ` : ''}Added to your bag</span>;
			break;
		}
	}

	return (
		<div
			className='relative px-toast text-[#ffe27a] py-2 px-4 flex flex-col items-center gap-1 chest-toast cursor-pointer'
			onClick={onClose}>
			<div className='flex items-center gap-2'>{title}</div>
			{detail}
			{hint}
			{!!loot.gems && (
				<span className='text-sm text-cyan-300 font-semibold inline-flex items-center gap-1'>
					Gem find! +{loot.gems} <GemIcon />
				</span>
			)}
		</div>
	);
};

export default ChestNotification;
