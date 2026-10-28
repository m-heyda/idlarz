import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/gameConfig';
import { castleLevelOf } from '@/lib/castleWard';
import { effectiveStats } from '@/lib/effectiveStats';
import { offlineCapSec, offlineEfficiency } from '@/lib/offline/limits';
import { calculateResourceRates, countBuildings, countOwnedTiles } from '@/utils/gameUtils';
import { getTile, setTile } from '@/utils/world';
import type { PersistedGame } from '@/lib/sanitizeSave';
import type { CastleUpgradeState, Resources } from '@/types/game';

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
	/** What an absence and the server-rolled rewards need, kept in the `derived` column (older rows lack it: see `DEFAULT_DERIVED`). */
	derived: SaveDerived;
}

export interface SaveDerived {
	/** True when these numbers were derived from a save (rows written before the offline ledger migration have only the defaults) */
	known?: boolean;
	/** The castle upgrade that was running, and the per-second rates once it is done (null with none running) */
	castleUpgrade: CastleUpgradeState | null;
	ratesAfterCastle: Resources | null;
	/** Total Luck (attributes + Lucky Charm + gear) and the gear's Gold Find %: they decide server-rolled rewards */
	luck: number;
	goldFind: number;
	/** Chests standing on the map: the ledger is seeded from them the first time it is created (monsters are the ledger's own) */
	chests: number;
	/** What the Legacy upgrades made of the away-time cap (seconds) and efficiency (0-1) */
	offlineCapSec: number;
	offlineEfficiency: number;
}

export const DEFAULT_DERIVED: SaveDerived = {
	castleUpgrade: null,
	ratesAfterCastle: null,
	luck: 0,
	goldFind: 0,
	chests: 0,
	offlineCapSec: offlineCapSec(),
	offlineEfficiency: offlineEfficiency(),
};

/** The per-second rates the kingdom will have once the running castle upgrade is done. */
const ratesAfterUpgrade = (state: PersistedGame): Resources | null => {
	const upgrade = state.castleUpgrade;
	const castle = getTile(state.tiles, CASTLE_X, CASTLE_Y);
	if (!upgrade || !castle || castle.biome !== 'castle') return null;
	const tiles = setTile(state.tiles, CASTLE_X, CASTLE_Y, { ...castle, level: upgrade.toLevel, upgradeCost: CASTLE_UPGRADE.upgradeCosts[upgrade.toLevel - 1] ?? undefined });
	return calculateResourceRates(tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades, state.merchantUpgrades).total;
};

export const summarize = (state: PersistedGame): SaveSummary => {
	const rates = calculateResourceRates(state.tiles, state.characterStats, state.farmLevels, state.prestige, state.farmUpgrades, state.merchantUpgrades).total;
	const fx = effectiveStats({ characterStats: state.characterStats, equipment: state.equipment, prestige: state.prestige, merchantUpgrades: state.merchantUpgrades });
	const limits = { prestige: state.prestige, merchantUpgrades: state.merchantUpgrades };
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
		derived: {
			known: true,
			castleUpgrade: state.castleUpgrade ? { ...state.castleUpgrade } : null,
			ratesAfterCastle: ratesAfterUpgrade(state),
			luck: fx.luck,
			goldFind: fx.goldFind,
			chests: state.tiles.stats.chests,
			offlineCapSec: offlineCapSec(limits),
			offlineEfficiency: offlineEfficiency(limits),
		},
	};
};
