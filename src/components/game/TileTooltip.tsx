import { buildingDef } from '@/catalog/buildings';
import { BIOMES } from '@/config/biomes';
import { BUILDING_RULES } from '@/config/buildings';
import { buildingLevelCost, buildingOutput, buildingUpgradeDuration, ownedOfBiome, producerBonus } from '@/lib/buildings';
import { RESOURCES, sortedCostEntries } from '@/catalog';
import { BuildingTooltip, ChestTooltip, MonsterTooltip } from '../../../packages/design-system/src/components/tooltips';
import { BiomeTooltip } from './BiomeTooltip';
import { limitOf } from '@/lib/limits';
import { economyTiles } from '@/utils/game/tiles';
import { idolEconomy } from '@/lib/idolEconomy';
import { idolDef } from '@/catalog/idols';
import { idolValueText } from '@/lib/idolEconomy';
import React from 'react';
import { createPortal } from 'react-dom';
import { type BiomeType, type MonsterType, type Resources } from '@/types/game';
import { TILE_SIZE } from '@/config/biomes';
import { MONSTERS } from '@/config/combatConfig';
import { MONSTER_CATALOG, monsterSpriteUrl } from '@/catalog/monsters';
import { formatCompact, formatNumber, formatTime } from '@/utils/formatters';
import { growthSecondsLeft, isBoss, maxLevelOf, monsterStats } from '@/lib/monsters';
import { useBestiaryStore, useIsDiscovered } from '@/stores/bestiaryStore';
import { useMapSource } from './mapSource';
import { useMapTipLayer } from './MapTipLayer';
import { TileStatus } from './TileStatus';

/** Hover card of a monster, the design system's MonsterTooltip with the game's numbers: level, HP and attack, kills, growth, boss traits and the call to fight. Reads the age at render time. */
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
	const entry = MONSTER_CATALOG.find((m) => m.id === (art ?? type));
	const wip = art ? entry : undefined;
	const place = 'map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max';
	const icon = entry ? monsterSpriteUrl(entry) : '';
	const biomeLabel = entry ? (BIOMES[entry.biomes[0] as keyof typeof BIOMES]?.label ?? '') : '';
	if (wip) {
		return (
			<div className={place}>
				<MonsterTooltip
					icon={icon}
					name={wip.label}
					subtitle={`Lv ${formatCompact(level)}${biomeLabel ? ` · ${biomeLabel}` : ''}`}
					hp=''
					rows={[]}
					boss={wip.grade === 'boss'}
					wip
				/>
			</div>
		);
	}
	const monster = state.monsters.find((m) => m.id === id);
	const growthOpts = { merchantUpgrades: state.merchantUpgrades, prestige: state.prestige };
	const nextLevel = monster ? growthSecondsLeft(monster, growthOpts) : null;
	const stats = monsterStats(type, level);
	const boss = isBoss(type);
	const growth = monster
		? `Level ${formatCompact(level)} of ${formatCompact(maxLevelOf(monster.spawnLevel, growthOpts, monster.growCap))}${
				nextLevel !== null ? `, grows in ${Math.max(1, Math.ceil(nextLevel / 60))} min` : ' - fully grown'
			}`
		: undefined;
	return (
		<div className={place}>
			<MonsterTooltip
				icon={icon}
				name={MONSTERS[type].label}
				subtitle={`Lv ${formatCompact(level)} · ${boss ? 'Boss' : biomeLabel || 'Monster'}`}
				hp={`${formatCompact(stats.maxHp)} HP`}
				rows={[
					{ label: 'Damage', value: `${formatCompact(stats.attack)} / hit` },
					{ label: 'Armor', value: formatCompact(stats.armor) },
				]}
				boss={boss}
				defeated={kills}
				growth={growth}
				bossLine={boss ? `Crits ${stats.critChance}%, resists Stun ${stats.stunResist}%. Beat it within ${MONSTERS[type].timeLimitSec} seconds` : undefined}
				cta={queued > 0 ? `In the queue (${queued}) - click to leave it` : lineOpen ? 'Click to add to the queue' : 'Click to fight'}
			/>
		</div>
	);
};

/** The tooltip of a tile with a building: the design system's BuildingTooltip (output per hour now, the next level's output, cost and time, the biome bonus, an Idol's text) with the tile's own lines under it. */
const BuildingTile: React.FC<{ id: string; level: number; tile: React.ReactNode }> = ({ id, level, tile }) => {
	const def = buildingDef(id);
	const idol = idolDef(id);
	const { game } = useMapSource();
	const tiles = game((state) => state.tiles);
	const resources = game((state) => state.resources);
	const prestige = game((state) => state.prestige);
	const idolLevels = game((state) => state.idolLevels);
	if (!def) return null;
	const owned = ownedOfBiome(tiles, def.biome);
	const biomeLabel = BIOMES[def.biome]?.label ?? def.biome;
	const output = idol ? null : buildingOutput(def, level, owned);
	const top = def.kind === 'idol' ? limitOf('idolMaxLevel') : BUILDING_RULES.maxLevel;
	const atTop = level >= top;
	const hourly = (o: Partial<Resources>) => Object.entries(o).filter(([, amount]) => (amount ?? 0) > 0) as [keyof Resources, number][];
	const rows = output ? hourly(output).map(([key, amount]) => ({ label: RESOURCES[key].label, value: `+${formatNumber(amount * 3600)}/h` })) : [];
	let next: { label: string; value: string; tone?: 'green' | 'red' | 'amber' }[] | undefined;
	if (!atTop) {
		const ownedTiles = economyTiles(tiles, game.getState().freeTiles);
		const cost = buildingLevelCost(level + 1, ownedTiles, def);
		const after = idol ? null : buildingOutput(def, level + 1, owned);
		next = [
			...(after
				? hourly(after).map(([key, amount]) => ({
						label: RESOURCES[key].label,
						value: `+${formatNumber((output?.[key] ?? 0) * 3600)} → +${formatNumber(amount * 3600)}/h`,
						tone: 'green' as const,
					}))
				: []),
			...(idol ? [{ label: 'Gives', value: idolValueText(idol, level + 1) }] : []),
			...sortedCostEntries<keyof Resources>(cost).map(([key, amount]) => ({
				label: `Cost · ${RESOURCES[key].label}`,
				value: formatNumber(amount),
				tone: (resources[key] ?? 0) >= amount ? ('green' as const) : ('red' as const),
			})),
			{
				label: 'Takes',
				value: formatTime(buildingUpgradeDuration(level, prestige, idolEconomy(tiles, idolLevels ?? {}).buildTimePct)),
				tone: 'amber' as const,
			},
		];
	}
	return (
		<BuildingTooltip
			icon={def.art}
			name={def.label}
			subtitle={`Level ${level} of ${top} · ${biomeLabel}`}
			rows={rows}
			nextLevel={atTop ? undefined : level + 1}
			next={next}
			tileExtra={tile}
			biomeBonus={output ? `${biomeLabel} bonus: +${Math.round(producerBonus(owned) * 100)} % (${owned} tile${owned === 1 ? '' : 's'})` : undefined}
			idolText={idol ? `${idolValueText(idol, level)}${idol.applied ? '' : ' (coming soon: not applied yet)'}` : undefined}
			rebirthNote={idol ? `Its level is kept when you rebirth; rebuild it free on any ${idol.biome} tile.` : undefined}
			cta='Click to open and upgrade'
		/>
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
				<div className='map-tip map-tip-up map-tip-in absolute bottom-full mb-1 left-1/2 -translate-x-1/2 w-max'>
					<ChestTooltip
						icon='/pixel/reuse/valuables/treasure_chest.png'
						cta={biome === 'lake' ? 'Something glints in the water. Click to open' : 'Click to open the treasure chest'}
					/>
				</div>
			)}
			{/* a monster has its own tooltip: the biome card would only cover it */}
			{!(isOwned && monster) && (
				<div className='map-tip map-tip-in absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full w-max'>
					{isOwned && building ? (
						<BuildingTile id={building.id} level={building.level} tile={<BiomeTooltip biome={biome} level={level} x={x} y={y} />} />
					) : (
						<TileStatus biome={biome} isOwned={isOwned} isAdjacent={isAdjacent} level={level} x={x} y={y} />
					)}
				</div>
			)}
		</div>,
		tipLayer,
	);
};

export default TileTooltip;
