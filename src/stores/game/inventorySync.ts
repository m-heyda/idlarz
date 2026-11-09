// inventorySync.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { RESOURCE_CAP } from '@/config/economy';
import { maxHp, maxMana } from '@/lib/combat';
import type { Inventory, InventoryOp, InventoryReply } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { provideInvVer, requestInventory } from '@/lib/rewardsClient';
import { signalNeedClaim, signalSyncNow } from '@/lib/serverSession';
import { ratesWithGear, toast, type GameGet, type GameSet } from './base';

export const createInventorySync = (set: GameSet, get: GameGet) => {
	// ---- the player's things are the server's -------------------------------------------------------------------------
	/**
	 * The bag, the worn gear, the loot pity and the auto-sell filter belong to the server's ledger (docs/reference/saves-and-server.md): drops, drunk
	 * potions and chest items already happened there, and the player's own changes are asked of it (`/api/inventory`). The browser previews
	 * each change at once and the server's answer, which carries the inventory as it stands, settles it. Changes are sent one at a time, in
	 * order (a bag index means the bag as the previous change left it), and while any is on its way a picture from another answer is not taken.
	 */
	let invOpsInFlight = 0;
	let invQueue: Promise<void> = Promise.resolve();
	let invGen = 0; // a New Game starts the changes over: an answer that belongs to the game before it is dropped

	/** Takes the server's picture of the player's things, unless it is older than the one held or one of our own changes is still on its way. */
	const applyInventory = (inv: Inventory | undefined) => {
		if (!inv || invOpsInFlight > 0) return;
		const state = get();
		if (state.invVer !== null && inv.ver <= state.invVer) return;
		const packrat = inv.packrat ?? 0;
		set({
			// the server's Pack Rat level comes with its bag: the two are always consistent in a save
			...(packrat > (state.merchantUpgrades.packrat ?? 0) ? { merchantUpgrades: { ...state.merchantUpgrades, packrat } } : {}),
			bag: inv.bag,
			equipment: inv.equipment,
			lootPity: inv.lootPity,
			autoSellUpTo: inv.autoSellUpTo,
			invVer: inv.ver,
			// a set bonus can change the income: the rates follow the gear
			resourceRates: ratesWithGear(state, inv.equipment),
			playerHp: Math.min(state.playerHp, maxHp(state.characterStats, inv.equipment)),
			playerMp: Math.min(state.playerMp, maxMana(state.characterStats, inv.equipment)),
		});
	};

	/**
	 * Asks the server to make one of the player's changes. `settle` runs with the answer (null: it never came) before the server's picture is
	 * taken, to put right what the preview got wrong (the gold of a sale, the price of a purchase the server refused).
	 */
	const sendInventoryOp = (op: InventoryOp, settle?: (reply: InventoryReply | null) => void) => {
		invOpsInFlight++;
		const gen = invGen;
		invQueue = invQueue.then(async () => {
			if (gen !== invGen) return;
			const key = newClaimId();
			let reply = await requestInventory(key, op);
			if (gen !== invGen) return;
			if (reply.status === 'unavailable') reply = await requestInventory(key, op);
			if (gen !== invGen) return;
			invOpsInFlight--;
			if (reply.status === 'ok') {
				settle?.(reply.value);
				if (!reply.value.ok) toast(reply.value.message ?? 'The server did not do that: it is undone.');
				applyInventory(reply.value.inv);
				// a drunk potion changed HP, mana and the buffs: the combat picture is the server's, ask for it
				if (reply.value.ok && op.action === 'use') {
					if (reply.value.buffs) set((state) => ({ combat: { ...state.combat, buffs: reply.value.buffs! } }));
					signalSyncNow();
				}
				return;
			}
			settle?.(null);
			// the preview cannot be trusted any more: forget the version and ask for the real picture
			set({ invVer: null });
			if (reply.status === 'need_claim') signalNeedClaim();
			else {
				toast('Could not reach the server: the change is undone.');
				signalSyncNow();
			}
		});
	};

	/** Corrects the gold by what the server says a sale paid against what the preview paid (all of it back when the sale did not happen). */
	const settleSale = (previewGold: number) => (reply: InventoryReply | null) => {
		const delta = (reply?.ok ? reply.gold : 0) - previewGold;
		if (delta !== 0) set((state) => ({ resources: { ...state.resources, gold: Math.min(Math.max(0, state.resources.gold + delta), RESOURCE_CAP) } }));
	};

	/** Gives the price back when the server did not put the purchase in the bag. */
	const settlePurchase = (price: number, undo?: () => void) => (reply: InventoryReply | null) => {
		if (reply?.ok) return;
		set((state) => ({ resources: { ...state.resources, gold: Math.min(state.resources.gold + price, RESOURCE_CAP) } }));
		undo?.();
	};

	provideInvVer(() => get().invVer);

	/** A New Game starts the changes over: nothing in flight is waited for and an answer from the game before it is dropped. */
	const reset = () => {
		invGen++;
		invOpsInFlight = 0;
		invQueue = Promise.resolve();
	};

	return { applyInventory, sendInventoryOp, settleSale, settlePurchase, reset };
};

export type InventorySync = ReturnType<typeof createInventorySync>;
