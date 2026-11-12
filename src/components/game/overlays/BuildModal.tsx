import React, { useEffect } from 'react';
import { IDOL_RULES } from '@/config/buildings';
import { idolDef } from '@/catalog/idols';
import { idolEconomy, idolValueText } from '@/lib/idolEconomy';
import type { PrestigeState } from '@/types/game';
import { limitOf } from '@/lib/limits';
import { buildingUpgradeDuration, ownedOfBiome } from '@/lib/buildings';
import { buildingEffectText } from '@/lib/buildingText';
import { formatTime } from '@/utils/formatters';
import { buildOptions, type BuildOption, type MoveOption } from '@/lib/buildingMenu';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import audioManager from '@/utils/audioManager';
import { getTile } from '@/utils/world';
import CostList from '../CostList';
import GameModal from '../GameModal';
import { Button } from '../../../../packages/design-system/src/components/primitives';
import ResourceIcon from '../ResourceIcon';
import '@/styles/BuildModal.css';

/** What a building makes, in plain words: the amount per hour now, what a level adds, what the tile count means and that levels exist. */
const EffectLines: React.FC<{ def: BuildOption['def']; ownedOfBiome: number }> = ({ def, ownedOfBiome }) => {
	const text = buildingEffectText(def, ownedOfBiome);
	if (!text) return null;
	return (
		<div className='build-output'>
			<span className='build-output-icons'>
				{def.produces.map((resource) => (
					<ResourceIcon key={resource} resource={resource} />
				))}
			</span>
			<div className='build-effect'>
				<p className='build-effect-main'>{text.produces}</p>
				<p>{text.perLevel}</p>
				<p className='build-effect-note'>{text.scale}</p>
				<p className='build-effect-note'>{text.levels}</p>
			</div>
		</div>
	);
};

const Art: React.FC<{ def: BuildOption['def'] }> = ({ def }) => (
	<span className='build-art'>
		{/* eslint-disable-next-line @next/next/no-img-element */}
		<img src={def.art} alt='' style={{ imageRendering: 'pixelated' }} />
	</span>
);

const Head: React.FC<{ def: BuildOption['def']; extra?: string }> = ({ def, extra }) => (
	<div className='build-head'>
		<span className='build-name'>{def.label}</span>
		<span className={`build-kind build-kind-${def.kind}`}>{def.kind === 'extractor' ? 'Extractor' : def.kind === 'idol' ? 'Idol' : 'Producer'}</span>
		{extra && <span className='build-extra'>{extra}</span>}
	</div>
);

/**
 * What an Idol is and does, in plain lines: the effect per level with the value now and at the cap, what the rebirth keeps, how it is upgraded. `coming soon` marks the effects the game does not apply yet
 * (farm output, click gold, merchant sell price). The numbers are `IDOL_RULES` and `limitOf('idolMaxLevel')`.
 */
export const IdolInfo: React.FC<{ id: string; remembered: number; buildTimePct?: number; prestige?: PrestigeState }> = ({
	id,
	remembered,
	buildTimePct = 0,
	prestige,
}) => {
	const idol = idolDef(id);
	if (!idol) return null;
	const max = limitOf('idolMaxLevel');
	const shown = Math.max(1, remembered);
	return (
		<div className='build-idol'>
			<p className='build-idol-effect'>
				{idol.effect === 'luck' ? `+${IDOL_RULES.luckPerLevel} Luck per level` : `+${IDOL_RULES.perLevel} % ${idol.effectText} per level`}
				{!idol.applied && <span className='build-soon'> (coming soon: not applied yet)</span>}
			</p>
			<p className='build-idol-levels'>
				Level {shown}/{max} = {idolValueText(idol, shown)}
				{shown < max ? `; level ${max} = ${idolValueText(idol, max)}` : ''}
			</p>
			<ul className='build-idol-notes'>
				<li>Kept when you rebirth: its level stays, rebuild it free on any {idol.biome} tile.</li>
				<li>
					Upgrade up to level {max} as your castle grows; each level takes the shared builder (
					{[1, 2, 3, 4].map((l) => formatTime(buildingUpgradeDuration(l, prestige, buildTimePct))).join(', ')}).
				</li>
				<li>The Ember shop&apos;s Idol Mastery raises the cap (coming soon).</li>
			</ul>
		</div>
	);
};

/** The shortage is already visible (red costs, a disabled button), so it is not printed under every card; any other refusal still is. */
const NOT_ENOUGH = 'Not enough resources';

/** "Build here": the buildings of the tile's biome with art, output and price, and the ones standing elsewhere that can be moved here. */
const BuildBody: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const close = useUiStore((state) => state.closeBuildModal);
	const buildBuilding = useGameStore((state) => state.buildBuilding);
	const moveBuilding = useGameStore((state) => state.moveBuilding);
	// re-evaluate whenever resources or the map change, so prices go green/red live
	const tiles = useGameStore((state) => state.tiles);
	useGameStore((state) => state.resources);
	const idolLevels = useGameStore((state) => state.idolLevels);
	const prestige = useGameStore((state) => state.prestige);
	const buildTimePct = idolEconomy(tiles, idolLevels).buildTimePct;
	const tile = getTile(tiles, x, y);
	const free = !!tile && !tile.building;
	const { builds, moves } = buildOptions(useGameStore, x, y);

	// the tile got a building, or nothing can be offered anymore: nothing left to choose
	useEffect(() => {
		if (!free || (builds.length === 0 && moves.length === 0)) close();
	}, [free, builds.length, moves.length, close]);
	if (!free) return null;

	const build = (o: BuildOption) => {
		if (o.problem) return;
		audioManager.playSound('click');
		void buildBuilding?.(x, y, o.def.id);
		close();
	};
	const move = (o: MoveOption) => {
		if (o.problem) return;
		audioManager.playSound('click');
		void moveBuilding?.(o.from.x, o.from.y, x, y);
		close();
	};

	return (
		<GameModal title='Build here' size='md' onClose={close}>
			<div className='build-list'>
				{builds.map((o) => (
					<div key={o.def.id} className={`ds-listrow build-row${o.problem ? ' build-row-off' : ''}`}>
						<Art def={o.def} />
						<div className='build-info'>
							<div className='build-top'>
								<Head def={o.def} />
								<Button tone='gold' size='sm' className='build-action' disabled={!!o.problem} title={o.problem ?? undefined} onClick={() => build(o)}>
									Build
								</Button>
							</div>
							<p className='build-blurb'>{o.def.blurb}</p>
							<EffectLines def={o.def} ownedOfBiome={ownedOfBiome(tiles, o.def.biome)} />
							{o.def.kind === 'idol' && <IdolInfo id={o.def.id} remembered={o.remembered ?? 0} buildTimePct={buildTimePct} prestige={prestige} />}
							<div className='build-foot'>
								{o.remembered ? <span className='build-free'>Free: learned at level {o.remembered}</span> : <CostList cost={o.cost} className='build-cost' />}
							</div>
							{o.problem && o.problem !== NOT_ENOUGH && <p className='build-problem'>{o.problem}</p>}
						</div>
					</div>
				))}
				{moves.map((o) => (
					<div key={`move-${o.def.id}`} className={`ds-listrow build-row${o.problem ? ' build-row-off' : ''}`}>
						<Art def={o.def} />
						<div className='build-info'>
							<div className='build-top'>
								<Head def={o.def} extra={`level ${o.level}, built elsewhere`} />
								<Button tone='gold' size='sm' className='build-action' disabled={!!o.problem} title={o.problem ?? undefined} onClick={() => move(o)}>
									Move here
								</Button>
							</div>
							<p className='build-blurb'>Move it here: level kept, half price.</p>
							<div className='build-foot'>
								<CostList cost={o.cost} className='build-cost' />
							</div>
							{o.problem && o.problem !== NOT_ENOUGH && <p className='build-problem'>{o.problem}</p>}
						</div>
					</div>
				))}
			</div>
		</GameModal>
	);
};

/** The Build window, mounted once on the page; the ui store says whether and for which tile it is open. */
const BuildModal: React.FC = () => {
	const target = useUiStore((state) => state.buildModal);
	return target ? <BuildBody x={target.x} y={target.y} /> : null;
};

export default BuildModal;
