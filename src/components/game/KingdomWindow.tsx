import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DiamondLevel, Inset, Panel, ProgressBar, SectionLabel, Stat } from '../../../packages/design-system/src/components/primitives';
import { biomeColor } from '@/config/biomePalette';
import { castleIconName, pixelIconSrc } from '@/config/pixelIcons';
import { kingdomSummary } from '@/lib/kingdomSummary';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import GameWindow from './GameWindow';
import '@/styles/Kingdom.css';

/**
 * The Kingdom overview window (the crown icon next to the settings gear): a one-screen summary of the realm, built by `kingdomSummary`. The castle's level against its cap and the builders, the land owned per biome (a heatmap of one square per tile, coloured by biome, with the count per biome under it), every building with its level
 * against what it can reach now (dimmed when not built yet) and how many monsters stand on the map. No income or resources: the resource windows have them. A first version, meant to grow.
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
	const summary = useMemo(() => kingdomSummary(input), [input]);
	const { castle, builders, land, buildings, monsters } = summary;
	// the land heatmap: one square per tile (or per `perCell` tiles on a huge realm), the biomes in runs like the weeks of a contribution graph
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
										</span>
									))}
								</div>
							</>
						)}
					</Inset>
				</Panel>

				<Panel>
					<SectionLabel>
						Buildings ({buildings.built} of {buildings.total})
					</SectionLabel>
					<Inset>
						<div className='kd-rows kd-rows-wide'>
							{buildings.rows.map((row) => (
								<div key={row.id} className='kd-building' data-built={row.level > 0}>
									<span>
										{row.label} <span className='kd-sub'>{row.kind}</span>
									</span>
									{row.level > 0 ? <DiamondLevel level={row.level} max={Math.max(row.cap, row.level)} small /> : <span className='kd-sub'>not built</span>}
									<span className='kd-lvl'>
										{row.level > 0 ? `Lv ${row.level} / ${row.cap}` : `cap ${row.cap}`}
										{row.upgrading ? ' ↑' : ''}
									</span>
								</div>
							))}
						</div>
					</Inset>
				</Panel>

				<Panel>
					<SectionLabel>Monsters on the map</SectionLabel>
					<div className='kd-stats'>
						<Stat label='Monsters' value={formatNumber(monsters.total)} />
						<Stat label='Bosses' value={formatNumber(monsters.bosses)} />
						<Stat label='Strongest' value={monsters.total ? `Lv ${formatNumber(monsters.highestLevel)}` : '-'} />
					</div>
				</Panel>
			</div>
		</GameWindow>
	);
};

export default KingdomWindow;
