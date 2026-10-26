import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ANIMALS, FARM_UPGRADES } from '@/config/gameConfig';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import { formatNumber } from '@/utils/formatters';
import {
	affordableAnimals,
	animalBatchCost,
	animalOutput,
	calculateAnimalCost,
	farmCap,
	farmUpgradeLevel,
} from '@/utils/gameUtils';
import type { Animal } from '@/types/game';
import audioManager from '@/utils/audioManager';
import PixelIcon from '../PixelIcon';
import ResourceIcon from '../ResourceIcon';

/** Width the scene keeps clear on the right while the panel is open (panel width plus its margin) */
export const ANIMAL_DOCK_WIDTH = 272;

interface FarmAnimalDockProps {
	open: boolean;
	onToggle: () => void;
	/** buy animals of a kind: a number, or 'max' for all you can afford */
	onBuy: (animalId: string, count: number | 'max') => void;
	/** The kind under the cursor, so the scene can light up its animals */
	onHover: (animalId: string | null) => void;
}

interface AnimalRowProps {
	animal: Animal;
	owned: number;
	upgrades: Record<string, number>;
	food: number;
	onBuy: (count: number | 'max') => void;
	onHover: (hovering: boolean) => void;
}

/** One animal in the panel: what it yields, how many you have, and x1 / x10 / Max buttons. */
const AnimalRow: React.FC<AnimalRowProps> = ({ animal, owned, upgrades, food, onBuy, onHover }) => {
	const cap = farmCap(upgrades);
	const full = owned >= cap;
	const one = animalOutput(animal, 1, upgrades);
	const product = animal.product.resource;
	const costOne = calculateAnimalCost(animal, owned);
	const canTen = !full && owned + 10 <= cap;
	const costTen = canTen ? animalBatchCost(animal, owned, 10) : 0;
	const maxN = affordableAnimals(animal, owned, food, cap);
	const costMax = animalBatchCost(animal, owned, maxN);
	const penMaxed = farmUpgradeLevel(upgrades, 'pen') >= FARM_UPGRADES.pen.maxLevel;

	const press = (count: number | 'max', ok: boolean) => {
		if (!ok) {
			audioManager.playSound('wrong');
			return;
		}
		onBuy(count);
		audioManager.playSound('click');
	};

	return (
		<div
			className='farm-animal-card'
			data-ok={!full && food >= costOne}
			role='group'
			aria-label={animal.name}
			onMouseEnter={() => onHover(true)}
			onMouseLeave={() => onHover(false)}>
			<div className='farm-animal-head'>
				<PixelIcon name={ANIMAL_PIXEL_ICONS[animal.id]} scale={0.75} alt='' />
				<span className='farm-animal-name'>{animal.name}</span>
				<span className='farm-animal-count' title='Animals owned / pen limit'>
					{owned}/{cap}
				</span>
			</div>
			<div className='farm-animal-yield'>
				<span className='inline-flex items-center gap-1 text-red-400'>
					{formatNumber(one.meat)}/s <ResourceIcon resource='meat' />
				</span>
				<span className='inline-flex items-center gap-1 text-[#e8d08a]'>
					{formatNumber(one[product])}/s <ResourceIcon resource={product} />
				</span>
				<span className='farm-animal-each'>each</span>
			</div>

			{full ? (
				<p className='farm-animal-note'>{penMaxed ? 'The pen is as big as it gets.' : 'Pen full: expand it below.'}</p>
			) : (
				<div className='farm-animal-buy'>
					<button className='farm-buy' data-ok={food >= costOne} onClick={() => press(1, food >= costOne)}>
						<span className='farm-buy-label'>Buy</span>
						<span className='farm-buy-cost'>
							{formatNumber(costOne)} <ResourceIcon resource='food' />
						</span>
					</button>
					<button
						className='farm-buy'
						disabled={!canTen}
						data-ok={canTen && food >= costTen}
						onClick={() => press(10, canTen && food >= costTen)}>
						<span className='farm-buy-label'>×10</span>
						<span className='farm-buy-cost'>
							{canTen ? (
								<>
									{formatNumber(costTen)} <ResourceIcon resource='food' />
								</>
							) : (
								'pen full'
							)}
						</span>
					</button>
					<button
						className='farm-buy'
						disabled={maxN < 1}
						data-ok={maxN >= 1}
						onClick={() => press('max', maxN >= 1)}>
						<span className='farm-buy-label'>Max{maxN > 0 ? ` ${maxN}` : ''}</span>
						<span className='farm-buy-cost'>
							{maxN > 0 ? (
								<>
									{formatNumber(costMax)} <ResourceIcon resource='food' />
								</>
							) : (
								'no food'
							)}
						</span>
					</button>
				</div>
			)}
		</div>
	);
};

/** The animal shop along the right edge of the farm scene (the mirror of the upgrade shelf at the bottom). */
const FarmAnimalDock: React.FC<FarmAnimalDockProps> = ({ open, onToggle, onBuy, onHover }) => {
	const food = useGameStore((state) => state.resources.food);
	const farmLevels = useGameStore((state) => state.farmLevels);
	const upgrades = useGameStore((state) => state.farmUpgrades);

	return (
		<div className='farm-animals' data-open={open}>
			<button className='farm-dock-toggle' onClick={onToggle} aria-expanded={open}>
				Animals {open ? '▶' : '◀'}
			</button>
			{open && (
				<div className='farm-animals-list'>
					{ANIMALS.map((animal) => (
						<AnimalRow
							key={animal.id}
							animal={animal}
							owned={farmLevels[animal.id] || 0}
							upgrades={upgrades}
							food={food}
							onBuy={(count) => onBuy(animal.id, count)}
							onHover={(hovering) => onHover(hovering ? animal.id : null)}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default FarmAnimalDock;
