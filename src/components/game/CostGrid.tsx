import React from 'react';
import type { Resources } from '@/types/game';
import { sortedCostEntries } from '@/catalog';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import ResourceIcon from './ResourceIcon';

/**
 * A bundle of resource costs laid out as a grid of chips (icon and amount), green when the player has enough and red when not (`muted`: all grey, for a price shown only as a preview).
 * The columns are as many as fit (at least 92px each), so six or more resource types wrap onto more rows instead of running out of the window; nothing is cut off at any width.
 * Used wherever a cost can grow past three resources: the building and Build here windows and the castle.
 */
const CostGrid: React.FC<{ cost: Partial<Resources>; muted?: boolean; className?: string }> = ({ cost, muted, className }) => {
	const resources = useGameStore((state) => state.resources);
	return (
		<div className={`cost-grid ${className ?? ''}`} data-muted={muted ? 'true' : undefined}>
			{sortedCostEntries<keyof Resources>(cost).map(([resource, amount]) => (
				<span key={resource} className='cost-chip' data-ok={muted ? undefined : resources[resource] >= amount}>
					<ResourceIcon resource={resource} />
					<span className='cost-chip-num'>{formatNumber(amount)}</span>
				</span>
			))}
		</div>
	);
};

export default CostGrid;
