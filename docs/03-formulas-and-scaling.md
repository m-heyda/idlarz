# 03 · Formulas & scaling

Constants: [`src/config/gameConfig.ts`](../src/config/gameConfig.ts) · maths: [`src/utils/gameUtils.ts`](../src/utils/gameUtils.ts) · actions: [`src/stores/gameStore.ts`](../src/stores/gameStore.ts). Full tables: [generated/balance-tables.md](generated/balance-tables.md) (`npm run report`); pacing: [generated/sim-milestones.md](generated/sim-milestones.md) (`npm run sim`).

Notation: `n` = tiles owned (castle included), `L` = player level, `C` = castle level.

## 1. Tile cost

```
base(n)  = floor(min(55 × 1.13^min(m, 15) × 1.07^(min(m, 100) − 15, ≥0) × 1.007^max(m − 100, 0) × (n / 300)^4.5 if n > 300, ceiling))
           with m = min(n, 300)                                                              SCALING_CONFIG.costFormula (tilePrice)
gold     = floor(base × (1 − discount%/100))
extra    = floor(base × share × (1 − discount%/100))  for each TILE_RESOURCE_COST row with n ≥ from
discount%= min(0.5 × Charisma, 25)
```

`TILE_RESOURCE_COST`: wood 10 % and stone 10 % of the gold cost from n = 15; coal 8 % from n = 30; food 8 % from n = 40.

| n | 1 | 10 | 20 | 30 | 50 | 75 | 100 | 150 | 200 | 300 | 400 | 500 | 1,000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gold (cha 5) | 60 | 181 | 469 | 925 | 3.6 K | 19.4 K | 105 K | 150 K | 212 K | 426 K | 1.6 M | 4.2 M | 96 M |

Cumulative gold for the first 100 / 200 / 300 / 400 / 500 tiles: 1.7 M / 17 M / 49 M / 142 M / 422 M (the extra wood, stone, coal and food shares come on top).

**The tail (no tile limit).** Up to 300 tiles the price is the three exponential stages (×1.13 to 15 tiles, ×1.07 to 100, then only ×1.007 per tile, the soft middle). Past `TILE_PRICE.tailFrom` (300) it grows like `(n / 300)^4.5` (`TILE_PRICE.tailExponent`), much steeper than the stretch before, and is capped at `TILE_PRICE.ceiling` (`RESOURCE_CAP / 100`), so it is always finite and a map of tens of thousands of tiles stays buyable (table in [generated/balance-tables.md](generated/balance-tables.md)). `RESOURCE_CAP` was raised from 1e15 to 1e21 for it. There is no tile limit any more (see 02 §1, map). The numbers are tuned with `npm run sim` against the pacing targets in [06](06-playtest-and-pacing-report.md) (100 tiles within the first day, 200-300 tiles in 2-3 days, a visibly harder climb after 300) for a game that will later be built around rebirths (bigger starting resources, much bigger maps): see BL16 in [05](05-balance-backlog-and-roadmap.md).

Every purchase rolls its biome (no picker). XP and reputation per purchase in §2.

## 2. XP and levels

```
tileXP(k)   = 125 × 1.02^(min(k,300)−1) × min(k,300)/4 × (k/300)^1.5 if k > 300      k = owned count AFTER the purchase (XP_TILE)
awardedXP   = tileXP × (1 + xpGainMultiplier/100)
xpGainMultiplier (%) = 0.2·INT + 0.25·CHA
passive xp/s = rates.total.xp × (1 + xpGainMultiplier/100)
XP to leave level N = floor(750 × 1.3^(N−1))
stat points = 1 per level; reputation = 1000 + 100 per tile bought
```

## 3. Resource rate pipeline

`calculateResourceRates`:

```
base[r]  = BASE_GENERATION_RATES[r]                                 gold 0.1, xp 0.25
         + Σ owned tiles of  (biome output[r] × scale + building output[r] × scale) × (1 + 0.25 × sameBiomeNeighbours)
              scale = 1.3 (BIOME_YIELD.scale); the castle uses its own output unscaled, without adjacency
         + Σ tiles inside the castle range  tileOutput[r] × castleAreaBonus(C)      (C < 7: +50 %; C ≥ 7: radius 1/2/3/4 at C = 7/8/9/10 → +100 % … +400 %)
         + 0.5 × (C − 1)   (r = xp only; CASTLE_UPGRADE.xpBonus)
         + Σ animals (r = meat only)

modifiers[r] = castleModifier(C)                    castle, all resources (§4)
             + stat modifiers                       2.5 % per point, see 02 §11 (XP: +0.2 %/INT, +0.25 %/CHA)
             + 0.05 × plainsTiles                   (r = meat only)

total[r] = base[r] × (1 + modifiers[r]) × (1 + 0.05 × legacyPointsEarned)     (second factor only after a Rebirth, §9)
```

The old hidden +10 % gold / +25 % XP modifier is gone (modifiers start at 0). Everything is additive inside the single `(1 + Σ)`.

`calculateResourceBreakdown` (`src/utils/gameUtils.ts`) is the one place this formula lives: per resource it returns the pieces (realm start, farm, biome tiles, buildings, castle-level XP), the bonuses (castle, plains, attributes, the Legacy factor) and the totals, and `calculateResourceRates` is built on it (`tests/uiActions.test.ts` checks that base, modifier and total are identical and that the pieces add up). The Stats tab's *Where the income comes from* section shows exactly these numbers per resource.

**New game**: gold 0.2 base × 1.45 = **0.29/s**, wood and food 0.05 × 1.45, stone 0.1 × 1.325, xp 0.75 × 1.223 = 0.92/s.

## 4. Castle

```
castleModifier(C)  = 0.2 × 2^(C−1)   for C ≤ 6  → +20 %, +40 %, +80 %, +160 %, +320 %, +640 %
                   = 6.4 + 3.2 × (C−6)  for C > 6  → +960 %, +1280 %, +1600 %, +1920 %      (lateLevelStep)
xp/s (flat)        = 0.5 × (C − 1)
castleAreaBonus(C) = 0.5 for C < 7, else castleRangeRadius(C) × 1   → 0.5 at levels 1-6, 1, 2, 3, 4 at levels 7-10 (extra output of every tile and building in range)
upgrade C→C+1      = pay upgradeCosts[C−1] up front, then wait durationsSec[C−1] × (1 − 0.05 × MasterBuilders) (tick-counted)
```

| Upgrade | Build time | gold | wood | stone | coal | food | meat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1→2 | 1 h | 70 K | 10 K | 10 K | — | — | — |
| 2→3 | 4 h | 200 K | 30 K | 30 K | 20 K | — | — |
| 3→4 | 12 h | 1 M | 100 K | 100 K | 50 K | 200 K | 40 K |
| 4→5 | 1 d 12 h | 4 M | 400 K | 400 K | 200 K | 2 M | 100 K |
| 5→6 | 3 d | 20 M | 2 M | 2 M | 1 M | 10 M | 500 K |
| 6→7 | 3 d | 30 M | 3 M | 3 M | 1.6 M | 16 M | 800 K |
| 7→8 | 4 d | 48 M | 4.8 M | 4.8 M | 2.6 M | 25.6 M | 1.28 M |
| 8→9 | 5 d | 76.8 M | 7.6 M | 7.6 M | 4 M | 41 M | 2 M |
| 9→10 | 7 d | 122.8 M | 12.2 M | 12.2 M | 6.6 M | 65.6 M | 3.2 M |

Build time to level 6 is 5 d 5 h, to level 10 24 d 5 h (before Legacy discounts). Cost rows come straight from `CASTLE_UPGRADE.upgradeCosts`; the generated tables show the same numbers.

## 5. Farm animals

```
cost of the N-th animal of a kind = floor(baseCost × costScaling^(N−1))   food
meat/s of N animals               = baseProduction × N × (1 + 0.02 × pen) × (1 + 0.05 × feed)
product/s of N animals            = perSec × N × (1 + 0.02 × pen) × (1 + 0.10 × coop|dairy|tannery)
meat total                        = base × (1 + castle modifier + 0.05 × plainsTiles)
products total                    = base × (1 + castle modifier)          (eggs, milk, hide)
cap per kind                      = 12 + 4 × pen level
upgrade cost (level N → N+1)      = ceil(base × growth^N) per resource
```

| Animal | first cost | cost × | meat/s each | product/s each |
| --- | --- | --- | --- | --- |
| Chicken | 1 K | 1.3 | 0.2 | 0.02 eggs |
| Deer | 10 K | 1.33 | 0.5 | 0.025 hide |
| Pig | 60 K | 1.36 | 1 | 0.05 hide |
| Cow | 400 K | 1.4 | 2 | 0.15 milk |

| Upgrade | per level | levels | base cost | cost × |
| --- | --- | --- | --- | --- |
| Feed Trough | +5 % meat | 10 | 2 K food | 1.6 |
| Hen House | +10 % eggs | 10 | 1.5 K wood + 40 eggs | 1.6 |
| Dairy | +10 % milk | 10 | 1.5 K stone + 30 milk | 1.6 |
| Tannery | +10 % hide | 10 | 1.2 K coal + 20 hide | 1.6 |
| Pen Expansion | +2 % all farm output, +4 animals per kind | 8 | 8 K food + 3 K wood + 3 K stone | 1.9 |

A product sells for 3 / 4 / 6 gold (eggs / milk / hide), which is 25–40 % of the meat value of the animal that makes it.

Payback (food valued at its sell price 0.75, meat at 1) is well under a day for the first chicken and grows with each extra animal (generated §4); the sim buys the first chicken within minutes and the first cow after about half a day.

## 6. Merchant, clicks, chests, buildings

```
sell:  gold = floor(amount × price × (1 + 0.03 × Haggler))    wood .5, stone .5, coal 1, food .75, meat 1, eggs 3, milk 4, hide 6
buy:   gold = ceil(amount × price × 2)                         wood, stone, coal, food, meat only
item:  sell = floor(sellValue × qty × Haggler)   common 8, uncommon 90, rare 250, epic 700, legendary 2000, potion 20
       shop price >= 3 × sellValue (> 3.9 × with a max Haggler), so buy + sell never gains gold
bonuses: price = ceil(base × growth^level)   Haggler 100 K ×1.9, Bulk Discount 250 K ×2.1, Lucky Charm 150 K ×1.9, Pack Rat 500 K ×3
click: gold = total gold/s × clickPower    0.5 → 0.9 → 1.3 → 1.8   (750 K, 2.5 M, 10 M)
tap:   resource = tile output/s × 0.5 s    (+ crit multiplier on lucky taps), tile cooldown 1.2 s
chest: gold = floor(total gold/s × U{600…3600} s × (1 + 0.005 × Luck))      one per 600 s, ≤ 5 waiting
building cost = floor({500 gold, 250 wood, 150 stone} × 1.6^(buildings already built))
critter gift = max(min, N s of that resource's income)  (×2 golden); N = 10 on the farm, 5 on the map (AMBIENT_LIFE.giftSeconds)
             cooldown: farm 8 s, map 20 s, both gated by the click limiter, amount computed in the store
```

Click limiter (gold clicks, tile taps, critter gifts; NOT fight hits): burst bucket 8 tokens refilling 5/s × stamina bucket 20 000 refilling 1.5/s; each paid click takes one token from both.

## 7. Character-derived stats

`calculateCombatStats`: physicalAtk = STR; magicAtk = INT; hp = 3·VIT + 0.25·CHA; mp = 2·INT; def = DEX + 0.5·STR + 0.5·VIT + 0.25·CHA; magicDef = INT + 0.5·VIT + 0.25·CHA; luck = CHA; critChance % = 0.25·DEX + 0.5·CHA; critDmg % = 100 + STR + 0.5·DEX + 0.5·CHA; atkSpeed % = 0.25·DEX; **xpGainMultiplier** and **tileCostDiscount** as above. Only luck (chests), crit stats (lucky taps), xpGainMultiplier and tileCostDiscount affect gameplay; the rest is display-only.

## 8. What the pacing looks like

From `npm run sim` (bot players, real store; see [06](06-playtest-and-pacing-report.md)): castle 2 ≈ 17–21 h, castle 3 ≈ 2–3 d, castle 4 ≈ 5–8 d, castle 5 ≈ 13–18 d, castle 6 ≈ 32–40 d, castle 10 ≈ 100–125 d, with the dedicated human about 20 % faster than a player who never clicks. The 24 h/day auto-clicker bot is faster still (castle 6 ≈ 24 d) because it also manages the economy around the clock, see [06 §3](06-playtest-and-pacing-report.md).

## 9. Rebirth and Legacy

```
available   : castle ≥ 6 (REBIRTH.minCastleLevel), tiles ≥ 20 (REBIRTH.minTiles), no castle upgrade running
points      = floor(4.5 × (C − 5) × sqrt(n / 10))                     REBIRTH.gain
income      × (1 + 0.05 × legacyEarned)                                folded into the modifiers, spending never lowers it
shop cost   = ceil(base × 1.4^level)        base: thrift 2, builders 3, mastery 2, provisions 2; max level 10
thrift      : tile and building cost × (1 − 0.02 × level), summed with the Charisma discount, capped at 45 %
builders    : castle build time × (1 − 0.05 × level)
mastery     : click power × (1 + 0.10 × level)
provisions  : start each run with level × (1500 gold, 400 wood, 400 stone)
```

| castle | 100 tiles | 200 tiles | 300 tiles |
| --- | --- | --- | --- |
| 6 | 14 | 20 | 24 |
| 8 | 42 | 60 | 73 |
| 10 | 71 | 100 | 123 |

Conservation rule used by the save check: `legacyPoints + Σ shop spending = legacyEarned`, and `rebirths = 0` implies `legacyEarned = 0` ([07 §3](07-security-and-exploits.md)). More tables in [generated/balance-tables.md](generated/balance-tables.md).

## 10. Combat, monsters and items

```
maxHp        = round(85 + characterStats.hp + Σ gear maxHp + set bonuses)       COMBAT.baseHp   (101 at the start)
damage/click = max(1, Σ gear damage + set bonuses)                              Wooden Sword 6 ... Titan Maul 45 at their first level (COMBAT.maxItemDamage 50 caps the authored base damage; gear grows with its item level)
click        : crit with  (character critChance + gear critChance) %  (max 75 %)  → damage × 2
               then a super crit with (5 + gear superCrit) %  (max 50 %)          → damage × 5   (COMBAT.crit)
fight hits   : not rate limited; trusted real clicks only, one DOM event counts once (lib/hitGuard.ts)
hit taken    = max(1, round(attack × (1 − armor / (armor + 40))))               COMBAT.armorK
regen        = (1 + gear regen) HP/s with no active fight, gear regen only during one; knockout restores 30 % of max HP
potion       = +35 / +90 HP (not above max), 8 s cooldown shared by all potions in a fight
rat tier t   : HP = round(100 × 1.5^(t−1))  → 100 / 150 / 225 / 338 / 506
               attack = round(4 × 1.25^(t−1)) every 2 s → 4 / 5 / 6 / 8 / 10
tier         = min(5, 1 + floor(age / 1800 s))                                  age counts only while not being fought
rewards      : rewardSec = 90 × 1.5^(t−1)
               gold = floor(max(10, gold/s × rewardSec × (1 + 0.005 × Luck)))   Luck = character + merchant + gear
               xp   = max(5, xp/s × (1 + xpGain%) × rewardSec)
drops        : see [10-loot-system.md](10-loot-system.md): profile -> rolls -> source level -> item level -> rarity -> base -> affixes
               rat: gear 12 % + 2 % per tier above 1, rarity rolled (Common 70 / Uncommon 22 / Rare 7 / Epic 1 / Legendary 0.2, gated by item level);
               potion 25 % + 3 % per tier (Greater from T4)                      (tier 1: 90 s of income, tier 5: ~456 s)
               Rat King: 1 item of his own (rolled rarity) + 1 Rattatui piece (missing ones first) + 40 % a second one + 5 % (pity up to 15 %) a legendary weapon + 2 Minor and 1 Greater potion
               chest (item result, 8 % of chests): one item - gear 82 % (rolled rarity) or a potion, 1.9 % a legendary weapon instead
item level   : source level = base + steps per tier + 3 per castle level above 1 (rat 1/3/5/7/9, King 12, chest 4, +3 per castle level); gear power x levelScale(level) = 1 + 0.07 x (level - 1)
spawn        : first rat 120 s after 5 owned tiles, then 900 s; max 8; Rat King check every 600 s of age after tier 5 (7200 s), 35 %
Rat King     : 15600 HP, attack 14 every 3 s, 75 s limit
```

The King's numbers were tuned with `npm run fight-sim` (a bot with the real combat rules; tables in [generated/fight-sim.md](generated/fight-sim.md)) and are
held by `tests/fightBalance.test.ts`: the starter kit and plain wood never win, steel needs fast clicking, obsidian a steady pace, the Rattatui set is comfortable,
and no loadout trivialises him. Rats are basic enemies and are not tuned around him.

Items, sets, rarities, stats, drop pools and the merchant stock are generated into [generated/item-catalog.md](generated/item-catalog.md) from `src/catalog`.
Combat numbers live in `src/config/combatConfig.ts`.

## Building cost

```
building number n (1-based, `built = n - 1` already stand)   factor(built) =
  built < 4              : starter[built]                       x0.4, x0.6, x0.8, x1.0     (BUILDING_COST.starter)
  k = built - 3           : 1.35^min(k, 12) x 1.25^clamp(k - 12, 0, 16) x 1.15^max(k - 28, 0)
cost (gold / wood / stone) = floor(base x factor x (1 - Thrift))     base = 500 / 250 / 150
```

| Building | factor | gold |
| --- | --- | --- |
| 1 | 0.4 | 200 |
| 2 | 0.6 | 300 |
| 3 | 0.8 | 400 |
| 4 | 1.0 | 500 |
| 5 | 1.35 | 675 |
| 10 | 6.05 | 3.0K |
| 16 | 36.6 | 18.3K |
| 20 | 89.5 | 44.7K |
| 32 | 1302 | 651K |
| 40 | 3982 | 1.99M |

The price follows the tile curve in shape (steep, then gentler, then gentler again) but starts lower, so a building is a fraction of a tile at the same point of the game.
`src/config/gameConfig.ts` `BUILDING_COST` and `buildingCostFactor` in `src/utils/gameUtils.ts`; `tests/buildOnTile.test.ts` holds the shape.
