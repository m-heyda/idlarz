/**
 * The per-biome building system (R7, IDL-91, IDL-92), behind {@link BUILDINGS_FLAG}, which is **ON** (owner decision: live on merge). Switching it off is the rollback: the game, the save format, the server checks and the sim are then byte-identical to a build
 * that never had this system (`tests/economy/buildingsFlagOff.test.ts` pins it), and saves written with it on still load, minus their buildings.
 *
 * What is built (Producers and Extractors, the seven home biomes): the build menu of a tile shows the Producer of its biome; **one of each type per map**; a Producer makes `tileEquivalents` tiles' worth of its biome's main materials, grown by
 * the share of the biome the player owns; **levels 1-5**, a level above 1 gated by the castle level and bought with resources plus a **timer** counted by the tick loop; the castle and the buildings share the **builders** (1 for everyone, +1 per level of the Gem shop's Additional builder (3 levels), +1 with the Ember shop's Extra Builder, 5 at most: one timer each, see `builderCount`);
 * a building can be **moved** for half its cost. Idols (IDL-96), the position bonus and the Ember-shop caps come in later slices (`docs/plan/18-biome-buildings-and-material-tiers.md`).
 *
 * **Save and server.** A building is two optional fields of a tile's `extra` entry (`building` = catalog id, `bl` = level) and the running upgrades are the optional top-level list `buildingUpgrades` (`{ x, y, toLevel, remainingSec }` each, like `castleUpgrade`; a first Idol build adds `building`, the Idol's id, and `toLevel` 1). A save from before several builders holds one `buildingUpgrade`, which is read as a list of one. They are
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
 * - `durationsSec`: the upgrade timers, indexed by the level being left (1 to 2 first): 10 min, 45 min, 3 h, 8 h. Level 1 is built at once (an Idol's first level has its own timer, see {@link IDOL_RULES}).
 * - `producer`: a level 1 Producer makes `tileEquivalents` (15) tiles' worth of its main materials; each level above 1 adds `levelStep` (+50 %) of that; each owned tile of the Producer's biome adds `perOwnedTile` (+2 %) up to `bonusCap` (+100 %).
 * - `extractor`: a level 1 Extractor makes `baseRate` (0.3) of its T3 material per second, before the global modifiers; each level above 1 adds `levelStep` (+40 %) of that; it grows with the size of its biome like the Producer (same `perOwnedTile` and `bonusCap`). It has no gold or wood side effects: the material is for crafting and later building upgrades, and the merchant never trades it.
 * - `cost`: level 1 costs `tilePrices` (14) tile prices at the current tile count (counted to at most `priceTileCap`, 300); every level above multiplies by `levelGrowth` (2). The price is gold, wood and stone like a tile's ({@link calculateTileCost}).
 * - `relocateShare`: moving a building costs this share (50 %) of what its current level cost to reach, at today's prices; it is instant and keeps the level.
 *
 * @category Economy/Buildings
 * @order 2
 */
export const BUILDING_RULES = {
	maxLevel: 5,
	durationsSec: [600, 2700, 10800, 28800],
	producer: { tileEquivalents: 15, levelStep: 0.5, perOwnedTile: 0.02, bonusCap: 1 },
	extractor: { baseRate: 0.3, levelStep: 0.4 },
	cost: { tilePrices: 14, priceTileCap: 300, levelGrowth: 2 },
	/** From level 3 a Producer or an Extractor upgrade also eats the biome's T3 extract (the same one the Idol takes, owner 2026-11-24, docs/plan/18): levels 3 / 4 / 5 cost 1,000 / 5,000 / 25,000, then x`t3Growth` per level above 5 */
	t3Costs: [1000, 5000, 25000],
	t3Growth: 5,
	relocateShare: 0.5,
};

/**
 * The biome milestones (IDL-198, decided 2026-11-07): owning enough tiles of one biome makes its Producer and Extractor stronger in steps. Each step reached adds `step` (+25 %) to the building's size bonus, inside the same additive bracket as the per-tile bonus
 * (`1 + producerBonus + milestoneBonus`), so there is no new multiplier bucket and the castle, Ember and gear modifiers apply on top as before. The count is the biome's tiles on the map, so the steps start again with a new run.
 *
 * | Biome | Steps at owned tiles |
 * | --- | --- |
 * | plains, forest | 75 / 150 / 300 |
 * | swamp, tundra | 100 / 200 / 400 |
 * | the five rebirth biomes (jungle, fields, orchard, blight, battlefield) | 125 / 250 / 500 |
 * | hills, lake, coast | none |
 *
 * The rebirth biomes are read from `REBIRTH_BIOME_OUTPUT` (`milestoneThresholds`), not listed twice.
 *
 * @category Economy/Buildings
 * @order 3
 * @formula
 * milestoneBonus(biome, owned) = 0.25 x (number of the biome's thresholds that owned has reached)
 * Producer and Extractor output = base x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned) + milestoneBonus(biome, owned))
 */
export const BIOME_MILESTONES = {
	step: 0.25,
	home: { plains: [75, 150, 300], forest: [75, 150, 300], swamp: [100, 200, 400], tundra: [100, 200, 400] } as Record<string, readonly number[]>,
	rebirth: [125, 250, 500] as readonly number[],
};

/**
 * The general buildings (Watchtower, Marketplace, Training Yard, Scriptorium, Guild Hall, Garrison): they stand on any land biome except the lake, each has its own copy cap (`BuildingDef.copies`, 2 or 3, separate from the Producer and Extractor Building Slots), and
 * make nothing: every level of every copy adds `perLevel` (1 %) of its effect, the same effects the Idols have and through the same server-derived economy (`idolEconomy`), so level 5 of a Watchtower is +5 % damage and three of them +15 %. Levels, timers, builders and the castle gate are
 * the Producer's; the price is the Producer's too (resources only: no extract).
 *
 * @category Economy/Buildings
 * @order 6
 */
export const GENERAL_RULES = { perLevel: 1 };

/**
 * The Idols (IDL-96, docs/plan/18 section 6): a permanent bonus per biome.
 *
 * - `perLevel`: each level adds +2 % of its effect (level 5 = +10 %); `luckPerLevel`: the Bog Witch Totem adds 4 Luck points per level instead (Luck is in points).
 * - `buildTimeCap`: the most the Dwarf Statue and the Ember shop's Master Builders can shorten a timer together (60 %).
 * - **Levels are the account's, the building is the run's**: an Idol's level is kept across rebirths (the server remembers it in the ledger, `legacy.idols`) and the map's building is gone; placing it again on any tile of its biome is free and it stands at its remembered level at once.
 *   An upgrade is bought during a run: resources, a timer on a builder, and the castle gate (`min(5, castle level)`); from level 3 it also needs the biome's T3 extract (where the biome has one): `t3Costs` for levels 3 / 4 / 5 (10,000 / 100,000 / 500,000), then x`t3Growth` (5) per level above 5 (2.5 M, 12.5 M, 62.5 M, ...), so raising the cap past 5 means real Extractor investment (an Extractor makes 0.3 a second at level 1, and the Extractors' material is for crafting too).
 *   **Timers** (`durationsSec`, indexed by the level reached): 30 min, 1 h, 4 h, 12 h, 24 h for levels 1 to 5, then x1.35 per level up to 7 days. Even the **first** build of an Idol takes one (a builder works on it and the tile shows it under construction); placing an Idol the account has already learned stays instant, at the level it remembers.
 *   The base level cap is `idolMaxLevel` (5), raised later by the Ember shop's Idol Mastery; levels above it keep scaling without a limit (price, extract and timer all grow exponentially).
 * - `floorTiles`: the **price floor**. Buying Idol level `L` is priced as if the player owned at least `floorTiles[L - 1]` tiles (20, 40, 60, 80, 100), so a rebirth (9 tiles) does not make levels cheap again. Above the table the floor grows `floorStepTiles` (40) per level; the price tile count never exceeds `priceTileCap`.
 *
 * @category Economy/Buildings
 * @order 7
 */
export const IDOL_RULES = {
	perLevel: 2,
	luckPerLevel: 4,
	buildTimeCap: 60,
	t3Costs: [10000, 100000, 500000],
	t3Growth: 5,
	floorTiles: [20, 40, 60, 80, 100],
	floorStepTiles: 40,
	durationsSec: [1800, 3600, 14400, 43200, 86400],
};
