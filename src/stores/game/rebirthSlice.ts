// rebirthSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { EMBER_DISABLED, EMBER_UPGRADES, type EmberUpgradeId } from '@/config/rebirth';
import { PACKRAT_IDS } from '@/config/merchant';
import { calculateCombatStats, calculateLevel, totalStatPoints } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { rebirthStatus, emberUpgradeCost } from '@/utils/game/rebirth';
import { maxHp, maxMana } from '@/lib/combat';
import { gearIncomePct } from '@/lib/gearEconomy';
import { rebirthKit } from '@/lib/inventory';
import { placeKept } from '@/lib/rebirthKeep';
import type { ItemInstance, PrestigeState } from '@/types/game';
import { clickLimiter, createInitialData, type GameGet, type GameSet } from './base';
import type { ChestSync } from './chestSync';
import type { InventorySync } from './inventorySync';
import type { CharacterSync } from './characterSync';
import audioManager from '@/utils/audioManager';

/** Shop upgrades whose effect is part of the income formula */
const INCOME_UPGRADES: ReadonlySet<string> = new Set(['overseer', 'skinner', 'startgold', 'decree']);

export const createRebirthSlice = (set: GameSet, get: GameGet, inv: InventorySync, chests: ChestSync, character: CharacterSync) => ({
	resetGame: () => {
		clickLimiter.reset();
		inv.reset();
		character.resetCharacterSync();
		chests.resetOpens();
		set({ ...createInitialData(), isHydrated: true });
	},

	// Rebirth: restart with the Ember bonus. Keeps name, class, play time, all Embers and the character (XP, level, attributes).
	// `serverGain`: the Embers the server computed (POST /api/rebirth); the game never takes more than it works out itself
	// `kept`: the legendary pieces the server carried over (`lib/rebirthKeep.ts`); they go into the new bag
	rebirth: (serverGain?: number, kept: readonly ItemInstance[] = []) => {
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
		character.resetCharacterSync(); // every point goes back (the server clears its allocation with the rebirth)
		const fresh = createInitialData(prestige);
		// settle the level first: XP bought a moment ago may not have been counted by a tick yet (its points are credited here)
		const settled = calculateLevel(state.resources.xp);
		// the other merchant bonuses start again; Pack Rat stays, so the starter bag is as big as the player bought it
		const merchantUpgrades: Record<string, number> = {};
		for (const id of PACKRAT_IDS) if (state.merchantUpgrades[id]) merchantUpgrades[id] = state.merchantUpgrades[id] as number;
		// respec: every attribute goes back to its start and all the points the level has earned are free to spend again
		const characterStats = { ...fresh.characterStats, availablePoints: totalStatPoints(settled.level) };
		Object.assign(characterStats, calculateCombatStats(characterStats));
		// gear is wiped: the starter kit on, the starter bag, no pity (the server does the same to its inventory when the rebirth reaches it)
		const kit = rebirthKit(merchantUpgrades, prestige, 0, state.playerClass); // Deep Pockets is an Ember upgrade: it survives too
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
			bag: placeKept(kit.bag, kept),
			lootPity: kit.lootPity,
			gems: state.gems, // the premium currency survives a rebirth
			idolLevels: state.idolLevels, // the Idols' levels are the account's: only the buildings go with the map, they are placed again for free
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
		if (!def || EMBER_DISABLED.has(id)) return false; // the quest upgrades cannot be bought until quests exist
		const level = state.prestige.upgrades[id] ?? 0;
		if (level >= def.maxLevel) return false;
		const cost = emberUpgradeCost(id, level);
		if (state.prestige.legacyPoints < cost) return false;
		// Deep Pockets: the new slots are in the bag at once (the server pads its bag the same way from the save's level)
		const grow = id === 'deeppockets' ? Array.from({ length: def.effectPerLevel }, () => null) : [];
		const prestige: PrestigeState = {
			...state.prestige,
			legacyPoints: state.prestige.legacyPoints - cost,
			upgrades: { ...state.prestige.upgrades, [id]: level + 1 },
		};
		set({
			prestige,
			...(grow.length ? { bag: [...state.bag, ...grow] } : {}),
			// the shop levels that change the income (Overseer, Master Skinner, Starting Treasury, Imperial Decree) show in the rates at once
			...(INCOME_UPGRADES.has(id)
				? {
						resourceRates: calculateResourceRates(
							state.tiles,
							state.characterStats,
							state.farmLevels,
							prestige,
							state.farmUpgrades,
							state.merchantUpgrades,
							gearIncomePct(state.equipment),
						),
					}
				: {}),
		});
		audioManager.playSound('buysell');
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
