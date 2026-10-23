import React from 'react';
import { useGameStore } from '@/stores/gameStore';
import { ITEM_CATALOG } from '@/config/itemCatalog';
import { clearDrag, getDrag, setDrag } from '@/lib/inventoryDrag';
import ItemSlot from './ItemSlot';

/** The 6x6 bag. Double-click / right-click equips gear or drinks a potion; drag to rearrange or to unequip. */
const Bag: React.FC<{ onNotice: (message: string) => void }> = ({ onNotice }) => {
	const bag = useGameStore((state) => state.bag);
	const equipItem = useGameStore((state) => state.equipItem);
	const drinkPotion = useGameStore((state) => state.drinkPotion);
	const moveBagItem = useGameStore((state) => state.moveBagItem);
	const unequipItem = useGameStore((state) => state.unequipItem);

	const use = (index: number) => {
		const slot = bag[index];
		if (!slot) return;
		if (ITEM_CATALOG[slot.id]?.consumable) {
			if (!drinkPotion(index)) onNotice('Not now - full health or still recovering');
		} else if (!equipItem(index)) {
			onNotice(useGameStore.getState().fight ? 'Finish the fight first' : 'Cannot equip that');
		}
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
					itemId={slot?.id}
					qty={slot?.qty}
					draggable
					onDragStart={() => setDrag({ kind: 'bag', index: i })}
					onDrop={() => drop(i)}
					onDoubleClick={() => use(i)}
					onContextMenu={() => use(i)}
				/>
			))}
		</div>
	);
};

export default Bag;
