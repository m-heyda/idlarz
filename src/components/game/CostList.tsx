import React from 'react';
import type { Resources } from '@/types/game';
import { sortedCostEntries } from '@/catalog';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import ResourceIcon from './ResourceIcon';

/** A bundle of resource costs; each entry is green when affordable and red when not. */
const CostList: React.FC<{ cost: Partial<Resources>; className?: string }> = ({
	cost,
	className,
}) => {
	const resources = useGameStore((state) => state.resources);
	return (
		<span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className ?? ''}`}>
			{sortedCostEntries<keyof Resources>(cost).map(([resource, amount]) => (
				<span
					key={resource}
					className={`inline-flex items-center gap-1 ${
						resources[resource] >= amount ? 'text-green-400' : 'text-red-400'
					}`}>
					<ResourceIcon resource={resource} />
					{formatNumber(amount)}
				</span>
			))}
		</span>
	);
};

export default CostList;
