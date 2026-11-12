import type React from 'react';
import { ITEM_CATALOG } from '@/catalog';
import { hasEffects } from '@/catalog/buffs';
import { gearOf, slotQty } from '@/lib/inventory';
import { resolveItem, sellValueOf } from '@/lib/itemInstance';
import { clearDrag, getDrag } from '@/lib/inventoryDrag';
import { openMenuAt } from '@/lib/globalMenu';
import { useGameStore } from '@/stores/gameStore';
import { useUiStore, type ContextMenuItem } from '@/stores/uiStore';
import type { EquipmentSlot } from '@/types/game';
import { formatNumber } from '@/utils/formatters';
import { sellPayout } from '@/utils/game/merchant';

const blocked = () => (useGameStore.getState().combat.fight ? 'Finish the fight first' : null);
const say = (message: string) => useUiStore.getState().showToast(message);

/** Double-click on a bag slot: drink a potion or equip a piece of gear (the toast says why it did not work). */
export const activateBagSlot = (index: number): void => {
	const state = useGameStore.getState();
	const slot = state.bag[index];
	if (!slot) return;
	if ('id' in slot && hasEffects(ITEM_CATALOG[slot.id])) state.drinkBagItem(index);
	else if (!state.equipItem(index)) say(blocked() ?? 'Cannot equip that');
};

/** Shift + click sells the whole stack (or the piece) at once, at the merchant's price with Haggler; refused in a fight (the toast says so). */
export const shiftSellBagSlot = (index: number): void => {
	const state = useGameStore.getState();
	const slot = state.bag[index];
	const gear = slot ? gearOf(slot) : null;
	const resolved = gear ? resolveItem(gear) : null;
	const def = resolved?.def ?? (slot && 'id' in slot ? ITEM_CATALOG[slot.id] : undefined);
	if (!slot || !def) return;
	const qty = slotQty(slot);
	const gold = state.sellItem(index, qty);
	say(gold > 0 ? `Sold ${qty > 1 ? `${formatNumber(qty)} x ` : ''}${resolved?.name ?? def.name} for ${formatNumber(gold)} Gold` : 'Finish the fight first');
};

/** Right click on a bag slot: use it, sell it at the merchant's price, mark it as junk or throw it away (the global entries follow below). */
export const openBagMenu = (index: number, e: React.MouseEvent): void => {
	const state = useGameStore.getState();
	const slot = state.bag[index];
	const gear = slot ? gearOf(slot) : null;
	const resolved = gear ? resolveItem(gear) : null;
	const def = resolved?.def ?? (slot && 'id' in slot ? ITEM_CATALOG[slot.id] : undefined);
	if (!slot || !def) return;
	const ui = useUiStore.getState();
	const fighting = !!state.combat.fight;
	const qty = slotQty(slot);
	const unit = gear ? sellValueOf(gear) : def.sellValue;
	const name = resolved?.name ?? def.name;
	// the price shown is what is paid: Haggler included
	const sellBatch = (n: number) => {
		const gold = useGameStore.getState().sellItem(index, n);
		ui.showToast(gold > 0 ? `Sold ${n > 1 ? `${formatNumber(n)} x ` : ''}${name} for ${formatNumber(gold)} Gold` : 'Finish the fight first');
	};
	const items: ContextMenuItem[] = [
		{ id: 'use', label: hasEffects(def) ? 'Drink' : 'Equip', onSelect: () => activateBagSlot(index) },
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
		...(gear
			? [
					{
						id: 'junk',
						label: gear.junk ? 'Unmark junk' : 'Mark as junk',
						disabled: fighting,
						onSelect: () => useGameStore.getState().markJunk(index, !gear.junk),
					},
				]
			: []),
		{ id: 'discard', label: 'Discard...', danger: true, disabled: fighting, hint: fighting ? 'in a fight' : undefined, onSelect: () => ui.askDiscard(index) },
	];
	openMenuAt(e.clientX, e.clientY, name, items);
};

/** Something dropped on bag slot `index`: a bag item moves there, a worn piece is taken off into the bag. */
export const dropOnBagSlot = (index: number): void => {
	const drag = getDrag();
	clearDrag();
	if (!drag) return;
	const state = useGameStore.getState();
	if (drag.kind === 'bag') state.moveBagItem(drag.index, index);
	else if (!state.unequipItem(drag.slot as EquipmentSlot)) say(blocked() ?? 'Your bag is full');
};

/** A bag item dropped on the worn gear: it is equipped. */
export const dropOnEquipment = (): void => {
	const drag = getDrag();
	clearDrag();
	if (drag?.kind === 'bag' && !useGameStore.getState().equipItem(drag.index)) say(blocked() ?? 'Cannot equip that');
};

/** A click on a worn piece takes it off into the bag. */
export const takeOffSlot = (slot: EquipmentSlot): void => {
	const state = useGameStore.getState();
	if (!state.equipment[slot]) return;
	if (!state.unequipItem(slot)) say(blocked() ?? 'Your bag is full');
};
