import React from 'react';
import type { PixelIconName } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';
import NotifyDot from './NotifyDot';

export interface PixelTabItem<Id extends string> {
	id: Id;
	label: string;
	icon: PixelIconName;
	/** Something in this tab needs attention */
	notify?: boolean;
	notifyLabel?: string;
}

interface PixelTabsProps<Id extends string> {
	tabs: readonly PixelTabItem<Id>[];
	active: Id;
	onSelect: (id: Id) => void;
}

/**
 * The tab strip at the top of a window (PixelModal `tabs`): bevelled stone tabs on a bronze baseline, the active one
 * raised and joined to the panel below. Arrow keys move between tabs.
 */
function PixelTabs<Id extends string>({ tabs, active, onSelect }: PixelTabsProps<Id>) {
	const move = (from: number, step: number) => {
		const next = tabs[(from + step + tabs.length) % tabs.length];
		onSelect(next.id);
	};

	return (
		<div className='px-tabbar' role='tablist'>
			{tabs.map((tab, index) => (
				<button
					key={tab.id}
					type='button'
					role='tab'
					aria-selected={tab.id === active}
					tabIndex={tab.id === active ? 0 : -1}
					className='px-tabbar-item'
					data-active={tab.id === active}
					onClick={() => onSelect(tab.id)}
					onKeyDown={(e) => {
						if (e.key === 'ArrowRight') move(index, 1);
						else if (e.key === 'ArrowLeft') move(index, -1);
						else return;
						e.preventDefault();
					}}>
					<PixelIcon name={tab.icon} scale={0.5} />
					<span className='px-tabbar-label'>{tab.label}</span>
					<NotifyDot show={!!tab.notify} label={tab.notifyLabel} />
				</button>
			))}
		</div>
	);
}

export default PixelTabs;
