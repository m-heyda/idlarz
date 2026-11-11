// characterSlice.ts
// Split out of gameStore.ts (IDL-14); the actions and their behaviour are unchanged.

import { PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { DEFAULT_PLAYER_NAME } from '@/config/character';
import { calculateCombatStats, calculateLevel, reconcileCharacter } from '@/utils/game/character';
import { calculateResourceRates } from '@/utils/game/income';
import { gearIncomePct } from '@/lib/gearEconomy';
import { maxHp, maxMana } from '@/lib/combat';
import { starterEquipmentFor } from '@/config/itemCatalog';
import type { CharacterStats } from '@/types/game';
import { BASE_STATS, type GameGet, type GameSet } from './base';
import type { CharacterSync } from './characterSync';
import type { AttrKey } from '@/lib/offline/attrs';

export const createCharacterSlice = (set: GameSet, get: GameGet, character: CharacterSync) => ({
	/** Takes the server's attribute allocation (the points belong to the server's ledger). */
	applyServerAttrs: character.applyAttrs,
	/** Reads the server's allocation and takes it (game start). */
	syncServerAttrs: character.syncAttrs,

	addStatPoint: (stat: keyof CharacterStats) => {
		const state = get();
		if (!(BASE_STATS as readonly string[]).includes(stat)) return false;
		if (state.characterStats.availablePoints <= 0) return false;

		const newStats = { ...state.characterStats };
		newStats[stat]++;
		newStats.availablePoints--;
		Object.assign(newStats, calculateCombatStats(newStats));

		const newRates = calculateResourceRates(
			state.tiles,
			newStats,
			state.farmLevels,
			state.prestige,
			state.farmUpgrades,
			state.merchantUpgrades,
			gearIncomePct(state.equipment),
		);

		set({
			characterStats: newStats,
			resourceRates: newRates,
		});
		// the preview is on screen; the server is asked for the point (a burst of clicks is one request)
		character.queuePoint(stat as AttrKey);
		return true;
	},

	applyServerXp: (xp: number) => {
		const state = get();
		if (!Number.isFinite(xp) || xp < 0 || xp >= state.resources.xp) return;
		const level = calculateLevel(xp);
		const characterStats = reconcileCharacter(state.characterStats, xp);
		set({
			resources: { ...state.resources, xp },
			level,
			previousLevel: level.level,
			characterStats,
			resourceRates: calculateResourceRates(
				state.tiles,
				characterStats,
				state.farmLevels,
				state.prestige,
				state.farmUpgrades,
				state.merchantUpgrades,
				gearIncomePct(state.equipment),
			),
		});
	},

	setPlayerClass: (playerClass: PlayerClassId) => {
		if (PLAYER_CLASSES[playerClass]) set({ playerClass });
	},

	applyProfileToFreshGame: (name: string, playerClass: PlayerClassId) => {
		const state = get();
		const cleanName = name.trim().substring(0, 9);
		if (state.playSeconds > 0 || state.playerName !== DEFAULT_PLAYER_NAME || !cleanName || !PLAYER_CLASSES[playerClass]) return false;
		// a brand-new game starts with the gear that fits the class (a bow, a staff, or the sword and shield)
		const equipment = starterEquipmentFor(playerClass);
		set({
			playerName: cleanName,
			playerClass,
			equipment,
			playerHp: maxHp(state.characterStats, equipment),
			playerMp: maxMana(state.characterStats, equipment, playerClass),
		});
		return true;
	},
});
