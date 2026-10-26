import React, { memo, useMemo } from 'react';
import { BiomeType, Resources } from '@/types/game';
import { BIOMES, CASTLE_AREA_BONUS, BUILDINGS, BuildingType } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { calculateTileOutput, canBuildOn, castleModifier } from '@/utils/gameUtils';
import { castleAreaBonus, castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import { getTile } from '@/utils/world';
import { formatTime } from '@/utils/formatters';
import ResourceIcon from './ResourceIcon';
import PixelIcon from './PixelIcon';
import { BUILDING_PIXEL_ICONS } from '@/config/pixelIcons';

const formatRate = (rate: number) => {
	if (rate === 0) return '0/s';
	return `${rate.toFixed(2)}/s`;
};

const percent = (fraction: number) => `+${Math.round(fraction * 100)}%`;

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
		const castleUpgrade = useGameStore((state) => state.castleUpgrade);
		const building = x !== undefined && y !== undefined ? getTile(tiles, x, y)?.building : undefined;
		const buildingInfo = building ? BUILDINGS[building as BuildingType] : undefined;
		const canBuild = x !== undefined && y !== undefined && canBuildOn(getTile(tiles, x, y));

		const castleLevel = castleLevelOf(tiles);
		const output = useMemo(
			() => (x === undefined || y === undefined ? null : calculateTileOutput(tiles, x, y, castleLevel)),
			[x, y, tiles, castleLevel]
		);

		// One line per resource: the tile's own output, and what the neighbours and the castle area add on top
		const lines = output
			? (Object.keys(output.base) as (keyof Resources)[])
					.map((resource) => ({
						resource,
						own: output.base[resource] || 0,
						bonus: (output.neighbour[resource] || 0) + (output.area[resource] || 0),
					}))
					.filter((line) => line.own > 0)
			: [];
		const areaBonus = castleAreaBonus(castleLevel);

		return (
			<div className='space-y-1 text-sm'>
				{biome === 'castle' && level && (
					<div className='mb-2 text-purple-300 font-semibold text-xs'>
						Level {level} Castle
					</div>
				)}

				{/* The building standing on this tile */}
				{buildingInfo && (
					<div className='mb-2 text-purple-300 font-semibold text-xs flex items-start gap-1'>
						<PixelIcon name={BUILDING_PIXEL_ICONS[buildingInfo.name]} alt='' scale={0.5} className='mt-px' />
						<span>{buildingInfo.label} built here</span>
					</div>
				)}

				{lines.map(({ resource, own, bonus }) => (
					<div key={resource} className='flex flex-wrap items-center gap-x-1'>
						<ResourceIcon resource={resource} />
						<span className='text-gray-300 font-semibold'>{formatRate(own)}</span>
						{bonus > 0.0001 && <span className='text-green-400 text-xs mt-0.5'>+{formatRate(bonus)}</span>}
					</div>
				))}

				{output && output.adjacent > 0 && (
					<div className='text-xs px-tip-muted'>
						Bonus: {output.adjacent} adjacent {biomeInfo.label}
					</div>
				)}
				{output && output.areaBonus > 0 && biome !== 'castle' && (
					<div className='text-xs text-purple-300'>Castle area: {percent(output.areaBonus)} production</div>
				)}

				{biome === 'castle' && level && level > 1 && (
					<div className='mt-2 text-purple-400 text-xs'>
						Castle Bonus: {Math.round(castleModifier(level) * 100)}% all resource generation
					</div>
				)}
				{/* The castle explains its bonus area: every tile (and building) inside it produces more */}
				{biome === 'castle' && (
					<div className='text-purple-300 text-xs'>
						{areaBonus > 0
							? `Castle area: ${percent(areaBonus)} production on every tile and building within ${castleRangeRadius(castleLevel)} tile${castleRangeRadius(castleLevel) > 1 ? 's' : ''}`
							: `Castle area bonus unlocks at level ${CASTLE_AREA_BONUS.fromLevel}`}
					</div>
				)}
				{biome === 'castle' && castleUpgrade && (
					<div className='mt-1 text-amber-300 text-xs'>
						Upgrading to level {castleUpgrade.toLevel}: {formatTime(castleUpgrade.remainingSec)} left
					</div>
				)}
				{canBuild && (
					<div className='text-amber-400 text-xs mt-1'>Right-click to build here</div>
				)}
			</div>
		);
	}
);

BiomeTooltip.displayName = 'BiomeTooltip';
