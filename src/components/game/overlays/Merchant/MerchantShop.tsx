import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { plainItem } from '@/lib/itemInstance';
import { MERCHANT_SHOP_ITEMS, MERCHANT_UPGRADES, type MerchantUpgradeId } from '@/config/gameConfig';
import { formatNumber } from '@/utils/formatters';
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

/** Plain gear and potions. Nothing is charged if they do not fit in the bag. */
export const MerchantShop: React.FC<BoughtProps> = ({ onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const buyItem = useGameStore((state) => state.buyItem);
	const [full, setFull] = useState(false);
	return (
		<div className='px-card mb-6'>
			<h3 className='text-white font-semibold mb-2'>Gear &amp; potions</h3>
			<p className='text-sm text-[#d8c8a0] mb-4'>
				Plain wares for your bag. Rattatui gear is not for sale: only the Rat King carries it.
				{full && <span className='text-red-400'> Your bag is full.</span>}
			</p>
			<div className='grid grid-cols-3 gap-3'>
				{MERCHANT_SHOP_ITEMS.map(({ id, price }) => {
					const def = ITEM_CATALOG[id];
					if (!def) return null;
					return (
						<div key={id} className='flex items-center gap-3'>
							{def.kind === 'consumable' ? <ItemSlot itemId={id} /> : <ItemSlot item={plainItem(id)} compare />}
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
		</div>
	);
};
