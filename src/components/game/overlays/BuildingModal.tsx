import React, { useEffect } from 'react';
import { BUILDING_LORE, buildingDef, type BuildingDef } from '@/catalog/buildings';
import { BUILDING_RULES } from '@/config/buildings';
import { RESOURCES } from '@/catalog/resources';
import { idolDef } from '@/catalog/idols';
import { BIOMES } from '@/config/biomes';
import {
	buildingLevelCost,
	buildingOutput,
	buildingUpgradeDuration,
	idolFloorTiles,
	levelOfTile,
	ownedOfBiome,
	producerBonus,
	upgradeProblem,
	type BuildingContext,
} from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { idolEconomy, idolValueText } from '@/lib/idolEconomy';
import { limitOf } from '@/lib/limits';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { canAffordBundle } from '@/utils/game/costs';
import { economyTiles } from '@/utils/game/tiles';
import { formatNumber, formatTime } from '@/utils/formatters';
import { getTile } from '@/utils/world';
import audioManager from '@/utils/audioManager';
import type { Resources } from '@/types/game';
import CostList from '../CostList';
import GameModal from '../GameModal';
import { Button, DiamondLevel } from '../../../../packages/design-system/src/components/primitives';
import ResourceIcon from '../ResourceIcon';
import '@/styles/BuildModal.css';

const HOUR = 3600;

/**
 * The building window: a left click on a building opens it. Art and lore, the kind and the level, what it makes now (per hour, before the castle and Ember bonuses) with the biome bonus, then the next level: what it adds, its price and timer
 * and the Upgrade button. An Idol shows its bonus now and at the next level instead of an output. Numbers are the rules' (`lib/buildings.ts`, `lib/buildingOutput.ts`); the upgrade goes through the store's `upgradeBuilding` like the old right-click entry did.
 */
const BuildingBody: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const close = useUiStore((state) => state.closeBuildingModal);
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const monsters = useGameStore((state) => state.monsters);
	const castleUpgrade = useGameStore((state) => state.castleUpgrade);
	const buildingUpgrade = useGameStore((state) => state.buildingUpgrade);
	const freeTiles = useGameStore((state) => state.freeTiles);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const prestige = useGameStore((state) => state.prestige);
	const upgradeBuilding = useGameStore((state) => state.upgradeBuilding);

	const tile = getTile(tiles, x, y);
	const def: BuildingDef | undefined = buildingDef(tile?.building);

	// the building is gone (moved, rebirth): nothing to show
	useEffect(() => {
		if (!def) close();
	}, [def, close]);
	if (!tile || !def) return null;

	const level = levelOfTile(tile);
	const idol = idolDef(def.id);
	const ownedTiles = economyTiles(tiles, freeTiles);
	const ctx: BuildingContext = { tiles, monsters, castleLevel: castleLevelOf(tiles), castleUpgrade, buildingUpgrade: buildingUpgrade ?? null, ownedTiles };
	const owned = ownedOfBiome(tiles, def.biome);
	const biomeLabel = BIOMES[def.biome]?.label ?? def.biome;
	const top = def.kind === 'idol' ? limitOf('idolMaxLevel') : BUILDING_RULES.maxLevel;
	const atTop = level >= top;
	const running = buildingUpgrade && buildingUpgrade.x === x && buildingUpgrade.y === y ? buildingUpgrade : null;
	const nextLevel = level + 1;
	const cost = atTop ? {} : buildingLevelCost(nextLevel, ownedTiles, def);
	const problem = atTop ? null : (upgradeProblem(ctx, x, y) ?? (canAffordBundle(resources, cost) ? null : 'Not enough resources'));
	const buildTimePct = idolEconomy(tiles, idolLevels ?? {}).buildTimePct;
	const now = def.kind === 'idol' ? null : buildingOutput(def, level, owned);
	const next = def.kind === 'idol' || atTop ? null : buildingOutput(def, nextLevel, owned);
	const gain: Partial<Resources> = {};
	if (now && next) for (const key of Object.keys(next) as (keyof Resources)[]) gain[key] = (next[key] ?? 0) - (now[key] ?? 0);
	const bonusPct = Math.round(producerBonus(owned) * 100);

	const upgrade = () => {
		if (problem) return;
		audioManager.playSound('click');
		void upgradeBuilding?.(x, y);
	};

	const keys = Array.from(new Set([...Object.keys(now ?? {}), ...Object.keys(next ?? {})])).filter(
		(key) => (now?.[key as keyof Resources] ?? 0) > 0 || (next?.[key as keyof Resources] ?? 0) > 0,
	) as (keyof Resources)[];
	const perHour = (o: Partial<Resources> | null, key: keyof Resources) => formatNumber((o?.[key] ?? 0) * HOUR);
	const total = running ? buildingUpgradeDuration(running.toLevel - 1, prestige, buildTimePct) : 0;
	const progress = running && total > 0 ? Math.min(1, Math.max(0, 1 - running.remainingSec / total)) : 0;

	return (
		<GameModal title={def.label} width={780} onClose={close}>
			<div className='bw'>
				<div className='bw-side'>
					<span className='build-art' style={{ width: '100%', height: 150 }}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={def.art} alt={def.label} style={{ imageRendering: 'pixelated', width: 130, height: 130 }} />
					</span>
					<div className='build-head'>
						<span className={`build-kind build-kind-${def.kind}`}>{def.kind === 'extractor' ? 'Extractor' : def.kind === 'idol' ? 'Idol' : 'Producer'}</span>
						<span className='build-extra'>{biomeLabel}</span>
					</div>
					<div>
						<div className='bw-level'>
							Level {level} <span>of {top}</span>
						</div>
						<div title={`Level ${level} of ${top}`} style={{ marginTop: 6 }}>
							<DiamondLevel level={level} max={top} />
						</div>
					</div>
					<p className='bw-lore'>{BUILDING_LORE[def.id] ?? def.blurb}</p>
				</div>

				<div className='bw-main'>
					<div className='ds-listrow'>
						{def.kind === 'idol' && idol ? (
							<>
								<div className='bw-label'>Its bonus</div>
								<div>
									{idolValueText(idol, level)}
									{!idol.applied && <span className='build-soon'> (coming soon: not applied yet)</span>}
								</div>
								{!atTop && !running && (
									<div className='bw-up'>
										Level {nextLevel}: {idolValueText(idol, nextLevel)}
									</div>
								)}
								<div className='bw-note'>Its level is kept when you rebirth; rebuild it free on any {biomeLabel.toLowerCase()} tile.</div>
							</>
						) : (
							<>
								<div className='bw-table'>
									<span className='bw-label'>Produces per hour</span>
									<span className='bw-col'>Now</span>
									<span className='bw-col'>{atTop ? '' : `Level ${nextLevel}`}</span>
									<span className='bw-col'>{atTop ? '' : 'Change'}</span>
									{keys.map((key) => (
										<React.Fragment key={key}>
											<span className='bw-res'>
												<ResourceIcon resource={key} />
												{RESOURCES[key]?.label ?? key}
											</span>
											<span className='bw-num'>{perHour(now, key)}</span>
											<span className='bw-num'>{atTop ? '' : perHour(next, key)}</span>
											<span className='bw-num bw-gain'>{atTop ? '' : `+${formatNumber((gain[key] ?? 0) * HOUR)}`}</span>
										</React.Fragment>
									))}
								</div>
								<div className='bw-note'>
									{biomeLabel} bonus: +{bonusPct} % from your {owned} {biomeLabel.toLowerCase()} tile{owned === 1 ? '' : 's'} (each adds +
									{Math.round(BUILDING_RULES.producer.perOwnedTile * 100)} %, up to +{Math.round(BUILDING_RULES.producer.bonusCap * 100)} %). Before the castle
									and Ember bonuses.
								</div>
							</>
						)}
					</div>

					<div className='ds-listrow bw-upgrade'>
						{running ? (
							<>
								<div className='bw-label'>Upgrading to level {running.toLevel}</div>
								<div className='bw-bar'>
									<div className='bw-bar-fill' style={{ width: `${Math.round(progress * 100)}%` }} />
								</div>
								<div className='bw-note'>{formatTime(Math.max(1, Math.ceil(running.remainingSec)))} left</div>
							</>
						) : atTop ? (
							<div className='bw-up'>Highest level reached.</div>
						) : (
							<>
								<div className='bw-label'>Upgrade to level {nextLevel}</div>
								<CostList cost={cost} className='build-cost' />
								{def.kind === 'idol' && ownedTiles < idolFloorTiles(nextLevel) && (
									<div className='bw-note'>Priced as if you owned at least {idolFloorTiles(nextLevel)} tiles.</div>
								)}
								<div className='bw-foot'>
									<span className='bw-time'>Takes {formatTime(buildingUpgradeDuration(level, prestige, buildTimePct))}</span>
									<Button tone='gold' disabled={!!problem} title={problem ?? undefined} onClick={upgrade}>
										Upgrade
									</Button>
								</div>
								{problem && problem !== 'Not enough resources' && <p className='build-problem'>{problem}</p>}
							</>
						)}
					</div>
				</div>
			</div>
		</GameModal>
	);
};

/** The building window, mounted once on the page; the ui store says whether and for which tile it is open. */
const BuildingModal: React.FC = () => {
	const target = useUiStore((state) => state.buildingModal);
	return target ? <BuildingBody x={target.x} y={target.y} /> : null;
};

export default BuildingModal;
