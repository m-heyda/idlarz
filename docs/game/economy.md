# Economy: income, tiles, buildings, castle, farm, merchant, clicks, chests

What the game does today, read from the code. Every number has the file it lives in; big tables are linked from [docs/generated](../generated), not copied. Where this page and a plan or draft disagree, this page describes the present.

## 1. Basics

| Thing                                          | Value                                                                       | Source                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Game tick                                      | 100 ms; one tick never advances more than 300 s                             | `TICK_RATE`, `MAX_CATCHUP_SEC` in `src/config/economy.ts`         |
| Stockpile cap (every resource and XP)          | 1e21                                                                        | `RESOURCE_CAP`, `XP_CAP` in `src/config/economy.ts`               |
| Start                                          | 125 gold, 1000 gems                                                         | `INITIAL_RESOURCES`, `STARTING_GEMS` in `src/config/economy.ts`   |
| Income with nothing built                      | gold 0.1/s, XP 0.25/s                                                       | `BASE_GENERATION_RATES` in `src/config/economy.ts`                |
| Castle position                                | (25, 25)                                                                    | `CASTLE_X`, `CASTLE_Y` in `src/config/castle.ts`                  |
| Map size                                       | unbounded; coordinates within ±16,000, at most 250,000 owned tiles          | `COORD_LIMIT`, `MAX_OWNED_TILES` in `src/utils/world.ts`          |
| Resources                                      | gold, wood, stone, coal, food, meat, eggs, milk, hide, xp (+ gems, embers)  | `src/catalog/resources.ts`, `src/catalog/resourceKeys.ts`         |
| Resource tiers                                 | currency (gold, gems, embers), t0 (wood, stone, coal, food, meat), t1 (eggs, milk, hide); t2-t4 are declared but empty | `RESOURCE_TIERS` in `src/catalog/resources.ts` |

Gems and Embers are not part of the `Resources` record: gems are the server's balance (see [saves-and-server.md](saves-and-server.md)), Embers live in the prestige state (see [progression.md](progression.md)).

## 2. Income per second

One function builds it: `calculateResourceBreakdown` in `src/utils/game/income.ts`.

```
base[r]  = BASE_GENERATION_RATES[r]
         + farm output (meat, eggs, milk, hide; the farm has no other source of those four)
         + sum over owned tiles of (biome output[r] + building output[r]) x BIOME_YIELD.scale x (1 + 0.25 x same-biome 4-neighbours)
         + sum over tiles inside the castle range of the same tile output x castleAreaBonus(castle level)
         + 0.5 x (castle level - 1)                  (xp only)
modifier[r] = (1 + castleModifier + plainsMod[r] + statMod[r]) x emberMult x foreman x gearIncome - 1
total[r] = base[r] x (1 + modifier[r])
```

- `BIOME_YIELD.scale` = 1.3 for every tile and building; the castle tile itself is not scaled and gets no neighbour bonus (`src/config/economy.ts`, `calculateTileOutput`).
- Neighbour bonus: +25% per same-biome 4-neighbour (`SCALING_CONFIG.adjacencyBonus`).
- `plainsMod`: +5% meat per owned Plains tile (`CHARACTER_STAT_CONFIG.plainsMeatModifier`).
- `statMod`: +2.5% per attribute point on the resources each attribute feeds, and +0.2% / +0.25% XP per Intelligence / Charisma point (see [progression.md](progression.md) §3).
- `emberMult` = `1 + 0.1 x (Embers ever earned)^0.6` (`REBIRTH.incomePerPoint`, `incomeExponent`; `emberIncomeBonus` in `src/utils/game/rebirth.ts`).
- `foreman`: merchant upgrade, +1% per level on every resource but XP. `gearIncome`: set bonus Income % on every resource but XP (`src/lib/gearEconomy.ts`).
- The merchant's Skinner multiplies the farm's meat and hide inside `base`.
- Everything inside the first bracket is added, the three multipliers after it are multiplied.

## 3. Map and tiles

### Buying a tile

- A tile can be bought when it touches an owned tile on one of its four sides and the whole bundle is paid.
- The count that feeds every price is the **economy count** `economyTiles = owned tiles - freeTiles + 1` (`src/utils/game/tiles.ts`). A new game owns the castle and the four tiles N/E/S/W (`STARTER_FREE_TILES` = 5, generated from plains/forest by `BIOME_RULES.startRing`), so the first purchase is "tile 1".
- Gold price of the next tile when `n` count tiles are owned (`tilePrice` in `src/config/economy.ts`):

```
m        = min(n, 300)
price(n) = floor(min(55 x 1.13^min(m,15) x 1.07^(min(m,100)-15, at least 0) x 1.007^max(m-100,0) x (n/300)^3.5 [only if n > 300], ceiling))
ceiling  = RESOURCE_CAP / 100
```

Constants: `BASE_TILE_COST` 55, `SCALING_CONFIG` (1.13 to 15, 1.07 to 100, 1.007 to `TILE_PRICE.tailFrom` 300), `TILE_PRICE.tailExponent` 3.5.

Values computed from the formula (before any discount): n=1 62 · 10 186 · 20 482 · 50 3,672 · 100 108,183 · 200 217,323 · 300 436,570 · 400 1.19 M · 500 2.61 M · 1,000 29.5 M. Cumulative gold for the first 100 / 200 / 300 / 400 / 500 tiles: 1.65 M / 17.4 M / 48.9 M / 126 M / 311 M. The full table with extra resources is [generated/balance-tables.md](../generated/balance-tables.md) §1.

- **Extra resources** (`TILE_RESOURCE_COST` in `src/config/economy.ts`): from the tile count shown, the price also asks for a share of the gold price: wood 30% and stone 20% from tile 15, coal 20% from 30, food 10% from 40, hide 2% from 100.
- **Discount** `calculateTileCost` (`src/utils/game/costs.ts`) removes `discount %` from the gold and from every extra part. `effectiveTileDiscount` (`src/utils/game/rebirth.ts`) = Charisma (0.5% per point, max 25%) + Thrift (2% per level) + Bulk Discount (1% per level), capped at 45% (`REBIRTH.discountCapPercent`).
- XP for a purchase: `calculateXpGain(k)` in `src/utils/game/character.ts`: `45 x 1.02^(min(k,300)-1) x min(k,300)/4`, times `(k/300)^1.5` beyond 300 (`BASE_XP_PER_TILE`, `XP_TILE` in `src/config/economy.ts`); multiplied by `1 + XP gain %` of the character.

### Which biome a purchase becomes

Rolled when you buy; there is no picker. Rules and numbers: `BIOME_RULES` in `src/config/biomeRules.ts`, `BIOME_SPAWN` in `src/config/biomes.ts`, logic in `src/utils/biomeRules.ts`.

- Plains, forest, hills and lake from the start; swamp after 6 purchases, tundra after 10; coast only beside a lake or coast.
- Never adjacent (8 neighbours): tundra-swamp, tundra-coast, hills-coast. Plains is neutral.
- Clustering: base chance to copy a neighbouring biome (forest 60, hills 55, lake 50, swamp 55, tundra 65, plains 45, coast 40) plus 10 per extra same-biome 4-neighbour, capped at 90%; a lone tile joins a neighbour with `buddyPct` 100.
- Otherwise a weighted roll: every biome 1, coast 0.6, lake/coast likelier beside water.
- Jungle, fields, orchard, blight and battlefield exist in `BIOMES` as dev-only entries; no rule gives them to players.

### Biome output

Config values per second; multiply by 1.3 for what a tile really makes (`src/config/biomes.ts`).

| Biome | Config output / s |
| --- | --- |
| Castle | gold 0.1, wood 0.05, stone 0.1, food 0.05, xp 0.5 (`CASTLE_BASE_RATES`, not scaled) |
| Forest | gold 0.1, wood 0.3 |
| Plains | gold 0.1, food 0.3 |
| Hills | gold 0.05, stone 0.3, coal 0.2 |
| Swamp | food 0.1, wood 0.2 |
| Tundra | gold 0.1, coal 0.35 |
| Lake | gold 0.05, food 0.25 |
| Coast | gold 0.1, food 0.2 |

## 4. Buildings

One building per tile, on any owned tile that is not the castle, a lake or empty (`BUILDING_COST.blockedBiomes`), not in a landmark area, not under a monster or chest. Output is added to the tile's own output (same 1.3 scale and neighbour bonus). Data: `BUILDINGS` in `src/config/buildings.ts` (16 types, config output per second):

| Building | Output | Building | Output |
| --- | --- | --- | --- |
| Farm | food 0.2 | Lumber Camp | wood 0.18 |
| Mine | stone 0.2, coal 0.2 | Quarry | stone 0.25 |
| Lumber Mill | wood 0.2 | Fishing Hut | food 0.16, gold 0.05 |
| Market | gold 0.2 | Hunter's Lodge | meat 0.15 |
| Blacksmith | 0.07 each of stone, coal, gold, food, wood | Tavern | food 0.12, xp 0.08 |
| Workshop | xp 0.2 | Tower | stone 0.08, xp 0.12 |
| Well | food 0.15 | Alchemy Lab | xp 0.12, gold 0.08 |
| Stone Craft | stone 0.15, gold 0.08 | Barracks | gold 0.1, xp 0.1 |

Price of the next building (`buildingCostFactor`, `calculateBuildingCost` in `src/utils/game/costs.ts`; `BUILDING_COST` in `src/config/buildings.ts`): base 500 gold / 250 wood / 150 stone times a factor that depends on how many buildings stand: 0.4, 0.6, 0.8, 1.0 for the first four, then `1.15^min(k,12) x 1.09^clamp(k-12,0,16) x 1.025^max(k-28,0)` with `k` = buildings built - 3; times `1 - Thrift`. Only Thrift discounts buildings (not Charisma or Bulk Discount). Examples: building 5 = 575 gold, 10 = 1,157, 20 = 3,776, 40 = 12,941. Each resource is capped at `RESOURCE_CAP / 100`.

## 5. Castle

All in `src/config/castle.ts`; maths in `src/utils/game/castle.ts` and `src/lib/castleWard.ts`.

- Levels 1-10. An upgrade pays its cost up front, then runs a timer counted by the tick (saved, counted while away at full speed). One upgrade at a time.
- Modifier added to every resource (`castleModifier`): `0.2 x 2^(L-1)` up to level 6 (+20%, +40%, +80%, +160%, +320%, +640%), then +3.2 per level: +960%, +1280%, +1600%, +1920% (`baseResourceMultiplier`, `doublingUntil`, `lateLevelStep`).
- Flat XP: +0.5 xp/s per level above 1 (`CASTLE_UPGRADE.xpBonus`).
- Timers (`CASTLE_UPGRADE.durationsSec`): 30 min, 2 h, 6 h, 12 h, 24 h, 1.5 d, 2 d, 2.5 d, 3.5 d (level 1→2 first). Master Builders (Ember shop) cuts them 5% per level (`castleUpgradeDuration`).
- Costs per step (`CASTLE_UPGRADE.upgradeCosts`): 1→2 70 K gold, 10 K wood, 10 K stone; the last step 9→10 is 122.8 M gold, 12.2 M wood, 12.2 M stone, 6.6 M coal, 65.6 M food, 3.2 M meat. Coal appears from 2→3, food and meat from 3→4. Per-step table: [generated/balance-tables.md](../generated/balance-tables.md).
- **Range** (violet area): radius 1 (3x3) up to level 7; from level 8 it grows one tile per level: 5x5 at 8, 7x7 at 9, 9x9 at 10 (`CASTLE_RANGE`, `castleRangeRadius`).
- **Area bonus** (`CASTLE_AREA_BONUS`, `castleAreaBonus`): tiles in range (and their buildings) make extra output of +50% below level 7; from level 7 it is +100% per tile of range radius: +100% (7), +200% (8), +300% (9), +400% (10). It is part of the base income, so the modifiers apply on top.
- **Fortress / ward** (`CASTLE_FORTRESS`): from level 7 the 3x3 around the castle is a ward: no monsters or chests spawn there and monsters standing in it are driven out.

## 6. Farm

`src/config/farm.ts` (data) and `src/utils/game/farm.ts` (maths). Animals are bought with food.

| Animal | First cost (food) | Cost x per animal | Meat / s each | Product / s each |
| --- | --- | --- | --- | --- |
| Chicken | 1,000 | 1.30 | 0.2 | eggs 0.03 |
| Deer | 10,000 | 1.33 | 0.5 | hide 0.075 |
| Pig | 60,000 | 1.36 | 1 | hide 0.15 |
| Cow | 400,000 | 1.40 | 2 | milk 0.225 |

- Cost of the N-th animal of a kind: `floor(baseCost x costScaling^owned)` (`calculateAnimalCost`). Pen holds 12 per kind (`FARM.baseCap`), +4 per Pen Expansion level.
- Output of N animals: meat `baseProduction x N x (1 + 0.02 x pen) x (1 + 0.05 x feed)`; product `perSec x N x (1 + 0.02 x pen) x (1 + coop|dairy|tannery effect) x (1 + 0.08 x pasture)` (`animalOutput`).
- Upgrades (`FARM_UPGRADES`; cost of level N+1 = `ceil(base x growth^N)` per resource): Feed Trough +5% meat, Hen House +15% eggs, Dairy +15% milk, Tannery +25% hide, Pasture +8% eggs/milk/hide (10 levels each, growth 1.6); Pen Expansion +2% farm output and +4 animals per kind (8 levels, growth 1.9).

## 7. Merchant

Data: `src/config/merchant.ts`, `src/catalog/resources.ts`; maths `src/utils/game/merchant.ts`, shelf `src/lib/merchant.ts`.

- **Sell prices** (gold per unit): wood 0.75, stone 0.9, coal 1.1, food 0.4, meat 1, eggs 2, milk 3, hide 2. Payout `floor(units x price x (1 + 0.03 x Haggler))` (`sellPayout`).
- **Buy** wood, stone, coal, food, meat at 2x the sell price, rounded up (`MERCHANT_BUY_MULTIPLIER`, `buyCost`). Farm products are never sold to the player.
- **Goods shelf** (`MERCHANT_GOODS`, `generateMerchantStock`): 6 pieces of gear (`LIMITS.merchantOffers`) from the loot source `merchant` (common 60 / uncommon 40, see [loot.md](loot.md)), item level centred at most 3 above the average worn item level and never more than 5 above it, otherwise built from the castle level (4 + 3 per castle level above 1). Price = `ceil(sell value x 5)`. Reshuffled every 1,800 s of play time.
- **Refresh**: 3 free per 12 h of play time (`windowSec` 43,200), 30 s between any two, then the paid price `10,000 x 2^(paid refreshes)` capped at 1e9 (`MERCHANT_GOODS.refresh`, `refreshCost`). The count is never reset, not even by a rebirth.
- **Supplies**: potions always in stock at their catalog `shop` price (`MERCHANT_SHOP_ITEMS`).
- **Item sale value**: `rarity value x valueCurve(item level) x quality x affixes`, see [loot.md](loot.md).
- **Click ladder**, bought here: see §8.
- **Upgrades** (gold; level N+1 costs `ceil(baseCost x growth^N)`; all but Pack Rat start again on a rebirth). `MERCHANT_UPGRADES` in `src/config/merchant.ts`:

| Id (label) | Group | Per level | Max | Base cost | Growth |
| --- | --- | --- | --- | --- | --- |
| haggler (Haggler) | economy | +3% gold from selling | 10 | 100,000 | 1.9 |
| bulk (Bulk Discount) | economy | -1% tile cost (shares the 45% cap) | 8 | 250,000 | 2.1 |
| charm (Lucky Charm) | economy | +2 Luck | 10 | 150,000 | 1.9 |
| packrat (Pack Rat) | economy | +4 bag slots | 4 | 500,000 | 3 |
| foreman (Foreman) | economy | +1% income of every resource but XP | 10 | 400,000 | 1.9 |
| skinner (Skinner) | economy | +5% meat and hide | 8 | 300,000 | 1.9 |
| swift (Quick Hands) | combat | +2% attack speed | 8 | 250,000 | 1.9 |
| keen (Keen Eye) | combat | +1 point crit chance | 8 | 250,000 | 1.9 |
| deadly (Deadly Aim) | combat | +1 point super-crit chance | 8 | 250,000 | 1.9 |
| might (Might) | combat | +2% physical damage | 8 | 250,000 | 1.9 |
| arcana (Arcana) | combat | +2% magic damage | 8 | 250,000 | 2 |
| fang (Vampiric Fang) | combat | +0.5% life leech | 6 | 300,000 | 2 |
| wind (Second Wind) | combat | +0.25 HP/s regeneration | 6 | 300,000 | 2 |
| tithe (Ancestral Tithe) | rebirth | +5% Embers from a rebirth | 10 | 600,000 | 1.9 |

## 8. Clicking

- A trusted click on the map pays `max(gold/s x power, floor) x multiplier` (`clickGold`, `CLICK_LADDER` in `src/config/economy.ts`). Multiplier = Click Mastery (+25% per Ember level) and the set's Click Gold %.
- Ladder (price in gold at the merchant): level 0 power 2 floor 2 (free) · level 1 power 4 floor 6 (750,000) · level 2 power 8 floor 20 (2.5 M) · level 3 power 15 floor 60 (10 M).
- Rate limit: two token buckets, a click needs a token from both. Burst 8 clicks refilling 5/s; stamina 20,000 clicks refilling 1.5/s. Script-dispatched clicks do not pay (`CLICK_LIMIT.requireTrusted`).
- Clicking a tile or building pays nothing else.

## 9. Chests and Luck

Data: `CHEST`, `LUCK`, `SPAWN_LIMIT` in `src/config/spawns.ts`; rolls `src/lib/chests.ts`, `src/lib/luck.ts`. The server mints and places them (see [saves-and-server.md](saves-and-server.md)).

- A chest ticket every 600 s of server time, faster with Luck: `interval = 600 x max(0.6, 1 / (1 + 0.004 x Luck))`. Monsters and chests together never exceed 30% of the free tiles (minimum 2), and at most 40 tickets wait in all, chests, monsters and the boss counted together (`ticketCap`, `TICKET_CAP` in `src/lib/offline/tickets.ts`; the server estimates free land from the owned-tile count, the browser's `spawnCap` in `src/lib/spawnLimits.ts` counts it from the map).
- Where: every eligible owned tile weighs 1, +3 if it touches unowned land, +1 per 4 tiles of Chebyshev distance from the castle, x0.3 if another chest is within 2 tiles (`CHEST.placement`).
- What is inside: relative weights gold 50, bundle 25, xp 12, boost 10, item 8 (`CHEST.rewards`). Each Luck point moves 1% of the gold weight (at most 60%) into boost (80%) and item (20%) (`rewardWeights`).
  - gold: `gold/s x U(10..60 min) x (1 + 0.005 x Luck) x (1 + Gold Find %)`; boost is the same x1.5.
  - bundle: 1-2 of wood/stone/coal/food, each 10-30 min of its income, at least 25.
  - xp: 10-30 min of XP income, at least 60.
  - item: one roll of the `chest` loot source (82% gear, else a potion; 1.9% a legendary weapon instead), see [loot.md](loot.md).
  - On top of any chest, a gem roll: `min(15%, 3% + 0.06% x Luck)`, 5-50 gems skewed low (`LUCK.gem`).
- Luck = Charisma + Lucky Charm + gear Luck. Other effects (`LUCK`): rare-and-better rarity weights x`min(1.6, 1 + 0.004 x Luck)`, monster gear roll chance x`(1 + 0.002 x Luck)`, golden monster chance `min(10%, 2% + 0.05% x Luck)`.

## 10. Where to see the numbers measured

- Pacing: [generated/sim-milestones.md](../generated/sim-milestones.md) (`npm run sim`), guarded in CI by `scripts/pacing-guard.ts`.
- Prices, XP and castle tables: [generated/balance-tables.md](../generated/balance-tables.md) (`npm run report`).
- Targets the numbers are checked against: [pacing-targets.md](pacing-targets.md).
