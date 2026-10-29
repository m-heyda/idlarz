import React, { memo, useMemo } from 'react';
import { BiomeType } from '@/types/game';
import { BIOMES } from '@/config/gameConfig';
import {
	calculateTileCost,
	canAffordBundle,
	effectiveTileDiscount,
	economyTiles,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { BiomeTooltip } from './BiomeTooltip';
import CostList from './CostList';
import { useMapGame } from './mapSource';

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
		const game = useMapGame();
		const tiles = game((state) => state.tiles);
		const resources = game((state) => state.resources);
		const characterStats = game((state) => state.characterStats);
		const prestige = game((state) => state.prestige);
		const merchantUpgrades = game((state) => state.merchantUpgrades);
		const freeTiles = game((state) => state.freeTiles);
		const discount = effectiveTileDiscount(characterStats, prestige, merchantUpgrades);

		const cost = useMemo(
			() => calculateTileCost(economyTiles(tiles, freeTiles), discount),
			[tiles, discount, freeTiles]
		);

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
					<div className='px-tip-muted text-xs text-center'>Click to explore</div>
				</div>
			);
		}

		return null;
	}
);

TileStatus.displayName = 'TileStatus';
