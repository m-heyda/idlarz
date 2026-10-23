import React from 'react';
import type { FC } from 'react';
import audioManager from '@/utils/audioManager';
import { BIOME_YIELD, BUILDINGS } from '@/config/gameConfig';
import { useGameStore } from '@/stores/gameStore';
import { calculateBuildingCost, canAffordBundle } from '@/utils/gameUtils';
import ResourceIcon from './ResourceIcon';
import CostList from './CostList';
import { BUILDING_PIXEL_ICONS } from '@/config/pixelIcons';
import PixelIcon from './PixelIcon';
import PixelModal from './PixelModal';

interface BuildingSelectionDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (buildingType: string) => void;
}

const BuildingSelectionDialog: FC<BuildingSelectionDialogProps> = ({
	isOpen,
	onClose,
	onSelect,
}) => {
	const tiles = useGameStore((state) => state.tiles);
	const resources = useGameStore((state) => state.resources);
	const prestige = useGameStore((state) => state.prestige);

	if (!isOpen) return null;

	const cost = calculateBuildingCost(tiles, prestige);
	const canAfford = canAffordBundle(resources, cost);

	const handleSelect = (buildingType: string) => {
		audioManager.playSound('click');
		onSelect(buildingType);
		onClose();
	};

	return (
		<PixelModal title='Select Building' size='md' onClose={onClose}>
			<p className='text-[#a89878] mb-2'>
				Select a building to construct on this grounds tile. Each building costs more than the last.
			</p>
			<div className='flex flex-wrap items-center gap-3 mb-4 text-sm'>
				<span className='text-[#a89878]'>Cost:</span>
				<CostList cost={cost} />
			</div>

			<div className='grid grid-cols-2 gap-3'>
				{Object.values(BUILDINGS).map((building) => (
					<button
						key={building.name}
						onClick={() => handleSelect(building.name)}
						disabled={!canAfford}
						className='px-card flex items-start gap-3 text-left cursor-pointer hover:brightness-125 transition disabled:opacity-50 disabled:cursor-not-allowed'>
						<div className='tile-ground tile-ground-yard shrink-0 w-[48px] h-[48px] flex items-center justify-center'>
							<PixelIcon name={BUILDING_PIXEL_ICONS[building.name]} alt={building.label} className='tile-icon' />
						</div>
						<div className='flex-1'>
							<span className='px-tip-title block'>{building.label}</span>
							<div className='text-sm mt-1 flex flex-wrap gap-x-2 gap-y-0.5'>
								{(Object.entries(building.resourceGeneration) as [string, number][]).map(
									([resource, rate]) => (
										<span key={resource} className='inline-flex items-center gap-0.5 text-green-400'>
											<ResourceIcon resource={resource} />+{(rate * BIOME_YIELD.scale).toFixed(2)}/s
										</span>
									)
								)}
							</div>
						</div>
					</button>
				))}
			</div>
		</PixelModal>
	);
};

export default BuildingSelectionDialog;
