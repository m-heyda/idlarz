import React, { memo, useMemo, useState } from 'react';
import { TileProps } from '@/types/game';
import {
	BIOMES,
	GRID_SIZE,
	GRID_HEIGHT,
	SCALING_CONFIG,
	BIOME_ICONS,
	GRID_CENTER_X,
	GRID_CENTER_Y,
	BUILDINGS,
	RESOURCE_ICONS,
	BuildingType,
} from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { countOwnedTiles } from '@/utils/gameUtils';
import { cn } from '@/lib/utils';
import audioManager from '@/utils/audioManager';
import { TileStatus } from './TileStatus';
import CastleUpgradeDialog from './CastleUpgradeDialog';
import BuildingSelectionDialog from './BuildingSelectionDialog';

const Tile: React.FC<TileProps> = ({
	biome,
	isOwned,
	x,
	y,
	style,
	level,
	building,
}) => {
	const tiles = useGameStore((state) => state.tiles);
	const buyTile = useGameStore((state) => state.buyTile);
	const resources = useGameStore((state) => state.resources);
	const characterStats = useGameStore((state) => state.characterStats);
	const upgradeGroundsTile = useGameStore((state) => state.upgradeGroundsTile);
	const collectChest = useGameStore((state) => state.collectChest);
	const isBiomeSelectionActive = useGameStore(
		(state) => state.biomeSelectionActive
	);
	const pendingTileCoords = useGameStore((state) => state.pendingTileCoords);
	const selectBiome = useGameStore((state) => state.selectBiome);
	const [isShaking, setIsShaking] = useState(false);
	const [showCastleDialog, setShowCastleDialog] = useState(false);
	const [showBuildingDialog, setShowBuildingDialog] = useState(false);
	const [showChestTooltip, setShowChestTooltip] = useState(false);

	// Check if this tile has a chest
	const hasChest = tiles?.[y]?.[x]?.hasChest || false;

	const isAdjacent = useMemo(() => {
		if (isOwned || !tiles) return false;

		const directions = [
			[x - 1, y],
			[x + 1, y],
			[x, y - 1],
			[x, y + 1],
		];

		return directions.some(
			([adjX, adjY]) =>
				adjX >= 0 &&
				adjX < GRID_SIZE &&
				adjY >= 0 &&
				adjY < GRID_HEIGHT &&
				tiles[adjY]?.[adjX]?.isOwned
		);
	}, [x, y, isOwned, tiles]);

	const backgroundColor = useMemo(() => {
		const baseColor = BIOMES[biome].baseColor;
		if (isOwned) {
			return baseColor;
		}
		return isAdjacent ? `${baseColor}BF` : `${baseColor}40`;
	}, [biome, isOwned, isAdjacent]);

	const ownedTilesCount = useMemo(() => countOwnedTiles(tiles), [tiles]);

	const cost = useMemo(() => {
		const baseCost = SCALING_CONFIG.costFormula(ownedTilesCount);
		const discountMultiplier = 1 - characterStats.tileCostDiscount / 100;
		return Math.floor(baseCost * discountMultiplier);
	}, [ownedTilesCount, characterStats.tileCostDiscount]);

	const canAfford = resources.gold >= cost;

	const handleClick = () => {
		// First priority: If in biome selection mode, handle selection
		if (isBiomeSelectionActive && pendingTileCoords) {
			selectBiome(biome);
			return;
		}

		// Check if this is a chest collection
		if (isOwned && hasChest) {
			const success = collectChest(x, y);
			if (success) {
				audioManager.playSound('click');
				// You could add a special chest collection sound here
			}
			return;
		}

		// Prioritize owned tiles for special interactions
		if (isOwned) {
			// Castle tile - show castle dialog
			if (biome === 'castle') {
				audioManager.playSound('click');
				setShowCastleDialog(true);
				return;
			}

			// Grounds tile - show building dialog ONLY if not already upgraded
			if (biome === 'grounds' && (!level || level < 2) && !building) {
				audioManager.playSound('click');
				setShowBuildingDialog(true);
				return;
			}

			// For any owned tile, show tooltip
			// toggleTooltip(); // This function is not defined in the provided code
			return;
		}

		if (isAdjacent && !isOwned) {
			if (canAfford) {
				const result = buyTile(x, y);
				// Only play the purchase sound if the tile was actually purchased
				// (not when biome selection was triggered)
				if (result && !useGameStore.getState().biomeSelectionActive) {
					audioManager.playSound('purchase');
				}
			} else if (cost > 0) {
				// Only play wrong sound and shake for adjacent unaffordable tiles
				setIsShaking(true);
				audioManager.playSound('wrong');
				setTimeout(() => setIsShaking(false), 300);
			}
		}
	};

	const handleBuildingSelect = (buildingType: string) => {
		// Upgrade the grounds tile with the selected building
		if (biome === 'grounds') {
			upgradeGroundsTile(x, y, buildingType);
			audioManager.playSound('purchase');
		}
		setShowBuildingDialog(false);
	};

	const farAwayTile = !isOwned && !isAdjacent;

	return (
		<>
			<div
				id={`tile-${x}-${y}`}
				className={cn(
					'absolute transition-all duration-200 ease-in-out select-none',
					{
						'opacity-100': isOwned,
						'opacity-50 hover:opacity-100': !isOwned && isAdjacent,
						'opacity-75': farAwayTile,
						'hover:z-10 cursor-pointer border border-gray-800':
							!isOwned && isAdjacent,
						'hover:border-green-800': !isOwned && isAdjacent && canAfford,
						'hover:border-red-800 cursor-not-allowed':
							!isOwned && isAdjacent && !canAfford,
						'border border-purple-400': biome === 'castle',
						'border-2 border-amber-300':
							(tiles[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level ?? 0) === 10 &&
							biome === 'castle',
						'group hover:z-20': true,
						'opacity-75 border-2 border-red-500': isShaking,
						'cursor-pointer':
							isOwned && (biome === 'castle' || biome === 'grounds' || hasChest),
						'castle-tile': isOwned && biome === 'castle',
						'border-2 border-amber-400': isOwned && hasChest
					}
				)}
				style={{
					...style,
					backgroundColor,
					...(farAwayTile && {
						backgroundColor: '#090c13',
						backgroundImage:
							'linear-gradient(45deg, #0b0d14 25%, transparent 25%, transparent 75%, #0b0d14 75%, #0b0d14), linear-gradient(-45deg, #0b0d14 25%, transparent 25%, transparent 75%, #0b0d14 75%, #0b0d14)',
						backgroundSize: '48px 48px',
					}),
				}}
				onClick={handleClick}
				onMouseEnter={() => hasChest && setShowChestTooltip(true)}
				onMouseLeave={() => setShowChestTooltip(false)}
				role='button'>
				<div className='w-full h-full flex items-center justify-center relative'>
					{isOwned &&
						BIOME_ICONS[BIOMES[biome].name as keyof typeof BIOME_ICONS]}
					{!isOwned && isAdjacent && '❔'}
					{biome === 'castle' && (
						<span className='absolute top-0.5 right-0.5 text-[8px] bg-amber-400 w-3 h-3 aspect-square flex items-center justify-center leading-0 font-bold text-purple-600 rounded-full'>
							{tiles[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level}
						</span>
					)}
					
					{/* Chest icon on tile */}
					{isOwned && hasChest && (
						<span className='absolute bottom-0 right-0 text-[14px] z-10'>
							💰
						</span>
					)}
					
					{/* Chest tooltip */}
					{isOwned && hasChest && showChestTooltip && (
						<div className='absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-yellow-400 text-[9px] px-2 py-1 rounded z-50 whitespace-nowrap'>
							CLICK TO COLLECT BONUS GOLD 💰
						</div>
					)}
					
					{biome === 'grounds' && level && level > 1 && (
						<>
							{level > 1 && (
								<span className='opacity-75 absolute top-0.5 right-0.5 text-[6px] bg-black w-3 h-3 aspect-square flex items-center justify-center leading-0 font-bold text-purple-600 rounded-full'>
									⭐
								</span>
							)}

							{/* Building icon */}
							<span className='absolute bottom-0.5 right-0.5 text-[10px]'>
								{BUILDINGS[building as BuildingType]?.icon}
							</span>
							{/* Resource icons for building bonuses */}
							<div className='absolute bottom-0.5 left-0.5 flex gap-0.5 text-[8px]'>
								{BUILDINGS[building as BuildingType]?.resourceGeneration &&
									Object.entries(
										BUILDINGS[building as BuildingType].resourceGeneration
									).map(([resource, rate]) => {
										if (!rate) return null;
										return (
											<span key={resource} className='text-green-400'>
												{
													RESOURCE_ICONS[
														resource as keyof typeof RESOURCE_ICONS
													]
												}
											</span>
										);
									})}
							</div>
						</>
					)}
				</div>

				{(isOwned || isAdjacent) && (
					<div className='absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity duration-200'>
						<div className='bg-gray-900 rounded-lg shadow-xl p-2 whitespace-nowrap border border-gray-700'>
							<TileStatus
								biome={biome}
								isOwned={isOwned}
								isAdjacent={isAdjacent}
								level={level}
								x={x}
								y={y}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Castle Upgrade Dialog */}
			{showCastleDialog && (
				<CastleUpgradeDialog onClose={() => setShowCastleDialog(false)} />
			)}

			{/* Building Selection Dialog */}
			{showBuildingDialog && (
				<BuildingSelectionDialog
					isOpen={showBuildingDialog}
					onClose={() => setShowBuildingDialog(false)}
					onSelect={handleBuildingSelect}
				/>
			)}
		</>
	);
};

Tile.displayName = 'Tile';

export default memo(Tile);
