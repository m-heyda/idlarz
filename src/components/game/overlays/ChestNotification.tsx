import React from 'react';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { ITEM_CATALOG } from '@/catalog';
import type { ChestLoot } from '@/lib/chests';
import type { Drop } from '@/types/game';
import GemIcon from '../GemIcon';
import { resolveItem } from '@/lib/itemInstance';
import ResourceIcon from '../ResourceIcon';
import PixelIcon from '../PixelIcon';
import '@/styles/ContextMenu.css';
import { RARITY_COLOR, itemIconName } from '../itemUi';

interface ChestNotificationProps {
	loot: (ChestLoot & { gems?: number; junk?: Drop[] }) | null;
	onClose: () => void;
}

const fmt = (n: number) => formatNumber(Math.floor(n));

/** The toast after opening a chest: what was inside, in the same gold-framed style for every kind. */
const ChestNotification: React.FC<ChestNotificationProps> = ({ loot, onClose }) => {
	if (!loot) return null;

	let title: React.ReactNode;
	let detail: React.ReactNode = null;
	let hint: React.ReactNode = null;

	switch (loot.kind) {
		case 'gold':
		case 'boost':
			title = (
				<>
					<span className='ds-toast-title'>
						{loot.kind === 'boost' ? 'Lucky chest! ' : 'Claimed '}
						{fmt(loot.gold)} bonus gold
					</span>
					<ResourceIcon resource='gold' scale={0.85} />
				</>
			);
			detail = (
				<span className='ds-toast-sub'>
					{formatCompact(loot.minutes)} minutes of gold income{loot.kind === 'boost' ? ` x${formatCompact(loot.multiplier)}` : ''}
				</span>
			);
			hint = <span className='ds-toast-hint'>Based on your current {formatNumber(loot.goldRate)} gold/s rate</span>;
			break;
		case 'bundle':
			title = <span className='ds-toast-title'>Chest of supplies</span>;
			detail = (
				<span className='ds-toast-sub ds-toast-line' style={{ gap: 10 }}>
					{loot.items.map((i) => (
						<span key={i.resource} className='inline-flex items-center gap-1'>
							+{fmt(i.amount)} <ResourceIcon resource={i.resource} scale={0.85} />
						</span>
					))}
				</span>
			);
			break;
		case 'xp':
			title = (
				<>
					<span className='ds-toast-title'>Chest of wisdom: +{fmt(loot.xp)} XP</span>
					<ResourceIcon resource='xp' scale={0.85} />
				</>
			);
			detail = <span className='ds-toast-sub'>{formatCompact(loot.minutes)} minutes of XP income</span>;
			break;
		case 'item': {
			const drop = loot.drop;
			const resolved = drop.kind === 'gear' ? resolveItem(drop.item) : null;
			const def = resolved?.def ?? (drop.kind === 'consumable' ? ITEM_CATALOG[drop.id] : undefined);
			const color = RARITY_COLOR[(resolved?.instance.rarity ?? def?.rarity ?? 'common') as keyof typeof RARITY_COLOR];
			title = (
				<>
					<span className='ds-toast-title'>
						You found <span style={def ? { color } : undefined}>{resolved?.name ?? def?.name ?? 'an item'}</span>!
					</span>
					{def && <PixelIcon name={itemIconName(def)} alt='' scale={0.85} />}
				</>
			);
			hint = <span className='ds-toast-hint'>{resolved ? `Item level ${formatCompact(resolved.instance.level)} - ` : ''}Added to your bag</span>;
			break;
		}
	}

	return (
		<div className='ds-root ds-toast chest-toast' style={{ cursor: 'pointer' }} onClick={onClose}>
			<div className='ds-toast-line'>{title}</div>
			{detail}
			{hint}
			{loot.junk && loot.junk.length > 0 && (
				<span className='ds-toast-hint'>
					{loot.junk
						.map((d) => (d.kind === 'consumable' ? `${formatNumber(d.qty)} x ${ITEM_CATALOG[d.id]?.name ?? d.id}` : ''))
						.filter(Boolean)
						.join(', ')}
				</span>
			)}
			{!!loot.gems && (
				<span className='ds-toast-line' style={{ color: '#7fd8ff' }}>
					Gem find! +{loot.gems} <GemIcon />
				</span>
			)}
		</div>
	);
};

export default ChestNotification;
