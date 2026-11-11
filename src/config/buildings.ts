/**
 * The per-biome building system (R7, IDL-91, IDL-92), behind {@link BUILDINGS_FLAG}, which is **ON** (owner decision: live on merge). Switching it off is the rollback: the game, the save format, the server checks and the sim are then byte-identical to a build
 * that never had this system (`tests/economy/buildingsFlagOff.test.ts` pins it), and saves written with it on still load, minus their buildings.
 *
 * What is built (Producers and Extractors, the seven home biomes): the build menu of a tile shows the Producer of its biome; **one of each type per map**; a Producer makes `tileEquivalents` tiles' worth of its biome's main materials, grown by
 * the share of the biome the player owns; **levels 1-5**, a level above 1 gated by the castle level and bought with resources plus a **timer** counted by the tick loop; the castle and the buildings share **one builder** (one timer at a time);
 * a building can be **moved** for half its cost. Idols (IDL-96), the position bonus and the Ember-shop caps come in later slices (`docs/plan/18-biome-buildings-and-material-tiers.md`).
 *
 * **Save and server.** A building is two optional fields of a tile's `extra` entry (`building` = catalog id, `bl` = level) and the running upgrade is the optional top-level `buildingUpgrade` (`{ x, y, toLevel, remainingSec }`, like `castleUpgrade`). They are
 * written and read only while the flag is on; with it off an incoming save that carries them is accepted and they are dropped, so a rollback of the flag never invalidates a save. No `SAVE_SCHEMA` bump. The server derives income from the saved map
 * with the same {@link calculateResourceBreakdown} (so the client only displays), judges the timer from two summaries (`timer_jump` in `verify.ts`) and prices levels in the net-worth floor.
 *
 * @category Economy/Buildings
 * @order 1
 * @see producerBonus, buildingUpgradeDuration, buildingBuildCost
 */
export const BUILDINGS_FLAG = { enabled: true };

/**
 * The numbers of the building system (proposals from docs/plan/18, tuned with the sim; every one is a plain config value).
 *
 * - `maxLevel`: the base level cap, 5. Level `L` can only be bought while the castle is at least level `L` (`min(5, castle level)`).
 * - `durationsSec`: the upgrade timers, indexed by the level being left (1 to 2 first): 10 min, 45 min, 3 h, 8 h. Level 1 is built at once.
 * - `producer`: a level 1 Producer makes `tileEquivalents` (15) tiles' worth of its main materials; each level above 1 adds `levelStep` (+50 %) of that; each owned tile of the Producer's biome adds `perOwnedTile` (+2 %) up to `bonusCap` (+100 %).
 * - `extractor`: a level 1 Extractor makes `baseRate` (0.3) of its T3 material per second, before the global modifiers; each level above 1 adds `levelStep` (+40 %) of that; it grows with the size of its biome like the Producer (same `perOwnedTile` and `bonusCap`). It has no gold or wood side effects: the material is for crafting and later building upgrades, and the merchant never trades it.
 * - `cost`: level 1 costs `tilePrices` (14) tile prices at the current tile count (counted to at most `priceTileCap`, 300); every level above multiplies by `levelGrowth` (2). The price is gold, wood and stone like a tile's ({@link calculateTileCost}).
 * - `relocateShare`: moving a building costs this share (50 %) of what its current level cost to reach, at today's prices; it is instant and keeps the level.
 *
 * @category Economy/Buildings
 * @order 2
 * @table building-rules
 */
export const BUILDING_RULES = {
	maxLevel: 5,
	durationsSec: [600, 2700, 10800, 28800],
	producer: { tileEquivalents: 15, levelStep: 0.5, perOwnedTile: 0.02, bonusCap: 1 },
	extractor: { baseRate: 0.3, levelStep: 0.4 },
	cost: { tilePrices: 14, priceTileCap: 300, levelGrowth: 2 },
	relocateShare: 0.5,
};

/**
 * The Idols (IDL-96, docs/plan/18 section 6): a permanent bonus per biome.
 *
 * - `perLevel`: each level adds +2 % of its effect (level 5 = +10 %); `luckPerLevel`: the Bog Witch Totem adds 4 Luck points per level instead (Luck is in points).
 * - `buildTimeCap`: the most the Dwarf Statue and the Ember shop's Master Builders can shorten a timer together (60 %).
 * - **Levels are the account's, the building is the run's**: an Idol's level is kept across rebirths (the server remembers it in the ledger, `legacy.idols`) and the map's building is gone; placing it again on any tile of its biome is free and it stands at its remembered level at once.
 *   An upgrade is bought during a run: resources, a timer on the shared builder, and the castle gate (`min(5, castle level)`); from level 3 it also needs `t3PerLevel` x 2^(level - 3) of the biome's T3 extract (where the biome has one).
 *   The base level cap is `idolMaxLevel` (5), raised later by the Ember shop's Idol Mastery.
 *
 * @category Economy/Buildings
 * @order 7
 * @table idol-effects
 */
export const IDOL_RULES = { perLevel: 2, luckPerLevel: 4, buildTimeCap: 60, t3PerLevel: 200 };
