import { calculateResourceRates, countBuildings, countOwnedTiles } from '@/utils/gameUtils';
import { castleLevelOf } from '@/lib/castleWard';
import type { PersistedGame } from '@/lib/sanitizeSave';
import type { Resources } from '@/types/game';

/**
 * What the server derives from a save by itself (never from numbers the client sends): per-second rates computed from
 * the map with the same function the game uses, plus the headline figures. They become typed columns, so the verifier,
 * leaderboards and offline progress never have to open the whole state.
 */
export interface SaveSummary {
	/** Per second, every resource (`calculateResourceRates(...).total`). */
	rates: Resources;
	gold: number;
	xp: number;
	gems: number;
	level: number;
	clickLevel: number;
	tilesOwned: number;
	buildingsOwned: number;
	castleLevel: number;
	rebirths: number;
	legacyPoints: number;
	legacyEarned: number;
	/** Percent bonus on xp income (`characterStats.xpGainMultiplier`). */
	xpGainPct: number;
	playSeconds: number;
}

export const summarize = (state: PersistedGame): SaveSummary => {
	const rates = calculateResourceRates(state.tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades).total;
	return {
		rates,
		gold: state.resources.gold,
		xp: state.resources.xp,
		gems: state.gems,
		level: state.level.level,
		clickLevel: state.clickLevel,
		tilesOwned: countOwnedTiles(state.tiles),
		buildingsOwned: countBuildings(state.tiles),
		castleLevel: castleLevelOf(state.tiles),
		rebirths: state.prestige.rebirths,
		legacyPoints: state.prestige.legacyPoints,
		legacyEarned: state.prestige.legacyEarned,
		xpGainPct: state.characterStats.xpGainMultiplier,
		playSeconds: state.playSeconds,
	};
};
