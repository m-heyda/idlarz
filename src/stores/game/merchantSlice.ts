// merchantSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import {
	MERCHANT_BUYABLE,
	MERCHANT_MAX_TRADE_QTY,
	MERCHANT_RESOURCE_PRICES,
	MERCHANT_SHOP_ITEMS,
	MERCHANT_UPGRADES,
	type MerchantUpgradeId,
} from '@/config/merchant';
import { RESOURCE_CAP } from '@/config/economy';
import { calculateResourceRates } from '@/utils/game/income';
import { buyCost, merchantLevel, merchantUpgradeCost, sellPayout } from '@/utils/game/merchant';
import { afterRefresh, bestWornGrade, freeRefreshesLeft, generateMerchantStock, refreshCooldown, refreshCost, shopPriceOf } from '@/lib/merchant';
import { emitSaveEvent } from '@/lib/saveEvents';
import { gearIncomePct } from '@/lib/gearEconomy';
import { addDrop, averageItemLevel } from '@/lib/inventory';
import { plainItem } from '@/lib/itemInstance';
import { castleLevelOf } from '@/lib/castleWard';
import { ITEM_CATALOG } from '@/catalog';
import type { Resources } from '@/types/game';
import { isPositiveNumber, limitCtx, type GameGet, type GameSet } from './base';
import type { InventorySync } from './inventorySync';

export const createMerchantSlice = (set: GameSet, get: GameGet, inv: InventorySync) => {
	const { sendInventoryOp, settlePurchase } = inv;

	return {
		// Sell resources to the merchant for gold. Gold and XP cannot be sold.
		sellResources: (resource: keyof Resources, requested: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES)) return false;
			if (!isPositiveNumber(requested)) return false;
			// a Max over the server's limit sells the limit (the rest can be sold with the next click)
			const amount = Math.min(requested, MERCHANT_MAX_TRADE_QTY);

			const state = get();
			if (state.resources[resource] < amount) return false;

			const price = MERCHANT_RESOURCE_PRICES[resource as keyof typeof MERCHANT_RESOURCE_PRICES];
			const goldGained = sellPayout(price, amount, state);

			// the server prices and judges the trade (IDL-319); the browser previews it and the answer settles it: the server's gold replaces the preview's, and a refusal gives the units back
			sendInventoryOp({ action: 'sellResource', resource, qty: amount }, (reply) => {
				if (reply?.ok) {
					// the server's gold replaces the preview's
					set((now) => ({ resources: { ...now.resources, gold: Math.min(Math.max(0, now.resources.gold + reply.gold - goldGained), RESOURCE_CAP) } }));
					return;
				}
				// refused: the gold is taken back, and only as many units come back as gold could be taken (gold already spent on something else is not given twice)
				set((now) => {
					const taken = Math.min(goldGained, now.resources.gold);
					const back = goldGained > 0 ? (amount * taken) / goldGained : amount;
					return { resources: { ...now.resources, gold: now.resources.gold - taken, [resource]: Math.min(now.resources[resource] + back, RESOURCE_CAP) } };
				});
			});
			set({
				resources: {
					...state.resources,
					[resource]: state.resources[resource] - amount,
					gold: Math.min(state.resources.gold + goldGained, RESOURCE_CAP),
				},
			});
			return true;
		},

		// Buy plain gear or potions from the shop; nothing is charged for what does not fit in the bag
		buyItem: (id: string, qty = 1) => {
			const state = get();
			const entry = MERCHANT_SHOP_ITEMS.find((item) => item.id === id);
			if (!entry || !ITEM_CATALOG[id]) return false;
			if (!Number.isInteger(qty) || qty < 1 || qty > 99) return false;
			const price = entry.price * qty;
			if (state.resources.gold < price) return false;
			let bag = state.bag;
			if (ITEM_CATALOG[id].kind === 'consumable') {
				const added = addDrop(bag, { kind: 'consumable', id, qty });
				if (added.overflow > 0) return false;
				bag = added.bag;
			} else {
				for (let i = 0; i < qty; i++) {
					const added = addDrop(bag, { kind: 'gear', item: plainItem(id) });
					if (added.overflow > 0) return false;
					bag = added.bag;
				}
			}
			sendInventoryOp({ action: 'buyShop', id, qty }, settlePurchase(price));
			set({ bag, resources: { ...state.resources, gold: state.resources.gold - price } });
			return true;
		},

		// Buy one piece of the merchant's goods at its price; nothing is charged when it does not fit in the bag
		buyOffer: (index: number) => {
			const state = get();
			const stock = state.merchantStock;
			if (!stock || !Number.isInteger(index) || index < 0 || index >= stock.offers.length) return false;
			const item = stock.offers[index];
			const price = shopPriceOf(item);
			if (state.resources.gold < price) return false;
			const added = addDrop(state.bag, { kind: 'gear', item });
			if (added.overflow > 0) return false;
			// the server did not put it in the bag: the offer is back on the shelf and the price is back in the purse
			sendInventoryOp(
				{ action: 'buyOffer', item },
				settlePurchase(price, () =>
					set((s) =>
						s.merchantStock
							? { merchantStock: { ...s.merchantStock, offers: [...s.merchantStock.offers.slice(0, index), item, ...s.merchantStock.offers.slice(index)] } }
							: {},
					),
				),
			);
			set({
				bag: added.bag,
				resources: { ...state.resources, gold: state.resources.gold - price },
				merchantStock: { ...stock, offers: stock.offers.filter((_, i) => i !== index) },
			});
			emitSaveEvent('buyOffer');
			return true;
		},

		// A new shelf of goods for gold (the free reshuffle comes with the timer, in `tick`)
		refreshMerchantStock: () => {
			const state = get();
			const castle = castleLevelOf(state.tiles);
			if (refreshCooldown(state.merchantRefresh, state.playSeconds) > 0) return false;
			const free = freeRefreshesLeft(state.merchantRefresh, state.playSeconds) > 0;
			const cost = free ? 0 : refreshCost(state.merchantRefreshes, limitCtx(state));
			if (state.resources.gold < cost) return false;
			set({
				resources: { ...state.resources, gold: state.resources.gold - cost },
				merchantStock: generateMerchantStock(
					castle,
					averageItemLevel(state.equipment),
					Math.random,
					state.playSeconds,
					limitCtx(state),
					bestWornGrade(state.equipment),
				),
				merchantRefreshes: state.merchantRefreshes + (free ? 0 : 1),
				merchantRefresh: afterRefresh(state.merchantRefresh, state.playSeconds, free),
			});
			emitSaveEvent('refreshMerchantStock');
			return true;
		},

		// One level of a merchant bonus (see MERCHANT_UPGRADES: economy, combat and the rebirth one), paid in gold
		buyMerchantUpgrade: (id: MerchantUpgradeId) => {
			const state = get();
			const def = MERCHANT_UPGRADES[id];
			if (!def) return false;
			const level = merchantLevel(state.merchantUpgrades, id);
			if (level >= def.maxLevel) return false;
			const cost = merchantUpgradeCost(id, level);
			if (state.resources.gold < cost) return false;
			const merchantUpgrades = { ...state.merchantUpgrades, [id]: level + 1 };
			const grow = id === 'packrat' ? Array.from({ length: def.effectPerLevel }, () => null) : [];
			set({
				merchantUpgrades,
				bag: [...state.bag, ...grow],
				resources: { ...state.resources, gold: state.resources.gold - cost },
				// Foreman and Skinner change the income: the rates follow at once (the other bonuses do not touch them)
				...(id === 'foreman' || id === 'skinner'
					? {
							resourceRates: calculateResourceRates(
								state.tiles,
								state.characterStats,
								state.farmLevels,
								state.prestige,
								state.farmUpgrades,
								merchantUpgrades,
								gearIncomePct(state.equipment),
							),
						}
					: {}),
			});
			return true;
		},

		// Buy whole units of a resource from the merchant (price rounds UP in the merchant's favour)
		buyResource: (resource: keyof Resources, amount: number) => {
			if (!(resource in MERCHANT_RESOURCE_PRICES) || !(MERCHANT_BUYABLE as readonly string[]).includes(resource)) return false;
			if (!isPositiveNumber(amount)) return false;
			const state = get();
			// only what the stock can still hold is bought (and charged): the preview credits all of it, so a refusal takes back exactly that
			const units = Math.min(Math.floor(amount), MERCHANT_MAX_TRADE_QTY, Math.floor(RESOURCE_CAP - state.resources[resource]));
			if (units < 1) return false;
			const price = buyCost(resource as keyof typeof MERCHANT_RESOURCE_PRICES, units);
			if (state.resources.gold < price) return false;

			// the server judges the price and grants the units (IDL-319); a refusal takes the units back and returns the gold
			sendInventoryOp({ action: 'buyResource', resource, qty: units }, (reply) => {
				if (reply?.ok) return;
				// refused: the units are taken back and the gold returned, but only for units still there (units already spent, on an upgrade say, stay paid for)
				set((now) => {
					const removed = Math.min(units, Math.floor(now.resources[resource]));
					return {
						resources: {
							...now.resources,
							gold: Math.min(now.resources.gold + Math.floor((price * removed) / units), RESOURCE_CAP),
							[resource]: now.resources[resource] - removed,
						},
					};
				});
			});
			set({
				resources: {
					...state.resources,
					gold: state.resources.gold - price,
					[resource]: Math.min(state.resources[resource] + units, RESOURCE_CAP),
				},
			});
			return true;
		},
	};
};
