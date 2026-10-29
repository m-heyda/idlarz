import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { averageItemLevel } from '@/lib/inventory';
import { resolveItem } from '@/lib/itemInstance';
import { freeRefreshesLeft, refreshCooldown, refreshCost, secondsToRotation, shelfCells, shopPriceOf } from '@/lib/merchant';
import { MERCHANT_GOODS, MERCHANT_SHOP_ITEMS, MERCHANT_UPGRADES, MERCHANT_UPGRADE_GROUPS, type MerchantUpgradeId } from '@/config/gameConfig';
import type { Box } from '@/lib/tipPlacement';
import type { ItemInstance } from '@/types/game';
import { formatNumber, formatTime } from '@/utils/formatters';
import { merchantLevel, merchantUpgradeCost } from '@/utils/gameUtils';
import ItemSlot, { FloatingTip } from '../../ItemSlot';
import ResourceIcon from '../../ResourceIcon';
import '@/styles/Inventory.css';

/** How many places stand on one plank of the shelf. */
const SHELF_SLOTS = 4;

interface BoughtProps {
	onBought: (what: string, price: number) => void;
}

const UPGRADE_IDS = Object.keys(MERCHANT_UPGRADES) as MerchantUpgradeId[];
const UPGRADE_GROUPS = Object.keys(MERCHANT_UPGRADE_GROUPS) as (keyof typeof MERCHANT_UPGRADE_GROUPS)[];

/** One permanent bonus: what it gives now and next, and the gold for the next level. */
const UpgradeCard: React.FC<BoughtProps & { id: MerchantUpgradeId }> = ({ id, onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const level = useGameStore((state) => merchantLevel(state.merchantUpgrades, id));
	const buy = useGameStore((state) => state.buyMerchantUpgrade);
	const def = MERCHANT_UPGRADES[id];
	const maxed = level >= def.maxLevel;
	const cost = merchantUpgradeCost(id, level);
	return (
		<div className='px-card text-white'>
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
};

/** The permanent bonuses (economy, combat, rebirth), under a heading per group. They lay out in the two columns of the Upgrades tab. */
export const MerchantUpgradeCards: React.FC<BoughtProps> = ({ onBought }) => (
	<>
		{UPGRADE_GROUPS.map((group) => (
			<React.Fragment key={group}>
				<h3 className='col-span-2 px-h text-center mt-2'>{MERCHANT_UPGRADE_GROUPS[group]}</h3>
				{UPGRADE_IDS.filter((id) => MERCHANT_UPGRADES[id].group === group).map((id) => (
					<UpgradeCard key={id} id={id} onBought={onBought} />
				))}
			</React.Fragment>
		))}
	</>
);

/**
 * One thing on the shelf: its slot (the usual item hover card) with a small Buy button under it. The price is not printed: it shows when
 * the pointer rests on the button (and on the item's card), which keeps the shelf compact.
 */
const ShelfItem: React.FC<{ item?: ItemInstance; itemId?: string; name: string; price: number; gold: number; onBuy: () => void }> = ({
	item,
	itemId,
	name,
	price,
	gold,
	onBuy,
}) => {
	const [tip, setTip] = useState<Box | null>(null);
	const affordable = gold >= price;
	return (
		<div className='shop-cell'>
			<ItemSlot item={item} itemId={itemId} compare={!!item} buyPrice={price} />
			{/* the wrapper takes the hover: a disabled button swallows mouse events */}
			<span
				className='shop-buy-wrap'
				onMouseEnter={(e) => {
					const { left, top, right, bottom } = e.currentTarget.getBoundingClientRect();
					setTip({ left, top, right, bottom });
				}}
				onMouseLeave={() => setTip(null)}>
				<button className='px-btn px-btn-sm shop-buy' disabled={!affordable} aria-label={`Buy ${name} for ${formatNumber(price)} gold`} onClick={onBuy}>
					Buy
				</button>
			</span>
			{tip &&
				createPortal(
					<FloatingTip anchor={tip}>
						<div className='px-tooltip text-sm'>
							<div className='px-tip-title'>{name}</div>
							<div className={affordable ? 'text-yellow-400' : 'text-[#ff8a6a]'}>
								<span className='inline-flex items-center gap-1'>
									{formatNumber(price)} <ResourceIcon resource='gold' />
								</span>
								{!affordable && <span className='px-tip-muted'> (not enough gold)</span>}
							</div>
						</div>
					</FloatingTip>,
					document.body
				)}
		</div>
	);
};

/**
 * The merchant's goods: a wooden shelf of small slots standing on planks (four to a plank), a Buy button hanging under each. It holds the
 * rolled gear, which is reshuffled every half hour of play time (or for gold), and the potions that are always in stock, mixed in one order.
 * Buying a piece takes it off the shelf; a full bag buys nothing.
 */
export const MerchantGoods: React.FC<BoughtProps> = ({ onBought }) => {
	const gold = useGameStore((state) => state.resources.gold);
	const stock = useGameStore((state) => state.merchantStock);
	const playSeconds = useGameStore((state) => state.playSeconds);
	const refreshes = useGameStore((state) => state.merchantRefreshes);
	const worn = useGameStore((state) => Math.round(averageItemLevel(state.equipment)));
	const buyOffer = useGameStore((state) => state.buyOffer);
	const buyItem = useGameStore((state) => state.buyItem);
	const refresh = useGameStore((state) => state.refreshMerchantStock);
	const showToast = useUiStore((state) => state.showToast);
	const refreshState = useGameStore((state) => state.merchantRefresh);
	const freeLeft = freeRefreshesLeft(refreshState, playSeconds);
	const wait = refreshCooldown(refreshState, playSeconds);
	const cost = freeLeft > 0 ? 0 : refreshCost(refreshes);
	const left = stock ? secondsToRotation(stock, playSeconds) : 0;
	const cells = shelfCells(stock, MERCHANT_SHOP_ITEMS.map(({ id }) => id));
	// the cells stand on planks, SHELF_SLOTS to a plank
	const shelves = Array.from({ length: Math.ceil(cells.length / SHELF_SLOTS) }, (_, row) => cells.slice(row * SHELF_SLOTS, (row + 1) * SHELF_SLOTS));
	const renderCell = (cell: (typeof cells)[number]) => {
		if (cell.kind === 'offer') {
			const item = stock?.offers[cell.index];
			if (!item) return null;
			const price = shopPriceOf(item);
			const name = resolveItem(item)?.name ?? item.base;
			return (
				<ShelfItem
					key={`${cell.key}:${cell.index}`}
					item={item}
					name={name}
					price={price}
					gold={gold}
					onBuy={() => {
						if (buyOffer(cell.index)) onBought(name, price);
						else if (gold >= price) showToast('Your bag is full');
					}}
				/>
			);
		}
		const def = ITEM_CATALOG[cell.id];
		const price = MERCHANT_SHOP_ITEMS.find((entry) => entry.id === cell.id)?.price;
		if (!def || price === undefined) return null;
		return (
			<ShelfItem
				key={cell.key}
				itemId={cell.id}
				name={def.name}
				price={price}
				gold={gold}
				onBuy={() => {
					if (buyItem(cell.id, 1)) onBought(def.name, price);
					else if (gold >= price) showToast('Your bag is full');
				}}
			/>
		);
	};
	return (
		<div className='px-card mb-4'>
			<div className='flex items-center justify-between mb-2 gap-2'>
				<h3 className='text-white font-semibold'>Today&apos;s goods</h3>
				<div className='flex items-center gap-3'>
					<span className='text-xs text-[#a89878]'>New goods in {formatTime(left)}</span>
					<button
						className='px-btn px-btn-sm'
						disabled={gold < cost || wait > 0}
						title={`Shuffle the shelf now. ${MERCHANT_GOODS.refresh.freePerWindow} refreshes are free every ${MERCHANT_GOODS.refresh.windowSec / 3600} hours of play, then each one costs double the last; ${MERCHANT_GOODS.refresh.cooldownSec} s between refreshes.`}
						onClick={() => {
							if (refresh()) onBought('a new shelf of goods', cost);
						}}>
						<span className='inline-flex items-center gap-1'>
							{wait > 0 ? (
								`Wait ${formatTime(wait)}`
							) : freeLeft > 0 ? (
								`Refresh free (${freeLeft} left)`
							) : (
								<>
									Refresh {formatNumber(cost)} <ResourceIcon resource='gold' />
								</>
							)}
						</span>
					</button>
				</div>
			</div>
			<p className='text-xs text-[#a89878] mb-3'>
				Gear never more than {MERCHANT_GOODS.maxAboveAverage} item levels above what you wear (item level {worn}), and potions that are always in stock. Hover an
				item for what it does and a Buy button for its price.
			</p>
			<div className='shop-board'>
				{shelves.map((shelf, row) => (
					<div className='shop-shelf' key={row}>
						<div className='shop-plank' aria-hidden />
						{shelf.map(renderCell)}
					</div>
				))}
			</div>
			{(!stock || stock.offers.length === 0) && <p className='text-sm text-[#a89878] mt-3'>The gear is sold out. New goods arrive soon.</p>}
		</div>
	);
};
