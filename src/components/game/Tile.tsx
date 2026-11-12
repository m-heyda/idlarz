import React, { memo, useState } from 'react';
import { TileProps, type MonsterType } from '@/types/game';
import { CASTLE_X, CASTLE_Y, CASTLE_UPGRADE } from '@/config/castle';
import { TILE_SIZE } from '@/config/biomes';
import { useMapSource } from './mapSource';
import { castleLevelOf, inCastleRange, MAX_CASTLE_RANGE_RADIUS } from '@/lib/castleWard';
import { getTile } from '@/utils/world';
import { cn } from '@/lib/utils';
import audioManager from '@/utils/audioManager';
import PixelIcon, { PixelSheet } from './PixelIcon';
import CastleSprite from './CastleSprite';
import CastleTimerBadge from './CastleTimerBadge';
import PetSprite from './pets/PetSprite';
import { usePetStore } from '@/stores/petStore';
import { maxLevelOf, monsterAt } from '@/lib/monsters';
import { useWindowStore } from '@/stores/windowStore';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { useTipDismiss } from '@/hooks/useTipDismiss';
import TileMonster from './TileMonster';
import TileTooltip from './TileTooltip';
import { openTileMenu } from './TileMenu';
import { buildingDef } from '@/catalog/buildings';

const Tile: React.FC<TileProps> = ({ biome, isOwned, x, y, level, canAfford = false }) => {
	const { game, onTile, drag } = useMapSource();
	// Only primitives are read from the store: a tile re-renders for its own chest, monster or castle level, not for every change of the map
	const buyTile = game((state) => state.buyTile);
	const collectChest = game((state) => state.collectChest);
	const startFight = game((state) => state.startFight);
	// string selector: the tile re-renders when its monster appears, changes level or leaves, not on every tick
	const monsterKey = game((state) => {
		const m = monsterAt(state.monsters, x, y);
		return m
			? `${m.id}:${m.type}:${m.level}:${m.lucky ? 1 : 0}:${maxLevelOf(m.spawnLevel, { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige }, m.growCap)}:${m.art ?? ''}`
			: '';
	});
	const [monsterId, monsterType, monsterLevel, monsterLucky, monsterMax, monsterArt] = monsterKey ? monsterKey.split(':') : [];
	// the battle queue: this monster's place in the line (0: not queued) and whether clicks now join the line instead of starting a fight
	const monsterTicket = game((state) => (monsterId ? monsterAt(state.monsters, x, y)?.ticket : undefined));
	const queuePos = useGameStore((state) => (monsterTicket === undefined ? 0 : state.combat.queue.findIndex((q) => q.n === monsterTicket) + 1));
	const lineOpen = useGameStore((state) => !!state.combat.fight || state.combat.queue.length > 0);
	// the cosmetic pet that walks around the castle (the first one the account owns; only the castle tile reads it)
	const petId = usePetStore((state) => (biome === 'castle' ? state.owned[0] : undefined));
	const [isShaking, setIsShaking] = useState(false);
	const [showChestTooltip, setShowChestTooltip] = useState(false);
	const [hovered, setHovered] = useState(false);
	// no stuck tooltip: a scroll, click, Escape, blur or a pointer that is no longer over this tile (a window opened over it, the monster replaced) hides it
	useTipDismiss(
		hovered,
		() => {
			setHovered(false);
			setShowChestTooltip(false);
		},
		(target) => !!target.closest(`#tile-${x}-${y}`),
	);

	// Check if this tile has a chest
	const hasChest = game((state) => isOwned && !!getTile(state.tiles, x, y)?.hasChest);

	// The building on this tile, "id:level" ('' with none, and always '' while the building system is off): only this string is read, so a tile re-renders for its own building
	const buildingKey = game((state) => {
		const t = isOwned ? getTile(state.tiles, x, y) : undefined;
		return t?.building ? `${t.building}:${t.buildingLevel ?? 1}` : '';
	});
	const [buildingId, buildingLevel] = buildingKey ? buildingKey.split(':') : [];
	const building = buildingDef(buildingId);

	// The map only mounts a tile that is not explored when it touches explored land: it can be bought
	const isAdjacent = !isOwned;

	const castleLevel = game((state) => (biome === 'castle' ? castleLevelOf(state.tiles) : 1));

	// Owned tiles around the castle get gold sparkles: they are inside the castle's range (it grows from castle level 8). A tile
	// farther than the biggest range never reads the castle level.
	const mayBeInRange = isOwned && biome !== 'castle' && Math.max(Math.abs(x - CASTLE_X), Math.abs(y - CASTLE_Y)) <= MAX_CASTLE_RANGE_RADIUS;
	const inRange = game((state) => mayBeInRange && inCastleRange(x, y, castleLevelOf(state.tiles)));

	const handleClick = (e: React.MouseEvent) => {
		// the map lab: a drawing tool already used the press (see Grid); otherwise the lab decides what a click does
		if (drag) return;
		if (onTile) {
			onTile(x, y, 0);
			return;
		}
		// A monster on this tile: a (real) click asks the server to start the fight against it, auto-battle or not; no chest, no gold
		if (isOwned && monsterKey) {
			e.stopPropagation();
			// the click sound is for starting a fight: a click that only joins or leaves the queue is silent (it sounded like a purchase)
			const lineWasOpen = lineOpen;
			if (e.nativeEvent.isTrusted && startFight(Number(monsterId)) && !lineWasOpen) audioManager.playSound('click');
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
			// A building: its window (art, lore, output, level, the next level's price and time, Upgrade)
			if (building) {
				audioManager.playSound('click');
				useUiStore.getState().openBuildingModal(x, y);
				return;
			}

			// Castle tile: the upgrade dialog; a castle that cannot be upgraded any further opens the rebirth (Embers) window
			if (biome === 'castle') {
				audioManager.playSound('click');
				if (castleLevel >= CASTLE_UPGRADE.maxLevel) useUiStore.getState().toggleRebirth();
				else useWindowStore.getState().openWindow('castle');
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

	// Right click on an explored tile opens the tile menu (see TileMenu); unexplored tiles fall through to the global menu alone.
	const handleContextMenu = (e: React.MouseEvent) => {
		if (onTile || drag) {
			e.preventDefault();
			onTile?.(x, y, 2);
			return;
		}
		if (!isOwned) return;
		openTileMenu(e, {
			x,
			y,
			biome,
			game,
			monster: monsterKey ? { id: Number(monsterId), type: monsterType as MonsterType } : undefined,
			queuePos,
			lineOpen,
			hasChest,
		});
	};

	return (
		<>
			<div
				id={`tile-${x}-${y}`}
				data-tutorial={!isOwned && isAdjacent ? 'tile-buy' : isOwned && biome === 'castle' ? 'castle' : hasChest ? 'chest' : monsterKey ? 'monster' : undefined}
				className={cn('absolute transition-all duration-200 ease-in-out select-none', {
					'opacity-100': isOwned,
					// the ground itself is drawn by TerrainLayer; a tile is a transparent hit area with its overlays
					'tile-unknown': !isOwned && isAdjacent,
					'tile-owned': isOwned,
					'hover:z-10 cursor-pointer border border-transparent': !isOwned && isAdjacent,
					'hover:border-green-700': !isOwned && isAdjacent && canAfford,
					'hover:border-red-700 cursor-not-allowed': !isOwned && isAdjacent && !canAfford,
					'border-2 border-amber-300': castleLevel >= CASTLE_UPGRADE.maxLevel && biome === 'castle',
					'group hover:z-20': true,
					'opacity-75 border-2 border-red-500': isShaking,
					'cursor-pointer': isOwned && (biome === 'castle' || hasChest || !!monsterKey || !!building),
					'tile-has-monster': isOwned && !!monsterKey,
					'castle-tile': isOwned && biome === 'castle',
				})}
				style={{
					width: TILE_SIZE,
					height: TILE_SIZE,
					transform: `translate(${x * TILE_SIZE}px, ${y * TILE_SIZE}px)`,
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
				role='button'
			>
				<div className='w-full h-full flex items-center justify-center relative'>
					{isOwned && biome === 'castle' && <CastleSprite level={castleLevel} />}
					{!isOwned && isAdjacent && <PixelIcon name='unknown' alt='Unexplored' className='unknown-mark' />}
					{biome === 'castle' && <span className='tile-badge'>{castleLevel}</span>}
					{isOwned && biome === 'castle' && <CastleTimerBadge />}
					{isOwned && biome === 'castle' && petId && <PetSprite petId={petId} />}

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

					{building && (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={building.art}
							alt={`${building.label}, level ${buildingLevel}`}
							className='absolute pointer-events-none'
							style={{ width: TILE_SIZE * 1.1, bottom: 2, imageRendering: 'pixelated' }}
						/>
					)}
					{building && <span className='tile-badge'>{buildingLevel}</span>}

					{isOwned && monsterKey && (
						<TileMonster
							id={Number(monsterId)}
							type={monsterType as MonsterType}
							level={Number(monsterLevel)}
							max={Number(monsterMax)}
							lucky={monsterLucky === '1'}
							art={monsterArt || undefined}
							queued={queuePos}
						/>
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
				</div>
			</div>

			{/* Tooltips live in the map's tooltip layer (above the ambient critters), anchored to this tile */}
			{hovered && (
				<TileTooltip
					biome={biome}
					isOwned={isOwned}
					isAdjacent={isAdjacent}
					x={x}
					y={y}
					level={level}
					hasChest={hasChest}
					showChestTip={showChestTooltip}
					monster={
						monsterKey ? { id: Number(monsterId), type: monsterType as MonsterType, level: Number(monsterLevel), art: monsterArt || undefined } : undefined
					}
					queued={queuePos}
					lineOpen={lineOpen}
					building={building ? { id: building.id, level: Number(buildingLevel) } : undefined}
				/>
			)}
		</>
	);
};

Tile.displayName = 'Tile';

export default memo(Tile);
