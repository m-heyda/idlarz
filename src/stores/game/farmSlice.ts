// farmSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { ANIMALS, FARM_UPGRADES, type FarmUpgradeId } from '@/config/farm';
import { affordableAnimals, animalBatchCost, farmCap, farmUpgradeCost, farmUpgradeLevel, farmUpgradeOpen } from '@/utils/game/farm';
import { calculateResourceRates } from '@/utils/game/income';
import { canAffordBundle, subtractBundle } from '@/utils/game/costs';
import { gearIncomePct } from '@/lib/gearEconomy';
import { type GameGet, type GameSet } from './base';
import audioManager from '@/utils/audioManager';

export const createFarmSlice = (set: GameSet, get: GameGet) => ({
	// Buy animals of a kind with food (each one costs more than the last). `count` is a number or 'max' (all you can
	// afford). The pen holds at most farmCap animals per kind. Returns how many were bought.
	purchaseAnimal: (animalId: string, count: number | 'max' = 1) => {
		const state = get();
		const animal = ANIMALS.find((a) => a.id === animalId);
		if (!animal) return 0;
		if (count !== 'max' && !(Number.isInteger(count) && count > 0)) return 0;

		const owned = state.farmLevels[animalId] || 0;
		const n = affordableAnimals(animal, owned, state.resources.food, farmCap(state.farmUpgrades), count === 'max' ? Infinity : count);
		if (n <= 0 || (count !== 'max' && n < count)) return 0; // a fixed batch is all or nothing
		const cost = animalBatchCost(animal, owned, n);

		const newFarmLevels = { ...state.farmLevels, [animalId]: owned + n };
		const newRates = calculateResourceRates(
			state.tiles,
			state.characterStats,
			newFarmLevels,
			state.prestige,
			state.farmUpgrades,
			state.merchantUpgrades,
			gearIncomePct(state.equipment),
		);

		set({
			farmLevels: newFarmLevels,
			resources: { ...state.resources, food: state.resources.food - cost },
			resourceRates: newRates,
		});
		audioManager.playSound('buysell');
		return n;
	},

	// One level of a farm upgrade (feed, hen house, dairy, tannery, pen, rooster), paid in resources
	buyFarmUpgrade: (id: FarmUpgradeId) => {
		const state = get();
		const def = FARM_UPGRADES[id];
		if (!def) return false;
		const level = farmUpgradeLevel(state.farmUpgrades, id);
		if (level >= def.maxLevel || !farmUpgradeOpen(id, state.farmLevels, state.farmUpgrades)) return false;
		const cost = farmUpgradeCost(id, level);
		if (!canAffordBundle(state.resources, cost)) return false;

		const farmUpgrades = { ...state.farmUpgrades, [id]: level + 1 };
		const newRates = calculateResourceRates(
			state.tiles,
			state.characterStats,
			state.farmLevels,
			state.prestige,
			farmUpgrades,
			state.merchantUpgrades,
			gearIncomePct(state.equipment),
		);
		set({ farmUpgrades, resources: subtractBundle(state.resources, cost), resourceRates: newRates });
		audioManager.playSound('buysell');
		return true;
	},
});
