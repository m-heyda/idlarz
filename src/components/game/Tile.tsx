import React, { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TileProps } from '@/types/game';
import {
	GRID_SIZE,
	GRID_HEIGHT,
	GRID_CENTER_X,
	GRID_CENTER_Y,
	BUILDINGS,
	BuildingType,
	TILE_TAP,
	CASTLE_UPGRADE,
	CASTLE_RANGE,
	TILE_SIZE,
} from '@/config/gameConfig';
import '@/styles/Buildings.css';
import { useGameStore } from '@/stores/gameStore';
import {
	calculateTileCost,
	canAffordBundle,
	effectiveTileDiscount,
	countOwnedTiles,
	tileCostAsResources,
} from '@/utils/gameUtils';
import { cn } from '@/lib/utils';
import audioManager from '@/utils/audioManager';
import { queueTileTap } from '@/lib/floatText';
import { blendKey, openSides, parseBlendKey } from '@/utils/biomeBlend';
import ResourceIcon from './ResourceIcon';
import PixelIcon from './PixelIcon';
import CastleSprite from './CastleSprite';
import { BIOME_PIXEL_ICONS, BUILDING_PIXEL_ICONS, BUILDING_GLOW } from '@/config/pixelIcons';
import { TileStatus } from './TileStatus';
import MonsterSprite from './MonsterSprite';
import { monsterAt, monsterStats, tierSecondsLeft } from '@/lib/monsters';
import { MONSTERS } from '@/config/combatConfig';
import CastleUpgradeDialog from './CastleUpgradeDialog';
import BuildingSelectionDialog from './BuildingSelectionDialog';
import { useMapTipLayer } from './MapTipLayer';

/** Hover card of a monster: tier, HP, time to the next tier and the call to fight. Reads the age at render time. */
const MonsterTip: React.FC<{ id: number; type: 'rat' | 'ratKing'; tier: number }> = ({ id, type, tier }) => {
	const monster = useGameStore.getState().monsters.find((m) => m.id === id);
	const nextTier = monster ? tierSecondsLeft(monster) : null;
	return (
		<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs'>
			<div className='px-tip-title'>
				{MONSTERS[type].label}
				{type === 'rat' ? ` - Tier ${tier}` : ''} - {monsterStats(type, tier).maxHp} HP
			</div>
			{nextTier !== null && (
				<div className='px-tip-muted'>Grows stronger in {Math.max(1, Math.ceil(nextTier / 60))} min</div>
			)}
			{type === 'ratKing' && <div className='px-tip-muted'>Beat it within 60 seconds</div>}
			<div className='text-[#f0d27a]'>Click to fight</div>
		</div>
	);
};

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
	// string selectors: re-render only when this tile's own transitions / open sides change
	const blendStr = useGameStore((state) => blendKey(state.tiles, x, y));
	const open = useGameStore((state) => openSides(state.tiles, x, y));
	const blendPieces = useMemo(() => parseBlendKey(blendStr), [blendStr]);
	// lake waves animate from mount: start every lake tile at the shared phase so neighbours never show a seam
	const [lakeDelay] = useState(() =>
		typeof performance === 'undefined' ? 0 : -((performance.now() / 1000) % 9)
	);
	const buyTile = useGameStore((state) => state.buyTile);
	const resources = useGameStore((state) => state.resources);
	const characterStats = useGameStore((state) => state.characterStats);
	const prestige = useGameStore((state) => state.prestige);
	const upgradeGroundsTile = useGameStore((state) => state.upgradeGroundsTile);
	const collectChest = useGameStore((state) => state.collectChest);
	const tapTile = useGameStore((state) => state.tapTile);
	const startFight = useGameStore((state) => state.startFight);
	// string selector: the tile re-renders when its monster appears, changes tier or leaves, not on every tick
	const monsterKey = useGameStore((state) => {
		const m = monsterAt(state.monsters, x, y);
		return m ? `${m.id}:${m.type}:${m.tier}` : '';
	});
	const [monsterId, monsterType, monsterTier] = monsterKey ? monsterKey.split(':') : [];
	const isBiomeSelectionActive = useGameStore(
		(state) => state.biomeSelectionActive
	);
	const pendingTileCoords = useGameStore((state) => state.pendingTileCoords);
	const selectBiome = useGameStore((state) => state.selectBiome);
	const [isShaking, setIsShaking] = useState(false);
	const [showCastleDialog, setShowCastleDialog] = useState(false);
	const [showBuildingDialog, setShowBuildingDialog] = useState(false);
	const [showChestTooltip, setShowChestTooltip] = useState(false);
	const [hovered, setHovered] = useState(false);
	const tipLayer = useMapTipLayer();
	const [tapped, setTapped] = useState(false);
	const [cooling, setCooling] = useState(false);

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

	const hasBuilding = biome === 'grounds' && !!building && (level ?? 1) > 1;
	const castleLevel = tiles?.[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level ?? 1;
	const isGlowingCastle = biome === 'castle' && castleLevel >= CASTLE_UPGRADE.glowFromLevel;

	// Owned neighbours of the castle get gold sparkles: they are inside the castle's range
	const inCastleRange =
		isOwned &&
		biome !== 'castle' &&
		Math.abs(x - GRID_CENTER_X) <= CASTLE_RANGE.radius &&
		Math.abs(y - GRID_CENTER_Y) <= CASTLE_RANGE.radius;

	const ownedTilesCount = useMemo(() => countOwnedTiles(tiles), [tiles]);

	const tileCost = useMemo(
		() => calculateTileCost(ownedTilesCount, effectiveTileDiscount(characterStats, prestige)),
		[ownedTilesCount, characterStats, prestige]
	);

	const canAfford = canAffordBundle(resources, tileCostAsResources(tileCost));

	const handleClick = (e: React.MouseEvent) => {
		// First priority: If in biome selection mode, handle selection
		if (isBiomeSelectionActive && pendingTileCoords) {
			selectBiome(biome);
			return;
		}

		// A monster on this tile: clicking it opens the fight (no tile tap, no chest)
		if (isOwned && monsterKey) {
			if (startFight(Number(monsterId))) audioManager.playSound('click');
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

		// Tapping an owned tile also yields a slice of that tile's own output (rate-limited per tile)
		if (isOwned) {
			const tap = tapTile(x, y, {
				eventId: e.nativeEvent.timeStamp,
				now: performance.now(),
				trusted: e.nativeEvent.isTrusted,
			});
			if (tap) {
				audioManager.playSound('click');
				queueTileTap(tap.items, tap.lucky);
				setTapped(true);
				setCooling(true);
				setTimeout(() => setTapped(false), 160);
				setTimeout(() => setCooling(false), TILE_TAP.cooldownMs);
			}
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
			} else if (tileCost.gold > 0) {
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
			if (upgradeGroundsTile(x, y, buildingType)) {
				audioManager.playSound('purchase');
			} else {
				audioManager.playSound('wrong');
			}
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
						'tile-unknown': !isOwned && isAdjacent,
						[`tile-ground tile-ground-${hasBuilding ? 'yard' : biome} tile-owned`]: isOwned,
						'opacity-75': farAwayTile,
						'hover:z-10 cursor-pointer border border-gray-800':
							!isOwned && isAdjacent,
						'hover:border-green-800': !isOwned && isAdjacent && canAfford,
						'hover:border-red-800 cursor-not-allowed':
							!isOwned && isAdjacent && !canAfford,
						'border border-purple-400': biome === 'castle',
						'border-2 border-amber-300':
							(tiles[GRID_CENTER_Y]?.[GRID_CENTER_X]?.level ?? 0) >= CASTLE_UPGRADE.maxLevel &&
							biome === 'castle',
						'group hover:z-20': true,
						'opacity-75 border-2 border-red-500': isShaking,
						'cursor-pointer':
							isOwned && (biome === 'castle' || biome === 'grounds' || hasChest || !!monsterKey),
						'tile-has-monster': isOwned && !!monsterKey,
						'castle-tile': isOwned && biome === 'castle',
						'castle-max-tile': isOwned && isGlowingCastle,
						'border-2 border-amber-400': isOwned && hasChest,
						'tile-cooldown': cooling,
					},
					open.split('').map((side) => `open-${side}`)
				)}
				style={{
					...style,
					...(biome === 'lake' && isOwned ? { animationDelay: `${lakeDelay.toFixed(2)}s` } : null),
					...({ '--cd': `${TILE_TAP.cooldownMs}ms` } as React.CSSProperties),
				}}
				onClick={handleClick}
				onMouseEnter={() => {
					setHovered(true);
					if (hasChest) setShowChestTooltip(true);
				}}
				onMouseLeave={() => {
					setHovered(false);
					setShowChestTooltip(false);
				}}
				role='button'>
				<div
					className={cn(
						'w-full h-full flex items-center justify-center relative',
						{ 'tile-tapped': tapped }
					)}>
					{blendPieces.map((b) =>
						b.ground.startsWith('shore-') || b.ground.startsWith('curb-') ? (
							<span
								key={b.piece}
								className='tile-trim'
								aria-hidden
								style={{ backgroundImage: `url('/pixel/bg/${b.ground}_${b.piece}_${b.variant}.png')` }}
							/>
						) : (
							<span
								key={b.piece}
								className='tile-blend'
								aria-hidden
								style={
									{
										'--src': `url('/pixel/bg/${b.ground === 'mystery' ? 'mystery' : `ground_${b.ground}`}.png')`,
										'--mask': `url('/pixel/bg/blend_${b.piece}_${b.variant}.png')`,
									} as React.CSSProperties
								}
							/>
						)
					)}
					{isOwned && biome === 'castle' && <CastleSprite level={castleLevel} />}
					{isOwned && !hasBuilding && BIOME_PIXEL_ICONS[biome] && (
						<PixelIcon name={BIOME_PIXEL_ICONS[biome]!} alt={biome} className='tile-icon' />
					)}
					{!isOwned && isAdjacent && (
						<PixelIcon name='unknown' alt='Unexplored' scale={2} className='unknown-mark' />
					)}
					{biome === 'castle' && (
						<span className='tile-badge'>{castleLevel}</span>
					)}

					{inCastleRange && (
						<span className='range-sparks' aria-hidden>
							{[0, 1].map((k) => {
								const h = (x * 7 + y * 13 + k * 5) % 11;
								return (
									<i
										key={k}
										className='range-spark'
										style={
											{
												'--x': `${22 + ((h * 9 + k * 31) % 60)}%`,
												'--d': `${-((h * 0.53 + k * 1.7) % 3.6).toFixed(2)}s`,
											} as React.CSSProperties
										}
									/>
								);
							})}
						</span>
					)}

					{isOwned && monsterKey && (
						<MonsterSprite type={monsterType as 'rat' | 'ratKing'} tier={Number(monsterTier)} />
					)}

					{/* Bonus treasure chest on the tile */}
					{isOwned && hasChest && (
						<span className='tile-chest-wrap'>
							<PixelIcon name='bonus_chest' alt='Bonus gold' className='tile-chest' />
							<i className='chest-twinkle' aria-hidden />
						</span>
					)}

					{hasBuilding && (
						<span
							className='tile-building'
							style={{ '--glow': BUILDING_GLOW[building as string] ?? '#ffd860' } as React.CSSProperties}>
							<PixelIcon
								name={BUILDING_PIXEL_ICONS[building as string]}
								alt={BUILDINGS[building as BuildingType]?.label ?? 'Building'}
								className='tile-icon'
							/>
						</span>
					)}
				</div>

			</div>

			{/* Tooltips live in the map's tooltip layer (above the ambient critters), anchored to this tile */}
			{tipLayer &&
				hovered &&
				(isOwned || isAdjacent) &&
				createPortal(
					<div className='absolute' style={{ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
						{isOwned && monsterKey && (
							<MonsterTip id={Number(monsterId)} type={monsterType as 'rat' | 'ratKing'} tier={Number(monsterTier)} />
						)}
						{isOwned && hasChest && showChestTooltip && (
							<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs text-[#f0d27a]'>
								Click to collect bonus gold <ResourceIcon resource='gold' />
							</div>
						)}
						<div className='map-tip map-tip-in absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full w-max min-w-[190px] max-w-[290px]'>
							<div className='px-tooltip break-words'>
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
					</div>,
					tipLayer
				)}

			{/* Dialogs go to <body>: inside the map they would be scaled and panned together with the tiles */}
			{showCastleDialog &&
				createPortal(<CastleUpgradeDialog onClose={() => setShowCastleDialog(false)} />, document.body)}

			{showBuildingDialog &&
				createPortal(
					<BuildingSelectionDialog
						isOpen={showBuildingDialog}
						onClose={() => setShowBuildingDialog(false)}
						onSelect={handleBuildingSelect}
					/>,
					document.body
				)}
		</>
	);
};

Tile.displayName = 'Tile';

export default memo(Tile);
