// inventorySlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { RESOURCE_CAP } from '@/config/economy';
import { sellPayout } from '@/utils/game/merchant';
import { maxHp, maxMana } from '@/lib/combat';
import { equipFromBag, gearOf, moveSlot, organizeBag, removeFromBag, slotQty, stackOf, unequip } from '@/lib/inventory';
import { sellValueOf } from '@/lib/itemInstance';
import { isAutoSold } from '@/lib/loot';
import { ITEM_CATALOG, RARITIES } from '@/catalog';
import { hasEffects } from '@/catalog/buffs';
import type { EquipmentSlot } from '@/types/game';
import { ratesWithGear, type GameGet, type GameSet } from './base';
import type { InventorySync } from './inventorySync';

export const createInventorySlice = (set: GameSet, get: GameGet, inv: InventorySync) => {
	const { sendInventoryOp, settleSale } = inv;

	return {
		/** Takes the inventory a server answer carries (a craft puts a potion in the bag) unless it is older than the one held */
		applyServerInventory: inv.applyInventory,

		// Drinks the potion in a bag slot: the server takes it from the bag, fills HP / mana and records the buff in one step, so nothing is previewed
		// (a refusal, such as the sixth buff, leaves the bag as it is and says why in a toast)
		drinkBagItem: (bagIndex: number) => {
			const slot = Number.isInteger(bagIndex) ? get().bag[bagIndex] : null;
			const stack = slot ? stackOf(slot) : null;
			if (!stack || !hasEffects(ITEM_CATALOG[stack.id])) return false;
			sendInventoryOp({ action: 'use', index: bagIndex });
			return true;
		},

		// Gear actions: refused while a fight is open; max HP can drop when gear comes off, so playerHp follows it down
		equipItem: (bagIndex: number) => {
			const state = get();
			if (state.combat.fight) return false;
			const result = equipFromBag(state.bag, state.equipment, bagIndex);
			if (!result) return false;
			sendInventoryOp({ action: 'equip', index: bagIndex });
			set({
				bag: result.bag,
				equipment: result.equipment,
				// a set bonus can change the income: the rates follow the gear
				resourceRates: ratesWithGear(state, result.equipment),
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment, state.playerClass)),
			});
			return true;
		},

		unequipItem: (slot: EquipmentSlot) => {
			const state = get();
			if (state.combat.fight) return false;
			const result = unequip(state.bag, state.equipment, slot);
			if (!result) return false;
			sendInventoryOp({ action: 'unequip', slot });
			set({
				bag: result.bag,
				equipment: result.equipment,
				// a set bonus can change the income: the rates follow the gear
				resourceRates: ratesWithGear(state, result.equipment),
				playerHp: Math.min(state.playerHp, maxHp(state.characterStats, result.equipment)),
				playerMp: Math.min(state.playerMp, maxMana(state.characterStats, result.equipment, state.playerClass)),
			});
			return true;
		},

		moveBagItem: (from: number, to: number) => {
			const state = get();
			if (state.combat.fight || from === to) return false;
			const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < state.bag.length;
			if (!inRange(from) || !inRange(to)) return false;
			sendInventoryOp({ action: 'move', from, to });
			set({ bag: moveSlot(state.bag, from, to) });
			return true;
		},

		// Tidy the bag from the left (stacks merged, gear sorted); like every bag action, not while a fight is open
		organizeBag: () => {
			const state = get();
			if (state.combat.fight) return false;
			sendInventoryOp({ action: 'organize' });
			set({ bag: organizeBag(state.bag) });
			return true;
		},

		// Sell bag items for gold (flat price per item, plus Haggler). Equipped gear is not in the bag, so it is never sold.
		sellItem: (bagIndex: number, qty?: number) => {
			const state = get();
			if (state.combat.fight) return 0;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return 0;
			const gear = gearOf(slot);
			const stack = stackOf(slot);
			const unit = gear ? sellValueOf(gear) : stack ? (ITEM_CATALOG[stack.id]?.sellValue ?? 0) : 0;
			if (!unit) return 0;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return 0;
			const gold = sellPayout(unit, amount, state);
			sendInventoryOp({ action: 'sell', index: bagIndex, qty: amount }, settleSale(gold));
			set({
				bag: removeFromBag(state.bag, bagIndex, amount),
				resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) },
			});
			return gold;
		},

		// Throw bag items away for good (no gold); `qty` defaults to one, pass the stack size to clear the slot
		discardItem: (bagIndex: number, qty?: number) => {
			const state = get();
			if (state.combat.fight) return false;
			const slot = Number.isInteger(bagIndex) ? state.bag[bagIndex] : null;
			if (!slot) return false;
			const amount = qty === undefined ? 1 : Math.floor(qty);
			if (!(amount >= 1) || amount > slotQty(slot)) return false;
			sendInventoryOp({ action: 'discard', index: bagIndex, qty: amount });
			set({ bag: removeFromBag(state.bag, bagIndex, amount) });
			return true;
		},

		// Sell every bag item of this rarity or lower that is gear (potions and stacks stay)
		sellJunk: (maxRarity: string) => {
			const state = get();
			if (state.combat.fight) return { gold: 0, count: 0 };
			if (!Object.prototype.hasOwnProperty.call(RARITIES, maxRarity)) return { gold: 0, count: 0 };
			let bag = state.bag;
			let gold = 0;
			let count = 0;
			bag.forEach((slot, index) => {
				const item = gearOf(slot);
				if (!item || !isAutoSold(item, maxRarity)) return;
				gold += sellPayout(sellValueOf(item), 1, state);
				count += 1;
				bag = removeFromBag(bag, index, 1);
			});
			if (count === 0) return { gold: 0, count: 0 };
			sendInventoryOp({ action: 'sellJunk', maxRarity }, settleSale(gold));
			set({ bag, resources: { ...state.resources, gold: Math.min(state.resources.gold + gold, RESOURCE_CAP) } });
			return { gold, count };
		},

		// The auto-sell filter: gear of this rarity or lower is sold the moment it drops (null = keep everything)
		setAutoSell: (rarity: string | null) => {
			if (rarity !== null && !Object.prototype.hasOwnProperty.call(RARITIES, rarity)) return;
			sendInventoryOp({ action: 'autoSell', rarity });
			set({ autoSellUpTo: rarity });
		},
	};
};
