// mapSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { emitSaveEvent } from '@/lib/saveEvents';
import { applyOfflineGrant } from '@/lib/offline/apply';
import { reconcileTickets } from '@/lib/offline/reconcile';
import type { ClaimResult, SyncResult } from '@/lib/offline/types';
import type { GameState } from '@/types/game';
import { useRockStore } from '@/stores/rockStore';
import { getTile, setTile } from '@/utils/world';
import { limitCtx, type GameGet, type GameSet } from './base';
import type { ChestSync } from './chestSync';
import type { CombatSync } from './combatSync';
import type { InventorySync } from './inventorySync';

export const createMapSlice = (set: GameSet, get: GameGet, inv: InventorySync, map: ChestSync, combat: CombatSync) => {
	const { applyInventory } = inv;
	const { openChestRemote, reconcileMap } = map;
	const { applyCombatView } = combat;

	return {
		// Collect a chest: the chest leaves the map at once and what was inside is rolled by the server (sealed on the number of chests
		// opened this run, so reloading cannot roll it twice): gold (passive gold/s x random minutes), a bundle of resources, XP or a gear
		// piece - see src/lib/chests.ts. Luck improves the odds and the gold.
		collectChest: (x: number, y: number) => {
			const state = get();
			const tile = getTile(state.tiles, x, y);
			if (!tile || !tile.hasChest) return false;
			set({ tiles: setTile(state.tiles, x, y, { ...tile, hasChest: false }), activeChests: Math.max(0, state.activeChests - 1) });
			void openChestRemote(x, y);
			return true;
		},

		// The server's view of what has appeared and of the player's combat (see /api/spawn): the map is brought in line, the gem balance and HP are the server's
		applyServerTickets: (sync: SyncResult) => {
			applyInventory(sync.inv);
			applyCombatView(sync.combat, sync.gemsTotal);
			return reconcileMap(sync.tickets, sync.serverNowSec).placed;
		},

		// Applies the server's answer to a login: what the absence paid, then the chests and monsters it made appear
		applyOfflineClaim: (result: ClaimResult) => {
			const state = get();
			let patch: Partial<GameState> = {};
			let levelsGained = 0;
			let castleReached: number | null = null;
			if (result.grant) {
				const applied = applyOfflineGrant(state, result.grant, limitCtx(state));
				patch = applied.patch;
				levelsGained = applied.summary.levelsGained;
				castleReached = applied.summary.castleReached;
			}
			const after = { ...state, ...patch } as GameState;
			const map = reconcileTickets(
				{ tiles: after.tiles, monsters: after.monsters, activeChests: after.activeChests },
				result.tickets,
				result.serverNowSec,
				limitCtx(state),
			);
			set({ ...patch, tiles: map.tiles, monsters: map.monsters, activeChests: map.activeChests, gems: result.gems });
			useRockStore.getState().setFromServer(result.tickets.rocks ?? []);
			emitSaveEvent('offlineClaimed');
			if (!result.grant) return null;
			return {
				grant: result.grant,
				levelsGained,
				castleReached,
				chestsPlaced: map.placed.chests,
				monstersPlaced: map.placed.monsters,
				strongestMonster: map.placed.strongestLevel,
				gems: result.gems,
			};
		},
	};
};
