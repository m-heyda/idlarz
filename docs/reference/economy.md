# Economy

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Income, tiles, castle, farm, merchant, clicks, chests and Luck.

**Contents**

- Basics: [Basics: tick, caps, start](#tick-rate), [`MAX_CATCHUP_SEC`](#max-catchup-sec), [`RESOURCE_CAP`](#resource-cap), [`INITIAL_RESOURCES`](#initial-resources)
- Income: [`calculateResourceBreakdown`](#calculateresourcebreakdown), [`calculateTileOutput`](#calculatetileoutput), [`BIOME_YIELD`](#biome-yield), [`BASE_GENERATION_RATES`](#base-generation-rates)
- Tiles: [`tilePrice`](#tileprice), [`TILE_RESOURCE_COST`](#tile-resource-cost), [`calculateTileCost`](#calculatetilecost), [`effectiveTileDiscount`](#effectivetilediscount), [`calculateXpGain`](#calculatexpgain), [`economyTiles`](#economytiles)
- Biomes: [`rollBiome`](#rollbiome), [`BIOMES`](#biomes), [`REBIRTH_BIOME_OUTPUT`](#rebirth-biome-output), [`generateStartRing`](#generatestartring)
- Castle: [`CASTLE_UPGRADE`](#castle-upgrade), [`castleModifier`](#castlemodifier), [`castleUpgradeDuration`](#castleupgradeduration), [`CASTLE_RANGE`](#castle-range), [`CASTLE_AREA_BONUS`](#castle-area-bonus), [`CASTLE_FORTRESS`](#castle-fortress), [`castleRangeRadius`](#castlerangeradius), [`castleAreaBonus`](#castleareabonus)
- Farm: [`ANIMALS`](#animals), [`animalOutput`](#animaloutput), [`FARM_UPGRADES`](#farm-upgrades), [`calculateAnimalCost`](#calculateanimalcost), [`farmUpgradeCost`](#farmupgradecost), [`calculateFarmOutput`](#calculatefarmoutput)
- Merchant: [`MERCHANT_RESOURCE_PRICES`](#merchant-resource-prices), [`MERCHANT_GOODS`](#merchant-goods), [`MERCHANT_UPGRADES`](#merchant-upgrades), [`sellPayout`](#sellpayout), [`buyCost`](#buycost), [`MERCHANT_BUY_MULTIPLIER`](#merchant-buy-multiplier), [`merchantUpgradeCost`](#merchantupgradecost), [`generateMerchantStock`](#generatemerchantstock), [`shopPriceOf`](#shoppriceof), [`refreshCost`](#refreshcost), [`bestWornGrade`](#bestworngrade)
- Clicks: [`CLICK_LADDER`](#click-ladder), [`CLICK_LIMIT`](#click-limit), [`clickGold`](#clickgold), [`createClickLimiter`](#createclicklimiter)
- Chests and Luck: [`CHEST`](#chest), [`LUCK`](#luck), [`chestIntervalSec`](#chestintervalsec), [`chestSpots`](#chestspots), [`rewardWeights`](#rewardweights), [`rollChestLoot`](#rollchestloot), [`gemChance`](#gemchance), [`rarityLuckMultiplier`](#rarityluckmultiplier), [`dropChanceMultiplier`](#dropchancemultiplier), [`goldenMonsterChance`](#goldenmonsterchance)
- Crafting: [`TRADE_GOODS`](#trade-goods), [`GEAR_RECIPES`](#gear-recipes)
- Buildings: [`BUILDINGS_FLAG`](#buildings-flag), [`BUILDING_RULES`](#building-rules), [`BUILDINGS`](#buildings), [`producerOutput`](#produceroutput), [`extractorOutput`](#extractoroutput), [`buildingUpgradeDuration`](#buildingupgradeduration), [`buildingLevelCost`](#buildinglevelcost)
- Perk caps: [`PERK_CAPS`](#perk-caps), [`LEGENDARY_PERK_TIERS`](#legendary-perk-tiers), [`WEAPON_LEGENDARY_DAMAGE_TOP`](#weapon-legendary-damage-top), [`capPerks`](#capperks), [`aggregateStats`](#aggregatestats)

## Basics

<a id="tick-rate"></a>

### Basics: tick, caps, start

Source: [`src/config/economy.ts:22`](../../src/config/economy.ts)

Game constants the economy runs on: the tick, the caps, the start.

What the game does is read from the code; every number below is computed from the config. Where a doc and the code disagree, the code wins.

- The browser ticks every 100 ms and one tick never advances the game by more than 300 s ([`MAX_CATCHUP_SEC`](economy.md#max-catchup-sec)), so a throttled tab catches up in 5-minute steps
  and a changed system clock can neither skip nor reverse time. Away time is not computed here but claimed from the server (see [`computeOfflineGrant`](saves-and-server.md#computeofflinegrant)).
- Every stockpile, XP included, stops at [`RESOURCE_CAP`](economy.md#resource-cap); a save above it is treated as tampered.
- Gems and Embers are not part of the `Resources` record: gems are the server's balance (see [`STARTING_GEMS`](progression.md#starting-gems)), Embers live in the prestige state (see [`REBIRTH`](progression.md#rebirth)).

**Basics** _(computed from the code)_

| Thing | Value | Source |
| --- | --- | --- |
| Game tick | 100 ms; one tick never advances more than 300 s | `TICK_RATE`, `MAX_CATCHUP_SEC` |
| Stockpile cap (every resource and XP) | 1e+21 | `RESOURCE_CAP`, `XP_CAP` |
| Start | gold 125, 1,000 gems (gem cap 1e+9) | `INITIAL_RESOURCES`, `STARTING_GEMS` |
| Income with nothing built | gold 0.1, xp 0.25 per second | `BASE_GENERATION_RATES` |
| Castle position | (25, 25) | `CASTLE_X`, `CASTLE_Y` |
| Map size | unbounded; coordinates within +-16 K, at most 250 K owned tiles | `COORD_LIMIT`, `MAX_OWNED_TILES` |
| Resource tiers | Currency: gold, gems, embers; Base materials: wood, stone, coal, food, meat; Farm products: eggs, milk, hide; Biome goods: none yet; Extracts: herbs, sap, ironOre, spores, frostshard, pearls, salt; Relics: none yet | `RESOURCE_TIERS` |

See also: [`MAX_CATCHUP_SEC`](economy.md#max-catchup-sec), [`RESOURCE_CAP`](economy.md#resource-cap), [`BASE_GENERATION_RATES`](economy.md#base-generation-rates), [`INITIAL_RESOURCES`](economy.md#initial-resources)

<a id="max-catchup-sec"></a>

### `MAX_CATCHUP_SEC` <small>const</small>

Source: [`src/config/economy.ts:35`](../../src/config/economy.ts)

A tick never advances the game by more than this many seconds (device sleep, clock edits).

See also: [`TICK_RATE`](economy.md#tick-rate)

<a id="resource-cap"></a>

### `RESOURCE_CAP` <small>const</small>

Source: [`src/config/economy.ts:43`](../../src/config/economy.ts)

The most any stockpile (XP included) can hold; a save above it is refused by `sanitizeSave`. Raised to 1e21 so a map of tens of thousands of tiles stays buyable.

<a id="initial-resources"></a>

### `INITIAL_RESOURCES` <small>const</small>

Source: [`src/config/economy.ts:148`](../../src/config/economy.ts)

What a new game starts with: 125 gold (and [`STARTING_GEMS`](progression.md#starting-gems) gems).

## Income

<a id="calculateresourcebreakdown"></a>

### `calculateResourceBreakdown` <small>function</small>

Source: [`src/utils/game/income.ts:127`](../../src/utils/game/income.ts)

Income per second of every resource, split into its sources and modifiers (the one place the income formula lives).

The one function that builds the income. Every number the UI shows as "per second" (header, tooltips, the tick) comes from here.

Everything inside the first bracket is added, the three multipliers after it are multiplied. The meat and hide of the farm are multiplied by the merchant's
Skinner before they enter `base`. The castle tile itself gets no yield scale and no neighbour bonus.

- `plainsMod`: +5% meat per owned Plains tile (`CHARACTER_STAT_CONFIG.plainsMeatModifier`).
- `statMod`: +2.5% per attribute point on the resources each attribute feeds, and +0.2% / +0.25% XP per Intelligence / Charisma point, see [`calculateStatResourceModifiers`](progression.md#calculatestatresourcemodifiers).
- `emberMult`: see [`emberIncomeBonus`](progression.md#emberincomebonus).
- `foreman`: the merchant upgrade, +1% per level on every resource but XP. `gearIncome`: the set bonus Income %, on every resource but XP (`src/lib/gearEconomy.ts`).

**Formula**

```text
base[r]  = BASE_GENERATION_RATES[r]
         + farm output (meat, eggs, milk, hide; the farm has no other source of those four)
         + sum over owned tiles of biome output[r] x BIOME_YIELD.scale x (1 + 0.25 x same-biome 4-neighbours)
         + sum over tiles inside the castle range of the same tile output x castleAreaBonus(castle level)
         + 0.5 x (castle level - 1)                      (xp only)
modifier[r] = (1 + castleModifier + plainsMod[r] + statMod[r]) x emberMult x foreman x gearIncome - 1
total[r] = base[r] x (1 + modifier[r])
         + sum over Producers and Extractors (buildings flag on) of {@link buildingOutput}   (counted with the biome tiles)
```

See also: [`calculateTileOutput`](economy.md#calculatetileoutput), [`castleModifier`](economy.md#castlemodifier), [`castleAreaBonus`](economy.md#castleareabonus), [`calculateFarmOutput`](economy.md#calculatefarmoutput)

<a id="calculatetileoutput"></a>

### `calculateTileOutput` <small>function</small>

Source: [`src/utils/game/income.ts:80`](../../src/utils/game/income.ts)

The one place a single tile's output is priced; the tooltip, the tile tap and the castle area pass of the income all use it.

Neighbour bonus: +25% per same-biome 4-neighbour (`SCALING_CONFIG.adjacencyBonus`). A tile inside the castle range also gets the castle area bonus ([`castleAreaBonus`](economy.md#castleareabonus)).

<a id="biome-yield"></a>

### `BIOME_YIELD` <small>const</small>

Source: [`src/config/economy.ts:141`](../../src/config/economy.ts)

Biome and building output is multiplied by `scale` (1.3). The castle tile's own output and the base rates are not scaled.

See also: [`calculateTileOutput`](economy.md#calculatetileoutput)

<a id="base-generation-rates"></a>

### `BASE_GENERATION_RATES` <small>const</small>

Source: [`src/config/economy.ts:158`](../../src/config/economy.ts)

Income of the realm itself, per second, before any tile: gold 0.1 and XP 0.25. Meat, eggs, milk and hide are 0 here: they come from the farm alone.

See also: [`calculateResourceBreakdown`](economy.md#calculateresourcebreakdown)

## Tiles

<a id="tileprice"></a>

### `tilePrice` <small>function</small>

Source: [`src/config/economy.ts:106`](../../src/config/economy.ts)

Gold price of the next tile when `ownedTiles` are owned, before discounts: the three exponential stages of SCALING_CONFIG
up to TILE_PRICE.tailFrom, then the polynomial tail, never above TILE_PRICE.ceiling. Always finite.

Buying a tile: a tile can be bought when it touches an owned tile on one of its four sides and the whole bundle is paid.

The count that feeds every price is the **economy count** ([`economyTiles`](economy.md#economytiles)). A new game owns the castle and the four tiles N/E/S/W, so the first purchase is "tile 1".
The constants are `BASE_TILE_COST` 55, the three stages in `SCALING_CONFIG` (1.13 to 15 tiles, 1.07 to 100, 1.007 to `TILE_PRICE.tailFrom` 300) and
`TILE_PRICE.tailExponent` 3.5. The extra resources a purchase asks for are in [`TILE_RESOURCE_COST`](economy.md#tile-resource-cost); discounts in [`calculateTileCost`](economy.md#calculatetilecost).

**Formula**

```text
m        = min(n, 300)
price(n) = floor(min(55 x 1.13^min(m,15) x 1.07^max(min(m,100)-15, 0) x 1.007^max(m-100, 0) x (n/300)^3.5 [only if n > 300], ceiling))
ceiling  = RESOURCE_CAP / 100
```

**Gold price of the next tile (before any discount) and cumulative gold** _(computed from the code)_

| Tiles owned (n) | price(n) | Cumulative gold for the first n tiles |
| --- | --- | --- |
| 1 | 62 |  |
| 10 | 186 |  |
| 20 | 482 |  |
| 50 | 3,672 |  |
| 100 | 108 K | 1.65 M |
| 200 | 217 K | 17.4 M |
| 300 | 437 K | 48.9 M |
| 400 | 1.19 M | 126 M |
| 500 | 2.61 M | 311 M |
| 1000 | 29.5 M |  |

See also: [`calculateTileCost`](economy.md#calculatetilecost), [`TILE_RESOURCE_COST`](economy.md#tile-resource-cost), [`economyTiles`](economy.md#economytiles)

<a id="tile-resource-cost"></a>

### `TILE_RESOURCE_COST` <small>const</small>

Source: [`src/config/economy.ts:126`](../../src/config/economy.ts)

Extra resources a tile purchase costs: from the tile count shown, the price also asks for a share of the gold price. Hide is the late one, because milk and eggs are kept for other uses.

**Extra resources per tile purchase (share of the gold price)** _(computed from the code)_

| From tile | Resource | Share of the gold price |
| --- | --- | --- |
| 15 | wood | 30% |
| 15 | stone | 20% |
| 30 | coal | 20% |
| 40 | food | 10% |
| 100 | hide | 2% |

<a id="calculatetilecost"></a>

### `calculateTileCost` <small>function</small>

Source: [`src/utils/game/costs.ts:14`](../../src/utils/game/costs.ts)

Everything buying the next tile costs, given how many tiles are owned and the Charisma discount (percent).

`discountPercent` removes that percent from the gold and from every extra part ([`effectiveTileDiscount`](economy.md#effectivetilediscount) computes it).

See also: [`tilePrice`](economy.md#tileprice), [`effectiveTileDiscount`](economy.md#effectivetilediscount), [`TILE_RESOURCE_COST`](economy.md#tile-resource-cost)

<a id="effectivetilediscount"></a>

### `effectiveTileDiscount` <small>function</small>

Source: [`src/utils/game/rebirth.ts:64`](../../src/utils/game/rebirth.ts)

Percent off tile cost: Charisma plus Thrift, capped.

The tile discount in percent: Charisma (0.5% per point, at most 25%) + Thrift (2% per level, Ember shop) + Bulk Discount (1% per level, merchant) + the Warrior's class passive (3 points), capped at 45% (`REBIRTH.discountCapPercent`).
Buildings take Thrift only.

**Formula**

```text
discount% = min(45, min(25, 0.5 x Charisma) + 2 x Thrift level + 1 x Bulk Discount level + class tile discount)
```

<a id="calculatexpgain"></a>

### `calculateXpGain` <small>function</small>

Source: [`src/utils/game/character.ts:85`](../../src/utils/game/character.ts)

Calculate XP gain scaling based on owned tiles
The more tiles owned, the more XP gained

XP a tile purchase gives, for the `k`-th purchase (`BASE_XP_PER_TILE` 45, `XP_TILE` in `src/config/economy.ts`); multiplied by `1 + XP gain %` of the character.
Tile XP is small on purpose: levels come from passive XP, kills and rebirth-paced play, see [`LEVELING`](progression.md#leveling).

**Formula**

```text
xp(k) = 45 x 1.02^(min(k,300) - 1) x min(k,300) / 4        times (k / 300)^1.5 beyond 300
```

<a id="economytiles"></a>

### `economyTiles` <small>function</small>

Source: [`src/utils/game/tiles.ts:28`](../../src/utils/game/tiles.ts)

Owned-tile count as the economy sees it: purchases + 1 (the old castle-only start). Tile cost, XP per tile, the extra
resource costs, the biome picker cadence and the rebirth requirements all use this, so the free starting tiles do not
make the first purchases expensive. Pass the state's `freeTiles`.

**Formula**

```text
economyTiles = owned tiles - freeTiles + 1       (freeTiles = STARTER_FREE_TILES = 5 in a new game)
```

## Biomes

<a id="rollbiome"></a>

### `rollBiome` <small>function</small>

Source: [`src/utils/biomeRules.ts:129`](../../src/utils/biomeRules.ts)

The biome of a random purchase on (x, y): first a chance to continue an adjoining area (stronger with every extra
same-biome neighbour), otherwise a weighted roll among everything the rules allow. Water still pulls water and shore
(BIOME_SPAWN). Always returns an allowed biome (plains is never blocked).

Which biome a purchase becomes is **rolled when you buy; there is no picker**. Rules and numbers are `BIOME_RULES` in `src/config/biomeRules.ts` and `BIOME_SPAWN` in `src/config/biomes.ts`.

- Plains, forest, hills and lake from the start; swamp after 6 purchases, tundra after 10; coast only beside a lake or coast.
- The rebirth biomes need completed rebirths (`BIOME_RULES.unlockAfterRebirths`): jungle after 1, fields 2, blossom orchard 3, blight 4, battlefield 5. `rebirths` is `prestige.rebirths`;
  below it the biome is never allowed, so it can neither be rolled nor copied from a neighbour.
- Never adjacent (8 neighbours): tundra-swamp, tundra-coast, hills-coast, blight-lake, blight-coast, blight-orchard, battlefield-swamp, jungle-tundra. Plains is neutral.
- Clustering: a base chance to copy a neighbouring biome (forest 60, hills 55, lake 50, swamp 55, tundra 65, plains 45, coast 40, jungle 55, fields 55, orchard 55, blight 60, battlefield 55)
  plus 10 per extra same-biome 4-neighbour, capped at 90%; a lone tile joins a neighbour with `buddyPct` 100.
- Otherwise a weighted roll: every biome 1, coast 0.6, lake and coast likelier beside water.
- The start ring (the four free tiles) is plains and forest only, at least two plains ([`generateStartRing`](economy.md#generatestartring)).

<a id="biomes"></a>

### `BIOMES` <small>const</small>

Source: [`src/config/biomes.ts:53`](../../src/config/biomes.ts)

Every biome with its config output per second. Multiply by `BIOME_YIELD.scale` (1.3) for what a tile really makes; the castle is not scaled.

**Config output per second (x BIOME_YIELD.scale for a real tile)** _(computed from the code)_

| Biome | Config output / s |
| --- | --- |
| Castle | gold 0.1, wood 0.05, stone 0.1, food 0.05, xp 0.5 (not scaled) |
| Forest | gold 0.1, wood 0.3 |
| Plains | gold 0.1, food 0.3 |
| Hills | gold 0.05, stone 0.3, coal 0.2 |
| Swamp | food 0.1, wood 0.2 |
| Tundra | gold 0.1, coal 0.35 |
| Lake | gold 0.05, food 0.25 |
| Coast | gold 0.1, food 0.2 |
| Jungle | gold 0.15, wood 0.45 |
| Fields | gold 0.16, food 0.48 |
| Blossom Orchard | gold 0.175, food 0.35, wood 0.175 |
| Blight | gold 0.19, coal 0.665 |
| Battlefield | stone 0.6, wood 0.4 |
| (scale) | x1.3 |

<a id="rebirth-biome-output"></a>

### `REBIRTH_BIOME_OUTPUT` <small>const</small>

Source: [`src/config/biomes.ts:32`](../../src/config/biomes.ts)

Output of the five rebirth biomes (unlocked one per rebirth, `BIOME_RULES.unlockAfterRebirths`): a **flat multiple of a basic tile's output**, existing resources only. `base` is the
output of the basic tile it is measured against (per second, before `BIOME_YIELD.scale`); `multiplier` rises with the rebirth that unlocks it, from x1.5 (jungle) to x2
(battlefield). No new resource types: T2 materials, monsters and buildings for these biomes come after the release. Pinned by tests/economy/rebirthBiomes.test.ts.

**Rebirth biomes: unlock and output per second (x BIOME_YIELD.scale for a real tile)** _(computed from the code)_

| Biome | Unlocks after rebirth | Measured against | Multiplier | Config output / s |
| --- | --- | --- | --- | --- |
| Jungle | 1 | forest | x1.5 | gold 0.15, wood 0.45 |
| Fields | 2 | plains | x1.6 | gold 0.16, food 0.48 |
| Blossom Orchard | 3 | a plains and forest mix | x1.75 | gold 0.175, food 0.35, wood 0.175 |
| Blight | 4 | tundra | x1.9 | gold 0.19, coal 0.665 |
| Battlefield | 5 | hills (stone) and swamp (wood) | x2 | stone 0.6, wood 0.4 |

<a id="generatestartring"></a>

### `generateStartRing` <small>function</small>

Source: [`src/utils/biomeRules.ts:189`](../../src/utils/biomeRules.ts)

The castle's four starting neighbours for a new game: the basic biomes (plains most), always at least `minPlains`
plains and never more than `maxOfOther` of any other biome. Retries with the same random source until it fits.

## Castle

<a id="castle-upgrade"></a>

### `CASTLE_UPGRADE` <small>const</small>

Source: [`src/config/castle.ts:62`](../../src/config/castle.ts)

The castle: levels 1-10. An upgrade pays its cost up front, then runs a timer counted by the tick (saved, counted while away at full speed). One upgrade at a time.

- **Modifier** added to every resource: see [`castleModifier`](economy.md#castlemodifier). **Flat XP**: +0.5 xp/s per level above 1 (`xpBonus`).
- **Timers** (`durationsSec`), level 1 to 2 first: 30 min, 2 h, 6 h, 12 h, 24 h, 1.5 d, 2 d, 2.5 d, 3.5 d. Master Builders (Ember shop) cuts them 5% per level ([`castleUpgradeDuration`](economy.md#castleupgradeduration)).
- **Costs** per step (`upgradeCosts`): coal appears from 2 to 3, food and meat from 3 to 4. The full per-step table is in `docs/generated/balance-tables.md`.
- **Range** (violet area), **area bonus** and **ward**: [`CASTLE_RANGE`](economy.md#castle-range), [`CASTLE_AREA_BONUS`](economy.md#castle-area-bonus), [`CASTLE_FORTRESS`](economy.md#castle-fortress).

**Castle levels** _(computed from the code)_

| Level | Modifier on every resource | Range | Area bonus | Upgrade to next: time | Upgrade to next: cost |
| --- | --- | --- | --- | --- | --- |
| 1 | +20% | 3x3 | +50% | 30 min | gold 70 K, wood 10 K, stone 10 K |
| 2 | +40% | 3x3 | +50% | 2 h | gold 200 K, wood 30 K, stone 30 K, coal 20 K |
| 3 | +80% | 3x3 | +50% | 6 h | gold 1 M, wood 100 K, stone 100 K, coal 50 K, food 200 K, meat 40 K |
| 4 | +160% | 3x3 | +50% | 12 h | gold 4 M, wood 400 K, stone 400 K, coal 200 K, food 2 M, meat 100 K |
| 5 | +320% | 3x3 | +50% | 1 d | gold 8 M, wood 2 M, stone 2 M, coal 1 M, food 4 M, meat 500 K |
| 6 | +640% | 3x3 | +50% | 1.5 d | gold 30 M, wood 3 M, stone 3 M, coal 1.6 M, food 16 M, meat 800 K |
| 7 | +960% | 3x3 | +100% | 2 d | gold 48 M, wood 4.8 M, stone 4.8 M, coal 2.6 M, food 25.6 M, meat 1.28 M |
| 8 | +1280% | 5x5 | +200% | 2.5 d | gold 76.8 M, wood 7.6 M, stone 7.6 M, coal 4 M, food 41 M, meat 2 M |
| 9 | +1600% | 7x7 | +300% | 3.5 d | gold 123 M, wood 12.2 M, stone 12.2 M, coal 6.6 M, food 65.6 M, meat 3.2 M |
| 10 | +1920% | 9x9 | +400% | - | - |

See also: [`castleModifier`](economy.md#castlemodifier), [`castleUpgradeDuration`](economy.md#castleupgradeduration)

<a id="castlemodifier"></a>

### `castleModifier` <small>function</small>

Source: [`src/utils/game/castle.ts:16`](../../src/utils/game/castle.ts)

Bonus (as a fraction) the castle adds to the modifier of every resource: +20% at level 1, doubling each
level up to `doublingUntil`, then a fixed step per level (so levels 7-10 stay a long climb, not an explosion).

**Formula**

```text
castleModifier(L) = 0.2 x 2^(L-1)                 for L <= 6   (+20%, +40%, +80%, +160%, +320%, +640%)
                  = 0.2 x 2^5 + 3.2 x (L - 6)     for L > 6    (+960%, +1280%, +1600%, +1920%)
```

<a id="castleupgradeduration"></a>

### `castleUpgradeDuration` <small>function</small>

Source: [`src/utils/game/castle.ts:34`](../../src/utils/game/castle.ts)

Seconds the castle needs to go from `fromLevel` to `fromLevel + 1`.

**Formula**

```text
seconds = floor(durationsSec[fromLevel - 1] x (1 - 0.05 x Master Builders level))
```

<a id="castle-range"></a>

### `CASTLE_RANGE` <small>const</small>

Source: [`src/config/castle.ts:24`](../../src/config/castle.ts)

The castle range (violet area): radius 1 (3x3) up to level 7; from level 8 it grows one tile per level: 5x5 at 8, 7x7 at 9, 9x9 at 10 ([`castleRangeRadius`](economy.md#castlerangeradius)).

<a id="castle-area-bonus"></a>

### `CASTLE_AREA_BONUS` <small>const</small>

Source: [`src/config/castle.ts:36`](../../src/config/castle.ts)

Area bonus: tiles in range (and their buildings) make extra output, +50% below level 7; from level 7 it is +100% per tile of range radius: +100% (7), +200% (8), +300% (9), +400% (10)
([`castleAreaBonus`](economy.md#castleareabonus)). It is part of the base income, so the modifiers apply on top.

<a id="castle-fortress"></a>

### `CASTLE_FORTRESS` <small>const</small>

Source: [`src/config/castle.ts:46`](../../src/config/castle.ts)

The ward: from castle level 7 the 3x3 around the castle is a walled fortress, no monsters or chests spawn there and monsters standing in it are driven out (`isInWard`, `wardTiles`).

<a id="castlerangeradius"></a>

### `castleRangeRadius` <small>function</small>

Source: [`src/lib/castleWard.ts:22`](../../src/lib/castleWard.ts)

How far (tiles, every side) the violet range area reaches: 1 (3x3) up to level 7, then one more tile per level (5x5 at 8, 9x9 at 10).

Used by the income (the area bonus pass), the castle range overlay and the save checks.

**Formula**

```text
radius = 1 + max(0, level - 8 + 1) x 1          level 1-7: 1 (3x3), 8: 2 (5x5), 9: 3 (7x7), 10: 4 (9x9)
```

<a id="castleareabonus"></a>

### `castleAreaBonus` <small>function</small>

Source: [`src/lib/castleWard.ts:41`](../../src/lib/castleWard.ts)

The extra output (as a fraction: 1 = +100%) every tile inside the castle range gets: +50% below level 7 (no walls), then one step per tile of range.

**Formula**

```text
bonus = 0.5                      castle level < 7
      = radius(level) x 1        castle level >= 7        (+100% at 7, +200% at 8, +300% at 9, +400% at 10)
```

## Farm

<a id="animals"></a>

### `ANIMALS` <small>const</small>

Source: [`src/config/farm.ts:17`](../../src/config/farm.ts)

The farm: animals are bought with food. The N-th animal of a kind costs `floor(baseCost x costScaling^owned)` ([`calculateAnimalCost`](economy.md#calculateanimalcost)); a pen holds 12 per kind (`FARM.baseCap`), +4 per Pen Expansion level.

**Animals (the pen holds 12 per kind)** _(computed from the code)_

| Animal | First cost (food) | Cost x per animal | Meat / s each | Product / s each |
| --- | --- | --- | --- | --- |
| Chicken | 1,000 | 1.3 | 0.2 | eggs 0.03 |
| Deer | 10 K | 1.33 | 0.5 | hide 0.075 |
| Pig | 60 K | 1.36 | 1 | hide 0.15 |
| Cow | 400 K | 1.4 | 2 | milk 0.225 |

<a id="animaloutput"></a>

### `animalOutput` <small>function</small>

Source: [`src/utils/game/farm.ts:59`](../../src/utils/game/farm.ts)

Output of `count` animals of one kind (every purchase adds one more animal).

Output of N animals of one kind. Meat uses Feed Trough, the products use their own upgrade and Pasture.

**Formula**

```text
meat    = baseProduction x N x (1 + 0.02 x pen level) x (1 + 0.05 x feed trough level)
product = perSec x N x (1 + 0.02 x pen level) x (1 + coop | dairy | tannery effect) x (1 + 0.08 x pasture level)
```

<a id="farm-upgrades"></a>

### `FARM_UPGRADES` <small>const</small>

Source: [`src/config/farm.ts:81`](../../src/config/farm.ts)

Farm upgrades: the cost of level N+1 is `ceil(base x growth^N)` per resource ([`farmUpgradeCost`](economy.md#farmupgradecost)). Pen Expansion adds +2% farm output and +4 animals per kind (8 levels, growth 1.9);
the others have 10 levels and growth 1.6.

**Farm upgrades** _(computed from the code)_

| Upgrade | Effect (1 level) | Max level | Base cost (level 1) | Growth |
| --- | --- | --- | --- | --- |
| Feed Trough | +5% meat | 10 | food 2,000 | 1.6 |
| Hen House | +15% eggs | 10 | wood 1,500, eggs 40 | 1.6 |
| Dairy | +15% milk | 10 | stone 1,500, milk 30 | 1.6 |
| Tannery | +25% hide | 10 | coal 1,200, hide 20 | 1.6 |
| Pasture | +8% eggs, milk and hide | 10 | food 5,000, wood 2,500 | 1.6 |
| Pen Expansion | +2% farm output, +4 animals per kind | 8 | food 8,000, wood 3,000, stone 3,000 | 1.9 |

<a id="calculateanimalcost"></a>

### `calculateAnimalCost` <small>function</small>

Source: [`src/utils/game/farm.ts:14`](../../src/utils/game/farm.ts)

Food cost of the next animal of a kind when `level` of them are owned: `floor(baseCost x costScaling^level)`.

**Formula**

```text
cost = floor(baseCost x costScaling^owned)
```

<a id="farmupgradecost"></a>

### `farmUpgradeCost` <small>function</small>

Source: [`src/utils/game/farm.ts:34`](../../src/utils/game/farm.ts)

Cost of the next level of a farm upgrade, given its current level (one entry per resource).

**Formula**

```text
cost[r] = ceil(base[r] x growth^level)          per resource of the upgrade
```

<a id="calculatefarmoutput"></a>

### `calculateFarmOutput` <small>function</small>

Source: [`src/utils/game/farm.ts:79`](../../src/utils/game/farm.ts)

The whole farm's output per second: the sum of [`animalOutput`](economy.md#animaloutput) over the animal kinds. The merchant's Skinner multiplies meat and hide afterwards ([`calculateResourceBreakdown`](economy.md#calculateresourcebreakdown)).

## Merchant

<a id="merchant-resource-prices"></a>

### `MERCHANT_RESOURCE_PRICES` <small>const</small>

Source: [`src/config/merchant.ts:18`](../../src/config/merchant.ts)

The merchant buys resources at these gold prices per unit. Payout is `floor(units x price x (1 + 0.03 x Haggler))` ([`sellPayout`](economy.md#sellpayout)).
Wood, stone, coal, food and meat can be bought at 2x the sell price, rounded up ([`MERCHANT_BUY_MULTIPLIER`](economy.md#merchant-buy-multiplier), [`buyCost`](economy.md#buycost)); farm products are never sold to the player.

**Merchant prices (gold per unit)** _(computed from the code)_

| Resource | Sell price | Buy price |
| --- | --- | --- |
| wood | 0.75 | 2 |
| stone | 0.9 | 2 |
| coal | 1.1 | 3 |
| food | 0.4 | 1 |
| meat | 1 | 2 |
| eggs | 2 | not sold |
| milk | 3 | not sold |
| hide | 2 | not sold |

<a id="merchant-goods"></a>

### `MERCHANT_GOODS` <small>const</small>

Source: [`src/config/merchant.ts:193`](../../src/config/merchant.ts)

The goods shelf and its refresh rules ([`generateMerchantStock`](economy.md#generatemerchantstock)). Potions are always in stock at their catalog `shop` price (`MERCHANT_SHOP_ITEMS`).

- **Shelf**: 6 pieces of gear (`LIMITS.merchantOffers`) from the loot source `merchant` (common 60 / uncommon 40, see [`generateLoot`](loot.md#generateloot)), item level centred at most 3 above the average worn item
  level and never more than 5 above it, otherwise built from the castle level (4 + 3 per castle level above 1). Price is `ceil(sell value x 5)` ([`shopPriceOf`](economy.md#shoppriceof)). Reshuffled every 1,800 s of play time.
- **Refresh**: 3 free per 12 h of play time (`windowSec` 43,200), 30 s between any two, then the paid price `10,000 x 2^(paid refreshes)` capped at 1e9 ([`refreshCost`](economy.md#refreshcost)).
  The count is never reset, not even by a rebirth.
- **Item sale value**: see [`sellValueOf`](loot.md#sellvalueof).

<a id="merchant-upgrades"></a>

### `MERCHANT_UPGRADES` <small>const</small>

Source: [`src/config/merchant.ts:43`](../../src/config/merchant.ts)

Merchant upgrades are bought with gold; the cost of level N+1 is `ceil(baseCost x growth^N)` ([`merchantUpgradeCost`](economy.md#merchantupgradecost)). All but Pack Rat start again on a rebirth.

**Merchant upgrades** _(computed from the code)_

| Id (label) | Group | Per level | Max | Base cost | Growth |
| --- | --- | --- | --- | --- | --- |
| haggler (Haggler) | Economy | +3% gold from everything you sell | 10 | 100 K | 1.9 |
| bulk (Bulk Discount) | Economy | -1% tile cost | 8 | 250 K | 2.1 |
| charm (Lucky Charm) | Economy | +2 Luck for chests and kills | 10 | 150 K | 1.9 |
| packrat (Pack Rat) | Economy | +8 bag slots | 6 | 500 K | 3 |
| foreman (Foreman) | Economy | +1% income from every resource, gold included | 10 | 400 K | 1.9 |
| skinner (Skinner) | Economy | +5% meat and hide from your animals | 8 | 300 K | 1.9 |
| swift (Quick Hands) | Combat | +2% attack speed | 8 | 250 K | 1.9 |
| keen (Keen Eye) | Combat | +1% crit chance | 8 | 250 K | 1.9 |
| deadly (Deadly Aim) | Combat | +1% chance that a crit is a super crit | 8 | 250 K | 1.9 |
| might (Might) | Combat | +2% damage with physical weapons | 8 | 250 K | 1.9 |
| arcana (Arcana) | Combat | +2% damage with staves and wands | 8 | 250 K | 2 |
| fang (Vampiric Fang) | Combat | +0.5% life leech: HP back from the damage you deal | 6 | 300 K | 2 |
| wind (Second Wind) | Combat | +0.25 HP regenerated per second | 6 | 300 K | 2 |
| tithe (Ancestral Tithe) | Rebirth | +5% Embers from your next rebirth | 10 | 600 K | 1.9 |

<a id="sellpayout"></a>

### `sellPayout` <small>function</small>

Source: [`src/utils/game/merchant.ts:51`](../../src/utils/game/merchant.ts)

Gold for selling `qty` of something worth `unit` each.

**Formula**

```text
payout = floor(units x unit price x (1 + 0.03 x Haggler level))
```

See also: `sellMultiplier (src/utils/game/merchant.ts)`

<a id="buycost"></a>

### `buyCost` <small>function</small>

Source: [`src/utils/game/merchant.ts:61`](../../src/utils/game/merchant.ts)

Gold for buying `units` of a resource from the merchant: twice the selling price, rounded up in the merchant's favour (the store and the Resources tab use this).

**Formula**

```text
cost = ceil(units x sell price x 2)
```

<a id="merchant-buy-multiplier"></a>

### `MERCHANT_BUY_MULTIPLIER` <small>const</small>

Source: [`src/config/merchant.ts:221`](../../src/config/merchant.ts)

The merchant sells wood, stone, coal, food and meat at this multiple of the price it pays (so buying and selling can never print gold).

<a id="merchantupgradecost"></a>

### `merchantUpgradeCost` <small>function</small>

Source: [`src/utils/game/merchant.ts:23`](../../src/utils/game/merchant.ts)

Gold price of the next level of a merchant upgrade.

**Formula**

```text
cost of level N+1 = ceil(baseCost x growth^N)
```

<a id="generatemerchantstock"></a>

### `generateMerchantStock` <small>function</small>

Source: [`src/lib/merchant.ts:90`](../../src/lib/merchant.ts)

A new shelf of goods, rolled at the world (castle) level and the player's gear, and stamped with the play time it was made.
`grade` is the best grade the player wears (`bestWornGrade`): nothing above it is on the shelf. Pure, so the server can take it as is.

See also: [`bestWornGrade`](economy.md#bestworngrade), [`shopPriceOf`](economy.md#shoppriceof), [`MERCHANT_GOODS`](economy.md#merchant-goods)

<a id="shoppriceof"></a>

### `shopPriceOf` <small>function</small>

Source: [`src/lib/merchant.ts:22`](../../src/lib/merchant.ts)

What a piece of gear costs at the merchant: far above what he pays for it, so buying and selling can never print gold.

**Formula**

```text
shelf price = ceil(sellValueOf(item) x 5)
```

<a id="refreshcost"></a>

### `refreshCost` <small>function</small>

Source: [`src/lib/merchant.ts:32`](../../src/lib/merchant.ts)

The gold the next paid refresh costs, when `refreshesBought` have been bought: it doubles each time, up to a cap of 1b.

**Formula**

```text
paid refresh price = min(1e9, 10,000 x 2^(paid refreshes so far))
```

<a id="bestworngrade"></a>

### `bestWornGrade` <small>function</small>

Source: [`src/lib/merchant.ts:61`](../../src/lib/merchant.ts)

The best ladder grade the player wears (G1 with nothing worn, or only pieces outside the ladder). The shelf never sells above it:
the next grade stays a reward for fights and chests until the player has worn the one before it (IDL-48).

## Clicks

<a id="click-ladder"></a>

### `CLICK_LADDER` <small>const</small>

Source: [`src/config/economy.ts:170`](../../src/config/economy.ts)

Clicking: a trusted click on the map pays `max(gold/s x power, floor) x multiplier` ([`clickGold`](economy.md#clickgold)). The multiplier is Click Mastery (+25% gold per Ember shop level) and the set's Click Gold %.
The ladder is bought from the merchant. Clicking a tile or building pays nothing else.

**Click ladder** _(computed from the code)_

| Level | Power (x gold/s) | Floor (gold) | Price (gold, merchant) |
| --- | --- | --- | --- |
| 0 | 2 | 2 | free |
| 1 | 4 | 6 | 750 K |
| 2 | 8 | 20 | 2.5 M |
| 3 | 15 | 60 | 10 M |

<a id="click-limit"></a>

### `CLICK_LIMIT` <small>const</small>

Source: [`src/config/economy.ts:203`](../../src/config/economy.ts)

The click rate limit: two token buckets, a click needs a token from both. Burst: 8 clicks refilling 5 per second; stamina: 20,000 clicks refilling 1.5 per second (about 130K paid clicks a day,
so an auto-clicker is no better than a very dedicated human). Script-dispatched clicks do not pay (`requireTrusted`). Implementation: [`createClickLimiter`](economy.md#createclicklimiter).

<a id="clickgold"></a>

### `clickGold` <small>function</small>

Source: [`src/config/economy.ts:186`](../../src/config/economy.ts)

Gold of one click at a ladder level: gold/s x power (at least the level's floor), then the multipliers (Click Mastery, set bonus).

**Formula**

```text
gold per click = max(gold/s x power, floor) x multiplier        power and floor from CLICK_LADDER[click level]
```

See also: [`CLICK_LADDER`](economy.md#click-ladder)

<a id="createclicklimiter"></a>

### `createClickLimiter` <small>function</small>

Source: [`src/lib/clickLimiter.ts:35`](../../src/lib/clickLimiter.ts)

Creates the click rate limiter: two token buckets (burst and stamina, see [`CLICK_LIMIT`](economy.md#click-limit)); a click is paid only if it can take a token from both. The click's event id makes one physical click cost one token.

## Chests and Luck

<a id="chest"></a>

### `CHEST` <small>const</small>

Source: [`src/config/spawns.ts:34`](../../src/config/spawns.ts)

Chests. The server mints and places them (see [`ticketCap`](monsters.md#ticketcap) and [`advanceBank`](monsters.md#advancebank)); data is `CHEST`, `LUCK` and `SPAWN_LIMIT` in `src/config/spawns.ts`, rolls are in `src/lib/chests.ts` and `src/lib/luck.ts`.

- **Timer**: one chest ticket every 600 s of server time, faster with Luck ([`chestIntervalSec`](economy.md#chestintervalsec)).
- **Room**: monsters and chests together never exceed 30% of the free tiles (minimum 2), and at most 40 tickets wait in all, chests, monsters and the boss counted together
  (`ticketCap` on the server, which estimates free land from the owned-tile count; `spawnCap` in the browser, which counts it from the map).
- **Where** (`CHEST.placement`, [`chestSpots`](economy.md#chestspots)): every eligible owned tile weighs 1, +3 if it touches unowned land, +1 per 4 tiles of Chebyshev distance from the castle, x0.3 if another chest is within 2 tiles.
- **What is inside** ([`rewardWeights`](economy.md#rewardweights), [`rollChestLoot`](economy.md#rollchestloot)): relative weights gold 50, bundle 25, xp 12, boost 10, item 8 (`CHEST.rewards`). Each Luck point moves 1% of the gold weight (at most 60%) into boost (80%) and item (20%).
  - gold: `gold/s x U(10..60 min) x (1 + 0.005 x Luck) x (1 + Gold Find %)`; boost is the same x1.5.
  - bundle: 1-2 of wood/stone/coal/food, each 10-30 min of its income, at least 25.
  - xp: 10-30 min of XP income, at least 60.
  - item: one roll of the `chest` loot source (82% gear, else a potion; 1.9% a legendary weapon instead), see [`generateLoot`](loot.md#generateloot).
  - on top of any chest, a gem roll: `min(15%, 3% + 0.06% x Luck)`, 5-50 gems skewed low ([`gemChance`](economy.md#gemchance)).

**Formula**

```text
interval = 600 x max(0.6, 1 / (1 + 0.004 x Luck))       seconds between chest tickets
```

<a id="luck"></a>

### `LUCK` <small>const</small>

Source: [`src/config/spawns.ts:74`](../../src/config/spawns.ts)

Luck = Charisma + Lucky Charm + gear Luck. Other effects (`LUCK`):

- rare-and-better rarity weights x `min(1.6, 1 + 0.004 x Luck)` ([`rarityLuckMultiplier`](economy.md#rarityluckmultiplier));
- monster gear roll chance x `(1 + 0.002 x Luck)` ([`dropChanceMultiplier`](economy.md#dropchancemultiplier));
- golden ("lucky") monster chance `min(10%, 2% + 0.05% x Luck)` ([`goldenMonsterChance`](economy.md#goldenmonsterchance));
- gem find on a chest ([`gemChance`](economy.md#gemchance)).

<a id="chestintervalsec"></a>

### `chestIntervalSec` <small>function</small>

Source: [`src/lib/luck.ts:16`](../../src/lib/luck.ts)

Seconds between two chests: Luck shortens it, never below `LUCK.chestIntervalFloor` of the base.

**Formula**

```text
interval = 600 x max(0.6, 1 / (1 + 0.004 x Luck)) / (1 + class chest speed% / 100)
```

<a id="chestspots"></a>

### `chestSpots` <small>function</small>

Source: [`src/lib/chests.ts:28`](../../src/lib/chests.ts)

The tiles a chest could go on, with their weights. Eligible: owned, not the castle, no chest, no monster (`taken` = "x,y" keys),
outside the castle ward. Weight = 1 + frontier bonus (touches unowned land) + distance from the castle, times a
penalty when another chest is within `nearbyRadius`. So chests lean toward the edge of your land and spread out.

<a id="rewardweights"></a>

### `rewardWeights` <small>function</small>

Source: [`src/lib/chests.ts:90`](../../src/lib/chests.ts)

Relative chances with Luck shifted from plain gold toward the lucky chest and the item.

**Formula**

```text
shift       = min(0.6 x gold weight, gold weight x Luck x 1%)
gold weight -= shift;  boost += 0.8 x shift;  item += 0.2 x shift
```

<a id="rollchestloot"></a>

### `rollChestLoot` <small>function</small>

Source: [`src/lib/chests.ts:107`](../../src/lib/chests.ts)

Rolls the contents of a chest. Gold is "minutes of income", like before; a full bag turns an item into gold.

**Formula**

```text
gold chest  = floor(gold/s x U(10..60 min) x 60 x (1 + 0.005 x Luck) x (1 + Gold Find%))      boost chest: x1.5
```

<a id="gemchance"></a>

### `gemChance` <small>function</small>

Source: [`src/lib/luck.ts:50`](../../src/lib/luck.ts)

Chance (0-1) that a chest also holds gems.

**Formula**

```text
gem chance = min(15%, 3% + 0.06% x Luck)             amount 5-50, skewed to the low end
```

<a id="rarityluckmultiplier"></a>

### `rarityLuckMultiplier` <small>function</small>

Source: [`src/lib/luck.ts:30`](../../src/lib/luck.ts)

What the weight of every rarity above Common/Uncommon is multiplied by (the roll is normalised afterwards, so it moves odds toward rare gear).

**Formula**

```text
multiplier = min(1.6, 1 + 0.004 x Luck)             applies to the weights of rare and better
```

<a id="dropchancemultiplier"></a>

### `dropChanceMultiplier` <small>function</small>

Source: [`src/lib/luck.ts:40`](../../src/lib/luck.ts)

Multiplier on a monster's gear drop chance.

**Formula**

```text
multiplier = 1 + 0.002 x Luck
```

<a id="goldenmonsterchance"></a>

### `goldenMonsterChance` <small>function</small>

Source: [`src/lib/luck.ts:67`](../../src/lib/luck.ts)

Chance (0-1) that a newly arrived rat is a lucky one.

**Formula**

```text
golden monster chance = min(10%, 2% + 0.05% x Luck)
```

## Crafting

<a id="trade-goods"></a>

### `TRADE_GOODS` <small>const</small>

Source: [`src/catalog/recipes.ts:36`](../../src/catalog/recipes.ts)

The trade goods crafting makes (IDL-227): plain bag stacks (`kind: 'consumable'` with no effect) that exist to be sold. They join `ITEM_CATALOG` but not the loot
pools, so nothing drops them. The value is set against the input value at merchant prices (`recipeCostGold`): at most 1.4x, so crafting a good pays a little
better than selling its raw inputs and never turns into the main income (tests/crafting/recipes.test.ts, `npm run craft-sim`).

<a id="gear-recipes"></a>

### `GEAR_RECIPES` <small>const</small>

Source: [`src/catalog/recipes.ts:337`](../../src/catalog/recipes.ts)

The gear recipes (IDL-241): one per grade G1-G4 and slot, 13 slots, 52 recipes. The player picks the grade and the slot; the server rolls the base, rarity and affixes at claim time through the `craft` loot source (rarity by Luck and the
pity counter, quality by Intelligence, item level by the crafting level inside the grade's window; see [`CRAFT_GEAR`](progression.md#craft-gear)). Every gear recipe is timed (`CRAFT_GEAR.timeSec`) and runs in the batch queue.
Adding a grade is one entry in `GEAR_UNLOCK`, `GEAR_GRADE_COST` and `CRAFT_GEAR.timeSec`; adding a slot is one in the tables above.

**Gear recipe costs (gold value of the inputs at merchant prices) and crafting XP** _(computed from the code)_

| Slot | G1 cost / XP | G2 cost / XP | G3 cost / XP | G4 cost / XP |
| --- | --- | --- | --- | --- |
| mainHand | 3,165 / 78 | 27.7 K / 1040 | 284 K / 3250 | 2.03 M / 7800 |
| offHand | 2,760 / 69 | 24.3 K / 920 | 260 K / 2875 | 1.8 M / 6900 |
| head | 2,539 / 63 | 22.5 K / 840 | 234 K / 2625 | 1.67 M / 6300 |
| shoulder | 2,539 / 63 | 22.5 K / 840 | 234 K / 2625 | 1.67 M / 6300 |
| chest | 3,135 / 78 | 27.8 K / 1040 | 289 K / 3250 | 2.09 M / 7800 |
| hands | 2,395 / 60 | 21.3 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| legs | 2,745 / 69 | 24.6 K / 920 | 255 K / 2875 | 1.81 M / 6900 |
| feet | 2,395 / 60 | 21.3 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| neck | 2,425 / 60 | 21.5 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| ring | 2,425 / 60 | 21.5 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| charm | 2,425 / 60 | 21.5 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| cape | 2,395 / 60 | 21.3 K / 800 | 223 K / 2500 | 1.6 M / 6000 |
| belt | 2,395 / 60 | 21.3 K / 800 | 223 K / 2500 | 1.6 M / 6000 |

## Buildings

<a id="buildings-flag"></a>

### `BUILDINGS_FLAG` <small>const</small>

Source: [`src/config/buildings.ts:17`](../../src/config/buildings.ts)

The per-biome building system (R7, IDL-91, IDL-92), behind [`BUILDINGS_FLAG`](economy.md#buildings-flag), which is **ON** (owner decision: live on merge). Switching it off is the rollback: the game, the save format, the server checks and the sim are then byte-identical to a build
that never had this system (`tests/economy/buildingsFlagOff.test.ts` pins it), and saves written with it on still load, minus their buildings.

What is built (Producers and Extractors, the seven home biomes): the build menu of a tile shows the Producer of its biome; **one of each type per map**; a Producer makes `tileEquivalents` tiles' worth of its biome's main materials, grown by
the share of the biome the player owns; **levels 1-5**, a level above 1 gated by the castle level and bought with resources plus a **timer** counted by the tick loop; the castle and the buildings share **one builder** (one timer at a time);
a building can be **moved** for half its cost. Idols (IDL-96), the position bonus and the Ember-shop caps come in later slices (`docs/plan/18-biome-buildings-and-material-tiers.md`).

**Save and server.** A building is two optional fields of a tile's `extra` entry (`building` = catalog id, `bl` = level) and the running upgrade is the optional top-level `buildingUpgrade` (`{ x, y, toLevel, remainingSec }`, like `castleUpgrade`). They are
written and read only while the flag is on; with it off an incoming save that carries them is accepted and they are dropped, so a rollback of the flag never invalidates a save. No `SAVE_SCHEMA` bump. The server derives income from the saved map
with the same [`calculateResourceBreakdown`](economy.md#calculateresourcebreakdown) (so the client only displays), judges the timer from two summaries (`timer_jump` in `verify.ts`) and prices levels in the net-worth floor.

See also: `producerBonus`, [`buildingUpgradeDuration`](economy.md#buildingupgradeduration), `buildingBuildCost`

<a id="building-rules"></a>

### `BUILDING_RULES` <small>const</small>

Source: [`src/config/buildings.ts:33`](../../src/config/buildings.ts)

The numbers of the building system (proposals from docs/plan/18, tuned with the sim; every one is a plain config value).

- `maxLevel`: the base level cap, 5. Level `L` can only be bought while the castle is at least level `L` (`min(5, castle level)`).
- `durationsSec`: the upgrade timers, indexed by the level being left (1 to 2 first): 10 min, 45 min, 3 h, 8 h. Level 1 is built at once.
- `producer`: a level 1 Producer makes `tileEquivalents` (15) tiles' worth of its main materials; each level above 1 adds `levelStep` (+50 %) of that; each owned tile of the Producer's biome adds `perOwnedTile` (+2 %) up to `bonusCap` (+100 %).
- `extractor`: a level 1 Extractor makes `baseRate` (0.3) of its T3 material per second, before the global modifiers; each level above 1 adds `levelStep` (+40 %) of that; it grows with the size of its biome like the Producer (same `perOwnedTile` and `bonusCap`). It has no gold or wood side effects: the material is for crafting and later building upgrades, and the merchant never trades it.
- `cost`: level 1 costs `tilePrices` (14) tile prices at the current tile count (counted to at most `priceTileCap`, 300); every level above multiplies by `levelGrowth` (2). The price is gold, wood and stone like a tile's ([`calculateTileCost`](economy.md#calculatetilecost)).
- `relocateShare`: moving a building costs this share (50 %) of what its current level cost to reach, at today's prices; it is instant and keeps the level.

**Building levels (the building system, flag off)** _(computed from the code)_

| Level | Castle level needed | Output x (of level 1) | Timer to reach it | Cost at 100 tiles |
| --- | --- | --- | --- | --- |
| 1 | 1 | x1 | built at once | wood 454 K, stone 303 K, coal 303 K, food 151 K, hide 30.3 K, gold 1.51 M |
| 2 | 2 | x1.5 | 10 min | wood 909 K, stone 606 K, coal 606 K, food 303 K, hide 60.6 K, gold 3.03 M |
| 3 | 3 | x2 | 45 min | wood 1.82 M, stone 1.21 M, coal 1.21 M, food 606 K, hide 121 K, gold 6.06 M |
| 4 | 4 | x2.5 | 3 h | wood 3.63 M, stone 2.42 M, coal 2.42 M, food 1.21 M, hide 242 K, gold 12.1 M |
| 5 | 5 | x3 | 8 h | wood 7.27 M, stone 4.85 M, coal 4.85 M, food 2.42 M, hide 485 K, gold 24.2 M |

<a id="buildings"></a>

### `BUILDINGS` <small>const</small>

Source: [`src/catalog/buildings.ts:29`](../../src/catalog/buildings.ts)

The Producer and the Extractor of each of the seven home biomes (docs/plan/18 section 3; the five rebirth biomes and their buildings follow with IDL-99). Each makes the resources listed in `produces` at `BUILDING_RULES.producer.tileEquivalents`
tiles' worth, so the land under it decides what it is good at. The sprite is first-pass art from the village pack, one `art` field per building.

**The Producers and Extractors (one of each per home biome, level 1, with 0 and 25 owned tiles of the biome)** _(computed from the code)_

| Building | Biome | Makes per second at 0 biome tiles | at 25 biome tiles |
| --- | --- | --- | --- |
| Granary | Plains | food 5.85, gold 1.95 | food 8.78, gold 2.93 |
| Lumberyard | Forest | wood 5.85, gold 1.95 | wood 8.78, gold 2.93 |
| Quarry | Hills | stone 5.85, coal 3.9, gold 0.975 | stone 8.78, coal 5.85, gold 1.46 |
| Peat Works | Swamp | wood 3.9, food 1.95 | wood 5.85, food 2.93 |
| Coal Pit | Tundra | coal 6.83, gold 1.95 | coal 10.2, gold 2.93 |
| Fishery | Lake | food 4.88, gold 0.975 | food 7.31, gold 1.46 |
| Harbor | Coast | gold 1.95, food 3.9 | gold 2.93, food 5.85 |
| Herb Garden | Plains | herbs 0.3 | herbs 0.45 |
| Sap Tapper | Forest | sap 0.3 | sap 0.45 |
| Deep Mine | Hills | ironOre 0.3 | ironOre 0.45 |
| Spore Cellar | Swamp | spores 0.3 | spores 0.45 |
| Ice Cutter | Tundra | frostshard 0.3 | frostshard 0.45 |
| Pearl Diver | Lake | pearls 0.3 | pearls 0.45 |
| Salt Works | Coast | salt 0.3 | salt 0.45 |

<a id="produceroutput"></a>

### `producerOutput` <small>function</small>

Source: [`src/lib/buildingOutput.ts:20`](../../src/lib/buildingOutput.ts)

What a Producer of level `level` makes per second, before the global modifiers (castle, Embers, ...): its `produces` resources at the biome's tile rate.

**Formula**

```text
output[r] = tileEquivalents x biome tile rate[r] x BIOME_YIELD.scale x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome))
```

See also: [`BUILDING_RULES`](economy.md#building-rules), `producerBonus`

<a id="extractoroutput"></a>

### `extractorOutput` <small>function</small>

Source: [`src/lib/buildingOutput.ts:42`](../../src/lib/buildingOutput.ts)

What an Extractor of level `level` makes per second, before the global modifiers: its T3 material at `extractor.baseRate`, grown by level and by the size of its biome.

**Formula**

```text
output = baseRate x (1 + levelStep x (level - 1)) x (1 + min(bonusCap, perOwnedTile x owned tiles of the biome))
```

See also: [`BUILDING_RULES`](economy.md#building-rules), `producerBonus`

<a id="buildingupgradeduration"></a>

### `buildingUpgradeDuration` <small>function</small>

Source: [`src/lib/buildings.ts:26`](../../src/lib/buildings.ts)

Seconds the next level takes, from `fromLevel` to `fromLevel + 1` (10 min, 45 min, 3 h, 8 h); Master Builders (Ember shop) shortens it like the castle's timer.

**Formula**

```text
seconds = floor(durationsSec[fromLevel - 1] x (1 - 0.05 x Master Builders level))
```

<a id="buildinglevelcost"></a>

### `buildingLevelCost` <small>function</small>

Source: [`src/lib/buildings.ts:37`](../../src/lib/buildings.ts)

The price of reaching `level` (1 = building it): `tilePrices` times the price of the next tile at the current tile count (counted up to `priceTileCap`), times `levelGrowth` per level above 1. Gold, wood and stone like a tile.

**Formula**

```text
cost(level) = floor(tilePrice(min(owned tiles, priceTileCap)) x tilePrices x levelGrowth^(level - 1))   per resource
```

## Perk caps

<a id="perk-caps"></a>

### `PERK_CAPS` <small>const</small>

Source: [`src/catalog/perkCaps.ts:15`](../../src/catalog/perkCaps.ts)

The cap on the gear bucket of each perk family, in percent. Each family is its own `(1 + sum)` bucket; the sum is everything gear gives: item stats, set
bonuses and legendary perks added together BEFORE the cap. Decided by the owner (IDL-149 on 2026-11-07, XP raised to 50 and damage to 50 on 2026-11-09).

**Formula**

```text
bucket = min(cap, sum of gear + set bonus + legendary perks)       multiplier = 1 + bucket / 100
```

**Perk family caps** _(computed from the code)_

| Family | Cap (% of the gear bucket) | Multiplier at the cap |
| --- | --- | --- |
| Income | 50 | x1.50 |
| XP Gain | 50 | x1.50 |
| Kill Rewards | 60 | x1.60 |
| Click Gold | 40 | x1.40 |
| Damage | 50 | x1.50 |

<a id="legendary-perk-tiers"></a>

### `LEGENDARY_PERK_TIERS` <small>const</small>

Source: [`src/catalog/perkCaps.ts:30`](../../src/catalog/perkCaps.ts)

The magnitude of a legendary perk by tier, in percent of its family (IDL-149: 8 / 15 / 25 for every family, damage 4 / 6 / 10). Data for the legendary
roster (IDL-144): no item carries these yet, so nothing reads them in the game today.

**Legendary perk tiers** _(computed from the code)_

| Family | Common | Rare | Top | Top legendaries to fill the cap |
| --- | --- | --- | --- | --- |
| Income | 8 | 15 | 25 | 2 |
| XP Gain | 8 | 15 | 25 | 2 |
| Kill Rewards | 8 | 15 | 25 | 3 |
| Click Gold | 8 | 15 | 25 | 2 |
| Damage | 4 | 6 | 10 | 5 |
| Damage, weapon legendary |  |  | 20 | 3 |

<a id="weapon-legendary-damage-top"></a>

### `WEAPON_LEGENDARY_DAMAGE_TOP` <small>const</small>

Source: [`src/catalog/perkCaps.ts:44`](../../src/catalog/perkCaps.ts)

The top damage tier of a WEAPON legendary: +20 % where every other slot tops out at [`LEGENDARY_PERK_TIERS`](economy.md#legendary-perk-tiers) damage +10 (owner, 2026-11-09: weapon
legendaries are a little overpowered on purpose). With the best set (S3, 13 pieces: 40) it reaches exactly the damage cap of 50. Data for IDL-144.

<a id="capperks"></a>

### `capPerks` <small>const</small>

Source: [`src/catalog/perkCaps.ts:57`](../../src/catalog/perkCaps.ts)

The one function that caps the perk families of a summed gear block. `aggregateStats` calls it, and the server reads gear only through `aggregateStats`
(fight profile, income summary), so the browser and the server cannot disagree. A new object is returned; stats without a cap pass through unchanged.

**Formula**

```text
totals[f] = min(PERK_CAPS[f], totals[f])    for the five families, nothing else changes
```

<a id="aggregatestats"></a>

### `aggregateStats` <small>function</small>

Source: [`src/lib/inventory.ts:242`](../../src/lib/inventory.ts)

The one place gear is summed: stats of everything equipped (base at its level and quality, plus affixes) plus the set bonuses reached, then the perk families
(income, XP, kill reward, click, damage) are capped by [`capPerks`](economy.md#capperks). The server reads gear through this too, so both sides agree.
