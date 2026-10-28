import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ANIMALS, FARM_UPGRADES } from '@/config/gameConfig';
import { ANIMAL_PIXEL_ICONS } from '@/config/pixelIcons';
import { formatNumber } from '@/utils/formatters';
import {
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
import CostList from '../CostList';
import { TipButton } from './Merchant/TipButton';

/** Width the scene keeps clear on the right while the panel is open (panel width plus its margin) */
export const ANIMAL_DOCK_WIDTH = 272;

interface FarmAnimalDockProps {
	open: boolean;
	onToggle: () => void;
	/** buy that many animals of a kind */
	onBuy: (animalId: string, count: number) => void;
	/** The kind under the cursor, so the scene can light up its animals */
	onHover: (animalId: string | null) => void;
}

interface AnimalRowProps {
	animal: Animal;
	owned: number;
	upgrades: Record<string, number>;
	food: number;
	onBuy: (count: number) => void;
	onHover: (hovering: boolean) => void;
}

/** The hover card of a buy button: what it buys, the price, and (when the button is off) why */
const buyTip = (name: string, count: number, cost: number, reason: string | null) => (
	<>
		<div className='px-tip-title'>
			Buy {count > 1 ? `${count} ${name}s` : name}
		</div>
		<CostList cost={{ food: cost }} />
		{reason && <div className='px-tip-muted'>{reason}</div>}
	</>
);

/** One animal in the panel: what it yields, how many you have, and Buy / Buy 10 buttons (the price is in their hover card). */
const AnimalRow: React.FC<AnimalRowProps> = ({ animal, owned, upgrades, food, onBuy, onHover }) => {
	const cap = farmCap(upgrades);
	const full = owned >= cap;
	const one = animalOutput(animal, 1, upgrades);
	const product = animal.product.resource;
	const costOne = calculateAnimalCost(animal, owned);
	const costTen = animalBatchCost(animal, owned, 10);
	const penMaxed = farmUpgradeLevel(upgrades, 'pen') >= FARM_UPGRADES.pen.maxLevel;
	const roomFor = (count: number) => owned + count <= cap;
	const canOne = !full && food >= costOne;
	const canTen = roomFor(10) && food >= costTen;
	const penReason = penMaxed ? 'The pen is as big as it gets.' : 'Pen full: expand it below.';
	const reasonOne = full ? penReason : 'Not enough food.';
	const reasonTen = !roomFor(10) ? (full ? penReason : `Room for only ${cap - owned} more.`) : 'Not enough food.';

	const buy = (count: number) => {
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

			<div className='farm-animal-buy'>
				<TipButton
					className='farm-buy'
					label='Buy'
					disabled={!canOne}
					onClick={() => buy(1)}
					tip={buyTip(animal.name, 1, costOne, canOne ? null : reasonOne)}
				/>
				<TipButton
					className='farm-buy'
					label='Buy 10'
					disabled={!canTen}
					onClick={() => buy(10)}
					tip={buyTip(animal.name, 10, costTen, canTen ? null : reasonTen)}
				/>
			</div>
		</div>
	);
};

/** The animal shop along the right edge of the farm scene (the upgrade drawer slides up beside it). */
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
