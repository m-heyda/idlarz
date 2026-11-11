import { buildingDef } from '@/catalog/buildings';
import { idolDef } from '@/catalog/idols';
import { idolValueText } from '@/lib/idolEconomy';
import React from 'react';
import { createPortal } from 'react-dom';
import { type BiomeType, type MonsterType } from '@/types/game';
import { TILE_SIZE } from '@/config/biomes';
import { MONSTERS } from '@/config/combatConfig';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import { formatCompact } from '@/utils/formatters';
import { growthSecondsLeft, isBoss, maxLevelOf, monsterStats } from '@/lib/monsters';
import { useIsDiscovered } from '@/stores/bestiaryStore';
import { useMapSource } from './mapSource';
import { useMapTipLayer } from './MapTipLayer';
import { TileStatus } from './TileStatus';

/** Hover card of a monster: level, HP, time to its next level, boss traits and the call to fight. Reads the age at render time. */
const MonsterTip: React.FC<{ id: number; type: MonsterType; level: number; art?: string; queued: number; lineOpen: boolean }> = ({
	id,
	type,
	level,
	art,
	queued,
	lineOpen,
}) => {
	const state = useMapSource().game.getState();
	const wip = art ? MONSTER_CATALOG.find((m) => m.id === art) : undefined;
	if (wip) {
		return (
			<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs'>
				<div className='px-tip-title'>
					{wip.grade === 'boss' ? '☠ ' : ''}
					{wip.label} - Lv {formatCompact(level)}
				</div>
				<div className='px-tip-muted'>Work in progress: art preview only</div>
			</div>
		);
	}
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
			{monster && (
				<div className='px-tip-muted'>
					Level {formatCompact(level)} of{' '}
					{formatCompact(maxLevelOf(monster.spawnLevel, { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige }, monster.growCap))}
					{nextLevel !== null ? `, grows in ${Math.max(1, Math.ceil(nextLevel / 60))} min` : ' - fully grown'}
				</div>
			)}
			{isBoss(type) && (
				<div className='px-tip-muted'>
					Crits {stats.critChance}%, resists Stun {stats.stunResist}%. Beat it within {MONSTERS[type].timeLimitSec} seconds
				</div>
			)}
			<div className='text-[#f0d27a]'>
				{queued > 0 ? `In the queue (${queued}) - click to leave it` : lineOpen ? 'Click to add to the queue' : 'Click to fight'}
			</div>
		</div>
	);
};

/** The building on the tile: its name and level; an Idol also says what it gives now and that its level survives a rebirth. */
const BuildingTip: React.FC<{ id: string; level: number }> = ({ id, level }) => {
	const def = buildingDef(id);
	const idol = idolDef(id);
	if (!def) return null;
	return (
		<div className='mt-1 border-t border-[#5a4a2a] pt-1 text-xs'>
			<div className='text-[#f0d27a]'>
				{def.label} (level {level})
			</div>
			{idol && (
				<>
					<div>
						{idolValueText(idol, level)}
						{!idol.applied && ' (coming soon: not applied yet)'}
					</div>
					<div className='text-[#a89878]'>Its level is kept when you rebirth; rebuild it free on any {idol.biome} tile.</div>
				</>
			)}
		</div>
	);
};

export interface TileTooltipProps {
	biome: BiomeType;
	isOwned: boolean;
	isAdjacent: boolean;
	x: number;
	y: number;
	level?: number;
	hasChest: boolean;
	/** The chest line shows only while the pointer is on the tile itself */
	showChestTip: boolean;
	/** The monster on the tile, as the parts of the tile's monster key; undefined: none */
	monster?: { id: number; type: MonsterType; level: number; art?: string };
	queued: number;
	lineOpen: boolean;
	/** The building standing on the tile (catalog id) and its level */
	building?: { id: string; level: number };
}

/**
 * The tile's tooltips, mounted only while the pointer is on the tile. They live in the map's tooltip layer (above the ambient
 * critters), anchored to the tile, so nothing here costs a tile that is not hovered.
 */
const TileTooltip: React.FC<TileTooltipProps> = ({ biome, isOwned, isAdjacent, x, y, level, hasChest, showChestTip, monster, queued, lineOpen, building }) => {
	const tipLayer = useMapTipLayer();
	const discovered = useIsDiscovered(monster?.type ?? '');
	if (!tipLayer || !(isOwned || isAdjacent)) return null;
	// a monster the player has not fought yet gets no tooltip at all (not even the biome card): it is a "?" until the first fight
	const tipMonster = monster && (monster.art || discovered) ? monster : undefined;
	if (isOwned && monster && !tipMonster) return null;
	return createPortal(
		<div className='absolute' style={{ left: x * TILE_SIZE, top: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE }}>
			{isOwned && monster && <MonsterTip id={monster.id} type={monster.type} level={monster.level} art={monster.art} queued={queued} lineOpen={lineOpen} />}
			{isOwned && hasChest && showChestTip && (
				<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max px-tooltip text-xs text-[#f0d27a]'>
					{biome === 'lake' ? 'Something glints in the water. Click to open' : 'Click to open the treasure chest'}
				</div>
			)}
			{/* a monster has its own tooltip: the biome card would only cover it */}
			{!(isOwned && monster) && (
				<div className='map-tip map-tip-in absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full w-max min-w-[190px] max-w-[290px]'>
					<div className='px-tooltip break-words'>
						<TileStatus biome={biome} isOwned={isOwned} isAdjacent={isAdjacent} level={level} x={x} y={y} />
						{isOwned && building && <BuildingTip id={building.id} level={building.level} />}
					</div>
				</div>
			)}
		</div>,
		tipLayer,
	);
};

export default TileTooltip;
