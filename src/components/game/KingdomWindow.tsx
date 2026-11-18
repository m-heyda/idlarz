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
 * The Kingdom overview window (the crown icon next to the settings gear): a one-screen summary of the realm, built by `kingdomSummary`. The castle's level against its cap and the builders, the land owned per biome, every building with its level
 * against what it can reach now (dimmed when not built yet) and how many monsters stand on the map. No income or resources: the resource windows have them. A first version, meant to grow.
 */
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
	const mostTiles = land.byBiome[0]?.count ?? 1;

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
						<div className='kd-rows'>
							{land.byBiome.length === 0 && <span className='kd-sub'>No land beyond the castle yet.</span>}
							{land.byBiome.map((row) => (
								<div key={row.biome} className='kd-biome'>
									<span className='kd-swatch' style={{ background: biomeColor(row.biome) }} />
									<span>{row.label}</span>
									<ProgressBar tone='xp' value={row.count} max={mostTiles} height={10} />
									<span className='kd-count'>{formatNumber(row.count)}</span>
								</div>
							))}
						</div>
					</Inset>
				</Panel>

				<Panel>
					<SectionLabel>
						Buildings ({buildings.built} of {buildings.total})
					</SectionLabel>
					<Inset>
						<div className='kd-rows'>
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
