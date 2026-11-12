import React, { memo, useMemo } from 'react';
import { BiomeType, Resources } from '@/types/game';
import { BIOMES } from '@/config/biomes';
import { RESOURCES } from '@/catalog';
import { CASTLE_AREA_BONUS } from '@/config/castle';
import { calculateTileOutput } from '@/utils/game/income';
import { castleModifier } from '@/utils/game/castle';
import { castleAreaBonus, castleLevelOf, castleRangeRadius } from '@/lib/castleWard';
import { formatPercent, formatNumber, formatTime } from '@/utils/formatters';
import { TipLine } from '../../../packages/design-system/src/components/tooltips';
import { resourceIconUrl } from './hero/recipeUi';
import { useMapGame } from './mapSource';

const formatRate = (rate: number) => {
	if (rate === 0) return '0/s';
	return `${formatNumber(rate)}/s`;
};

const percent = (fraction: number) => `+${formatPercent(fraction * 100)}`;

/** The body of a tile card (the caller wraps it in the design-system Tooltip): one row per resource with the tile's own output and what the neighbours and the castle area add, then the bonus lines. */
export const BiomeTooltip = memo(({ biome, level, x, y }: { biome: BiomeType; level?: number; x?: number; y?: number }) => {
	const game = useMapGame();
	const biomeInfo = BIOMES[biome];
	const tiles = game((state) => state.tiles);
	const castleUpgrade = game((state) => state.castleUpgrade);

	const castleLevel = castleLevelOf(tiles);
	const output = useMemo(() => (x === undefined || y === undefined ? null : calculateTileOutput(tiles, x, y, castleLevel)), [x, y, tiles, castleLevel]);

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
		<>
			{lines.length > 0 && (
				<div className='ds-tip-rows'>
					{lines.map(({ resource, own, bonus }) => (
						<div key={resource} className='ds-tip-row'>
							<span>
								<img className='ds-tip-mini' src={resourceIconUrl(resource)} alt='' />
								{RESOURCES[resource].label}
							</span>
							<span>
								{formatRate(own)}
								{bonus > 0.0001 && <span style={{ color: '#5ee07a' }}> +{formatRate(bonus)}</span>}
							</span>
						</div>
					))}
				</div>
			)}

			{output && output.adjacent > 0 && (
				<TipLine>
					Bonus: {output.adjacent} adjacent {biomeInfo.label}
				</TipLine>
			)}
			{output && output.areaBonus > 0 && biome !== 'castle' && <TipLine tone='purple'>Castle area: {percent(output.areaBonus)} production</TipLine>}

			{biome === 'castle' && level && level > 1 && (
				<TipLine tone='purple'>Castle Bonus: {formatPercent(castleModifier(level) * 100)} all resource generation</TipLine>
			)}
			{/* The castle explains its bonus area: every tile inside it produces more */}
			{biome === 'castle' && (
				<TipLine tone='purple'>
					{`Castle area: ${percent(areaBonus)} production on every tile within ${castleRangeRadius(castleLevel)} tile${castleRangeRadius(castleLevel) > 1 ? 's' : ''}`}
					{castleLevel < CASTLE_AREA_BONUS.fromLevel && ` (level ${CASTLE_AREA_BONUS.fromLevel} doubles it)`}
				</TipLine>
			)}
			{biome === 'castle' && castleUpgrade && (
				<TipLine tone='amber'>
					Upgrading to level {castleUpgrade.toLevel}: {formatTime(castleUpgrade.remainingSec)} left
				</TipLine>
			)}
		</>
	);
});

BiomeTooltip.displayName = 'BiomeTooltip';
