import React, { memo, useMemo } from 'react';
import { BiomeType } from '@/types/game';
import { BIOMES } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import {
	calculateTileCost,
	canAffordBundle,
	effectiveTileDiscount,
	countOwnedTiles,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { BiomeTooltip } from './BiomeTooltip';
import CostList from './CostList';
import { cn } from '@/lib/utils';

export const TileStatus = memo(
	({
		biome,
		isOwned,
		isAdjacent,
		level,
		x,
		y,
	}: {
		biome: BiomeType;
		isOwned: boolean;
		isAdjacent: boolean;
		level?: number;
		x: number;
		y: number;
	}) => {
		const tiles = useGameStore((state) => state.tiles);
		const resources = useGameStore((state) => state.resources);
		const characterStats = useGameStore((state) => state.characterStats);
		const prestige = useGameStore((state) => state.prestige);
		const discount = effectiveTileDiscount(characterStats, prestige);

		const { cost, tilesUntilManualSelection, canManuallySelect } = useMemo(() => {
			const ownedTilesCount = countOwnedTiles(tiles);
			const discountedCost = calculateTileCost(
				ownedTilesCount,
				discount
			);
			const tilesUntilManualSelection = (3 - (ownedTilesCount % 4)) % 4;
			const canManuallySelect = tilesUntilManualSelection === 0;

			return {
				cost: discountedCost,
				tilesUntilManualSelection,
				canManuallySelect,
			};
		}, [tiles, discount]);

		if (isOwned) {
			const biomeInfo = BIOMES[biome];
			return (
				<div className='space-y-1'>
					<div className='px-tip-title text-sm'>{biomeInfo.label}</div>
					<BiomeTooltip biome={biome} level={level} x={x} y={y} />
				</div>
			);
		}

		if (isAdjacent) {
			const canAfford = canAffordBundle(resources, tileCostAsResources(cost));
			return (
				<div className='space-y-1 text-sm'>
					<div className='px-tip-title'>Unexplored Land</div>
					<div className='flex flex-wrap items-center gap-1 mb-2'>
						<span className={canAfford ? 'text-green-400' : 'text-red-400'}>Cost:</span>
						<CostList cost={tileCostAsResources(cost)} />
						{discount > 0 && (
							<span className='text-amber-400 text-xs ml-1'>
								(-{discount.toFixed(2)}%)
							</span>
						)}
					</div>
					<div
						className={cn('text-xs mb-1', {
							'text-amber-300': canManuallySelect,
							'text-white': tilesUntilManualSelection === 1,
							'text-gray-500': tilesUntilManualSelection > 1,
						})}>
						{canManuallySelect && '◆ This tile can be selected upon purchase'}
						{tilesUntilManualSelection === 1 && '◇ Next tile will be selectable'}
						{tilesUntilManualSelection > 1 &&
							`◇ ${tilesUntilManualSelection} tiles until manual selection`}
					</div>
					<div className='px-tip-muted text-xs text-center'>Click to explore</div>
				</div>
			);
		}

		return null;
	}
);

TileStatus.displayName = 'TileStatus';
