import React, { memo, useState } from 'react';
import { formatCompact } from '@/utils/formatters';
import { createPortal } from 'react-dom';
import { TileProps } from '@/types/game';
import {
	CASTLE_X,
	CASTLE_Y,
	BIOMES,
	BUILDINGS,
	BuildingType,
	TILE_TAP,
	CASTLE_FORTRESS,
	CASTLE_UPGRADE,
	TILE_SIZE,
} from '@/config/gameConfig';
import '@/styles/Buildings.css';
import { useGameStore } from '@/stores/gameStore';
import { castleLevelOf, inCastleRange, MAX_CASTLE_RANGE_RADIUS } from '@/lib/castleWard';
import { getTile } from '@/utils/world';
import { canBuildOn } from '@/utils/gameUtils';
import { cn } from '@/lib/utils';
import audioManager from '@/utils/audioManager';
import { queueTileTap } from '@/lib/floatText';
import PixelIcon, { PixelSheet } from './PixelIcon';
import CastleSprite from './CastleSprite';
import { BUILDING_PIXEL_ICONS, BUILDING_GLOW } from '@/config/pixelIcons';
import { TileStatus } from './TileStatus';
import MonsterSprite from './MonsterSprite';
import { growthSecondsLeft, isBoss, monsterAt, monsterStats } from '@/lib/monsters';
import { MONSTERS } from '@/config/combatConfig';
import CastleUpgradeDialog from './CastleUpgradeDialog';
import { useMapTipLayer } from './MapTipLayer';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import { openMenuAt } from '@/lib/globalMenu';
import '@/styles/ContextMenu.css';

/** Hover card of a monster: level, HP, time to its next level, boss traits and the call to fight. Reads the age at render time. */
const MonsterTip: React.FC<{ id: number; type: 'rat' | 'ratKing'; level: number }> = ({ id, type, level }) => {
	const state = useGameStore.getState();
	const monster = state.monsters.find((m) => m.id === id);
	const nextLevel = monster ? growthSecondsLeft(monster, { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige }) : null;
	const stats = monsterStats(type, level);
	return (
		<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs'>
			<div className='px-tip-title'>
				{isBoss(type) ? '☠ ' : ''}
				{MONSTERS[type].label} - Lv {formatCompact(level)} - {formatCompact(stats.maxHp)} HP
			</div>
			{isBoss(type) && <div className='text-[#ff8a6a] font-bold'>BOSS</div>}
			{nextLevel !== null && (
				<div className='px-tip-muted'>Grows stronger in {Math.max(1, Math.ceil(nextLevel / 60))} min</div>
			)}
			{isBoss(type) && (
				<div className='px-tip-muted'>
					Crits {stats.critChance}%, resists Stun {stats.stunResist}%. Beat it within {MONSTERS.ratKing.timeLimitSec} seconds for a Rattatui piece
				</div>
			)}
			<div className='text-[#f0d27a]'>Click to fight</div>
		</div>
	);
};

const Tile: React.FC<TileProps> = ({
	biome,
	isOwned,
	x,
	y,
	level,
	building,
	canAfford = false,
}) => {
	// Only primitives are read from the store: a tile re-renders for its own chest, monster or castle level, not for every change of the map
	const buyTile = useGameStore((state) => state.buyTile);
	const collectChest = useGameStore((state) => state.collectChest);
	const tapTile = useGameStore((state) => state.tapTile);
	const startFight = useGameStore((state) => state.startFight);
	// string selector: the tile re-renders when its monster appears, changes level or leaves, not on every tick
	const monsterKey = useGameStore((state) => {
		const m = monsterAt(state.monsters, x, y);
		return m ? `${m.id}:${m.type}:${m.level}:${m.lucky ? 1 : 0}` : '';
	});
	const [monsterId, monsterType, monsterLevel, monsterLucky] = monsterKey ? monsterKey.split(':') : [];
	const [isShaking, setIsShaking] = useState(false);
	const [showCastleDialog, setShowCastleDialog] = useState(false);
	const [showChestTooltip, setShowChestTooltip] = useState(false);
	const [hovered, setHovered] = useState(false);
	const tipLayer = useMapTipLayer();
	const [tapped, setTapped] = useState(false);
	const [cooling, setCooling] = useState(false);

	// Check if this tile has a chest
	const hasChest = useGameStore((state) => isOwned && !!getTile(state.tiles, x, y)?.hasChest);

	// The map only mounts a tile that is not explored when it touches explored land: it can be bought
	const isAdjacent = !isOwned;

	const hasBuilding = !!building;
	const castleLevel = useGameStore((state) => (biome === 'castle' ? castleLevelOf(state.tiles) : 1));
	const isGlowingCastle = biome === 'castle' && castleLevel >= CASTLE_UPGRADE.glowFromLevel;
	// from the fortress level the castle stands on cobbles inside walls: no purple border, no golden tile aura
	const isFortress = biome === 'castle' && castleLevel >= CASTLE_FORTRESS.fromLevel;

	// Owned tiles around the castle get gold sparkles: they are inside the castle's range (it grows from castle level 8). A tile
	// farther than the biggest range never reads the castle level.
	const mayBeInRange =
		isOwned &&
		biome !== 'castle' &&
		Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= MAX_CASTLE_RANGE_RADIUS;
	const inRange = useGameStore((state) => mayBeInRange && inCastleRange(x, y, castleLevelOf(state.tiles)));

	const handleClick = (e: React.MouseEvent) => {
		// A monster on this tile: a (real) click asks the server to start the fight against it, auto-battle or not; no tile tap, no chest, no gold
		if (isOwned && monsterKey) {
			e.stopPropagation();
			if (e.nativeEvent.isTrusted && startFight(Number(monsterId))) audioManager.playSound('click');
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

		// Tapping an owned tile also yields a slice of that tile's own output (rate-limited per tile); the castle opens its dialog instead
		if (isOwned && biome !== 'castle') {
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
			// Castle tile: the upgrade dialog; a castle that cannot be upgraded any further opens the rebirth (Legacy) window
			if (biome === 'castle') {
				audioManager.playSound('click');
				if (castleLevel >= CASTLE_UPGRADE.maxLevel) useUiStore.getState().toggleLegacy();
				else setShowCastleDialog(true);
				return;
			}

			// For any owned tile, show tooltip
			// toggleTooltip(); // This function is not defined in the provided code
			return;
		}

		if (isAdjacent && !isOwned) {
			if (canAfford) {
				if (buyTile(x, y)) audioManager.playSound('purchase');
			} else {
				// Only play wrong sound and shake for adjacent unaffordable tiles
				setIsShaking(true);
				audioManager.playSound('wrong');
				setTimeout(() => setIsShaking(false), 300);
			}
		}
	};

	// Right click on an explored tile: what can be done here (dismiss a monster, open a chest, build, highlight the area),
	// then the global entries. Unexplored tiles fall through to the global menu alone.
	const handleContextMenu = (e: React.MouseEvent) => {
		if (!isOwned) return;
		e.preventDefault();
		const ui = useUiStore.getState();
		const own: ContextMenuItem[] = [];
		if (monsterKey) {
			const id = Number(monsterId);
			own.push(
				{ id: 'fight', label: `Fight ${MONSTERS[monsterType as 'rat' | 'ratKing'].label}`, onSelect: () => void startFight(id) },
				{ id: 'dismiss', label: `Dismiss ${MONSTERS[monsterType as 'rat' | 'ratKing'].label}...`, danger: true, onSelect: () => ui.askDismissMonster(id) }
			);
		} else if (hasChest) {
			own.push({ id: 'chest', label: 'Open chest', onSelect: () => void collectChest(x, y) });
		}
		if (biome !== 'castle') {
			if (!hasBuilding) {
				const blocked = !!monsterKey || hasChest;
				own.push({
					id: 'build',
					label: 'Build here...',
					disabled: blocked || !canBuildOn(getTile(useGameStore.getState().tiles, x, y)),
					hint: blocked ? 'tile in use' : undefined,
					onSelect: () => ui.openBuildDialog(x, y),
				});
			}
			own.push({
				id: 'highlight',
				label: `Highlight this ${BIOMES[biome]?.label ?? biome} area`,
				onSelect: () => ui.flashCluster(useGameStore.getState().tiles, x, y),
			});
		}
		openMenuAt(e.clientX, e.clientY, biome === 'castle' ? 'Castle' : BIOMES[biome]?.label ?? biome, own);
	};

	return (
		<>
			<div
				id={`tile-${x}-${y}`}
				className={cn(
					'absolute transition-all duration-200 ease-in-out select-none',
					{
						'opacity-100': isOwned,
						// the ground itself is drawn by TerrainLayer; a tile is a transparent hit area with its overlays
						'tile-unknown': !isOwned && isAdjacent,
						'tile-owned': isOwned,
						'hover:z-10 cursor-pointer border border-transparent':
							!isOwned && isAdjacent,
						'hover:border-green-700': !isOwned && isAdjacent && canAfford,
						'hover:border-red-700 cursor-not-allowed':
							!isOwned && isAdjacent && !canAfford,
						'border-2 border-amber-300':
							castleLevel >= CASTLE_UPGRADE.maxLevel &&
							biome === 'castle' &&
							!isFortress,
						'group hover:z-20': true,
						'opacity-75 border-2 border-red-500': isShaking,
						'cursor-pointer':
							isOwned && (biome === 'castle' || hasChest || !!monsterKey),
						'tile-has-monster': isOwned && !!monsterKey,
						'castle-tile': isOwned && biome === 'castle',
						'castle-max-tile': isOwned && isGlowingCastle && !isFortress,
						'tile-fortress': isOwned && isFortress,
						'tile-cooldown': cooling,
									}
				)}
				style={{
					width: TILE_SIZE,
					height: TILE_SIZE,
					transform: `translate(${x * TILE_SIZE}px, ${y * TILE_SIZE}px)`,
					...({ '--cd': `${TILE_TAP.cooldownMs}ms` } as React.CSSProperties),
				}}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
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
					{isOwned && biome === 'castle' && <CastleSprite level={castleLevel} />}
					{!isOwned && isAdjacent && (
						<PixelIcon name='unknown' alt='Unexplored' className='unknown-mark' />
					)}
					{biome === 'castle' && (
						<span className='tile-badge'>{castleLevel}</span>
					)}

					{inRange && (
						<span className='range-sparks' aria-hidden>
							{[0, 1].map((k) => {
								const h = (((x * 7 + y * 13 + k * 5) % 11) + 11) % 11; // 0..10, also for negative tiles
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
						<MonsterSprite type={monsterType as 'rat' | 'ratKing'} level={Number(monsterLevel)} lucky={monsterLucky === '1'} />
					)}

					{/* Bonus treasure chest on the tile */}
					{isOwned && hasChest && biome === 'lake' && (
							<span className='tile-chest-ripple' aria-label='Something glints in the water'>
								<i />
								<i />
								<i />
							</span>
						)}
						{isOwned && hasChest && biome !== 'lake' && (
						<span className='tile-chest-wrap'>
							<span className='tile-chest'>
								<PixelSheet name='chest_map_anim' frames={4} durationMs={1600} alt='Treasure chest' />
							</span>
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
							<MonsterTip id={Number(monsterId)} type={monsterType as 'rat' | 'ratKing'} level={Number(monsterLevel)} />
						)}
						{isOwned && hasChest && showChestTooltip && (
							<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs text-[#f0d27a]'>
								{biome === 'lake' ? 'Something glints in the water. Click to open' : 'Click to open the treasure chest'}
							</div>
						)}
						{/* a monster has its own tooltip: the biome card would only cover it */}
						{!(isOwned && monsterKey) && (
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
						)}
					</div>,
					tipLayer
				)}

			{/* Dialogs go to <body>: inside the map they would be scaled and panned together with the tiles */}
			{showCastleDialog &&
				createPortal(<CastleUpgradeDialog onClose={() => setShowCastleDialog(false)} />, document.body)}
		</>
	);
};

Tile.displayName = 'Tile';

export default memo(Tile);
