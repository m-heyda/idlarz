import React, { memo, useMemo } from 'react';
import { BiomeType } from '@/types/game';
import {
	BIOMES,
	GRID_SIZE,
	GRID_HEIGHT,
	SCALING_CONFIG,
	RESOURCE_ICONS,
	BIOME_YIELD,
	CASTLE_UPGRADE,
	BUILDINGS,
	BuildingType,
} from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { calculateTileTapYield } from '@/utils/gameUtils';
import { formatTime } from '@/utils/formatters';
import { TILE_TAP } from '@/config/gameConfig';
import ResourceIcon from './ResourceIcon';
import PixelIcon from './PixelIcon';
import { BUILDING_PIXEL_ICONS } from '@/config/pixelIcons';

const formatRate = (rate: number) => {
	if (rate === 0) return '0/s';
	return `${rate.toFixed(2)}/s`;
};

export const BiomeTooltip = memo(
	({
		biome,
		level,
		x,
		y,
	}: {
		biome: BiomeType;
		level?: number;
		x?: number;
		y?: number;
	}) => {
		const biomeInfo = BIOMES[biome];
		const tiles = useGameStore((state) => state.tiles);
		const building = x !== undefined && y !== undefined ? tiles[y][x].building : undefined;
		const resourceRates = useGameStore((state) => state.resourceRates);
		const castleUpgrade = useGameStore((state) => state.castleUpgrade);
		const tapYield =
			x !== undefined && y !== undefined
				? calculateTileTapYield(tiles, x, y, resourceRates)
				: {};
		
		// Get building info if we have one
		const buildingInfo = building ? BUILDINGS[building as BuildingType] : undefined;

		const adjacentCount = useMemo(() => {
			if (x === undefined || y === undefined) return 0;
			const directions = [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			];
			return directions.reduce((count, [dx, dy]) => {
				const newX = x + dx;
				const newY = y + dy;
				if (
					newX >= 0 &&
					newX < GRID_SIZE &&
					newY >= 0 &&
					newY < GRID_HEIGHT &&
					tiles[newY][newX].isOwned &&
					tiles[newY][newX].biome === biome
				) {
					return count + 1;
				}
				return count;
			}, 0);
		}, [x, y, biome, tiles]);

		const adjacencyMultiplier =
			1 + SCALING_CONFIG.adjacencyBonus * adjacentCount;

		return (
			<div className='space-y-1 text-sm'>
				{biome === 'castle' && level && (
					<div className='mb-2 text-purple-300 font-semibold text-xs'>
						Level {level} Castle
					</div>
				)}
				
				{/* Display building info for upgraded grounds */}
				{biome === 'grounds' && level === 2 && buildingInfo && (
					<div className='mb-2 text-purple-300 font-semibold text-xs flex items-start gap-1'>
						<PixelIcon name={BUILDING_PIXEL_ICONS[buildingInfo.name]} alt='' scale={0.5} className='mt-px' />
						<span>Grounds level 2 with {buildingInfo.label}</span>
					</div>
				)}
				
				{/* Display base resource generation */}
				{(
					Object.entries(biomeInfo.resourceGeneration) as [
						keyof typeof RESOURCE_ICONS,
						number
					][]
				).map(([resource, rate]) => {
					const baseRate = (rate || 0) * (biome === 'castle' ? 1 : BIOME_YIELD.scale);
					if (baseRate === 0) return null;
					const withNeighbours = baseRate * adjacencyMultiplier;

					return (
						<div key={resource} className='flex flex-col gap-1'>
							<div className='flex flex-wrap items-center gap-x-1'>
								<ResourceIcon resource={resource} />

								<span className='text-gray-400 font-semibold'>
									{formatRate(baseRate)}
								</span>

								<span className='text-xs text-gray-500 mt-0.5'>(base)</span>
								{adjacentCount > 0 && (
									<span className='text-yellow-500 text-xs mt-0.5'>
										{formatRate(withNeighbours)} with neighbours
									</span>
								)}
							</div>
						</div>
					);
				})}
				
				{/* Display building resource bonuses */}
				{biome === 'grounds' && level === 2 && buildingInfo && buildingInfo.resourceGeneration && (
					<>
						<div className='mt-2 mb-1 text-green-400 text-xs'>
							Building Bonuses:
						</div>
						{Object.entries(buildingInfo.resourceGeneration).map(([resource, rate]) => {
							if (!rate) return null;
							
							// Buildings get the same yield scale and neighbour bonus as the biome
							const scaledRate = rate * BIOME_YIELD.scale;
							const effectiveRate = scaledRate * adjacencyMultiplier;
							
							return (
								<div key={`building-${resource}`} className='flex flex-wrap items-center gap-x-1 text-xs'>
									<ResourceIcon resource={resource} />
									<span className='text-green-400 font-semibold'>
										+{formatRate(scaledRate)}
									</span>
									{adjacentCount > 0 && (
										<span className='text-yellow-500 mt-0.5'>
											(with adjacency: +{formatRate(effectiveRate)})
										</span>
									)}
								</div>
							);
						})}
					</>
				)}

				{biome === 'castle' && level && level > 1 && (
					<div className='mt-2 text-purple-400 text-xs'>
						Castle Bonus:{' '}
						{Math.round(
							CASTLE_UPGRADE.baseResourceMultiplier *
								Math.pow(2, level - 1) *
								100
						)}
						% all resource generation
					</div>
				)}
				{biome === 'castle' && castleUpgrade && (
					<div className='mt-1 text-amber-300 text-xs'>
						Upgrading to level {castleUpgrade.toLevel}: {formatTime(castleUpgrade.remainingSec)} left
					</div>
				)}
				{biome === 'grounds' && (!level || level === 1) && (
										<div className='text-amber-400 text-xs'>
										This grounds can be expanded with a building
									</div>
				)}
				{adjacentCount > 0 && (
					<div className='mt-0.5 text-yellow-500 text-xs'>
						+{(adjacencyMultiplier - 1).toFixed(2)}x bonus from {adjacentCount}{' '}
						adjacent {biomeInfo.label}
					</div>
				)}
				{Object.keys(tapYield).length > 0 && (
					<div className='mt-2 pt-2 border-t px-rule text-xs'>
						<div className='text-[#f0d27a] mb-1'>
							Click bonus <span className='px-tip-muted'>({(TILE_TAP.cooldownMs / 1000).toFixed(1)}s cooldown)</span>
						</div>
						<div className='flex flex-wrap gap-x-3 gap-y-1'>
							{(Object.entries(tapYield) as [string, number][]).map(([resource, perSecond]) => (
								<span key={resource} className='flex items-center gap-1 text-green-300'>
									<ResourceIcon resource={resource} />+{(perSecond * TILE_TAP.seconds).toFixed(2)}
								</span>
							))}
						</div>
					</div>
				)}
				{biomeInfo.description && (
					<div className='mt-2 text-gray-400 text-xs'>
						{biomeInfo.description}
					</div>
				)}
			</div>
		);
	}
);

BiomeTooltip.displayName = 'BiomeTooltip';
