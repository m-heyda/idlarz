import React, { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG, RARITIES, RARITY_ORDER } from '@/config/itemCatalog';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { isAutoSold } from '@/lib/loot/autoSell';
import { formatNumber } from '@/utils/formatters';
import { sellPayout } from '@/utils/gameUtils';
import ItemSlot from '../../ItemSlot';
import { slotProps } from '../../itemUi';
import ResourceIcon from '../../ResourceIcon';
import '@/styles/Inventory.css';

/**
 * Sell bag items for gold: click a slot to sell one, shift-click to sell the whole stack. Worn gear is not in the bag,
 * so it can never be sold by accident. "Sell common" / "up to uncommon" clear plain gear (potions always stay).
 */
export const MerchantItemsSection: React.FC = () => {
	const bag = useGameStore((state) => state.bag);
	const upgrades = useGameStore((state) => state.merchantUpgrades);
	const fighting = useGameStore((state) => !!state.fight);
	const sellItem = useGameStore((state) => state.sellItem);
	const sellJunk = useGameStore((state) => state.sellJunk);
	const autoSellUpTo = useGameStore((state) => state.autoSellUpTo);
	const setAutoSell = useGameStore((state) => state.setAutoSell);
	const [message, setMessage] = useState<string | null>(null);

	const say = (text: string) => {
		setMessage(text);
		setTimeout(() => setMessage(null), 3000);
	};

	const sell = (index: number, all: boolean) => {
		const slot = bag[index];
		if (!slot) return;
		const gear = gearOf(slot);
		const name = (gear && resolveItem(gear)?.name) || ('id' in slot ? ITEM_CATALOG[slot.id]?.name : undefined) || 'item';
		const qty = all ? slotQty(slot) : 1;
		const gold = sellItem(index, qty);
		if (gold > 0) say(`Sold ${qty > 1 ? `${qty} x ` : ''}${name} for ${formatNumber(gold)} Gold`);
		else say(fighting ? 'Finish the fight first' : 'The merchant is not interested');
	};

	const junk = (maxRarity: string) => {
		const { gold, count } = sellJunk(maxRarity);
		say(
			count > 0
				? `Sold ${count} piece${count === 1 ? '' : 's'} of gear for ${formatNumber(gold)} Gold`
				: 'No junk to sell'
		);
	};

	const worth = bag.reduce((sum, slot) => {
		const gear = slot ? gearOf(slot) : null;
		return gear && isAutoSold(gear, 'uncommon') ? sum + sellPayout(sellValueOf(gear), 1, upgrades) : sum;
	}, 0);
	// Auto-sell may go up to (but never include) the two rarest tiers: those are never junk
	const autoChoices = RARITY_ORDER.slice(0, -2);

	return (
		<div className='px-card mt-6'>
			<div className='flex items-center justify-between mb-2'>
				<h3 className='text-white font-bold text-sm'>Sell items</h3>
				<div className='flex gap-2'>
					<button className='px-btn px-btn-sm' onClick={() => junk('common')} disabled={fighting}>
						Sell common
					</button>
					<button className='px-btn px-btn-sm' onClick={() => junk('uncommon')} disabled={fighting || worth <= 0}>
						Sell up to uncommon
					</button>
				</div>
			</div>
			<p className='text-xs text-[#a89878] mb-3'>
				Click an item to sell one, Shift-click to sell the whole stack. Only your bag is listed, worn gear is safe.
				Plain gear in your bag is worth{' '}
				<span className='inline-flex items-center gap-1 text-yellow-400'>
					{formatNumber(worth)} <ResourceIcon resource='gold' />
				</span>
				.
			</p>
			<label className='flex items-center gap-2 text-xs text-[#a89878] mb-2'>
				Auto-sell new gear up to
				<select
					className='px-input'
					value={autoSellUpTo ?? ''}
					onChange={(e) => setAutoSell(e.target.value === '' ? null : e.target.value)}>
					<option value=''>Off (keep everything)</option>
					{autoChoices.map((id) => (
						<option key={id} value={id}>
							{RARITIES[id].label}
						</option>
					))}
				</select>
			</label>
			{message && <p className='text-green-400 text-sm mb-2'>{message}</p>}
			<div className='inv-bag'>
				{bag.map((slot, i) => (
					<ItemSlot
						key={i}
						{...slotProps(slot)}
						compare
						onClick={(e) => sell(i, e.shiftKey)}
					/>
				))}
			</div>
		</div>
	);
};
