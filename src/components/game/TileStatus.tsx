import React, { memo, useMemo } from 'react';
import { BiomeType } from '@/types/game';
import { formatNumber, tidy } from '@/utils/formatters';
import { BIOMES } from '@/config/biomes';
import { RESOURCES } from '@/catalog';
import { Tooltip, TipCostList, TipLine } from '../../../packages/design-system/src/components/tooltips';
import { resourceIconUrl } from './hero/recipeUi';
import { calculateTileCost, canAffordBundle, tileCostAsResources } from '@/utils/game/costs';
import { effectiveTileDiscount } from '@/utils/game/rebirth';
import { economyTiles } from '@/utils/game/tiles';
import { BiomeTooltip } from './BiomeTooltip';
import { useMapGame } from './mapSource';

export const TileStatus = memo(
	({
		biome,
		isOwned,
		isAdjacent,
		level,
		x,
		y,
		extra,
	}: {
		biome: BiomeType;
		isOwned: boolean;
		isAdjacent: boolean;
		level?: number;
		x: number;
		y: number;
		/** More card content under the tile's own lines (the building on the tile) */
		extra?: React.ReactNode;
	}) => {
		const game = useMapGame();
		const tiles = game((state) => state.tiles);
		const resources = game((state) => state.resources);
		const characterStats = game((state) => state.characterStats);
		const prestige = game((state) => state.prestige);
		const merchantUpgrades = game((state) => state.merchantUpgrades);
		const playerClass = game((state) => state.playerClass);
		const freeTiles = game((state) => state.freeTiles);
		const discount = effectiveTileDiscount(characterStats, prestige, merchantUpgrades, playerClass);

		const cost = useMemo(() => calculateTileCost(economyTiles(tiles, freeTiles), discount), [tiles, discount, freeTiles]);

		if (isOwned) {
			const biomeInfo = BIOMES[biome];
			return (
				<Tooltip title={biomeInfo.label} subtitle={biome === 'castle' && level ? `Level ${level} Castle` : undefined} className='map-ds-tip'>
					<BiomeTooltip biome={biome} level={level} x={x} y={y} />
					{extra}
				</Tooltip>
			);
		}

		if (isAdjacent) {
			const bundle = tileCostAsResources(cost);
			const costs = (Object.keys(bundle) as (keyof typeof bundle)[])
				.filter((key) => (bundle[key] ?? 0) > 0)
				.map((key) => ({
					label: RESOURCES[key].label,
					icon: resourceIconUrl(key),
					have: resources[key] ?? 0,
					cost: bundle[key] ?? 0,
					text: formatNumber(bundle[key] ?? 0),
					discount: discount > 0 ? `-${tidy(discount.toFixed(2))}%` : undefined,
				}));
			return (
				<Tooltip title='Unexplored Land' subtitle={canAffordBundle(resources, bundle) ? 'You can afford it' : 'Not enough resources'} className='map-ds-tip'>
					<TipCostList costs={costs} />
					<TipLine>Click to explore</TipLine>
				</Tooltip>
			);
		}

		return null;
	},
);

TileStatus.displayName = 'TileStatus';
