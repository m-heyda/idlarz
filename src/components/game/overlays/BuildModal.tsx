import React, { useEffect } from 'react';
import { BUILDING_RULES } from '@/config/buildings';
import { buildOptions, type BuildOption, type MoveOption } from '@/lib/buildingMenu';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import audioManager from '@/utils/audioManager';
import { getTile } from '@/utils/world';
import CostList from '../CostList';
import PixelModal from '../PixelModal';
import ResourceIcon from '../ResourceIcon';
import '@/styles/BuildModal.css';

/** What a building makes, in one line: the Producer's tile-equivalents of its resources, the Extractor's rate of its material. */
const OutputLine: React.FC<{ option: Pick<BuildOption, 'def'> }> = ({ option: { def } }) => (
	<span className='build-output'>
		{def.produces.map((resource) => (
			<ResourceIcon key={resource} resource={resource} />
		))}
		<span>{def.kind === 'extractor' ? `${BUILDING_RULES.extractor.baseRate}/s` : `like ${BUILDING_RULES.producer.tileEquivalents} tiles`}</span>
	</span>
);

const Art: React.FC<{ def: BuildOption['def'] }> = ({ def }) => (
	<span className='build-art'>
		{/* eslint-disable-next-line @next/next/no-img-element */}
		<img src={def.art} alt='' style={{ imageRendering: 'pixelated' }} />
	</span>
);

const Head: React.FC<{ def: BuildOption['def']; extra?: string }> = ({ def, extra }) => (
	<div className='build-head'>
		<span className='build-name'>{def.label}</span>
		<span className={`build-kind build-kind-${def.kind}`}>{def.kind === 'extractor' ? 'Extractor' : 'Producer'}</span>
		{extra && <span className='build-extra'>{extra}</span>}
	</div>
);

/** "Build here": the buildings of the tile's biome with art, output and price, and the ones standing elsewhere that can be moved here. */
const BuildBody: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const close = useUiStore((state) => state.closeBuildModal);
	const buildBuilding = useGameStore((state) => state.buildBuilding);
	const moveBuilding = useGameStore((state) => state.moveBuilding);
	// re-evaluate whenever resources or the map change, so prices go green/red live
	const tiles = useGameStore((state) => state.tiles);
	useGameStore((state) => state.resources);
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
		<PixelModal title='Build here' size='sm' onClose={close}>
			<div className='build-list'>
				{builds.map((o) => (
					<div key={o.def.id} className={`px-card build-row${o.problem ? ' build-row-off' : ''}`}>
						<Art def={o.def} />
						<div className='build-info'>
							<Head def={o.def} />
							<p className='build-blurb'>{o.def.blurb}</p>
							<OutputLine option={o} />
							<div className='build-foot'>
								<CostList cost={o.cost} />
								<button className='px-btn' disabled={!!o.problem} title={o.problem ?? undefined} onClick={() => build(o)}>
									Build
								</button>
							</div>
							{o.problem && <p className='build-problem'>{o.problem}</p>}
						</div>
					</div>
				))}
				{moves.map((o) => (
					<div key={`move-${o.def.id}`} className={`px-card build-row${o.problem ? ' build-row-off' : ''}`}>
						<Art def={o.def} />
						<div className='build-info'>
							<Head def={o.def} extra={`level ${o.level}, built elsewhere`} />
							<p className='build-blurb'>Move it here: level kept, half price.</p>
							<div className='build-foot'>
								<CostList cost={o.cost} />
								<button className='px-btn' disabled={!!o.problem} title={o.problem ?? undefined} onClick={() => move(o)}>
									Move here
								</button>
							</div>
							{o.problem && <p className='build-problem'>{o.problem}</p>}
						</div>
					</div>
				))}
			</div>
		</PixelModal>
	);
};

/** The Build window, mounted once on the page; the ui store says whether and for which tile it is open. */
const BuildModal: React.FC = () => {
	const target = useUiStore((state) => state.buildModal);
	return target ? <BuildBody x={target.x} y={target.y} /> : null;
};

export default BuildModal;
