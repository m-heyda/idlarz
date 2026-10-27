import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { clearDrag, getDrag, setDrag } from '@/lib/inventoryDrag';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import { openMenuAt } from '@/lib/globalMenu';
import ItemSlot from './ItemSlot';
import { slotProps } from './itemUi';

/** The 6x6 bag. Double-click equips gear or drinks a potion; right-click opens its menu (use, sell, discard); drag to rearrange or to unequip. */
const Bag: React.FC<{ onNotice: (message: string) => void }> = ({ onNotice }) => {
	const bag = useGameStore((state) => state.bag);
	const equipItem = useGameStore((state) => state.equipItem);
	const drinkPotion = useGameStore((state) => state.drinkPotion);
	const moveBagItem = useGameStore((state) => state.moveBagItem);
	const unequipItem = useGameStore((state) => state.unequipItem);
	const sellItem = useGameStore((state) => state.sellItem);

	const activate = (index: number) => {
		const slot = bag[index];
		if (!slot) return;
		if ('id' in slot && ITEM_CATALOG[slot.id]?.consumable) {
			if (!drinkPotion(index)) onNotice('Not now - full health or still recovering');
		} else if (!equipItem(index)) {
			onNotice(useGameStore.getState().fight ? 'Finish the fight first' : 'Cannot equip that');
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
		const fighting = !!useGameStore.getState().fight;
		const items: ContextMenuItem[] = [
			{ id: 'use', label: def.consumable ? 'Drink' : 'Equip', onSelect: () => activate(index) },
			{
				id: 'sell',
				label: `Sell${slotQty(slot) > 1 ? ' one' : ''}`,
				hint: `${gear ? sellValueOf(gear) : def.sellValue} gold`,
				disabled: fighting,
				onSelect: () => {
					sellItem(index, 1);
				},
			},
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
			onNotice(useGameStore.getState().fight ? 'Finish the fight first' : 'Your bag is full');
		}
	};

	return (
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
					onContextMenu={(e) => menu(i, e)}
				/>
			))}
		</div>
	);
};

export default Bag;
