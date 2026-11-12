import { buildingDef } from '@/catalog/buildings';
import { BIOMES } from '@/config/biomes';
import { buildingOutput, ownedOfBiome, producerBonus } from '@/lib/buildings';
import { RESOURCES } from '@/catalog';
import { Tooltip, TipLine, TipSection } from '../../../packages/design-system/src/components/tooltips';
import { resourceIconUrl } from './hero/recipeUi';
import { idolDef } from '@/catalog/idols';
import { idolValueText } from '@/lib/idolEconomy';
import React from 'react';
import { createPortal } from 'react-dom';
import { type BiomeType, type MonsterType, type Resources } from '@/types/game';
import { TILE_SIZE } from '@/config/biomes';
import { MONSTERS } from '@/config/combatConfig';
import { MONSTER_CATALOG } from '@/catalog/monsters';
import { formatCompact, formatNumber } from '@/utils/formatters';
import { growthSecondsLeft, isBoss, maxLevelOf, monsterStats } from '@/lib/monsters';
import { useBestiaryStore, useIsDiscovered } from '@/stores/bestiaryStore';
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
	// the server's count of this type's kills (the bestiary store; a tip only shows for a type the player has met, so 0 reads as "none yet")
	const kills = useBestiaryStore((s) => s.kills[type] ?? 0);
	const wip = art ? MONSTER_CATALOG.find((m) => m.id === art) : undefined;
	const place = 'map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max';
	if (wip) {
		return (
			<div className={place}>
				<Tooltip title={`${wip.grade === 'boss' ? '☠ ' : ''}${wip.label}`} subtitle={`Lv ${formatCompact(level)}`} className='map-ds-tip'>
					<TipLine>Work in progress: art preview only</TipLine>
				</Tooltip>
			</div>
		);
	}
	const monster = state.monsters.find((m) => m.id === id);
	const nextLevel = monster ? growthSecondsLeft(monster, { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige }) : null;
	const stats = monsterStats(type, level);
	const boss = isBoss(type);
	return (
		<div className={place}>
			<Tooltip
				title={`${boss ? '☠ ' : ''}${MONSTERS[type].label}`}
				subtitle={`Lv ${formatCompact(level)} - ${formatCompact(stats.maxHp)} HP`}
				rarity={boss ? 'epic' : 'common'}
				banner={undefined}
				className='map-ds-tip'
			>
				{boss && <TipLine tone='red'>BOSS</TipLine>}
				<TipLine>Defeated: {formatCompact(kills)}</TipLine>
				{monster && (
					<TipLine>
						Level {formatCompact(level)} of{' '}
						{formatCompact(maxLevelOf(monster.spawnLevel, { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige }, monster.growCap))}
						{nextLevel !== null ? `, grows in ${Math.max(1, Math.ceil(nextLevel / 60))} min` : ' - fully grown'}
					</TipLine>
				)}
				{boss && (
					<TipLine>
						Crits {stats.critChance}%, resists Stun {stats.stunResist}%. Beat it within {MONSTERS[type].timeLimitSec} seconds
					</TipLine>
				)}
				<TipLine tone='gold'>{queued > 0 ? `In the queue (${queued}) - click to leave it` : lineOpen ? 'Click to add to the queue' : 'Click to fight'}</TipLine>
			</Tooltip>
		</div>
	);
};

/**
 * The building on the tile: its name and level, what it makes per hour now (with the biome bonus its output grows by), and that a click opens its window. An Idol says what it gives now and that its level survives a rebirth.
 * The output is before the castle and Ember bonuses, like the building window. Content only: the tile card wraps it.
 */
const BuildingTip: React.FC<{ id: string; level: number }> = ({ id, level }) => {
	const def = buildingDef(id);
	const idol = idolDef(id);
	const { game } = useMapSource();
	const tiles = game((state) => state.tiles);
	if (!def) return null;
	const owned = ownedOfBiome(tiles, def.biome);
	const output = idol ? null : buildingOutput(def, level, owned);
	const biomeLabel = BIOMES[def.biome]?.label ?? def.biome;
	const rows = output ? Object.entries(output).filter(([, amount]) => (amount ?? 0) > 0) : [];
	return (
		<>
			<TipSection>
				{def.label} (level {level})
			</TipSection>
			{rows.length > 0 && (
				<div className='ds-tip-rows'>
					{rows.map(([key, amount]) => (
						<div key={key} className='ds-tip-row'>
							<span>
								<img className='ds-tip-mini' src={resourceIconUrl(key)} alt='' />
								{RESOURCES[key as keyof Resources].label}
							</span>
							<span>+{formatNumber((amount ?? 0) * 3600)}/h</span>
						</div>
					))}
				</div>
			)}
			{output && (
				<TipLine>
					{biomeLabel} bonus: +{Math.round(producerBonus(owned) * 100)} % ({owned} tile{owned === 1 ? '' : 's'})
				</TipLine>
			)}
			{idol && (
				<>
					<TipLine tone='gold'>
						{idolValueText(idol, level)}
						{!idol.applied && ' (coming soon: not applied yet)'}
					</TipLine>
					<TipLine>Its level is kept when you rebirth; rebuild it free on any {idol.biome} tile.</TipLine>
				</>
			)}
			<TipLine tone='gold'>Click to open and upgrade</TipLine>
		</>
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
					<TileStatus
						biome={biome}
						isOwned={isOwned}
						isAdjacent={isAdjacent}
						level={level}
						x={x}
						y={y}
						extra={isOwned && building ? <BuildingTip id={building.id} level={building.level} /> : undefined}
					/>
				</div>
			)}
		</div>,
		tipLayer,
	);
};

export default TileTooltip;
