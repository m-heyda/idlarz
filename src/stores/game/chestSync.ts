// chestSync.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { RESOURCE_CAP, XP_CAP } from '@/config/economy';
import { type ChestLoot } from '@/lib/chests';
import { reconcileTickets } from '@/lib/offline/reconcile';
import type { ChestReward, SyncResult } from '@/lib/offline/types';
import { newClaimId } from '@/lib/offlineClient';
import { requestChest, type Reply } from '@/lib/rewardsClient';
import { signalNeedClaim } from '@/lib/serverSession';
import { useUiStore } from '@/stores/uiStore';
import { useRewardPendingStore } from '@/stores/rewardPendingStore';
import { getTile, setTile } from '@/utils/world';
import { limitCtx, toast, type GameGet, type GameSet } from './base';
import type { Drop } from '@/types/game';
import type { InventorySync } from './inventorySync';

export const createChestSync = (set: GameSet, get: GameGet, inv: InventorySync) => {
	const { applyInventory } = inv;
	/** Puts a chest's item and the gold the server paid for what did not fit (see ChestReward.received). */
	type ChestReceived = NonNullable<Extract<ChestReward, { ok: true }>['received']>;

	/** Puts what a chest held into the game: resources, XP, an item (through the auto-sell filter and the full-bag rule), and the server's gem balance when it gave one. */
	const receiveChest = (loot: ChestLoot, gemsTotal?: number, gemsFound = 0, received?: ChestReceived, junk?: Drop[]) => {
		const state = get();
		const resources = { ...state.resources };
		if (loot.kind === 'gold' || loot.kind === 'boost') resources.gold += loot.gold;
		else if (loot.kind === 'bundle') loot.items.forEach((i) => (resources[i.resource] += i.amount));
		else if (loot.kind === 'xp') resources.xp = Math.min(resources.xp + loot.xp, XP_CAP);
		// the server has put the item and the junk in its bag (the picture comes with the answer); the gold of what it sold or could not fit is ours
		if (received) resources.gold = Math.min(resources.gold + received.convertedGold + received.autoSold.gold, RESOURCE_CAP);
		const shown = { ...loot, ...(gemsFound > 0 ? { gems: gemsFound } : {}), ...(junk && junk.length > 0 ? { junk } : {}) };
		set({ resources, ...(gemsTotal !== undefined ? { gems: gemsTotal } : {}), lastChestLoot: shown });
		// one notice per chest, stacked under the header (opening several quickly shows them all)
		useUiStore.getState().pushChestNotice(shown);
	};

	/** Puts a chest back on its tile (the server could not be reached, so nothing was opened). */
	const restoreChest = (x: number, y: number) => {
		const state = get();
		const tile = getTile(state.tiles, x, y);
		if (!tile || tile.hasChest) return;
		set({ tiles: setTile(state.tiles, x, y, { ...tile, hasChest: true }), activeChests: state.activeChests + 1 });
	};

	// Chest opens and the polls that follow them cross on the way. An answer the server made BEFORE it opened our chest still counts that
	// chest, and the map would put it back ("missing") a moment after the player opened it. So a chest is only placed from an answer that is
	// not older than our own opens: none of them is still in flight, and the server's `opened` count (how many chests the run has opened
	// when it made the answer) has reached the last one we were told about. Taking extra chests off is always fine.
	let chestOpensInFlight = 0;
	let lastOwnOpen = { opened: 0, at: 0 };
	const OWN_OPEN_WINDOW_MS = 15_000; // an older answer than this cannot still be on its way (and a rebirth starts the count again)
	const chestsMayBePlaced = (tickets: SyncResult['tickets']): boolean => {
		if (chestOpensInFlight > 0) return false;
		const recent = Date.now() - lastOwnOpen.at < OWN_OPEN_WINDOW_MS;
		return !(recent && tickets.opened !== undefined && tickets.opened < lastOwnOpen.opened);
	};

	/** Opens a chest on the server (one try, one more with the same key if the answer got lost: the server replays it). */
	const openChestRemote = async (x: number, y: number) => {
		const key = newClaimId();
		chestOpensInFlight++;
		useRewardPendingStore.getState().begin(); // the little chest animation covers the wait for the loot
		let reply: Reply<ChestReward>;
		try {
			reply = await requestChest(key, x, y);
			if (reply.status === 'unavailable') reply = await requestChest(key, x, y);
		} finally {
			chestOpensInFlight--;
			useRewardPendingStore.getState().end();
		}
		if (reply.status === 'ok') {
			applyInventory(reply.value.inv);
			if (reply.value.ok) {
				lastOwnOpen = { opened: Math.max(lastOwnOpen.opened, reply.value.tickets.opened ?? 0), at: Date.now() };
				receiveChest(reply.value.loot, reply.value.gemsTotal, reply.value.gems, reply.value.received, reply.value.junk);
			} else toast('The chest crumbled: it was not a real one.');
			return;
		}
		restoreChest(x, y);
		if (reply.status === 'need_claim') {
			signalNeedClaim();
			toast('Catching up with the server, try again in a moment.');
		} else if (reply.status === 'no_save') {
			// the server has no readable save of this player yet (an older save, or the first upload is still on its way)
			toast('Your progress is still being saved to the server: the chest is still there, try again in a moment.');
		} else toast('Could not reach the server: the chest is still there.');
	};

	/** The map as the server's tickets say: monsters where it put them, as many chests as it counts. */
	const reconcileMap = (tickets: SyncResult['tickets'], serverNowSec: number) => {
		const state = get();
		const map = reconcileTickets({ tiles: state.tiles, monsters: state.monsters, activeChests: state.activeChests }, tickets, serverNowSec, limitCtx(state), {
			placeChests: chestsMayBePlaced(tickets),
		});
		set({ tiles: map.tiles, monsters: map.monsters, activeChests: map.activeChests });
		return map;
	};

	/** A new run counts its chests from zero. */
	const resetOpens = () => {
		lastOwnOpen = { opened: 0, at: 0 };
	};

	return { openChestRemote, reconcileMap, resetOpens };
};

export type ChestSync = ReturnType<typeof createChestSync>;
