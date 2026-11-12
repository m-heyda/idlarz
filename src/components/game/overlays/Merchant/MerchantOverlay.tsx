import React, { useEffect } from 'react';
import { newClaimId } from '@/lib/offlineClient';
import { requestGems } from '@/lib/rewardsClient';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore } from '@/stores/uiStore';
import { formatNumber, formatPercent } from '@/utils/formatters';
import { MerchantItemsSection } from './MerchantItemsSection';
import { MerchantGoods, MerchantUpgradeCards } from './MerchantShop';
import { CLICK_LADDER } from '@/config/economy';
import { cn } from '@/lib/utils';
import ResourceIcon from '../../ResourceIcon';

/** Opening the Gambling tab while it is still empty is a secret deed (IDL-305): the server is told once per page load, and it decides whether that counts. */
let gamblingSeen = false;
const GamblingPlaceholder: React.FC = () => {
	useEffect(() => {
		if (gamblingSeen) return;
		gamblingSeen = true;
		void requestGems(newClaimId(), { action: 'visit', id: 'gambling_empty' }).then((reply) => {
			if (reply.status !== 'ok') gamblingSeen = false;
		});
	}, []);
	return <PlaceholderTabContent title='Gambling' emoji='🎲' description='Coming soon! Test your luck with various games of chance. Win big or lose it all!' />;
};

// Extracted component for tab content placeholders
interface PlaceholderTabContentProps {
	title: string;
	emoji: string;
	description: string;
}

const PlaceholderTabContent: React.FC<PlaceholderTabContentProps> = ({ title, emoji, description }) => {
	return (
		<>
			<h2 className='px-h text-center'>{title}</h2>
			<div className='flex flex-col items-center justify-center h-[60vh]'>
				<div className='text-6xl mb-6'>{emoji}</div>
				<p className='text-[#a89878] text-center'>{description}</p>
			</div>
		</>
	);
};

/**
 * The Goods, Upgrades, Quests and Gambling tabs of the Merchant window, still in their own look while they are rebuilt one by one inside the new window (the Resources tab is `MerchantResourcesTab`).
 */
const MerchantOverlay: React.FC = () => {
	const resources = useGameStore((state) => state.resources);
	const buyClickUpgrade = useGameStore((state) => state.buyClickUpgrade);
	const clickLevel = useGameStore((state) => state.clickLevel);

	const activeTab = useUiStore((state) => state.merchantTab);

	// Every sale and purchase is announced by the shared toast (top of the screen), so the window never jumps
	const showToast = useUiStore((state) => state.showToast);

	// Click power ladder: gold per click = your gold/s x power (see CLICK_LADDER)
	const maxClickLevel = CLICK_LADDER.length - 1;
	const nextClick = CLICK_LADDER[clickLevel + 1];
	const percent = (power: number) => formatPercent(power * 100);

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
		announcePurchase(`Click Power Level ${clickLevel + 1}`, price);
	};

	const announcePurchase = (item: string, price: number) => {
		showToast(`Purchased ${item} for ${formatNumber(price)} Gold`);
	};

	// Render tab content based on active tab
	const renderTabContent = () => {
		switch (activeTab) {
			case 'goods':
				return (
					<>
						<h2 className='px-h text-center'>Goods</h2>

						{/* The shuffling shelf and the supplies */}
						<MerchantGoods onBought={announcePurchase} />

						{/* Sell bag items */}
						<MerchantItemsSection />
					</>
				);
			case 'upgrades':
				return (
					<>
						<h2 className='px-h text-center'>Upgrades</h2>

						<div className='grid grid-cols-2 gap-4'>
							{/* Gold click multiplier upgrade */}
							<div
								className={cn('px-card text-white', {
									'!border-purple-500': clickLevel >= maxClickLevel,
								})}
							>
								<h3 className='font-semibold mb-2 flex items-center text-sm'>
									<span className='mr-2'>
										<ResourceIcon resource='gold' />
									</span>{' '}
									Click Power
									{clickLevel >= maxClickLevel && <span className='ml-2 text-xs uppercase text-purple-500'>(Max level)</span>}
								</h3>
								<p className='text-sm text-[#d8c8a0] mb-4'>{getClickMultiplierText()}</p>

								{nextClick ? (
									<div className='flex justify-between items-center text-sm mt-2'>
										<p className='text-yellow-400 font-medium'>
											<span className='inline-flex items-center gap-1'>
												{formatNumber(nextClick?.price ?? 0)} <ResourceIcon resource='gold' />
											</span>
										</p>
										<button onClick={handleBuyClickMultiplier} disabled={resources.gold < (nextClick?.price ?? 0)} className='px-btn px-btn-sm'>
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
				return <GamblingPlaceholder />;
			default:
				return null;
		}
	};

	return <div className='px-panel flex flex-col'>{renderTabContent()}</div>;
};

export default MerchantOverlay;
