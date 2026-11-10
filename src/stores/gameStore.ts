import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateResourceRates } from '@/utils/game/income';
import { EMPTY_PRESTIGE } from '@/utils/game/rebirth';
import { withSaveEvents } from '@/lib/saveEvents';
import { gearIncomePct } from '@/lib/gearEconomy';
import { mulberry32 } from '@/lib/rng';
import { markSaveReady, PERSIST_NAME, PERSIST_VERSION, saveStorage } from '@/lib/saveStorage';
import { pickPersisted, type PersistedGame } from '@/lib/sanitizeSave';
import type { GameState } from '@/types/game';
import { createCharacterSlice } from './game/characterSlice';
import { createChestSync } from './game/chestSync';
import { createBuildingSlice } from './game/buildingSlice';
import { createClockSlice } from './game/clockSlice';
import { createCombatSlice } from './game/combatSlice';
import { createCombatSync } from './game/combatSync';
import { createEconomySlice } from './game/economySlice';
import { createFarmSlice } from './game/farmSlice';
import { createInventorySlice } from './game/inventorySlice';
import { createInventorySync } from './game/inventorySync';
import { createMapSlice } from './game/mapSlice';
import { createMerchantSlice } from './game/merchantSlice';
import { createRebirthSlice } from './game/rebirthSlice';
import { createInitialData, initialCombat, type GameGet, type GameSet } from './game/base';

/** The whole store: the slices share what they must (the inventory and chest bookkeeping, the combat picture) and nothing else. */
const createGameSlice = (set: GameSet, get: GameGet) => {
	const inv = createInventorySync(set, get);
	const chests = createChestSync(set, get, inv);
	const combat = createCombatSync(set, get, inv, chests);

	const slice = {
		// A fixed placeholder world: it is rendered on the server and before the save is read, so it must not be
		// random (that broke hydration). `merge` below replaces it with a random one for a player without a save.
		...createInitialData(EMPTY_PRESTIGE, mulberry32(1)),
		...createRebirthSlice(set, get, inv, chests),
		...createEconomySlice(set, get),
		...createBuildingSlice(set, get),
		...createClockSlice(set, get),
		...createFarmSlice(set, get),
		...createCharacterSlice(set, get),
		...createInventorySlice(set, get, inv),
		...createMerchantSlice(set, get, inv),
		...createCombatSlice(set, get, inv, chests, combat),
		...createMapSlice(set, get, inv, chests, combat),
	};

	// Purchases, castle upgrades, rebirth, gear changes: a successful call tells the cloud sync to save soon
	return withSaveEvents(slice);
};

export const useGameStore = create(
	persist<GameState, [], [], PersistedGame>((set, get) => createGameSlice(set, get), {
		name: PERSIST_NAME,
		version: PERSIST_VERSION,
		// One text line in localStorage (decoded and validated by sanitizeSave when it is read)
		storage: saveStorage,
		// Only game data is saved; rates, UI flags and actions are rebuilt on load
		partialize: (state) => pickPersisted(state),
		merge: (persisted, current) => {
			const saved = persisted as PersistedGame | undefined;
			if (!saved) return { ...current, ...createInitialData(), isHydrated: true };
			const rates = calculateResourceRates(
				saved.tiles,
				saved.characterStats,
				saved.farmLevels,
				saved.prestige,
				saved.farmUpgrades,
				saved.merchantUpgrades,
				gearIncomePct(saved.equipment),
			);
			return {
				...current,
				...saved,
				// combat is the server's: it is asked again as soon as the game is up
				combat: initialCombat(),
				resourceRates: rates,
				isHydrated: true,
			};
		},
		// From here on changes are written (nothing is saved before the first load has finished)
		onRehydrateStorage: () => () => markSaveReady(),
	}),
);
