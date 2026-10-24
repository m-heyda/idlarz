import React from 'react';
import { formatNumber } from '@/utils/formatters';
import { FARM_UPGRADES } from '@/config/gameConfig';
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
import ResourceIcon from '../ResourceIcon';

interface FarmAnimalCardProps {
	animal: Animal;
	owned: number;
	upgrades: Record<string, number>;
	food: number;
	pinned: boolean;
	onBuy: (count: number | 'max') => void;
}

/** The buy card that hangs above an animal: what one animal yields, how many you have, and x1 / x10 / Max buttons. */
const FarmAnimalCard: React.FC<FarmAnimalCardProps> = ({ animal, owned, upgrades, food, pinned, onBuy }) => {
	const cap = farmCap(upgrades);
	const full = owned >= cap;
	const one = animalOutput(animal, 1, upgrades);
	const product = animal.product.resource;
	const costOne = calculateAnimalCost(animal, owned);
	const canTen = !full && owned + 10 <= cap;
	const costTen = canTen ? animalBatchCost(animal, owned, 10) : 0;
	const maxN = affordableAnimals(animal, owned, food, cap);
	const costMax = animalBatchCost(animal, owned, maxN);
	const penLevel = farmUpgradeLevel(upgrades, 'pen');
	const penMaxed = penLevel >= FARM_UPGRADES.pen.maxLevel;

	const press = (count: number | 'max', ok: boolean) => {
		if (!ok) {
			audioManager.playSound('wrong');
			return;
		}
		onBuy(count);
		audioManager.playSound('click');
	};

	return (
		<div className='farm-card' data-pinned={pinned} role='group' aria-label={animal.name}>
			<div className='farm-card-head'>
				<span className='farm-card-name'>{animal.name}</span>
				<span className='farm-card-count' title='Animals owned / pen limit'>
					{owned}/{cap}
				</span>
			</div>
			<div className='farm-card-rows'>
				<div className='farm-card-row'>
					<span>Each yields</span>
					<span className='inline-flex items-center gap-1 text-red-400'>
						{formatNumber(one.meat)}/s <ResourceIcon resource='meat' />
					</span>
				</div>
				<div className='farm-card-row'>
					<span />
					<span className='inline-flex items-center gap-1 text-[#e8d08a]'>
						{formatNumber(one[product])}/s <ResourceIcon resource={product} />
					</span>
				</div>
				{owned > 0 && (
					<div className='farm-card-row'>
						<span>All {owned}</span>
						<span className='inline-flex items-center gap-1 text-red-400'>
							{formatNumber(one.meat * owned)}/s <ResourceIcon resource='meat' />
						</span>
					</div>
				)}
			</div>

			{full ? (
				<p className='farm-card-note'>
					{penMaxed ? 'The pen is as big as it gets.' : 'The pen is full. Expand it below to hold more.'}
				</p>
			) : (
				<div className='farm-card-buy'>
					<button
						className='px-btn px-btn-sm'
						data-ok={food >= costOne}
						onClick={() => press(1, food >= costOne)}>
						Buy
						<span className='farm-cost'>
							{formatNumber(costOne)} <ResourceIcon resource='food' />
						</span>
					</button>
					<button
						className='px-btn px-btn-sm'
						disabled={!canTen}
						data-ok={canTen && food >= costTen}
						onClick={() => press(10, canTen && food >= costTen)}>
						x10
						<span className='farm-cost'>
							{canTen ? (
								<>
									{formatNumber(costTen)} <ResourceIcon resource='food' />
								</>
							) : (
								'over the limit'
							)}
						</span>
					</button>
					<button
						className='px-btn px-btn-sm'
						disabled={maxN < 1}
						data-ok={maxN >= 1}
						onClick={() => press('max', maxN >= 1)}>
						Max{maxN > 0 ? ` (${maxN})` : ''}
						<span className='farm-cost'>
							{maxN > 0 ? (
								<>
									{formatNumber(costMax)} <ResourceIcon resource='food' />
								</>
							) : (
								'not enough food'
							)}
						</span>
					</button>
				</div>
			)}
		</div>
	);
};

export default FarmAnimalCard;
