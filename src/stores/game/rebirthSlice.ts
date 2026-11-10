// rebirthSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { EMBER_UPGRADES, type EmberUpgradeId } from '@/config/rebirth';
import { calculateCombatStats, calculateLevel, totalStatPoints } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { rebirthStatus, emberUpgradeCost } from '@/utils/game/rebirth';
import { maxHp, maxMana } from '@/lib/combat';
import { gearIncomePct } from '@/lib/gearEconomy';
import { rebirthKit } from '@/lib/inventory';
import type { PrestigeState } from '@/types/game';
import { clickLimiter, createInitialData, type GameGet, type GameSet } from './base';
import type { ChestSync } from './chestSync';
import type { InventorySync } from './inventorySync';

export const createRebirthSlice = (set: GameSet, get: GameGet, inv: InventorySync, chests: ChestSync) => ({
	resetGame: () => {
		clickLimiter.reset();
		inv.reset();
		chests.resetOpens();
		set({ ...createInitialData(), isHydrated: true });
	},

	// Rebirth: restart with the Ember bonus. Keeps name, class, play time, all Embers and the character (XP, level, attributes).
	// `serverGain`: the Embers the server computed (POST /api/rebirth); the game never takes more than it works out itself
	rebirth: (serverGain?: number) => {
		const state = get();
		const status = rebirthStatus(state);
		if (!status.canRebirth) return false;
		const gain = serverGain === undefined ? status.gain : Math.min(status.gain, Math.max(0, Math.floor(serverGain)));
		if (gain < 1) return false;

		const prestige: PrestigeState = {
			...state.prestige,
			rebirths: state.prestige.rebirths + 1,
			legacyPoints: state.prestige.legacyPoints + gain,
			legacyEarned: state.prestige.legacyEarned + gain,
		};
		clickLimiter.reset();
		chests.resetOpens();
		const fresh = createInitialData(prestige);
		// settle the level first: XP bought a moment ago may not have been counted by a tick yet (its points are credited here)
		const settled = calculateLevel(state.resources.xp);
		// the other merchant bonuses start again; Pack Rat stays, so the starter bag is as big as the player bought it
		const merchantUpgrades: Record<string, number> = state.merchantUpgrades.packrat ? { packrat: state.merchantUpgrades.packrat } : {};
		// respec: every attribute goes back to its start and all the points the level has earned are free to spend again
		const characterStats = { ...fresh.characterStats, availablePoints: totalStatPoints(settled.level) };
		Object.assign(characterStats, calculateCombatStats(characterStats));
		// gear is wiped: the starter kit on, the starter bag, no pity (the server does the same to its inventory when the rebirth reaches it)
		const kit = rebirthKit(merchantUpgrades);
		set({
			...fresh,
			// the character is progression too: lifetime XP, the level it gives and the attributes (with the points still to spend) carry
			// over, because the level curve is paced over rebirths (level 80 around the 3rd, 100 around the 10th); the income follows the attributes
			resources: { ...fresh.resources, xp: state.resources.xp },
			level: settled,
			previousLevel: settled.level,
			characterStats,
			resourceRates: calculateResourceRates(
				fresh.tiles,
				characterStats,
				fresh.farmLevels,
				prestige,
				fresh.farmUpgrades,
				merchantUpgrades,
				gearIncomePct(kit.equipment),
			),
			equipment: kit.equipment,
			bag: kit.bag,
			lootPity: kit.lootPity,
			gems: state.gems, // the premium currency survives a rebirth
			autoSellUpTo: state.autoSellUpTo, // a setting, not gear
			merchantUpgrades,
			merchantStock: state.merchantStock, // the shelf and its rotation clock carry over: a rebirth is no free reshuffle
			merchantRefreshes: state.merchantRefreshes, // the refresh price and the free window are not reset by a rebirth
			merchantRefresh: state.merchantRefresh,
			playerHp: maxHp(characterStats, kit.equipment),
			playerMp: maxMana(characterStats, kit.equipment, state.playerClass),
			playerName: state.playerName,
			playerClass: state.playerClass,
			playSeconds: state.playSeconds,
			isHydrated: true,
		});
		return true;
	},

	// Spend Embers on a permanent shop upgrade
	buyEmberUpgrade: (id: EmberUpgradeId) => {
		const state = get();
		const def = EMBER_UPGRADES[id];
		if (!def) return false;
		const level = state.prestige.upgrades[id] ?? 0;
		if (level >= def.maxLevel) return false;
		const cost = emberUpgradeCost(id, level);
		if (state.prestige.legacyPoints < cost) return false;
		set({
			prestige: {
				...state.prestige,
				legacyPoints: state.prestige.legacyPoints - cost,
				upgrades: { ...state.prestige.upgrades, [id]: level + 1 },
			},
		});
		return true;
	},

	// The server kept less XP than the game held (see cloudSave/xpModel.ts): XP, the level it gives and the attribute points follow
	applyServerPrestige: (prestige: PrestigeState) => {
		const state = get();
		if (prestige.legacyEarned > state.prestige.legacyEarned || prestige.rebirths > state.prestige.rebirths) return; // only ever takes the lower numbers
		set({
			prestige,
			resourceRates: calculateResourceRates(
				state.tiles,
				state.characterStats,
				state.farmLevels,
				prestige,
				state.farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment),
			),
		});
	},
});
