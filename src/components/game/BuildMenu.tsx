import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import audioManager from '@/utils/audioManager';
import { BIOMES, BIOME_YIELD, BUILDINGS } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { calculateBuildingCost, canAffordBundle, countBuildings } from '@/utils/gameUtils';
import { BUILDING_PIXEL_ICONS } from '@/config/pixelIcons';
import type { BiomeType } from '@/types/game';
import ResourceIcon from './ResourceIcon';
import CostList from './CostList';
import PixelIcon from './PixelIcon';

interface BuildMenuProps {
	biome: BiomeType;
	/** Where the right click happened (viewport px); the menu opens there, kept on screen */
	anchor: { x: number; y: number };
	onSelect: (buildingType: string) => void;
	onClose: () => void;
}

/**
 * The right-click menu of an explored tile: every building with what it produces, the price of the next one, and each
 * building drawn on a patch of the tile's own biome so you can see how it fits. Closes on Escape, a click outside or a scroll.
 */
const BuildMenu: FC<BuildMenuProps> = ({ biome, anchor, onSelect, onClose }) => {
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const prestige = useGameStore((state) => state.prestige);
	const ref = useRef<HTMLDivElement>(null);
	const [pos, setPos] = useState<{ left: number; top: number }>({ left: anchor.x, top: anchor.y });

	const cost = calculateBuildingCost(tiles, prestige);
	const canAfford = canAffordBundle(resources, cost);
	const built = countBuildings(tiles);

	// keep the menu inside the viewport
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const margin = 8;
		setPos({
			left: Math.max(margin, Math.min(anchor.x, window.innerWidth - el.offsetWidth - margin)),
			top: Math.max(margin, Math.min(anchor.y, window.innerHeight - el.offsetHeight - margin)),
		});
	}, [anchor.x, anchor.y]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		const onDown = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('pointerdown', onDown, true);
		window.addEventListener('wheel', onClose, { passive: true });
		window.addEventListener('resize', onClose);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pointerdown', onDown, true);
			window.removeEventListener('wheel', onClose);
			window.removeEventListener('resize', onClose);
		};
	}, [onClose]);

	return (
		<div
			ref={ref}
			className='fixed z-[90] px-tooltip build-menu'
			style={{ left: pos.left, top: pos.top }}
			role='menu'
			aria-label='Build here'
			onContextMenu={(e) => e.preventDefault()}>
			<div className='px-tip-title text-sm'>Build on {BIOMES[biome]?.label ?? biome}</div>
			<div className='flex flex-wrap items-center gap-2 text-xs mt-1 mb-2'>
				<span className='text-[#a89878]'>Cost:</span>
				<CostList cost={cost} />
				<span className='px-tip-muted'>
					{built} built - each costs more than the last
				</span>
			</div>
			<div className='build-menu-grid'>
				{Object.values(BUILDINGS).map((building) => (
					<button
						key={building.name}
						role='menuitem'
						onClick={() => {
							audioManager.playSound('click');
							onSelect(building.name);
						}}
						disabled={!canAfford}
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
										<ResourceIcon resource={resource} />+{(rate * BIOME_YIELD.scale).toFixed(2)}/s
									</span>
								))}
							</span>
						</span>
					</button>
				))}
			</div>
			<div className='px-tip-muted text-xs mt-2'>One building per tile. It adds its output to the tile&apos;s own.</div>
		</div>
	);
};

export default BuildMenu;
