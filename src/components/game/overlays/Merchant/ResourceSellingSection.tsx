import React from 'react';
import { formatNumber } from '@/utils/formatters';
import ResourceIcon from '../../ResourceIcon';
import {
	MERCHANT_RESOURCE_INFO,
	MERCHANT_RESOURCE_PRICES,
} from '@/config/gameConfig';

// Extracted component for the resource selling section
interface ResourceSellingSectionProps {
	resource: keyof typeof MERCHANT_RESOURCE_PRICES;
	maxAmount: number;
	currentAmount: number;
	goldValue: number;
	/** Haggler bonus on the unit price (1 = none) */
	priceMultiplier?: number;
	onAmountChange: (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => void;
	onSell: (resource: keyof typeof MERCHANT_RESOURCE_PRICES) => void;
	onSellAll: (resource: keyof typeof MERCHANT_RESOURCE_PRICES) => void;
}

export const ResourceSellingSection: React.FC<ResourceSellingSectionProps> = ({
	resource,
	maxAmount,
	currentAmount,
	goldValue,
	priceMultiplier = 1,
	onAmountChange,
	onSell,
	onSellAll,
}) => {
	const resourceInfo = MERCHANT_RESOURCE_INFO[resource];

	return (
		<div className='px-card'>
			<div className='flex items-center justify-between mb-3'>
				<div className='flex items-center'>
					<span className='mr-2'><ResourceIcon resource={resource} scale={1} /></span>
					<div>
						<h3 className='text-white font-bold text-sm'>
							{resourceInfo.label}
						</h3>
						<p className='text-xs text-[#a89878]'>
							{resourceInfo.priceDescription}
						</p>
					</div>
				</div>
				<div className='text-right'>
					<div className='text-yellow-400 font-medium text-sm'>
						<span className='inline-flex items-center gap-1'>{formatNumber(MERCHANT_RESOURCE_PRICES[resource] * priceMultiplier)} <ResourceIcon resource='gold' /> each</span>
					</div>
					<div className='text-xs text-[#a89878]'>
						Available: {formatNumber(maxAmount)}
					</div>
				</div>
			</div>

			<div className='flex items-center gap-4 mb-3'>
				<input
					type='range'
					min='0'
					max={maxAmount}
					value={currentAmount}
					onChange={(e) => onAmountChange(resource, parseInt(e.target.value))}
					disabled={maxAmount <= 0}
					className='px-range flex-grow'
				/>
				<div className='w-20 text-center'>
					<span
						className={`transition-all font-bold text-red-400 duration-500 ${
							currentAmount <= 0 && 'opacity-0 select-none'
						}`}>
						{formatNumber(currentAmount)}
					</span>
				</div>
			</div>

			<div className='flex justify-between items-center'>
				<div className='text-yellow-400 text-sm'>
					<span className='inline-flex items-center gap-1'><span className='font-medium'>{formatNumber(goldValue)}</span> <ResourceIcon resource='gold' /></span>
				</div>
				<div className='flex gap-2 font-bold'>
					<button
						onClick={() => onSell(resource)}
						disabled={currentAmount <= 0}
						className='px-btn px-btn-gold px-btn-sm'>
						Sell
					</button>
					<button
						onClick={() => onSellAll(resource)}
						disabled={maxAmount <= 0}
						className='px-btn px-btn-red px-btn-sm'>
						Sell All
					</button>
				</div>
			</div>
		</div>
	);
};
