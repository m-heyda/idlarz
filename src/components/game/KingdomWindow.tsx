import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DiamondLevel, HoverTip, Inset, Panel, ProgressBar, SectionLabel } from '../../../packages/design-system/src/components/primitives';
import { HintTooltip } from '../../../packages/design-system/src/components/tooltips';
import { biomeColor } from '@/config/biomePalette';
import { MARK_BUTTONS, MONSTER_MARK_TILES, type MarkPref } from '@/config/mapMarks';
import { castleIconName, pixelIconSrc } from '@/config/pixelIcons';
import { kingdomSummary } from '@/lib/kingdomSummary';
import { useGameStore } from '@/stores/gameStore';
import { useRockStore } from '@/stores/rockStore';
import { formatNumber } from '@/utils/formatters';
import GameWindow from './GameWindow';
import { useMapMarks } from './useMapMarks';
import '@/styles/Kingdom.css';

/**
 * The Kingdom overview window (the crown icon next to the settings gear): a one-screen summary of the realm, built by `kingdomSummary`. The castle's level against its cap and the builders, the land owned per biome (a heatmap of one square per tile, coloured by biome, with the count per biome under it), every building with its level
 * against its top level (the Ember caps, not the castle level; dimmed when not built yet) and how many chests, ore nodes and monsters stand on the map. The last panel, "Find on the map", is one grid of equal tiles, all pressable: Chests, Ore nodes and Monsters, then Bosses, Strongest, Golden, Fully grown and Still growing with their counts. A press rings just those on the map and lights the tile (one mark at a time, the same marks as the buttons under the minimap, `useMapMarks` and `MARK_TARGETS`). No income or resources: the resource windows have them. A first version, meant to grow.
 */
/** The most squares the land heatmap draws; above it each square stands for several tiles */
const HEAT_MAX_CELLS = 400;

const KingdomWindow: React.FC = () => {
	const input = useGameStore(
		useShallow((state) => ({
			tiles: state.tiles,
			monsters: state.monsters,
			castleUpgrade: state.castleUpgrade,
			buildingUpgrades: state.buildingUpgrades,
			prestige: state.prestige,
			gemBuilders: state.gemBuilders,
		})),
	);
	const rockCount = useRockStore((state) => Object.keys(state.rocks).length);
	const summary = useMemo(() => kingdomSummary(input, rockCount), [input, rockCount]);
	const { castle, builders, land, buildings, monsters } = summary;
	const { on: marked, choose } = useMapMarks();
	/** How many of each kind stand on the map, for the "Find on the map" tiles (the Strongest tile counts the monsters at the highest level) */
	const markCount: Record<MarkPref, number> = {
		markChests: monsters.chests,
		markOres: monsters.rocks,
		markMonsters: monsters.total,
		markBosses: monsters.bosses,
		markGolden: monsters.lucky,
		markGrown: monsters.maxed,
		markGrowing: monsters.growing,
		markStrongest: monsters.strongest,
	};
	/** What a tile shows as its big number: the count, and for Strongest the level */
	const markValue = (pref: MarkPref) =>
		pref === 'markStrongest' ? (monsters.total ? `Lv ${formatNumber(monsters.highestLevel)}` : '-') : formatNumber(markCount[pref]);
	const markNote = (pref: MarkPref) => (markCount[pref] === 0 ? 'None on the map' : marked[pref] ? 'Shown on the map' : 'Click to show');
	// the land heatmap: one square per tile (or per `perCell` tiles on a huge realm), the biomes in runs, left to right and wrapping to the width of the window
	const perCell = Math.max(1, Math.ceil(land.owned / HEAT_MAX_CELLS));
	const cells = land.byBiome.flatMap((row) =>
		Array.from({ length: Math.max(1, Math.round(row.count / perCell)) }, () => ({ biome: row.biome, label: `${row.label}: ${formatNumber(row.count)}` })),
	);

	return (
		<GameWindow id='kingdom' title='Kingdom overview' width={620} height={680}>
			<div className='kd-root' data-testid='kingdom-overview'>
				<Panel>
					<SectionLabel>Castle</SectionLabel>
					<div className='kd-castle'>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={pixelIconSrc(castleIconName(castle.level))} alt='' />
						<div className='kd-castle-main'>
							<ProgressBar tone='gold' value={castle.level} max={castle.cap} label={`Level ${castle.level} of ${castle.cap}`} height={18} />
							<div className='kd-line'>
								<span>
									{castle.upgradingTo ? `Upgrading to level ${castle.upgradingTo}` : castle.level >= castle.cap ? 'Fully upgraded' : 'Ready to upgrade'}
								</span>
								<span>
									Builders <b>{builders.busy}</b> busy of <b>{builders.total}</b>
								</span>
							</div>
						</div>
					</div>
				</Panel>

				<Panel>
					<SectionLabel>Land</SectionLabel>
					<div className='kd-line'>
						<span>Tiles you own</span>
						<b data-testid='kingdom-tiles'>{formatNumber(land.owned)}</b>
					</div>
					<Inset>
						{land.byBiome.length === 0 ? (
							<span className='kd-sub'>No land beyond the castle yet.</span>
						) : (
							<>
								<div className='kd-heat' data-testid='kingdom-heatmap' role='img' aria-label='Land owned, one square per tile, grouped by biome'>
									{cells.map((cell, i) => (
										<span key={i} className='kd-cell' style={{ background: biomeColor(cell.biome) }} title={cell.label} />
									))}
								</div>
								{perCell > 1 && <div className='kd-sub kd-heat-note'>1 square = {formatNumber(perCell)} tiles</div>}
								<div className='kd-legend'>
									{land.byBiome.map((row) => (
										<span key={row.biome} className='kd-biome'>
											<span className='kd-swatch' style={{ background: biomeColor(row.biome) }} />
											{row.label}
											<b className='kd-count'>{formatNumber(row.count)}</b>
											<span className='kd-sub'>{row.pct.toFixed(1)}%</span>
										</span>
									))}
								</div>
							</>
						)}
					</Inset>
				</Panel>

				<Panel>
					<SectionLabel>
						Buildings ({buildings.built} of {buildings.available} available)
					</SectionLabel>
					{buildings.available < buildings.total && (
						<div className='kd-sub kd-note'>{buildings.total - buildings.available} more open with later rebirths (marked Locked).</div>
					)}
					<Inset>
						{buildings.groups.map((group) => (
							<div key={group.biome} className='kd-group' data-testid='kingdom-building-group'>
								<div className='kd-group-head'>
									{group.biome !== 'land' && <span className='kd-swatch' style={{ background: biomeColor(group.biome) }} />}
									{group.label}
								</div>
								<div className='kd-rows kd-rows-wide'>
									{group.rows.map((row) => (
										<div key={row.id} className='kd-building' data-built={row.level > 0} data-locked={row.lockedUntilRebirth > 0}>
											<span>
												{row.label} <span className='kd-sub'>{row.kind}</span>
											</span>
											{row.level > 0 ? (
												<DiamondLevel level={row.level} max={Math.max(row.cap, row.level)} small />
											) : row.lockedUntilRebirth > 0 ? (
												<span className='kd-sub'>Locked: rebirth {row.lockedUntilRebirth}</span>
											) : (
												<span className='kd-sub'>Not built</span>
											)}
											<span className='kd-lvl'>
												{row.level > 0 ? `Lv ${row.level} / ${row.cap}` : `cap ${row.cap}`}
												{row.upgrading ? ' ↑' : ''}
											</span>
										</div>
									))}
								</div>
							</div>
						))}
					</Inset>
				</Panel>

				<Panel>
					<SectionLabel>Find on the map</SectionLabel>
					<div className='kd-tiles' data-testid='kingdom-mark-cards'>
						{[...MARK_BUTTONS, ...MONSTER_MARK_TILES.map((tile) => ({ ...tile, icon: undefined, size: 0, shift: [0, 0] as [number, number] }))].map(
							({ pref, label, card, icon, text, size, shift }) => {
								const scale = 1.4;
								return (
									<HoverTip key={pref} fill placement='above' align='center' tip={<HintTooltip title={label} text={text} />}>
										<button
											type='button'
											className='kd-tile kd-mark-card'
											data-active={marked[pref] ? 'true' : undefined}
											data-empty={markCount[pref] === 0 ? 'true' : undefined}
											aria-pressed={marked[pref]}
											aria-label={`${label}: ${markCount[pref]} on the map`}
											onClick={() => choose(pref)}
										>
											{icon ? (
												// eslint-disable-next-line @next/next/no-img-element
												<img
													src={icon}
													alt=''
													draggable={false}
													style={{ width: size * scale, height: size * scale, transform: `translate(${shift[0] * scale}px, ${shift[1] * scale}px)` }}
												/>
											) : null}
											<b>{markValue(pref)}</b>
											<span>{card}</span>
											<small>{markNote(pref)}</small>
										</button>
									</HoverTip>
								);
							},
						)}
					</div>
				</Panel>
			</div>
		</GameWindow>
	);
};

export default KingdomWindow;
