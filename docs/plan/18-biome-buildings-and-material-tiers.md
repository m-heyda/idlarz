# 18 · Biome buildings: what is left (the building model is built; the position bonus, the art and some Ember items are open)

Reviewed against the code on 2026-11-26; everything built was removed. **Built** (the code and its JSDoc are the record: `src/config/buildings.ts`, `src/catalog/buildings.ts`, `src/catalog/idols.ts`, `src/config/limits.ts`, `EMBER_UPGRADES` in `src/config/rebirth.ts`, `src/catalog/resources.ts`, the Kingdom overview window): three buildings per biome (a Producer, an Extractor and an Idol, one of each per map, a build menu that shows only the tile's biome), levels 1 to 5 with timers and one shared builder queue, the Producer's output growing with the owned tiles of its biome plus the tile-count milestones (IDL-198), relocation for half the cost, the twelve Extractors and their T3 extracts (the merchant buys the home biomes' extracts and never sells them back), Idol levels that survive a rebirth and are re-placed for free (the ledger's `legacy` record), the soft caps through `limitOf` and `HARD_LIMITS`, the resource-key registry, the castle timers (halved) and the Ember-shop caps (Idol Mastery, building caps, Extra Builder, Deep Pockets, build-time cuts with a combined cap of 60 %). The material tiers as they stand: T0 base goods, T1 farm goods, T3 extracts, with T4 relics still planned; the old T2 goods (Hardwood, Cloth, Honey) were dropped and the merchant sells T0 and T1 only ([12](12-rebirth-biomes.md)).

## What is open

### 1. The position bonus (decided 2026-10-29; IDL-95)

One pure function `positionBonus(distance, castleLevel)` gives the building on a tile its bonus, so near and far buildings stay comparable. It does not exist in the code yet (`src/config/buildings.ts` says it comes in a later slice).

- **Inside the castle range** (the existing `CASTLE_AREA_BONUS`, `src/config/castle.ts`: +50 % below castle level 7, from level 7 +100 % per range radius tile up to +400 % at castle 10; range 3x3 growing to 9x9): unchanged for tiles, and now **also applied to every building on them**.
- **Beyond the range** (the rebirth biomes begin 10 or more tiles out, outside the maximum radius 4): a **frontier bonus** that grows with distance, proposal `min(+100 %, 5 % x (distance - 9))` from distance 10 (+5 % at 10, +65 % at 22, +100 % from 29). Between the range edge and distance 9 there is no bonus. Exactly one of the two applies to a tile. It counts the real distance from the castle (there is no global offset, see [12](12-rebirth-biomes.md)).
- **Who gets it:** Producers and Extractors in full, and **Idols capped at x2**: Idol value x `min(1 + positionBonus, 2)`, so an Idol beside a castle 10 is not five times stronger.
- Consequences to design for: the range holds at most 80 tiles, so which buildings stand in it is a placement puzzle; basic-biome buildings compete for the castle region while the late biomes are rewarded by the frontier bonus, which fits the exploration goal.
- **Server:** a pure function of the saved map (building tile, castle position and level), folded into the building economy so offline grants, `verify.ts` and `netWorth.ts` agree. Relocating a building changes its bonus, so the relocation cost matters (open).

### 2. Building art (IDL-99, IDL-245)

21 sprites for the home biomes (the rebirth biomes' with their art, [12](12-rebirth-biomes.md)), two looks each (levels 1-2 and 3-5, a glow on level 5), replacing the old sprites; the assessed pack in `public/pixel/assets_to_assess_and_use/` may supply some. Spread across the biome releases: each biome ships with its three buildings. New pictures follow the Sprite Fusion rule in `CLAUDE.md`.

### 3. Ember shop items not built yet (IDL-97, IDL-132, IDL-162, IDL-184, IDL-185, IDL-195; decided 2026-11-07)

All permanent and kept across rebirth.

| Item | Effect | Levels | Cost per level (Embers) |
|---|---|---|---|
| **Vault slot** | +1 legendary Vault slot (1 to 3), see IDL-146 | 2 | 60, 150 |
| **Auto tiles** | unlocks the tile buyer | 1 | 40 |
| **Auto castle** | unlocks the castle auto-upgrade | 1 | 100 |
| **Auto sell** | unlocks the surplus auto-sell | 1 | 40 |

- The three autobuyers are IDL-195 (online only, no per-click server calls; a bulk "buy next N" with a cost preview is free for everyone). A later building auto-upgrade needs the building costs to be a pure function of (building, level) and one batched request per purchase.
- **Cosmetic Ember shop v1** (IDL-184, a pure sink with no number changes): about 20 titles (50 to 2,000 Embers, a few reachable only through achievements) and 8 name colours, shown in the header and the rankings. Ownership and the spent total are server-held in the ledger and count as spent (`legacyPoints + spent = earned` must hold), so **`sanitizeSave` and the client check must add the server-held cosmetic spend to the upgrade spend**, or a save would be rejected after a purchase.
- **Monument (IDL-185, a gold sink):** one per map, 30 levels, resets at rebirth, **+0.5 % income per level, max +15 %, as its own deliberate multiplier bucket** (shown in "Where the income comes from"). The gold cost starts at 0.5 hours of end-run income (a constant from the castle-10 reference economy) and grows x1.10 per level (about 82 hours in total, level 30 about 8.7 h), plus a small wood and stone share. The sim keeps its end-run income share under 10 % and the pacing guard at +-15 %.

### 4. `verify.ts` shadow flags for buildings

`building_dupe` (two of one type), `building_wrong_biome` and `building_level_cap` (a level above the castle cap): all O(buildings) over data already read. Not built (the biome flags of [12](12-rebirth-biomes.md) are IDL-89).

### 5. Open numbers and questions

1. The frontier bonus numbers (5 % per tile beyond 9, cap +100 %) and the castle-10 x5 on Extractors against the crafting pace.
2. Extractor rates per level (set from "crafts per day at the crafting pace", [17](17-crafting.md)) and the Producer and Extractor timers for levels 6-15 (proposal: x1.35 per level on the level-5 timer of 8 h, capped at 7 days; the effect step stays as in levels 1-5, flatten it above level 10 if a level 15 Producer, x8 before the position bonus, is too much).
3. The Luck Idol is in points, not percent: its per-level points (proposal 4) and the click-gold Idol's exact form; Idol scaling in general (IDL-287).
4. A sim line for all twelve Idols maxed against the Ember income bonus (+6 % per Ember ever earned).
5. T4 relics: decided to come from the biome bosses and persist, one per boss ([20](20-monster-families-and-rewards.md) section 8); the Vault exchange is IDL-146.
6. With one shared builder queue, should the castle upgrade be able to cut in line?
7. The art load (item 2) against the release order.

## Rules that still stand

- Gold stays the tile limiter; Producers must not make a material a non-issue (the Producer bonus is capped and level-gated).
- Idols are small permanent bonuses in six to ten mechanics: the sim line in 5.4 compares them with the Ember shop.
- Extractors are slow by design (crafting is a month-plus system, [17](17-crafting.md)).
