import React from 'react';
import { formatNumber } from '@/utils/formatters';
import audioManager from '@/utils/audioManager';
import { BIOMES, BIOME_YIELD, BUILDINGS } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { calculateBuildingCost, canAffordBundle, canBuildAt, countBuildings } from '@/utils/gameUtils';
import { getTile } from '@/utils/world';
import { isLandmarkTile } from '@/utils/terrain';
import { BUILDING_PIXEL_ICONS } from '@/config/pixelIcons';
import ResourceIcon from './ResourceIcon';
import CostList from './CostList';
import PixelIcon from './PixelIcon';
import PixelModal from './PixelModal';
import '@/styles/Buildings.css';

const BuildDialogBody: React.FC<{ x: number; y: number }> = ({ x, y }) => {
	const close = useUiStore((state) => state.closeBuildDialog);
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const prestige = useGameStore((state) => state.prestige);
	const buildOnTile = useGameStore((state) => state.buildOnTile);

	const tile = getTile(tiles, x, y);
	const biome = tile?.biome ?? 'plains';
	const cost = calculateBuildingCost(tiles, prestige);
	const canAfford = canAffordBundle(resources, cost);
	const built = countBuildings(tiles);
	const free = !!tile && canBuildAt(tiles, x, y);

	const build = (type: string) => {
		const ok = buildOnTile(x, y, type);
		audioManager.playSound(ok ? 'purchase' : 'wrong');
		if (ok) close();
	};

	return (
		<PixelModal title={`Build on ${BIOMES[biome]?.label ?? biome}`} size='md' onClose={close}>
			<div className='flex flex-wrap items-center gap-2 text-sm mb-3'>
				<span className='text-[#a89878]'>Next building costs:</span>
				<CostList cost={cost} />
				<span className='px-tip-muted'>
					{built} built - each costs more than the last
				</span>
			</div>
			{!free && (
				<div className='text-amber-300 text-sm mb-2'>
					{isLandmarkTile(tiles, x, y) ? 'A landmark stands here: its 6x6 area is kept free of buildings.' : 'This tile cannot be built on right now.'}
				</div>
			)}
			<div className='build-menu-grid'>
				{Object.values(BUILDINGS).map((building) => (
					<button
						key={building.name}
						onClick={() => build(building.name)}
						disabled={!canAfford || !free}
						className='px-card build-menu-item'>
						<span className={`build-menu-patch tile-ground tile-ground-${biome}`}>
							<span className='build-menu-pad' aria-hidden />
							<PixelIcon name={BUILDING_PIXEL_ICONS[building.name]} alt={building.label} className='build-menu-sprite' />
						</span>
						<span className='flex-1 min-w-0'>
							<span className='px-tip-title block text-xs'>{building.label}</span>
							<span className='flex flex-wrap gap-x-2 text-xs'>
								{(Object.entries(building.resourceGeneration) as [string, number][]).map(([resource, rate]) => (
									<span key={resource} className='inline-flex items-center gap-0.5 text-green-400'>
										<ResourceIcon resource={resource} />+{formatNumber(rate * BIOME_YIELD.scale)}/s
									</span>
								))}
							</span>
						</span>
					</button>
				))}
			</div>
			<div className='px-tip-muted text-xs mt-3'>One building per tile. It adds its output to the tile&apos;s own.</div>
		</PixelModal>
	);
};

/** The build dialog of one explored tile, opened from its right-click menu ("Build here"). */
const BuildDialog: React.FC = () => {
	const target = useUiStore((state) => state.buildDialog);
	return target ? <BuildDialogBody x={target.x} y={target.y} /> : null;
};

export default BuildDialog;
