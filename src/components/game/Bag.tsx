import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/catalog';
import { hasEffects } from '@/catalog/buffs';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { clearDrag, getDrag, setDrag } from '@/lib/inventoryDrag';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import { openMenuAt } from '@/lib/globalMenu';
import { formatNumber } from '@/utils/formatters';
import { sellPayout } from '@/utils/game/merchant';
import ItemSlot from './ItemSlot';
import CraftStash from './CraftStash';
import OrganizeButton from './OrganizeButton';
import BuffRow from './BuffRow';
import { slotProps } from './itemUi';

/** The bag (6 columns, scrolls from 60 slots up). Double-click equips gear or drinks a potion; right-click opens its menu (use, sell, discard); drag to rearrange or to unequip. */
const Bag: React.FC<{ onNotice: (message: string) => void }> = ({ onNotice }) => {
	const [tab, setTab] = React.useState<'bag' | 'crafting'>('bag');
	const bag = useGameStore((state) => state.bag);
	const equipItem = useGameStore((state) => state.equipItem);
	const drinkBagItem = useGameStore((state) => state.drinkBagItem);
	const moveBagItem = useGameStore((state) => state.moveBagItem);
	const unequipItem = useGameStore((state) => state.unequipItem);
	const sellItem = useGameStore((state) => state.sellItem);

	const activate = (index: number) => {
		const slot = bag[index];
		if (!slot) return;
		if ('id' in slot && hasEffects(ITEM_CATALOG[slot.id])) drinkBagItem(index);
		else if (!equipItem(index)) {
			onNotice(useGameStore.getState().combat.fight ? 'Finish the fight first' : 'Cannot equip that');
		}
	};

	// Right click: use it, sell it at the merchant's price, or throw it away (the global entries follow below)
	const menu = (index: number, e: React.MouseEvent) => {
		const slot = bag[index];
		const gear = slot ? gearOf(slot) : null;
		const resolved = gear ? resolveItem(gear) : null;
		const def = resolved?.def ?? (slot && 'id' in slot ? ITEM_CATALOG[slot.id] : undefined);
		if (!slot || !def) return;
		const ui = useUiStore.getState();
		const state = useGameStore.getState();
		const fighting = !!state.combat.fight;
		const qty = slotQty(slot);
		const unit = gear ? sellValueOf(gear) : def.sellValue;
		const name = resolved?.name ?? def.name;
		// the price shown is what is paid: Haggler included
		const sellBatch = (n: number) => {
			const gold = sellItem(index, n);
			ui.showToast(gold > 0 ? `Sold ${n > 1 ? `${formatNumber(n)} x ` : ''}${name} for ${formatNumber(gold)} Gold` : 'Finish the fight first');
		};
		const items: ContextMenuItem[] = [
			{ id: 'use', label: hasEffects(def) ? 'Drink' : 'Equip', onSelect: () => activate(index) },
			{
				id: 'sell',
				label: `Sell${qty > 1 ? ' one' : ''}`,
				hint: `${formatNumber(sellPayout(unit, 1, state))} gold`,
				disabled: fighting,
				onSelect: () => sellBatch(1),
			},
			// a stack (potions) can be sold in one go
			...(qty > 1
				? [
						{
							id: 'sellAll',
							label: `Sell all (${qty})`,
							hint: `${formatNumber(sellPayout(unit, qty, state))} gold`,
							disabled: fighting,
							onSelect: () => sellBatch(qty),
						},
					]
				: []),
			{ id: 'discard', label: 'Discard...', danger: true, disabled: fighting, hint: fighting ? 'in a fight' : undefined, onSelect: () => ui.askDiscard(index) },
		];
		openMenuAt(e.clientX, e.clientY, resolved?.name ?? def.name, items);
	};

	const drop = (index: number) => {
		const drag = getDrag();
		clearDrag();
		if (!drag) return;
		if (drag.kind === 'bag') moveBagItem(drag.index, index);
		else if (!unequipItem(drag.slot as Parameters<typeof unequipItem>[0])) {
			onNotice(useGameStore.getState().combat.fight ? 'Finish the fight first' : 'Your bag is full');
		}
	};

	return (
		<div>
			<div className='flex justify-center gap-2 mb-2'>
				<button className='px-btn px-btn-sm' data-active={tab === 'bag'} aria-pressed={tab === 'bag'} onClick={() => setTab('bag')}>
					Bag
				</button>
				<button className='px-btn px-btn-sm' data-active={tab === 'crafting'} aria-pressed={tab === 'crafting'} onClick={() => setTab('crafting')}>
					Crafting
				</button>
				{tab === 'bag' && <OrganizeButton onNotice={onNotice} />}
			</div>
			<BuffRow />
			{tab === 'crafting' ? (
				<CraftStash />
			) : (
				<div className='inv-bag'>
					{bag.map((slot, i) => (
						<ItemSlot
							key={i}
							{...slotProps(slot)}
							draggable
							compare
							onDragStart={() => setDrag({ kind: 'bag', index: i })}
							onDrop={() => drop(i)}
							onDoubleClick={() => activate(i)}
							onDrink={slotProps(slot).itemId && hasEffects(ITEM_CATALOG[slotProps(slot).itemId!]) ? () => activate(i) : undefined}
							onContextMenu={(e) => menu(i, e)}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default Bag;
