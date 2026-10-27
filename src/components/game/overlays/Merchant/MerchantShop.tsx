import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { averageItemLevel } from '@/lib/inventory';
import { resolveItem } from '@/lib/itemInstance';
import { refreshCost, secondsToRotation, shopPriceOf } from '@/lib/merchant';
import { MERCHANT_GOODS, MERCHANT_SHOP_ITEMS, MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/gameConfig';
import { formatNumber, formatTime } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/gameUtils';
import ItemSlot from '../../ItemSlot';
import ResourceIcon from '../../ResourceIcon';
import '@/styles/Inventory.css';

interface BoughtProps {
	onBought: (what: string, price: number) => void;
}

/** Permanent bonuses (Haggler, Bulk Discount, Lucky Charm, Pack Rat) bought with gold. */
export const MerchantUpgradeCards: React.FC<BoughtProps> = ({ onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const upgrades = useGameStore((state) => state.merchantUpgrades);
	const buy = useGameStore((state) => state.buyMerchantUpgrade);
	return (
		<>
			{(Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[]).map((id) => {
				const def = MERCHANT_UPGRADES[id];
				const level = merchantLevel(upgrades, id);
				const maxed = level >= def.maxLevel;
				const cost = merchantUpgradeCost(id, level);
				return (
					<div key={id} className='px-card text-white'>
						<h3 className='font-semibold mb-1 text-sm'>
							{def.label} <span className='text-[#a89878]'>({level}/{def.maxLevel})</span>
						</h3>
						<p className='text-sm text-[#d8c8a0] mb-1'>Now: {level > 0 ? def.description(level) : 'nothing yet'}</p>
						{!maxed && <p className='text-xs text-[#a89878] mb-3'>Next level: {def.description(level + 1)}</p>}
						{maxed ? (
							<div className='text-purple-300 text-sm text-center'>Max level</div>
						) : (
							<div className='flex justify-between items-center text-sm mt-2'>
								<p className='text-yellow-400 font-medium'>
									<span className='inline-flex items-center gap-1'>
										{formatNumber(cost)} <ResourceIcon resource='gold' />
									</span>
								</p>
								<button
									className='px-btn px-btn-sm'
									disabled={gold < cost}
									onClick={() => {
										if (buy(id)) onBought(`${def.label} level ${level + 1}`, cost);
									}}>
									{gold >= cost ? 'Purchase' : 'Get more gold!'}
								</button>
							</div>
						)}
					</div>
				);
			})}
		</>
	);
};

/** Supplies: potions, always in stock. Nothing is charged if they do not fit in the bag. */
const Supplies: React.FC<BoughtProps & { full: boolean; setFull: (full: boolean) => void }> = ({ onBought, full, setFull }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const buyItem = useGameStore((state) => state.buyItem);
	return (
		<div className='px-card mb-4'>
			<h3 className='text-white font-semibold mb-2'>Supplies</h3>
			<p className='text-sm text-[#d8c8a0] mb-3'>Always in stock.</p>
			<div className='grid grid-cols-3 gap-3'>
				{MERCHANT_SHOP_ITEMS.map(({ id, price }) => {
					const def = ITEM_CATALOG[id];
					if (!def) return null;
					return (
						<div key={id} className='flex items-center gap-3'>
							<ItemSlot itemId={id} />
							<div className='flex flex-col gap-1 min-w-0'>
								<span className='text-xs text-white truncate'>{def.name}</span>
								<button
									className='px-btn px-btn-sm'
									disabled={gold < price}
									onClick={() => {
										const ok = buyItem(id, 1);
										setFull(!ok && gold >= price);
										if (ok) onBought(def.name, price);
									}}>
									<span className='inline-flex items-center gap-1'>
										{formatNumber(price)} <ResourceIcon resource='gold' />
									</span>
								</button>
							</div>
						</div>
					);
				})}
			</div>
			{full && <p className='text-red-400 text-sm mt-2'>Your bag is full.</p>}
		</div>
	);
};

/**
 * The merchant's goods: a shelf of rolled gear that is reshuffled every half hour of play time (or for gold), and the supplies.
 * Buying a piece takes it off the shelf; a full bag buys nothing.
 */
export const MerchantGoods: React.FC<BoughtProps> = ({ onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const stock = useGameStore((state) => state.merchantStock);
	const playSeconds = useGameStore((state) => state.playSeconds);
	const refreshes = useGameStore((state) => state.merchantRefreshes);
	const worn = useGameStore((state) => Math.round(averageItemLevel(state.equipment)));
	const buyOffer = useGameStore((state) => state.buyOffer);
	const refresh = useGameStore((state) => state.refreshMerchantStock);
	const [full, setFull] = useState(false);
	const cost = refreshCost(refreshes);
	const left = stock ? secondsToRotation(stock, playSeconds) : 0;
	return (
		<>
			<div className='px-card mb-4'>
				<div className='flex items-center justify-between mb-2 gap-2'>
					<h3 className='text-white font-semibold'>Today&apos;s goods</h3>
					<div className='flex items-center gap-3'>
						<span className='text-xs text-[#a89878]'>New goods in {formatTime(left)}</span>
						<button
							className='px-btn px-btn-sm'
							disabled={gold < cost}
							title='Shuffle the shelf now'
							onClick={() => {
								if (refresh()) onBought('a new shelf of goods', cost);
							}}>
							<span className='inline-flex items-center gap-1'>
								Refresh {formatNumber(cost)} <ResourceIcon resource='gold' />
							</span>
						</button>
					</div>
				</div>
				<p className='text-sm text-[#d8c8a0] mb-3'>
					Plain and fine gear for the world around you, never more than {MERCHANT_GOODS.maxAboveAverage} item levels above what you wear (item level {worn}). Hover for what it does.
					{full && <span className='text-red-400'> Your bag is full.</span>}
				</p>
				{!stock || stock.offers.length === 0 ? (
					<p className='text-sm text-[#a89878]'>Sold out. New goods arrive soon.</p>
				) : (
					<div className='grid grid-cols-3 gap-3'>
						{stock.offers.map((item, index) => {
							const price = shopPriceOf(item);
							const name = resolveItem(item)?.name ?? item.base;
							return (
								<div key={`${index}-${item.base}-${item.level}`} className='flex items-center gap-3'>
									<ItemSlot item={item} compare />
									<div className='flex flex-col gap-1 min-w-0'>
										<span className='text-xs text-white truncate'>{name}</span>
										<button
											className='px-btn px-btn-sm'
											disabled={gold < price}
											onClick={() => {
												const ok = buyOffer(index);
												setFull(!ok && gold >= price);
												if (ok) onBought(name, price);
											}}>
											<span className='inline-flex items-center gap-1'>
												{formatNumber(price)} <ResourceIcon resource='gold' />
											</span>
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
			<Supplies onBought={onBought} full={full} setFull={setFull} />
		</>
	);
};
