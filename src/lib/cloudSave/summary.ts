import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { castleLevelOf } from '@/lib/castleWard';
import { effectiveStats } from '@/lib/effectiveStats';
import { gearEconomy, gearIncomePct, xpGainPct } from '@/lib/gearEconomy';
import { offlineCapSec, offlineEfficiency } from '@/lib/offline/limits';
import { calculateResourceRates } from '@/utils/game/income';
import { countOwnedTiles, economyTiles } from '@/utils/game/tiles';
import { biomeCount, getTile, setTile } from '@/utils/world';
import type { PersistedGame } from '@/lib/sanitizeSave';
import { stockValue } from './netWorth';
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
	castleLevel: number;
	rebirths: number;
	legacyPoints: number;
	legacyEarned: number;
	/** Percent bonus on xp income (`characterStats.xpGainMultiplier` plus the gear's XP Gain). */
	xpGainPct: number;
	playSeconds: number;
	/** What an absence and the server-rolled rewards need, kept in the `derived` column (`DEFAULT_DERIVED` fills a row without it). */
	derived: SaveDerived;
}

export interface SaveDerived {
	/** The castle upgrade that was running, and the per-second rates once it is done (null with none running) */
	castleUpgrade: CastleUpgradeState | null;
	ratesAfterCastle: Resources | null;
	/** Total Luck (attributes + Lucky Charm + gear) and the gear's Gold Find %: they decide server-rolled rewards */
	luck: number;
	goldFind: number;
	/** Lake tiles owned: they hold no monster or chest, so the server's ticket cap subtracts them (spawnLimits.freeLand). Absent on rows from before (read as 0). */
	lakesOwned?: number;
	/** The character's Intelligence attribute: it leans the quality of crafted gear (src/lib/craftGear.ts). Absent on rows from before (read as 0). */
	intelligence?: number;
	/** The set bonuses' Kill Rewards %: extra gold and XP from a kill */
	killRewardPct: number;
	/** Chests standing on the map: the ledger is seeded from them the first time it is created (monsters are the ledger's own) */
	chests: number;
	/** What the Ember upgrades made of the away-time cap (seconds) and efficiency (0-1) */
	offlineCapSec: number;
	offlineEfficiency: number;
	/** Tiles bought, as the XP formula counts them (castle + purchases): the XP the purchases can explain is worked out from it */
	purchased: number;
	/** The most XP the server has seen this character earn (cloudSave/xpModel.ts): kept from save to save, absent before the first save */
	xpBase?: number;
	/** What the stock of sellable resources is worth at the merchant, in gold: the next save may sell it without that being a burst of income (verify.ts). Absent on rows from before. */
	stockWorth?: number;
}

export const DEFAULT_DERIVED: SaveDerived = {
	castleUpgrade: null,
	ratesAfterCastle: null,
	luck: 0,
	goldFind: 0,
	killRewardPct: 0,
	purchased: 1,
	chests: 0,
	offlineCapSec: offlineCapSec(),
	offlineEfficiency: offlineEfficiency(),
};

/** The per-second rates the kingdom will have once the running castle upgrade is done. */
const ratesAfterUpgrade = (state: PersistedGame): Resources | null => {
	const upgrade = state.castleUpgrade;
	const castle = getTile(state.tiles, CASTLE_X, CASTLE_Y);
	if (!upgrade || !castle || castle.biome !== 'castle') return null;
	const tiles = setTile(state.tiles, CASTLE_X, CASTLE_Y, {
		...castle,
		level: upgrade.toLevel,
		upgradeCost: CASTLE_UPGRADE.upgradeCosts[upgrade.toLevel - 1] ?? undefined,
	});
	return calculateResourceRates(
		tiles,
		state.characterStats,
		state.farmLevels,
		state.prestige,
		state.farmUpgrades,
		state.merchantUpgrades,
		gearIncomePct(state.equipment),
	).total;
};

export const summarize = (state: PersistedGame): SaveSummary => {
	const rates = calculateResourceRates(
		state.tiles,
		state.characterStats,
		state.farmLevels,
		state.prestige,
		state.farmUpgrades,
		state.merchantUpgrades,
		gearIncomePct(state.equipment),
	).total;
	const fx = effectiveStats({
		characterStats: state.characterStats,
		equipment: state.equipment,
		prestige: state.prestige,
		merchantUpgrades: state.merchantUpgrades,
	});
	const gear = gearEconomy(state.equipment);
	const limits = { prestige: state.prestige, merchantUpgrades: state.merchantUpgrades, gear };
	return {
		rates,
		gold: state.resources.gold,
		xp: state.resources.xp,
		gems: state.gems,
		level: state.level.level,
		clickLevel: state.clickLevel,
		tilesOwned: countOwnedTiles(state.tiles),
		castleLevel: castleLevelOf(state.tiles),
		rebirths: state.prestige.rebirths,
		legacyPoints: state.prestige.legacyPoints,
		legacyEarned: state.prestige.legacyEarned,
		xpGainPct: xpGainPct(state.characterStats, state.equipment),
		playSeconds: state.playSeconds,
		derived: {
			lakesOwned: biomeCount(state.tiles, 'lake'),
			castleUpgrade: state.castleUpgrade ? { ...state.castleUpgrade } : null,
			ratesAfterCastle: ratesAfterUpgrade(state),
			luck: fx.luck,
			goldFind: fx.goldFind,
			intelligence: state.characterStats.intelligence,
			killRewardPct: gear.killRewardPct,
			chests: state.tiles.stats.chests,
			offlineCapSec: offlineCapSec(limits),
			offlineEfficiency: offlineEfficiency(limits),
			purchased: economyTiles(state.tiles, state.freeTiles),
			stockWorth: stockValue(state.resources, state),
		},
	};
};
