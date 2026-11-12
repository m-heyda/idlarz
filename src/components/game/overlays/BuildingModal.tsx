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

/** "+1.2K" per hour for each resource of an output (per second in, per hour out). */
const OutputRows: React.FC<{ output: Partial<Resources>; muted?: boolean }> = ({ output, muted }) => (
	<span className={`inline-flex flex-wrap items-center gap-x-4 gap-y-1 ${muted ? 'text-[#a89878]' : 'text-[#f1e6c8]'}`}>
		{Object.entries(output)
			.filter(([, amount]) => (amount ?? 0) > 0)
			.map(([key, amount]) => (
				<span key={key} className='inline-flex items-center gap-1 tabular-nums' title={RESOURCES[key as keyof Resources]?.label}>
					<ResourceIcon resource={key as keyof Resources} />+{formatNumber((amount ?? 0) * HOUR)}/h
				</span>
			))}
	</span>
);

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

	return (
		<GameModal title={def.label} size='md' onClose={close}>
			<div className='flex flex-col gap-4 px-1 pb-1'>
				<div className='flex gap-4 items-start'>
					<span className='build-art shrink-0' style={{ width: 96, height: 96 }}>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={def.art} alt={def.label} style={{ imageRendering: 'pixelated' }} />
					</span>
					<div className='min-w-0 flex-1 flex flex-col gap-1'>
						<div className='build-head'>
							<span className={`build-kind build-kind-${def.kind}`}>{def.kind === 'extractor' ? 'Extractor' : def.kind === 'idol' ? 'Idol' : 'Producer'}</span>
							<span className='build-extra'>{biomeLabel}</span>
						</div>
						<div className='text-[#f0d27a] text-lg'>
							Level {level} <span className='text-[#a89878] text-sm'>of {top}</span>
						</div>
						{/* the level as gems, one per level the building can reach */}
						<div title={`Level ${level} of ${top}`}>
							<DiamondLevel level={level} max={top} />
						</div>
						<p className='text-sm italic text-[#c8b898]'>{BUILDING_LORE[def.id] ?? def.blurb}</p>
					</div>
				</div>

				<div className='ds-listrow'>
					<div className='text-[#a89878] text-sm'>{def.kind === 'idol' ? 'Its bonus' : 'Produces now'}</div>
					{def.kind === 'idol' && idol ? (
						<>
							<div className='text-[#f1e6c8]'>
								{idolValueText(idol, level)}
								{!idol.applied && <span className='build-soon'> (coming soon: not applied yet)</span>}
							</div>
							<div className='text-xs text-[#a89878]'>Its level is kept when you rebirth; rebuild it free on any {biomeLabel.toLowerCase()} tile.</div>
						</>
					) : (
						now && (
							<>
								<OutputRows output={now} />
								<div className='text-xs text-[#a89878]'>
									{biomeLabel} bonus: +{bonusPct} % from your {owned} {biomeLabel.toLowerCase()} tile{owned === 1 ? '' : 's'} (each adds +
									{Math.round(BUILDING_RULES.producer.perOwnedTile * 100)} %, up to +{Math.round(BUILDING_RULES.producer.bonusCap * 100)} %). Before the castle
									and Ember bonuses.
								</div>
							</>
						)
					)}
				</div>

				<div className='ds-listrow'>
					{running ? (
						<>
							<div className='text-[#a89878] text-sm'>Upgrading</div>
							<div className='text-[#f1e6c8]'>
								Level {running.toLevel} in {formatTime(Math.max(1, Math.ceil(running.remainingSec)))}
							</div>
						</>
					) : atTop ? (
						<div className='text-[#f0d27a]'>Highest level reached.</div>
					) : (
						<>
							<div className='text-[#a89878] text-sm'>Next: level {nextLevel}</div>
							<div className='text-sm text-[#f1e6c8]'>
								{def.kind === 'idol' && idol ? (
									<>Gives {idolValueText(idol, nextLevel)}</>
								) : (
									<span className='inline-flex flex-wrap items-center gap-2'>
										Adds <OutputRows output={gain} />
									</span>
								)}
							</div>
							<div className='flex items-center justify-between gap-3 flex-wrap'>
								<div className='flex flex-col gap-1'>
									<CostList cost={cost} className='build-cost' />
									<span className='text-xs text-[#a89878]'>Takes {formatTime(buildingUpgradeDuration(level, prestige, buildTimePct))}</span>
								</div>
								<Button tone='gold' disabled={!!problem} title={problem ?? undefined} onClick={upgrade}>
									Upgrade
								</Button>
							</div>
							{problem && problem !== 'Not enough resources' && <p className='build-problem'>{problem}</p>}
						</>
					)}
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
