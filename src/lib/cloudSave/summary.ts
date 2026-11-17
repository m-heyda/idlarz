import { BUILDINGS_FLAG } from '@/config/buildings';
import { worldFacts, type WorldFacts } from '@/lib/worldFacts';
import { CASTLE_UPGRADE, CASTLE_X, CASTLE_Y } from '@/config/castle';
import { builderCount, builtBuildings, maxBuildTimeReduction } from '@/lib/buildings';
import { castleLevelOf } from '@/lib/castleWard';
import { effectiveStats } from '@/lib/effectiveStats';
import { gearEconomy, gearIncomePct, xpGainPct } from '@/lib/gearEconomy';
import { idolEconomy } from '@/lib/idolEconomy';
import { offlineCapSec, offlineEfficiency } from '@/lib/offline/limits';
import { calculateResourceRates } from '@/utils/game/income';
import { countOwnedTiles, economyTiles } from '@/utils/game/tiles';
import { biomeCount, getTile, setTile } from '@/utils/world';
import type { PersistedGame } from '@/lib/sanitizeSave';
import { stockValue } from './netWorth';
import type { BuildingUpgradeState, CastleUpgradeState, Resources } from '@/types/game';

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
	/** The building levels being built, one per busy builder (absent while the building system is off, and on rows from before it; see `derivedJobs` for rows that hold the older single `buildingUpgrade`) */
	buildingUpgrades?: BuildingUpgradeState[];
	/** Level of each building type on the map (absent while the building system is off): the server judges level changes against `buildingUpgrades` (`timer_jump` in verify.ts) */
	buildings?: Record<string, number>;
	/** For each of `buildingUpgrades`, the per-second rates once that upgrade alone is done (absent while the building system is off) */
	ratesAfterBuildings?: (Resources | null)[];
	/** Rows from before several builders: the one running building upgrade and the rates once it is done. Read only (through `derivedJobs`), never written. */
	buildingUpgrade?: BuildingUpgradeState | null;
	ratesAfterBuilding?: Resources | null;
	/** Builders the save's own upgrades give (1 + the Ember shop's); the Gem shop's one is the ledger's. Absent on rows from before (read as 1). */
	builders?: number;
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
	/** What the standing Idols add that the server applies beyond the numbers above (absent with none): chest speed, crafting XP, damage and max HP and armor, in % */
	idol?: { chestSpeedPct: number; craftXpPct: number; damagePct: number; hpArmorPct: number; merchantSellPct?: number };
	/** The share of a castle or building timer the player's cuts take off (Master Builders plus the Dwarf Statue, at most 0.6): `verify.ts` refuses a new upgrade shorter than that allows. Absent with none. */
	buildTimeReduction?: number;
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
	/** The land and farm facts the deeds read (`worldFacts`: biomes owned, largest groups, animals, buildings). Absent on rows from before. */
	deedWorld?: WorldFacts;
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

/** The running building upgrades of a stored row and the rates once each is done: the list, or the one `buildingUpgrade` an older row holds. */
export const derivedJobs = (derived: SaveDerived): { jobs: BuildingUpgradeState[]; ratesAfter: (Resources | null)[] } => {
	if (derived.buildingUpgrades) return { jobs: derived.buildingUpgrades, ratesAfter: derived.ratesAfterBuildings ?? [] };
	if (derived.buildingUpgrade) return { jobs: [derived.buildingUpgrade], ratesAfter: [derived.ratesAfterBuilding ?? null] };
	return { jobs: [], ratesAfter: [] };
};

/** The per-second rates the kingdom will have once this one building upgrade is done (a first Idol build puts the building on its empty tile). */
const ratesAfterBuildingUpgrade = (state: PersistedGame, job: BuildingUpgradeState): Resources | null => {
	const tile = getTile(state.tiles, job.x, job.y);
	if (!tile) return null;
	if (!tile.building && !job.building) return null;
	const tiles = setTile(state.tiles, job.x, job.y, {
		...tile,
		...(job.building && !tile.building ? { building: job.building } : {}),
		buildingLevel: job.toLevel,
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
	const idol = idolEconomy(state.tiles, state.idolLevels);
	const fx = effectiveStats({
		idol,
		characterStats: state.characterStats,
		equipment: state.equipment,
		prestige: state.prestige,
		merchantUpgrades: state.merchantUpgrades,
		playerClass: state.playerClass,
	});
	const gear = gearEconomy(state.equipment);
	// the standing Idols (a pure function of the map and the account's trusted Idol levels) add to the same numbers the gear does
	const limits = {
		prestige: state.prestige,
		merchantUpgrades: state.merchantUpgrades,
		gear: { ...gear, offlineEff: gear.offlineEff + idol.offlineEffPts },
		playerClass: state.playerClass,
	};
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
		xpGainPct: xpGainPct(state.characterStats, state.equipment, state.playerClass) + idol.xpPct,
		playSeconds: state.playSeconds,
		derived: {
			lakesOwned: biomeCount(state.tiles, 'lake'),
			deedWorld: worldFacts(state.tiles, state.farmLevels, BUILDINGS_FLAG.enabled),
			...(BUILDINGS_FLAG.enabled
				? {
						buildingUpgrades: (state.buildingUpgrades ?? []).map((job) => ({ ...job })),
						ratesAfterBuildings: (state.buildingUpgrades ?? []).map((job) => ratesAfterBuildingUpgrade(state, job)),
						builders: builderCount({ prestige: state.prestige }),
						buildings: Object.fromEntries(builtBuildings(state.tiles).map((b) => [b.id, b.level])),
					}
				: {}),
			castleUpgrade: state.castleUpgrade ? { ...state.castleUpgrade } : null,
			ratesAfterCastle: ratesAfterUpgrade(state),
			luck: fx.luck,
			goldFind: fx.goldFind,
			intelligence: state.characterStats.intelligence,
			killRewardPct: gear.killRewardPct + idol.killRewardPct,
			...(maxBuildTimeReduction(state.prestige, idol.buildTimePct) > 0 ? { buildTimeReduction: maxBuildTimeReduction(state.prestige, idol.buildTimePct) } : {}),
			...(idol.chestSpeedPct || idol.craftXpPct || idol.damagePct || idol.hpArmorPct || idol.merchantSellPct
				? {
						idol: {
							chestSpeedPct: idol.chestSpeedPct,
							craftXpPct: idol.craftXpPct,
							damagePct: idol.damagePct,
							hpArmorPct: idol.hpArmorPct,
							...(idol.merchantSellPct ? { merchantSellPct: idol.merchantSellPct } : {}),
						},
					}
				: {}),
			chests: state.tiles.stats.chests,
			offlineCapSec: offlineCapSec(limits),
			offlineEfficiency: offlineEfficiency(limits),
			purchased: economyTiles(state.tiles, state.freeTiles),
			stockWorth: stockValue(state.resources, state),
		},
	};
};
