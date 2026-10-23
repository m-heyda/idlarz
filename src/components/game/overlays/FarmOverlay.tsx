import React, { useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import { ANIMALS } from '@/config/gameConfig';
import type { ClickInput } from '@/types/game';
import { queueTileTap } from '@/lib/floatText';
import type { Critter } from './MeadowLayer';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import {
	calculateAnimalCost,
	calculateAnimalProduction,
	countOwnedBiomeTypes,
} from '@/utils/gameUtils';
import audioManager from '@/utils/audioManager';
import '@/styles/Farm.css';
import PixelModal from '../PixelModal';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';
import LevelOrb from '../LevelOrb';
import FarmScene from './FarmScene';
import { Animal } from '@/types/game';

// Side panel for the selected animal: portrait, numbers and the buy / upgrade button
const AnimalPanel: React.FC<{
	animal: Animal;
	level: number;
	canAfford: boolean;
	onPurchase: () => void;
}> = ({ animal, level, canAfford, onPurchase }) => {
	const cost = calculateAnimalCost(animal, level);
	const currentProduction = level > 0 ? calculateAnimalProduction(animal, level) : 0;
	const nextProduction = calculateAnimalProduction(animal, level + 1);

	return (
		<div className='farm-panel'>
			<div className='farm-portrait'>
				<span className='farm-portrait-stage'>
					<PixelIcon name={ANIMAL_PIXEL_ICONS[animal.id]} scale={2} alt={animal.name} />
				</span>
				<div className='min-w-0'>
					<h3 className='px-tip-title text-lg flex items-center gap-2'>
						{animal.name}
						{level > 0 && <LevelOrb level={level} />}
					</h3>
					<p className='text-[#a89878] text-sm leading-tight'>{animal.description}</p>
				</div>
			</div>

			<div className='farm-rows'>
				<div className='farm-row'>
					<span>{level > 0 ? 'Production' : 'Base production'}</span>
					<span className='text-red-400 font-medium inline-flex items-center gap-1'>
						{formatNumber(level > 0 ? currentProduction : nextProduction)}/s
						<ResourceIcon resource='meat' />
					</span>
				</div>
				{level > 0 && (
					<div className='farm-row'>
						<span>Next level</span>
						<span className='text-green-400 font-medium inline-flex items-center gap-1'>
							{formatNumber(nextProduction)}/s
							<ResourceIcon resource='meat' />
							<span className='text-[#7ac27a]'>(+{formatNumber(nextProduction - currentProduction)})</span>
						</span>
					</div>
				)}
				<div className='farm-row'>
					<span>{level > 0 ? 'Upgrade cost' : 'Purchase cost'}</span>
					<span className={`font-medium inline-flex items-center gap-1 ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
						{formatNumber(cost)}
						<ResourceIcon resource='food' />
					</span>
				</div>
			</div>

			<button
				onClick={() => {
					if (canAfford) {
						onPurchase();
						audioManager.playSound('click');
					} else {
						audioManager.playSound('wrong');
					}
				}}
				disabled={!canAfford}
				className='px-btn w-full py-2'>
				{level > 0 ? 'Upgrade' : 'Purchase'}
			</button>
			{!canAfford && (
				<p className='text-xs text-[#7a6a52] text-center mt-2'>Not enough food yet</p>
			)}
		</div>
	);
};

const FarmOverlay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const tiles = useGameStore((state) => state.tiles);
	const purchaseAnimal = useGameStore((state) => state.purchaseAnimal);
	const showFarmWindow = useGameStore((state) => state.showFarmWindow);
	const setShowFarmWindow = useGameStore((state) => state.setShowFarmWindow);
	const claimCritterGift = useGameStore((state) => state.claimCritterGift);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [celebrate, setCelebrate] = useState<string | null>(null);

	useEffect(() => {
		if (!celebrate) return;
		const t = setTimeout(() => setCelebrate(null), 1100);
		return () => clearTimeout(t);
	}, [celebrate]);

	useEffect(() => {
		if (!showFarmWindow) setSelectedId(null);
	}, [showFarmWindow]);

	if (!showFarmWindow) return null;

	const totalMeatProduction = ANIMALS.reduce((total, animal) => {
		const level = farmLevels[animal.id] || 0;
		return level > 0 ? total + calculateAnimalProduction(animal, level) : total;
	}, 0);

	// Plains bonus: each owned Plains tile adds 5% meat
	const plainsCount = countOwnedBiomeTypes(tiles, 'plains');
	const plainsBonusPercentage = plainsCount * 5;

	const canAffordAnimal = (animal: Animal) =>
		resources.food >= calculateAnimalCost(animal, farmLevels[animal.id] || 0);

	const selected = ANIMALS.find((a) => a.id === selectedId) ?? null;

	// A meadow critter was clicked: gift = some seconds of that resource's income (bigger if golden).
	// The amount rides the click's cursor popup together with the usual click gold.
	const catchCritter = (critter: Critter, _x: number, _y: number, input: ClickInput) => {
		const gift = claimCritterGift({ source: 'farm', type: critter.type, golden: critter.golden }, input);
		if (!gift) return;
		queueTileTap([{ resource: gift.resource, amount: gift.amount }], critter.golden);
		audioManager.playSound('click');
	};

	const buy = (animal: Animal) => {
		if (purchaseAnimal(animal.id)) setCelebrate(animal.id);
	};

	return (
		<PixelModal
			title='Farm'
			icon={<PixelIcon name='menu_farm' alt='' />}
			size='lg'
			onClose={() => setShowFarmWindow(false)}>
			<div className='farm-layout'>
				<FarmScene
					farmLevels={farmLevels}
					food={resources.food}
					selectedId={selectedId}
					onSelect={setSelectedId}
					celebrate={celebrate}
					onCatchCritter={catchCritter}
				/>

				<aside className='farm-side'>
					{/* quick picker: same as clicking the animal in the pen */}
					<div className='farm-picker'>
						{ANIMALS.map((animal) => {
							const level = farmLevels[animal.id] || 0;
							return (
								<button
									key={animal.id}
									type='button'
									className='farm-pick'
									data-selected={selectedId === animal.id}
									data-owned={level > 0}
									title={animal.name}
									onClick={() => setSelectedId(selectedId === animal.id ? null : animal.id)}>
									<PixelIcon name={ANIMAL_PIXEL_ICONS[animal.id]} alt={animal.name} />
									{level > 0 && (
										<span className='farm-pick-lvl'>
											<LevelOrb level={level} />
										</span>
									)}
								</button>
							);
						})}
					</div>

					{selected ? (
						<AnimalPanel
							animal={selected}
							level={farmLevels[selected.id] || 0}
							canAfford={canAffordAnimal(selected)}
							onPurchase={() => buy(selected)}
						/>
					) : (
						<div className='farm-panel'>
							<h3 className='px-h'>Farm Statistics</h3>
							<div className='farm-rows'>
								<div className='farm-row'>
									<span>Meat production</span>
									<span className='text-red-400 font-medium'>{formatNumber(totalMeatProduction)}/s</span>
								</div>
								<div className='farm-row'>
									<span>Per minute</span>
									<span className='text-red-400 font-medium'>{formatNumber(totalMeatProduction * 60)}/min</span>
								</div>
								<div className='farm-row'>
									<span>Per hour</span>
									<span className='text-red-400 font-medium'>{formatNumber(totalMeatProduction * 3600)}/hr</span>
								</div>
							</div>
							<h3 className='px-h mt-4'>Resources</h3>
							<div className='farm-rows'>
								<div className='farm-row'>
									<span>Available food</span>
									<span className='text-green-400 font-medium inline-flex items-center gap-1'>
										{formatNumber(resources.food)}
										<ResourceIcon resource='food' />
									</span>
								</div>
								<div className='farm-row'>
									<span>Current meat</span>
									<span className='text-red-400 font-medium inline-flex items-center gap-1'>
										{formatNumber(resources.meat)}
										<ResourceIcon resource='meat' />
									</span>
								</div>
								{plainsCount > 0 && (
									<div className='farm-row'>
										<span>Plains bonus</span>
										<span className='text-yellow-400 font-medium inline-flex items-center gap-1'>
											+{plainsBonusPercentage}%
											<ResourceIcon resource='meat' />
										</span>
									</div>
								)}
							</div>
							<p className='farm-hint'>
								Click an animal in the pen to buy or upgrade it. Each animal produces meat automatically
								{plainsCount > 0 ? ' - every Plains tile adds +5%.' : '.'}
							</p>
						</div>
					)}
				</aside>
			</div>
		</PixelModal>
	);
};

export default FarmOverlay;
