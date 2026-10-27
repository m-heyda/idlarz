import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { formatNumber } from '@/utils/formatters';
import { ResourceSellingSection } from './ResourceSellingSection';
import { MerchantPriceList } from './MerchantPriceList';
import { MerchantTabButtons } from './MerchantTabButtons';
import { MerchantItemsSection } from './MerchantItemsSection';
import { MerchantGoods, MerchantUpgradeCards } from './MerchantShop';
import { sellMultiplier, sellPayout } from '@/utils/gameUtils';
import {
	CLICK_LADDER,
	MERCHANT_BUYABLE,
	MERCHANT_BUY_MULTIPLIER,
	MERCHANT_RESOURCE_INFO,
	MERCHANT_RESOURCE_PRICES,
} from '@/config/gameConfig';
import { cn } from '@/lib/utils';
import type { MerchantTab } from '@/types/game';
import PixelIcon from '../../PixelIcon';
import ResourceIcon from '../../ResourceIcon';

// Extracted component for tab content placeholders
interface PlaceholderTabContentProps {
	title: string;
	emoji: string;
	description: string;
}

const PlaceholderTabContent: React.FC<PlaceholderTabContentProps> = ({
	title,
	emoji,
	description,
}) => {
	return (
		<>
			<h2 className='px-h text-center'>
				{title}
			</h2>
			<div className='flex flex-col items-center justify-center h-[60vh]'>
				<div className='text-6xl mb-6'>{emoji}</div>
				<p className='text-[#a89878] text-center'>{description}</p>
			</div>
		</>
	);
};

// Component for resource buying with slider
interface ResourceBuyingSectionProps {
	resource: keyof typeof MERCHANT_RESOURCE_PRICES;
	maxAmount: number;
	currentAmount: number;
	goldPrice: number;
	onAmountChange: (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => void;
	onBuy: (resource: keyof typeof MERCHANT_RESOURCE_PRICES) => void;
}

const ResourceBuyingSection: React.FC<ResourceBuyingSectionProps> = ({
	resource,
	maxAmount,
	currentAmount,
	goldPrice,
	onAmountChange,
	onBuy,
}) => {
	const resourceInfo = MERCHANT_RESOURCE_INFO[resource];
	const canAfford = useGameStore((state) => state.resources.gold >= goldPrice);

	return (
		<div className='px-card'>
			<div className='flex items-center justify-between mb-3'>
				<div className='flex items-center'>
					<span className='mr-2'><ResourceIcon resource={resource} scale={1} /></span>
					<div>
						<h3 className='text-white font-bold text-sm'>
							{resourceInfo.label}
						</h3>
						<p className='text-xs text-[#a89878] mr-4'>{resourceInfo.description}</p>
					</div>
				</div>
				<div className='text-right'>
					<div className='text-yellow-400 font-medium text-xs'>
						<span className='inline-flex items-center gap-1'>{MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER} <ResourceIcon resource='gold' /> each</span>
					</div>
					<div className='text-xs text-[#a89878] whitespace-nowrap'>
						Max: {formatNumber(maxAmount)}
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
						className={`transition-all font-bold text-green-400 duration-500 ${
							currentAmount <= 0 && 'opacity-0 select-none'
						}`}>
						{formatNumber(currentAmount)}
					</span>
				</div>
			</div>

			<div className='flex justify-between items-center'>
				<div className='text-yellow-400 text-sm'>
					<span className='inline-flex items-center gap-1'><span className='font-medium'>{formatNumber(goldPrice)}</span> <ResourceIcon resource='gold' /></span>
				</div>
				<div className='flex gap-2 font-bold'>
					<button
						onClick={() => onBuy(resource)}
						disabled={currentAmount <= 0 || !canAfford}
						className='px-btn px-btn-sm'>
						Buy
					</button>
				</div>
			</div>
		</div>
	);
};

const MerchantOverlay: React.FC = () => {
	const {
		resources,
		sellResources,
		buyResource,
		buyClickUpgrade,
		clickLevel,
		merchantUpgrades,
		prestige,
	} = useGameStore();

	// State for current merchant tab
	const [activeTab, setActiveTab] = useState<MerchantTab>('resources');

	// Slider amounts for selling and buying, one entry per resource the merchant trades
	const zero = (keys: readonly string[]): Record<string, number> => Object.fromEntries(keys.map((k) => [k, 0]));
	const [sellAmounts, setSellAmounts] = useState<Record<string, number>>(() => zero(Object.keys(MERCHANT_RESOURCE_PRICES)));
	const [buyAmounts, setBuyAmounts] = useState<Record<string, number>>(() => zero(MERCHANT_BUYABLE));

	// For showing success message after selling
	const [saleMessage, setSaleMessage] = useState<{
		resource: string;
		amount: number;
		gold: number;
	} | null>(null);

	// For showing purchase success message
	const [purchaseMessage, setPurchaseMessage] = useState<{
		item: string;
		price: number;
	} | null>(null);

	// Calculate the max for each resource (current owned amount)
	const maxAmounts = resources as unknown as Record<string, number>;

	// Handle selling the specified amount of a resource
	const handleSell = (resource: keyof typeof MERCHANT_RESOURCE_PRICES) => {
		if (sellAmounts[resource] <= 0) return;

		// Gold gained (same formula as the store's sellResources)
		const goldGained = calculateGold(resource, sellAmounts[resource]);

		// Sell the resources
		if (!sellResources(resource, sellAmounts[resource])) return;

		// Set success message
		setSaleMessage({
			resource: MERCHANT_RESOURCE_INFO[resource].label,
			amount: sellAmounts[resource],
			gold: goldGained,
		});

		// Reset the slider for this resource
		setSellAmounts((prev) => ({
			...prev,
			[resource]: 0,
		}));

		// Clear message after 3 seconds
		setTimeout(() => {
			setSaleMessage(null);
		}, 3000);
	};

	// Handle selling all of a resource
	const handleSellAll = (resource: keyof typeof MERCHANT_RESOURCE_PRICES) => {
		if (resources[resource] <= 0) return;

		const amountToSell = resources[resource];
		
		// Gold gained (same formula as the store's sellResources)
		const goldGained = calculateGold(resource, amountToSell);

		// Sell the resources
		if (!sellResources(resource, amountToSell)) return;

		// Set success message
		setSaleMessage({
			resource: MERCHANT_RESOURCE_INFO[resource].label,
			amount: amountToSell,
			gold: goldGained,
		});

		// Clear message after 3 seconds
		setTimeout(() => {
			setSaleMessage(null);
		}, 3000);
	};

	// Handle changing the amount of a resource to sell
	const handleAmountChange = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => {
		setSellAmounts({
			...sellAmounts,
			[resource]: amount,
		});
	};

	// Handle changing the amount of a resource to buy
	const handleBuyAmountChange = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => {
		setBuyAmounts({
			...buyAmounts,
			[resource]: amount,
		});
	};

	// Calculate gold to be gained for the current selection
	const calculateGold = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => {
		return sellPayout(MERCHANT_RESOURCE_PRICES[resource], amount, { merchantUpgrades, prestige });
	};

	// Price of a resource pack (rounded up, same as the store's buyResource)
	const calculateResourcePackPrice = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES,
		amount: number
	) => {
		return Math.ceil(
			amount * MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER
		);
	};

	// Handle buying a resource with slider
	const handleBuyResource = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES
	) => {
		const amount = buyAmounts[resource];
		if (amount <= 0) return;

		const price = calculateResourcePackPrice(resource, amount);

		// Check if player can afford it
		if (resources.gold < price) return;

		// Subtract gold and add resources
		if (!buyResource(resource, amount)) return;

		// Show purchase message
		setPurchaseMessage({
			item: `${MERCHANT_RESOURCE_INFO[resource].label} x${formatNumber(
				amount
			)}`,
			price: price,
		});

		// Reset the slider for this resource
		setBuyAmounts((prev) => ({
			...prev,
			[resource]: 0,
		}));

		// Clear message after 3 seconds
		setTimeout(() => {
			setPurchaseMessage(null);
		}, 3000);
	};

	// Click power ladder: gold per click = your gold/s x power (see CLICK_LADDER)
	const maxClickLevel = CLICK_LADDER.length - 1;
	const nextClick = CLICK_LADDER[clickLevel + 1];
	const percent = (power: number) => `${Math.round(power * 100)}%`;

	const getClickMultiplierText = () =>
		nextClick
			? `Gold per click: ${percent(CLICK_LADDER[clickLevel].power)} of your gold/s → ${percent(nextClick.power)}`
			: `Maximum level reached (${percent(CLICK_LADDER[clickLevel].power)} of your gold/s per click)`;

	// Handle buying the next click power level
	const handleBuyClickMultiplier = () => {
		if (!nextClick) return;
		const price = nextClick.price;
		if (!buyClickUpgrade()) return;

		// Show purchase message
		setPurchaseMessage({
			item: `Click Power Level ${clickLevel + 1}`,
			price: price,
		});

		// Clear message after 3 seconds
		setTimeout(() => {
			setPurchaseMessage(null);
		}, 3000);
	};

	// Calculate max buy amount based on player's gold
	const calculateMaxBuyAmount = (
		resource: keyof typeof MERCHANT_RESOURCE_PRICES
	) => {
		const unitPrice = MERCHANT_RESOURCE_PRICES[resource] * MERCHANT_BUY_MULTIPLIER;
		return Math.floor(resources.gold / unitPrice);
	};

	const announcePurchase = (item: string, price: number) => {
		setPurchaseMessage({ item, price });
		setTimeout(() => setPurchaseMessage(null), 3000);
	};

	// The result of the last sale or purchase, shown at the top of every tab
	const messages = (
		<>
			{saleMessage && (
				<div className='mb-4 px-card text-center'>
					<p className='text-green-400'>
						Sold {formatNumber(saleMessage.amount)} {saleMessage.resource}{' '}
						for {formatNumber(saleMessage.gold)} Gold!
					</p>
				</div>
			)}
			{purchaseMessage && (
				<div className='mb-4 px-card text-center'>
					<p className='text-green-400'>
						Purchased {purchaseMessage.item} for{' '}
						{formatNumber(purchaseMessage.price)} Gold!
					</p>
				</div>
			)}
		</>
	);

	// Render tab content based on active tab
	const renderTabContent = () => {
		switch (activeTab) {
			case 'resources':
				return (
					<>
						<h2 className='px-h text-center'>
							Resources
						</h2>
						{messages}

						<div className='grid grid-cols-2 gap-6'>
							{/* Resource selling section */}
							{Object.keys(MERCHANT_RESOURCE_PRICES).map((resource) => {
								const typedResource =
									resource as keyof typeof MERCHANT_RESOURCE_PRICES;
								const maxAmount = Math.floor(maxAmounts[typedResource]);
								const currentAmount = sellAmounts[typedResource] ?? 0;
								const goldValue = calculateGold(typedResource, currentAmount);

								return (
									<ResourceSellingSection
										key={resource}
										resource={typedResource}
										maxAmount={maxAmount}
										currentAmount={currentAmount}
										goldValue={goldValue}
										priceMultiplier={sellMultiplier({ merchantUpgrades, prestige })}
										onAmountChange={handleAmountChange}
										onSell={handleSell}
										onSellAll={handleSellAll}
									/>
								);
							})}
						</div>

						{/* Resource packs */}
						<div className='px-card mt-6'>
							<h3 className='text-white font-semibold mb-2'>
								Resource Packs
							</h3>
							<p className='text-sm text-[#d8c8a0] mb-4'>
								Purchase resources in bulk (prices are {MERCHANT_BUY_MULTIPLIER}x sell value).
							</p>

							<div className='grid grid-cols-2 gap-4'>
								{/* Resource buying sections with sliders */}
								{MERCHANT_BUYABLE.map((resource) => {
									const typedResource =
										resource as keyof typeof MERCHANT_RESOURCE_PRICES;
									const maxAmount = calculateMaxBuyAmount(typedResource);
									const currentAmount = buyAmounts[typedResource] ?? 0;
									const goldPrice = calculateResourcePackPrice(
										typedResource,
										currentAmount
									);

									return (
										<ResourceBuyingSection
											key={resource}
											resource={typedResource}
											maxAmount={maxAmount}
											currentAmount={currentAmount}
											goldPrice={goldPrice}
											onAmountChange={handleBuyAmountChange}
											onBuy={handleBuyResource}
										/>
									);
								})}
							</div>
						</div>
					</>
				);
			case 'goods':
				return (
					<>
						<h2 className='px-h text-center'>
							Goods
						</h2>
						{messages}

						{/* The shuffling shelf and the supplies */}
						<MerchantGoods onBought={announcePurchase} />

						{/* Sell bag items */}
						<MerchantItemsSection />
					</>
				);
			case 'upgrades':
				return (
					<>
						<h2 className='px-h text-center'>
							Upgrades
						</h2>
						{messages}

						<div className='grid grid-cols-2 gap-4'>
							{/* Gold click multiplier upgrade */}
							<div className={cn('px-card text-white', {
								'!border-purple-500': clickLevel >= maxClickLevel
							})}>
								<h3 className='font-semibold mb-2 flex items-center text-sm'>
									<span className='mr-2'><ResourceIcon resource='gold' /></span> Click Power
									{clickLevel >= maxClickLevel && (
										<span className='ml-2 text-xs uppercase text-purple-500'>
											(Max level)
										</span>
									)}
								</h3>
								<p className='text-sm text-[#d8c8a0] mb-4'>
									{getClickMultiplierText()}
								</p>

								{nextClick ? (
									<div className='flex justify-between items-center text-sm mt-2'>
										<p className='text-yellow-400 font-medium'>
											<span className='inline-flex items-center gap-1'>{formatNumber(nextClick?.price ?? 0)} <ResourceIcon resource='gold' /></span>
										</p>
										<button
											onClick={handleBuyClickMultiplier}
											disabled={resources.gold < (nextClick?.price ?? 0)}
											className='px-btn px-btn-sm'>
											{resources.gold >= (nextClick?.price ?? 0) ? 'Purchase' : 'Get more gold!'}
										</button>
									</div>
								) : (
									<div className='bg-purple-900 bg-opacity-50 p-2 rounded border border-purple-700 text-center'>
										<p className='text-purple-300 font-medium'>Max Level Reached ({percent(CLICK_LADDER[clickLevel].power)} per click)</p>
									</div>
								)}
							</div>
							<MerchantUpgradeCards onBought={announcePurchase} />
						</div>
					</>
				);
			case 'quests':
				return (
					<PlaceholderTabContent
						title='Quests'
						emoji='📜'
						description='Coming soon! Take on special assignments from the merchant for valuable rewards and unique items.'
					/>
				);
			case 'gambling':
				return (
					<PlaceholderTabContent
						title='Gambling'
						emoji='🎲'
						description='Coming soon! Test your luck with various games of chance. Win big or lose it all!'
					/>
				);
			default:
				return null;
		}
	};

	return (
				<div className='grid grid-cols-5 gap-5'>
					{/* Merchant Avatar and Navigation */}
					<div className='col-span-1 flex flex-col gap-4'>
						{/* Merchant Avatar */}
						<div className='px-panel flex flex-col items-center'>
							<div className='mb-3'><PixelIcon name='merchant' alt='Merchant' scale={2} /></div>
							<h3 className='px-h text-center w-full'>
								Merchant
							</h3>
							<p className='text-[#a89878] text-xs text-center mb-4'>
								{`"I'll give you gold for your resources, traveler!"`}
							</p>

							<MerchantPriceList />
						</div>

						{/* Merchant Navigation Tabs */}
						<MerchantTabButtons
							activeTab={activeTab}
							onTabChange={setActiveTab}
						/>
					</div>

					{/* Content Area - Changes based on selected tab */}
					<div className='col-span-4 px-panel flex flex-col'>
						{renderTabContent()}
					</div>
				</div>
	);
};

export default MerchantOverlay;
