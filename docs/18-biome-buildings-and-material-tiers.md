# 18 · Biome buildings, upgrades and the material tiers (design draft, nothing built)

Replaces today's 16 generic buildings with **three buildings per biome**: a **Producer** (a lot of the biome's base material), an **Extractor** (a crafting material only that biome gives) and an **Idol** (a permanent multiplier). Each building type can be built **once**, the build menu shows only the three of the tile's biome, and buildings are **upgraded with timers like the castle**. Also: shorter early castle timers, and a rework of the material tiers so crafting ([17](17-crafting.md)) has a proper ladder. Names, numbers and bonuses below are proposals.

Related: [12 biomes](12-rebirth-biomes.md) (the five new biomes and T2), [17 crafting](17-crafting.md), [13 reset](13-rebirth-reset-and-paragon.md), [ROADMAP](ROADMAP.md) ("Building rework").

## 1. What exists
- `BUILDINGS` (16 types, one flat `resourceGeneration` each) and `BUILDING_COST` (a price ladder over the number of buildings built, in gold, wood, stone) in `config/gameConfig.ts`; `canBuildOn`, `calculateBuildingCost`, `calculateTileOutput` in `utils/gameUtils.ts`; `buildOnTile` in the store; `BuildDialog.tsx`.
- Any building on any explored tile except castle, lake and empty; permanent, no demolish, no levels. A monster never stands on a building (`canSpawnOn`).
- The server sees `tile.building` in the saved map only (plausibility in `cloudSave/netWorth.ts`; rates are derived from the map by `summary()`).
- The castle is the model for timed upgrades: `CASTLE_UPGRADE.durationsSec` (levels 2-6: 1 h, 4 h, 12 h, 24 h, 48 h = **3 d 17 h**; 7-10: 3, 4, 5, 7 days), counted by the tick loop; the server checks the timer on its own clock (`castle_jump`).
- Pattern to reuse for effects: `gearEconomy(equipment)` (`lib/gearEconomy.ts`) is a pure function that `summarize()` folds into income, XP gain, away-time limits and kill rewards, so the server and the browser agree. Idol bonuses use the same shape: `buildingEconomy(world)`.

## 2. The rules
1. **One of each type.** Every building type exists at most once per map. A biome has exactly three types, so a full map has at most 3 x 12 biomes = 36 buildings.
2. **The tile decides the menu.** Right-click a tile -> Build lists the three buildings of that biome (greyed with a reason if already built, if the castle level is too low, or if you cannot pay). Lakes get buildings too (piers and platforms over the water; `BUILDING_COST.blockedBiomes` loses `lake`; fish need water). Still not on the castle, a chest or a monster tile.
3. **Location matters.** The building stands on one tile of its biome; the **Producer's output grows with how much of that biome you own** (decided: +2 % per owned tile of the biome, capped at +100 %, counting only tiles of that biome), so a big forest makes the Lumberyard great and one lone forest tile makes it mediocre. This is the "specialisation bonus" BL8 wanted, without needing a cluster test, and it keeps "one building per type" interesting.
4. **Relocate** (decided): a building can be moved for 50 % of its current build cost, instantly (levels are kept), because one-per-type punishes a bad first placement.
5. **Levels and timers** (section 5). **The map and its biomes always reset on rebirth**, and with them every Producer and Extractor. **Idols are the exception: their levels persist** (section 6).
6. **Legacy buildings** (the 16 old types) disappear (section 8).
7. **Position bonus: the castle's area bonus near the castle, a frontier bonus far from it (decided 2026-10-29).** One pure function `positionBonus(distance, castleLevel)` gives the building on that tile its bonus, so near and far buildings stay comparable:
   - **Inside the castle range** (the existing `CASTLE_AREA_BONUS`, `config/gameConfig.ts`: +50 % below castle level 7; from level 7 `+100 %` per range radius tile, up to `+400 %` at castle 10; range 3x3 growing to 9x9): unchanged for tiles, now **also applied to every building on them**.
   - **Beyond the range** (the rebirth biomes begin 10+ tiles out, outside the maximum radius 4): a **frontier bonus** that grows with distance, proposal `min(+100 %, 5 % x (distance - 9))` from distance 10 (so +5 % at 10, +65 % at 22, +100 % from 29). Between the range edge and distance 9 there is no bonus. Exactly one of the two applies to a tile.
   - **Who gets it:** Producers and **Extractors in full** (decided: the same as Producers; Extractor rates in [17](17-crafting.md)'s pacing must therefore be set with the castle-10 case of x5 in mind), and **Idols capped at x2**: Idol value x `min(1 + positionBonus, 2)`. The cap is what keeps an Idol next to a castle 10 from being five times stronger.
   - Consequences to design for: the range holds at most 80 tiles, so which of the 36 buildings stand in it is a placement puzzle; the castle region is the start ring's basic biomes, so basic-biome buildings compete for it while the late biomes are rewarded by the frontier bonus; the frontier bonus rewards expanding outward, which fits the map-exploration goal of [12](12-rebirth-biomes.md).
   - **Server:** pure function of the saved map (building tile, castle position and level), folded into `buildingEconomy(world, legacy)` like the Obsidian set, so offline grants, `verify.ts` and `netWorth.ts` agree. Relocating a building ([rule 4]) changes its bonus, so relocation cost matters (open).
8. **Roads** (decided 2026-10-29): a Producer or Extractor connected to the castle by road gets +100 % production, added to its position bonus (section 5.2).

## 3. The buildings (36 proposals)

Producer = base material x many tiles' worth. Extractor = a crafting material (T3 below). Idol = a permanent multiplier at its level. One Idol effect per mechanic, so nothing is stacked twice and each biome has a reason to exist.

| Biome | Producer | Extractor -> T3 | Idol -> effect (+2 % per level, decided; Luck in points) |
|---|---|---|---|
| **Plains** | Granary: food | Herb Garden -> **Herbs** | Harvest Scarecrow: +farm animal output % |
| **Forest** | Lumberyard: wood | Sap Tapper -> **Sap** | Elder Tree Statue: +XP gain % |
| **Hills** | Quarry: stone, some coal | Deep Mine -> **Iron Ore** | Dwarf Statue: -castle and building build time % |
| **Swamp** | Peat Works: coal-grade fuel (coal), wood | Spore Cellar -> **Spores** | Bog Witch Totem: +Luck |
| **Tundra** | Coal Pit: coal, gold | Ice Cutter -> **Frostshard** | Frost Obelisk: +offline efficiency % |
| **Lake** | Fishery: food, gold | Pearl Diver -> **Pearls** | Water Spirit Fountain: chests come faster % |
| **Coast** | Harbor: gold, food | Salt Works -> **Salt** | Lighthouse: merchant pays +% when selling |
| **Jungle** | Logging Camp: hide, hardwood | Serpent Pit -> **Venom** | Totem of the Wild: +kill rewards % |
| **Fields** | Hen Barn: eggs, food | Dye Works -> **Dye** | Scarecrow King: +gold per click % |
| **Blossom Orchard** | Dairy Barn: milk, gold | Apiary -> **Royal Jelly** | Blossom Shrine: +crafting XP % |
| **Blight** | Tar Pit: coal | Ooze Vat -> **Corrupted Core** | Maw Idol: +damage % |
| **Battlefield** | Siege Works: stone, wood | Salvage Yard -> **Scrap Steel** | War Memorial: +max HP and armor % |

Why these extracts for crafting: Iron Ore and Scrap Steel are the metal for steel/obsidian weapons and armor; Sap and Venom coat arrows and blades; Salt tans hide into leather armor; Herbs, Spores and Royal Jelly are potion and enchant reagents; Pearls and Frostshards are trinkets and rings; Dye makes cloth armor tiers; Corrupted Core feeds the enchanted craft next to Ichor. Each biome therefore gives crafting a distinct slot, and every craft recipe in [17](17-crafting.md) can name its extracts.

Server-visible Idols (they change what the server computes): Luck, chest speed, offline efficiency, kill rewards, XP gain, crafting XP. All six are folded into `summary()` by `buildingEconomy(world)` exactly like the Obsidian set. Client-only (the browser's anyway until the economy moves): farm output, click gold, merchant sell price, build time. Combat Idols (damage, HP/armor) go into the fight profile like gear.

## 4. Material tiers (rework)

The tiers become a ladder with one job each, so crafting recipes ([17](17-crafting.md)) read like a progression:

| Tier | What | Examples | Source | Merchant |
|---|---|---|---|---|
| currency | gold, gems, Embers | | | n/a |
| **T0 Base** | the land's raw output | wood, stone, coal, food, meat | tiles, Producers | buys and sells |
| **T1 Farm** | animal products | eggs, milk, hide | farm, some Producers | buys and sells |
| **T2 Biome goods** | the new biomes' tile output | Hardwood, Cloth, Honey, Ichor, War Medals | tiles of the five rebirth biomes | **no** |
| **T3 Extracts** | one per biome, from its Extractor | the twelve in section 3 | Extractors | **no** |
| **T4 Relics** | rare, from bosses and the deepest content | e.g. Rat King's Crown, boss cores *(placeholders)* | boss kills, late events | **no** |

Rules: the **merchant trades T0 and T1 only** (your instruction); T2-T4 are crafting and building-upgrade inputs, so they have a real sink and cannot be converted to gold. This replaces the earlier idea in [12](12-rebirth-biomes.md) of selling Hardwood, Cloth and Honey (flagged there). Higher tiers appear in recipes in order: basic gear = T0/T1, the middle tiers = T2 + T3, the top tiers and enchanted crafts = T3 + T4 plus Ichor/Medals. Building upgrades past level 3 also take T2/T3 (so Extractors feed the economy as well as crafting).

**Prerequisite refactor (S-M): one source for resource keys.** Adding 12 extracts and 5 T2 materials to the hand-kept lists (`Resources`, `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `zeroResources`, `sanitizeSave` `OPTIONAL_RESOURCES`, `offline/grant.ts`, `offline/ledger.ts` `zeroTotals`) is the biggest source of mistakes in the whole plan. First derive them all from `RESOURCES` in `catalog/resources.ts` (one entry per resource; tier, label, icon, merchant price), and keep `tests/catalog.test.ts` as the guard. Then adding a material is one catalog entry plus its source and sink.

## 5. Upgrades and timers

- Buildings have **levels 1-5 as the base cap** (decided; Master Craftsmen raises it to 15). Level 1 is built for resources immediately (as today); each further level is bought with resources and takes a **timer**, like the castle.
- **Level cap**: levels 1-5 are gated by the castle level (`min(5, castle level)`): a rebirth restarts the climb, and the castle stays the gate. Levels 6 and above need no castle level; they are limited only by the purchased cap (`buildingMaxLevel`, raised by Master Craftsmen up to 15, section 6).
- Timers (proposal): level 2: 10 min, 3: 45 min, 4: 3 h, 5: 8 h. **One shared builder** (decided): the castle and all buildings share a single upgrade queue, so a timer is a real choice about what to upgrade next. Idol and Extractor upgrades from level 3 cost T2/T3 materials.
- **Levels 6-15 (Master Craftsmen)**: the effect step stays the same as levels 1-5 (decided), the timer keeps growing (proposal x1.35 per level on the level-5 timer of 8 h, capped at 7 days), and the cost uses the same material rule with larger multipliers; the total effect has to be checked against the position and road bonuses (below): a Producer at level 15 is x8 before them. If that is too much, flatten the step above level 10.
- Effects per level (proposal): Producer x(1 + 0.5 x (level-1)) on top of the biome-size bonus; Extractor rate x(1 + 0.4 x (level-1)); Idol bonus = `base x level` (e.g. +2 % XP per level, so level 5 = +10 %). All small: the Idols together must not out-scale the Ember shop (BL9/BL10).
- **Server**: the castle timer's pattern generalizes to a list of `timers` in the save (castle + buildings) checked against the server clock (`castle_jump` becomes `timer_jump`); once the castle upgrade is server-owned ([ROADMAP](ROADMAP.md) "Economy actions") the buildings ride along. Until then they are the browser's, verified by plausibility, with `netWorth.ts` pricing building levels.
- **Save**: today a tile with a building "never has a level" (`sanitizeSave`). Buildings need `level` (and `upgradeEndsAt`/remaining seconds) as **optional** tile fields in `extra`. No `SAVE_SCHEMA` bump: absent means level 1.

### 5.1 Castle timers: shorter early levels
Today levels 2-6 take 1 h, 4 h, 12 h, **24 h**, 48 h = 3 d 17 h. **Decided** (with the first five castle costs x0.75, sim-measured in [19](19-first-build-steps.md)) to take about **1 day** off the first run:

| Upgrade | Now | Proposed |
|---|---|---|
| 1 -> 2 | 1 h | 1 h |
| 2 -> 3 | 4 h | 3 h |
| 3 -> 4 | 12 h | 9 h |
| 4 -> 5 | 24 h | 16 h |
| 5 -> 6 | 48 h | 36 h |
| **Total to castle 6** | **3 d 17 h** | **2 d 17 h** |

**Measured with the sim ([19](19-first-build-steps.md)): these timers save 1.0 d for the hardcore bot but only 0.5 d for the owner-like `human` profile (its sleep windows and resource waits dominate); with the first five castle costs x0.75 it saves 1.0 d for both (decided, see [19](19-first-build-steps.md)).** Levels 7-10 (3, 4, 5, 7 days) stay for now. Checks before shipping, from [06](06-pacing-targets.md): the cost of 5 -> 6 must still be payable while the (now 16 h) 4 -> 5 timer runs; `sim` first-rebirth day moves from about 5-7 to about 4-6 and the run-2 ratio target (65-70 %) must be re-measured; Master Builders (-5 %/level) and the Dwarf Statue stack, so cap the combined reduction (proposal 60 %). Update `CASTLE_UPGRADE.durationsSec` and the first five `upgradeCosts` rows; no save change.

### 5.2 Roads (decided 2026-10-29)

A road is a per-tile overlay that connects a building to the castle. A **connected Producer or Extractor** (not Idols) gets **+100 % production, added to its position bonus** (decided: additive), so the multiplier is `1 + positionBonus + (connected ? 1 : 0)`: x6 at castle 10 inside the range, up to x3 at the frontier.

- **Connected** means: the building's tile is 4-adjacent to a road tile, and that road tile belongs to a 4-connected road network that reaches the castle's 3x3 block (a road tile at distance 1 from the castle, the "gate" ring). One network serves every building beside it, so a trunk road to a far biome connects many buildings.
- **A road tile is occupied**: no building, chest or monster stands on it (`canSpawnOn` and `chestSpots` skip it; a ticket on a tile that becomes road is placed again by the existing `settle`). Roads need an owned tile; they are not built on the castle.
- **Cost: gold and resources, built instantly (no timer).** **Decided: about 3 % of the current tile price per tile** (gold, wood, stone at 3 % each, tuned with the "minutes to cover" check of the sim) x a **biome multiplier** x `(1 + 0.1 x distance from the castle)`, so a long road to a far biome is a real expense and the frontier bonus has a price. Multipliers (proposals): fields 0.8 (old farm tracks), plains 1.0, orchard 1.0, battlefield 1.0, forest 1.2 (clearing), coast 1.2, jungle 1.8, hills 1.5, **swamp 2.0** and **tundra 2.0** (causeway / frozen ground, as you asked: more expensive), blight 2.5, **lake bridge 3.0**. Bridges can later ask for Hardwood.
- **Different roads per biome** (art, one set per ground family): packed dirt path (plains, fields, orchard, forest), cobble (coast, the castle area), stone causeway (hills), **snow-packed road with sled ruts (tundra)**, **plank causeway on stilts (swamp, jungle)**, **wooden or stone bridge (lakes)**, bone-and-ash track (blight), trampled mud with wheel ruts (battlefield). Each is a 4-neighbour autotile (16 variants, plus end caps and a small entrance stub toward a building), drawn as an overlay above the ground by the pixel pipeline (`terrain_props.py` style, no dual-grid needed). Where two biomes meet, the road keeps the style of the tile it stands on and a short blend sprite covers the join. Extras: carts and travellers on roads through `AmbientLife`, and a lit road (a thin glow) when connected so the player sees at once which buildings are doubled.
- **UI**: a road tool (build menu on any tile, "Build road"): click a start tile and drag or click along a path to the castle or the network; the cost of the whole path is previewed, one confirm pays it, and one autosave carries it. A road tile can be removed for a partial refund (proposal 50 %).
- **Rebirth**: roads belong to the map and reset with it.
- **Server and save**: `road: true` is an optional flag in the tile's `extra` (no `SAVE_SCHEMA` bump); `sanitizeSave` allows it on owned non-castle tiles that carry no building, chest or monster; `netWorth.ts` prices roads (so a forged map of free roads shows as spending the player never made); `buildingEconomy(world)` runs a breadth-first search from the castle over road tiles (O(tiles), once per save) to decide which buildings are connected, so offline grants, `verify.ts` and the browser agree. New shadow flag `road_off_land`.
- **Balance to check**: connected x2 plus the area bonus makes the castle-10 core very strong (x6 on a Producer that is already level 15 = x8 before position, [Master Craftsmen above]); the sim needs a "buildings connected" profile, and the Producer step above level 10 may have to flatten. Also compare the road cost for a far Producer to the extra output it buys (the payback time should be hours, not days, in the middle of a run).

## 6. Idols survive rebirth (decided), soft caps and legacy points

**Decided (2026-10-29, overrides the earlier "Idols reset with the map"):**
- **Idol levels persist across rebirths.** They are account progression, kept in a `legacy` record (below). The Idol *building* is part of the map and is gone after a rebirth like every other building.
- **Free re-placement at the remembered level.** Once an Idol of a biome has been built, in any later run, the player can place it again on any tile of that biome **for free**, and it stands at the level it had reached before. (Producers and Extractors are rebuilt and re-levelled from scratch each run.)
- **Five levels for now.** The Idol level cap is a soft cap: base 5, raised by **purchasable cap upgrades paid in legacy points (Embers)**. Rebirth-gated unlocks of more levels come later.
- **Biomes and the map reset on every rebirth, always.** A new map is generated from the same rules; `discovered` biomes (the Guide and header unlocks) persist, the land does not.

**How it works**
- State: `legacy.idols = { forest: 3, hills: 5, ... }` (level per biome Idol), plus the cap level from the Ember shop. Building a *new* Idol (never built before) costs materials as a level-1 building; every level up costs materials (T2/T3 from level 3) and takes the shared builder's time **during a run** (the Idol must stand to be upgraded). The cost is paid once per level for the account.
- The **castle-level gate** (levels 1-5: `min(5, castle level)`; above 5 only the Idol Mastery cap) applies to *upgrading* an Idol, not to placing it at its remembered level: a fresh run places the level-5 Idol at castle level 1 and the power is back at once. Because the power now persists, the per-level values must be small and the sum over the 12 Idols must be tested against the Ember shop's total (BL9/BL10); the area-bonus cap above is part of that.
- Who owns it: the Idols change what the server computes (Luck, kill rewards, XP, offline efficiency, chest speed, crafting XP, damage, HP), so their levels belong in the **ledger**, not in the save (an edited save must not grant level 5 for free). New nullable column `player_ledger.legacy jsonb` (migration `legacy_ledger.sql`, applied before the code, lazy-seeded like `inv`); an Idol level-up is a server operation priced in the ledger, and `buildingEconomy(world, legacy)` takes the levels from there. The build menu shows "free (level N)" when the legacy level exists.
- **Soft caps as one mechanism.** The code already has it: `LIMITS` (base values) read through `limitOf(key, ctx)` with `LIMIT_BONUSES`, and `HARD_LIMITS` (what a save may ever hold, so raising a limit later never invalidates a save, `config/limits.ts`). Every new cap goes there, and the Ember shop (legacy points) is the first source of raises, later also rebirth milestones and paragon ([13](13-rebirth-reset-and-paragon.md)):

| Cap (key) | Base now | Raised by (planned) | Hard ceiling (proposal) |
|---|---|---|---|
| `idolMaxLevel` (new) | 5 | Ember shop "Idol Mastery", +1 per purchase | 10 |
| `buildingMaxLevel` (new, Producers/Extractors) | 5 | Ember shop (Master Craftsmen, up to +10) | 20 |
| `bagSize` | 36 | Pack Rat (merchant) | existing |
| `offlineCapHours` / `offlineEfficiency` | 8 / 50 % | Night Watch / Steward | existing |
| `monsterGrowthLevels` | 10 | later rebirth effects | existing |
| `merchantOffers` | 6 | later | existing |
| `craftingLevelCap` (new, [17](17-crafting.md)) | 100 | paragon-style steps | 150 |
| `builderSlots` (new) | 1 | Ember shop (parallel upgrades) | 3 |

- The Ember shop gains items of a different shape, which BL9/BL10 asked for: caps and slots instead of flat percentages. **Decided (2026-10-29):**

| Shop item | Effect | Levels | Cost curve (`ceil(base x growth^N)`) | Cost per level |
|---|---|---|---|---|
| **Idol Mastery** | +1 level cap on **all** Idols (one global item, not per Idol) | 5 (cap 5 -> 10) | base 10, x2.2 ("very steep") | 10, 22, 48, 106, 233 (419 total) |
| **Master Craftsmen** | +1 level cap on Producers and Extractors, separate from the Idol cap | **10 (cap 5 -> 15)** (decided 2026-10-29, was 3) | base 10, **x1.6** (gentler, because the ladder is long) | 10, 16, 26, 41, 66, 105, 168, 269, 430, 688 (1,819 total) |
| **Extra Builder** | +1 parallel upgrade slot (castle and buildings) | 2 (1 -> 3 slots) | **decided: base 40, x2.2** (the slot is the strongest of the three) | 40, 88 (128 total) |

  They are plain `EMBER_UPGRADES` entries (`maxLevel`, `baseCost`, `costGrowth`) whose effects register as `LIMIT_BONUSES` on `idolMaxLevel`, `buildingMaxLevel` and `builderSlots`, so no call site changes; the hard ceilings in the table above (10, 20, 3) keep every save valid. Pacing check: the first rebirth earns about 9 Embers and rebirth 5 about 40 or more (`REBIRTH.gain`: 3 x (castle - 5) x sqrt(tiles / 10)), so these roughly 2,400 Embers (Idol Mastery 419, Master Craftsmen 1,819, Extra Builder 128) are a long-game sink, far beyond ten rebirths next to the six existing percent items (about 140 each to max); the first Idol Mastery level is affordable around the second rebirth and the first Extra Builder around the third to fifth. Re-check with `sim` once Embers are modelled per rebirth. Cap items must not be refundable or respeccable (Embers stay permanent, BL9).
- T2 and T3 stock resets at rebirth; **T4 relics survive it** (decided 2026-10-29: boss-gated drops, [20](20-monster-families-and-rewards.md)).
- The Dwarf Statue's build-time bonus is capped (above), so rebirth speed-ups cannot stack out of the 65-70 % run-2 target.

## 7. Server and data
- No SQL. Building levels live in `player_worlds.extra` (jsonb) and in the save; rates are derived by `summary()` as today; `buildingEconomy(world)` adds the Idol effects and the Producer/Extractor output so offline grants, `verify.ts` and `netWorth.ts` agree.
- New `verify.ts` shadow flags: `building_dupe` (two of one type), `building_wrong_biome`, `building_level_cap` (level above the castle cap). All O(buildings) on data already read.
- `placement.ts` already ignores tiles with buildings; unchanged.
- Extract production also reaches the ledger totals (`granted`, `zeroTotals`): done by the key-list refactor in section 4.

## 8. Existing saves and the removed buildings
All 16 old types go. The documented pattern for removed content is lenient repair (`repairSave.ts`): a tile whose `building` is not in the new set loses it. **Refund** (decided; **unnecessary if the class-release reset ships first or together with the buildings**, because the reset wipes every map, [21](21-classes-avatars-achievements-offline-report.md) section 6): the gold, wood and stone it cost by the old ladder (`calculateBuildingCost` for the n-th building), credited once. A refund raises resources outside the server's income model, so the server must grant it: on the first accepted save that still contains a legacy building (checked on the *stored* map), add the computed refund to `granted` and set an idempotent marker in the ledger. Live data: 5 players today; `buildings_owned` per row tells how many refunds there will be (query before release, `scripts/check-live-saves.ts` from [14](14-server-audit-and-data-plan.md)). Economy sets/bonuses tied to old buildings (the `blacksmith` all-resources, `tower` etc.) go with them; the sim's `BUILD_ORDER` must be rewritten around the 36.

## 9. Impact on balance (what to measure)
- Gold remains the tile limiter; Producers must not make a material a non-issue: the Producer bonus is capped and level-gated.
- Idols are small permanent bonuses in six to ten mechanics: add a sim line "income/XP/kill/chest with all idols maxed" and compare to the Ember shop's contribution.
- Extractors are slow by design (crafting is a 1-month+ system, [17](17-crafting.md)): set rates from "crafts per day at the target crafting pace".
- The art load is large: ten road sets (16 variants each plus bridges), and 36 building sprites at 3 levels each if levels change the look (proposal: 2 looks, level 1-2 and 3-5, plus a glow on level 5). Spread across the biome releases ([12](12-rebirth-biomes.md)): each biome ships with its three buildings.

## 10. Rollout
P0 key-list refactor and the registry; P1 new building model (one-per-type, per-biome menu, levels, timers, Producer only) behind the existing 7 biomes + refund; P2 Extractors + T3 materials (needed by crafting) ; P3 Idols + `buildingEconomy`; P4 castle timer change (can go first, it is one array); P5 buildings of each new biome with its art; P6 Guide pages and the `verify.ts` flags; roads (section 5.2) after P3, since they need the Producer/Extractor bonus to exist; the `legacy` ledger column with P3; Master Craftsmen and Extra Builder with the first Ember shop update. If the class-release reset has shipped by then, P1 needs no legacy-building refund.

## 11. Decisions and open questions

**Decided (2026-10-29):**
- Position bonus (rule 7): castle area bonus applies to every building in range; Idols capped at x2; Extractors in full like Producers; buildings beyond the range get a frontier bonus mirroring it.
- Producers scale with the owned size of their biome (+2 % per tile, cap +100 %), one of each type per map.
- ~~Idol bonuses reset with the map~~ **Superseded (see section 6): Idol levels persist across rebirths and are re-placed for free; the cap is 5 for now and raised with legacy points.**
- The merchant trades T0 and T1 only; T2-T4 are never sold. This overrides the earlier "tradable once discovered" plan in [12](12-rebirth-biomes.md).
- Legacy buildings are removed with a server-granted refund (section 8), which is unnecessary if the class-release reset ships first or together with the buildings.
- One shared builder: the castle and all buildings share one upgrade queue (one timer runs at a time). Ember Master Builders and the Dwarf Statue shorten timers; extra builder slots can become an Ember shop item later (also adds a shape to BL9).

**Decided in the numbers round (2026-10-29):**
- **Producer base:** a level 1 Producer is worth about **15 tiles** of its main material (4.5/s for a 0.3/s tile), before the biome-size bonus, levels, position and road.
- **Idol value:** **+2 % per level** (level 5 = +10 %, level 10 with Idol Mastery = +20 %), multiplied by up to x2 by the position bonus cap; Luck is expressed in points (open below).
- **Relocation:** 50 % of the building's current build cost, instant.
- **Road tile:** about 3 % of the current tile price in gold, wood and stone, times the biome multiplier and the distance factor.

**Decided (Ember shop, 2026-10-29):** Idol Mastery (global, +1 cap per level, 5 levels, base 10 x2.2), Master Craftsmen (+1 Producer/Extractor cap, 10 levels, cap 5 -> 15, base 10 x1.6), Extra Builder (+1 parallel slot, 2 levels, base 40 x2.2 = 40 and 88 Embers); see section 6.

**Still open:**
0a. Road numbers: the biome multipliers, the distance factor and the road refund (the 3 % share is decided); whether a lake needs a pier building first; whether roads should also speed anything else (monster travel, chest rewards).
0b. The frontier bonus numbers (5 % per tile beyond 9, cap +100 %) and whether they should count the global distance offset of [12](12-rebirth-biomes.md); the castle-10 x5 on Extractors against the crafting pace.
1. Extractor rates per level (set from "crafts per day at the crafting pace", [17](17-crafting.md)) and the Producer/Extractor timers for levels 6-15.
2. The Luck Idol is in points, not percent: its per-level Luck points (proposal 4 per level) and the click-gold Idol's exact form.
3. A sim line for all twelve Idols maxed against the Ember income bonus (+6 % per Ember ever earned).
4. T4 Relics: decided to come from the biome bosses and persist; what they are and what they are used for is still open ([20](20-monster-families-and-rewards.md)).
5. With one shared queue, the castle and a building compete for the builder: should the castle upgrade be able to cut in line?
