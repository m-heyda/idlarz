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

`TILE_RESOURCE_COST`: wood 30 % and stone 20 % of the gold cost from n = 15; coal 20 % from n = 30; food 10 % from n = 40; hide 2 % from n = 100 (milk and eggs are kept for other uses). The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (`npm run sim`, table at the end of [generated/sim-milestones.md](generated/sim-milestones.md)): gold must be the biggest number, hide and the rest below it. Gold stays the biggest single part.

| n | 1 | 10 | 20 | 30 | 50 | 75 | 100 | 150 | 200 | 300 | 400 | 500 | 1,000 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gold (cha 5) | 60 | 181 | 469 | 925 | 3.6 K | 19.4 K | 105 K | 150 K | 212 K | 426 K | 1.6 M | 4.2 M | 96 M |

Cumulative gold for the first 100 / 200 / 300 / 400 / 500 tiles: 1.6 M / 17 M / 48 M / 138 M / 412 M (the extra wood, stone, coal and food shares come on top).

**The tail (no tile limit).** Up to 300 tiles the price is the three exponential stages (×1.13 to 15 tiles, ×1.07 to 100, then only ×1.007 per tile, the soft middle). Past `TILE_PRICE.tailFrom` (300) it grows like `(n / 300)^4.5` (`TILE_PRICE.tailExponent`), much steeper than the stretch before, and is capped at `TILE_PRICE.ceiling` (`RESOURCE_CAP / 100`), so it is always finite and a map of tens of thousands of tiles stays buyable (table in [generated/balance-tables.md](generated/balance-tables.md)). `RESOURCE_CAP` was raised from 1e15 to 1e21 for it. There is no tile limit any more (see 02 §1, map). The numbers are tuned with `npm run sim` against the pacing targets in [06](06-pacing-targets.md) (100 tiles within the first day, 200-300 tiles in 2-3 days, a visibly harder climb after 300) for a game that will later be built around rebirths (bigger starting resources, much bigger maps); the tail is also on the balance backlog in [ROADMAP](ROADMAP.md).

Every purchase rolls its biome (no picker). XP and reputation per purchase in §2.

## 2. XP and levels

```
tileXP(k)   = 45 × 1.02^(min(k,300)−1) × min(k,300)/4 × (k/300)^1.5 if k > 300      k = owned count AFTER the purchase (XP_TILE)
awardedXP   = tileXP × (1 + xpGainMultiplier/100)
xpGainMultiplier (%) = 0.2·INT + 0.25·CHA
passive xp/s = rates.total.xp × (1 + xpGainMultiplier/100)
XP to leave level N = xpToNextLevel(N): from anchors (level → total XP) 10 → 1.4e5, 30 → 1e8, 80 → 3e9, 90 → 6.5e9, 100 → 1.85e10,
                       every step a constant factor above the one before inside a segment; level 100 is the maximum (LEVELING in gameConfig.ts)
stat points = 1 per level, +2 for levels 2..30 (totalStatPoints); reputation = 1000 + 100 per tile bought
level, lifetime XP and attributes carry over a rebirth
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

total[r] = base[r] × (1 + modifiers[r]) × (1 + 0.06 × embersEarned) × (1 + Foreman) × (1 + setIncomePct/100)     (second factor only after a Rebirth, §9; Foreman = merchant upgrade, +1 % per level; the set Income % comes from the worn Obsidian set; both on every resource but XP)

The merchant's Skinner upgrade (+5 % per level) multiplies the farm's meat and hide inside `base` before the modifiers.
```

The old hidden +10 % gold / +25 % XP modifier is gone (modifiers start at 0). Everything is additive inside the single `(1 + Σ)`.

`calculateResourceBreakdown` (`src/utils/gameUtils.ts`) is the one place this formula lives: per resource it returns the pieces (realm start, farm, biome tiles, buildings, castle-level XP), the bonuses (castle, plains, attributes, the Ember factor) and the totals, and `calculateResourceRates` is built on it (`tests/uiActions.test.ts` checks that base, modifier and total are identical and that the pieces add up). The Character tab's *Where the income comes from* section shows exactly these numbers per resource.

**New game**: the castle plus the 4 free start tiles (a random mix of plains and forest) give roughly 2-3 gold/s, about 0.1 wood and 0.2 stone/s and a few food per second, under the castle's +45 % modifier (+32.5 % stone), and about 1.2 xp/s. The exact rows for one fixed ring are in [generated/balance-tables.md §7](generated/balance-tables.md).

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
| 4→5 | 1 d | 4 M | 400 K | 400 K | 200 K | 2 M | 100 K |
| 5→6 | 2 d | 8 M | 2 M | 2 M | 1 M | 4 M | 500 K |
| 6→7 | 3 d | 30 M | 3 M | 3 M | 1.6 M | 16 M | 800 K |
| 7→8 | 4 d | 48 M | 4.8 M | 4.8 M | 2.6 M | 25.6 M | 1.28 M |
| 8→9 | 5 d | 76.8 M | 7.6 M | 7.6 M | 4 M | 41 M | 2 M |
| 9→10 | 7 d | 122.8 M | 12.2 M | 12.2 M | 6.6 M | 65.6 M | 3.2 M |

Build time to level 6 is 3 d 17 h (1 h + 4 h + 12 h + 1 d + 2 d), to level 10 22 d 17 h (before Ember discounts); the timers are the floor of the first run, so the cost of 5→6 is what a player who plays a few times a day must be able to pay while the 4→5 timer runs. Cost rows come straight from `CASTLE_UPGRADE.upgradeCosts`; the generated tables show the same numbers.

## 5. Farm animals

```
cost of the N-th animal of a kind = floor(baseCost × costScaling^(N−1))   food
meat/s of N animals               = baseProduction × N × (1 + 0.02 × pen) × (1 + 0.05 × feed)
product/s of N animals            = perSec × N × (1 + 0.02 × pen) × (1 + effect × coop|dairy|tannery) × (1 + 0.08 × pasture)      effect: 0.15 coop / dairy, 0.25 tannery
meat total                        = base × (1 + castle modifier + 0.05 × plainsTiles)
products total                    = base × (1 + castle modifier)          (eggs, milk, hide)
cap per kind                      = 12 + 4 × pen level
upgrade cost (level N → N+1)      = ceil(base × growth^N) per resource
```

| Animal | first cost | cost × | meat/s each | product/s each |
| --- | --- | --- | --- | --- |
| Chicken | 1 K | 1.3 | 0.2 | 0.03 eggs |
| Deer | 10 K | 1.33 | 0.5 | 0.075 hide |
| Pig | 60 K | 1.36 | 1 | 0.15 hide |
| Cow | 400 K | 1.4 | 2 | 0.225 milk |

| Upgrade | per level | levels | base cost | cost × |
| --- | --- | --- | --- | --- |
| Feed Trough | +5 % meat | 10 | 2 K food | 1.6 |
| Hen House | +15 % eggs | 10 | 1.5 K wood + 40 eggs | 1.6 |
| Dairy | +15 % milk | 10 | 1.5 K stone + 30 milk | 1.6 |
| Tannery | +25 % hide | 10 | 1.2 K coal + 20 hide | 1.6 |
| Pasture | +8 % eggs, milk and hide | 10 | 5 K food + 2.5 K wood | 1.6 |
| Pen Expansion | +2 % all farm output, +4 animals per kind | 8 | 8 K food + 3 K wood + 3 K stone | 1.9 |

A product sells for 2 / 3 / 2 gold (eggs / milk / hide; hide produces twice as fast as before and sells for half, so its gold is unchanged and the hide itself reaches the tile price faster), which is 30–40 % of the meat value of the animal that makes it (products were produced 50 % slower and sold for 3 / 4 / 6 before: the same gold, reached faster).

Payback (food valued at its sell price 0.75, meat at 1) is well under a day for the first chicken and grows with each extra animal (generated §4); the sim buys the first chicken within minutes and the first cow after about half a day.

## 6. Merchant, clicks, chests, buildings

```
sell:  gold = floor(amount × price × (1 + 0.03 × Haggler))    wood .75, stone .9, coal 1.1, food .4, meat 1, eggs 2, milk 3, hide 2
buy:   gold = ceil(amount × price × 2)                         wood, stone, coal, food, meat only
item:  sell = floor(rarityValue × valueCurve(level) × qualityValue × affixesValue × Haggler)   rarityValue 300 / 1200 / 3600 / 12000 / 45000; potions 20 / 90
       valueCurve = 1.3^(min(L,10)−1) × 1.12^max(0,L−10);  qualityValue 0.75..1.25;  affixesValue = 1 + Σ(0.15 + 0.35 × roll/100)   (ITEM_VALUE in catalog/stats.ts)
       supplies (potions) price >= 3 × sellValue (> 3.9 × with a max Haggler), so buy + sell never gains gold
goods: shelf = 6 pieces of loot source `merchant` (profile `merchant_stock`: common 60 / uncommon 40, nothing better); item level centre = min(castle-based level, avgWorn + 3), never above avgWorn + 5 (MERCHANT_GOODS)
       price = ceil(sellValue × 5), reshuffle after 1800 s of play time, refresh = 5000 × (k+1) for the k-th paid refresh (k < 10), then 50000 × (k−8) (MERCHANT_GOODS.refresh)
bonuses: price = ceil(base × growth^level)   Haggler 100 K ×1.9, Bulk Discount 250 K ×2.1, Lucky Charm 150 K ×1.9, Pack Rat 500 K ×3, Foreman 400 K ×1.9, Skinner 300 K ×1.9, Quick Hands / Keen Eye / Deadly Aim / Might 250 K ×1.9, Arcana 250 K ×2, Vampiric Fang / Second Wind 300 K ×2, Ancestral Tithe 600 K ×1.9 (all start again on a rebirth but Pack Rat); Embers of a rebirth = floor(gain × (1 + 0.05 × Tithe))
click: gold = total gold/s × clickPower    0.5 → 0.9 → 1.3 → 1.8   (750 K, 2.5 M, 10 M)
chest: gold = floor(total gold/s × U{600…3600} s × (1 + 0.005 × Luck))      one per 600 s of server time (Luck shortens it), counted with the monsters against min(40, 30 % of the free land)
building cost: see §11
```

Click limiter (gold clicks): burst bucket 8 tokens refilling 5/s × stamina bucket 20 000 refilling 1.5/s; each paid click takes one token from both.

## 7. Character-derived stats

`calculateCombatStats` (`gameUtils.ts`; the combat parts come from `lib/statBonuses.ts`, the same functions the server's fights use, and count the points above the starting 5): physicalAtk % = 2·(STR−5); magicAtk % = 2.4·(INT−5); hp = 3·VIT + 0.25·CHA (on top of the base 85); mp = 20 + 4·INT; def = 0.5·(DEX−5) + 0.5·(VIT−5) + 0.25·(STR−5); luck = CHA; critChance % = 0.25·DEX + 0.5·CHA; atkSpeed % = 0.25·(DEX−5); **xpGainMultiplier** = 0.2·INT + 0.25·CHA and **tileCostDiscount** = 0.5·CHA (max 25) as above. Damage, armor, crit damage and attack speed feed the fight engine (§10), luck feeds chests and kills, xpGainMultiplier and tileCostDiscount the economy; reputation is display-only.

## 8. What the pacing looks like

Pacing is measured, not written here: `npm run sim` drives the real store with bot players and writes [generated/sim-milestones.md](generated/sim-milestones.md); the targets and what they mean are in [06](06-pacing-targets.md).

## 9. Rebirth and Embers

```
available   : castle ≥ 6 (REBIRTH.minCastleLevel), tiles ≥ 100 (REBIRTH.minTiles), no castle upgrade running
points      = floor(3 × (C − 5) × sqrt(n / 10))                     REBIRTH.gain
income      × (1 + 0.06 × legacyEarned)                                folded into the modifiers, spending never lowers it
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

Conservation rule used by the save check: `legacyPoints + Σ shop spending = legacyEarned`, and `rebirths = 0` implies `legacyEarned = 0` ([07](07-saves-and-security.md)). More tables in [generated/balance-tables.md](generated/balance-tables.md).

## 10. Combat, monsters and items

```
maxHp        = round((85 + characterStats.hp + Σ gear maxHp + set bonuses) × (1 + maxHpPct/100))       COMBAT.baseHp   (101 at the start)
damage/hit   = max(1, (Σ gear damage + set bonuses) × (1 + damagePct/100))                              Wooden Sword 6 ... Titan Maul 45 at their first level (COMBAT.maxItemDamage 50 caps the authored base damage; gear grows with its item level)
hit          : crit with  (character critChance + gear critChance) %  (max 75 %)  → damage × 2
               then a super crit with (5 + gear superCrit) %  (max 50 %)          → damage × 5   (COMBAT.crit)
hit taken    = max(1, round(attack × (1 − armorReduction(armor))))              COMBAT.armorK, armorSoftCap, armorSoftSlope
armorReduction(a) = r = a/(a+40);  r ≤ 0.5 ? r : 0.5 + (r − 0.5) × 0.5       (ceiling 75 %)
stat bonuses : counted above the starting 5 (STAT_RULES)
               damage = gear damage × (1 + 0.02 × (STR−5))  physical weapons;  × (1 + 0.024 × (INT−5))  staff and wand
               armor  = gear armor + 0.5 × (DEX−5) + 0.5 × (VIT−5) + 0.25 × (STR−5)       hit taken × (1 − armorReduction(armor))
               crit multipliers x2 / x5 × (1 + (1 × (STR−5) + 0.5 × (DEX−5) + 0.5 × (CHA−5)) / 100)
               attacks/s = weapon speed × (1 + 0.0025 × (DEX−5))   (the speed the server's fight engine swings at)
mana         = 20 + 4 × INT + gear;  regen = 0.5 + 0.05 × INT + gear  per second;  life leech = min(15, gear %) of the damage dealt as HP
Heal         = round(25 % max HP × (1 + 0.024 × (INT−5)) × (1 + Spell Power %)), level 5, 20 mana, 12 s cooldown
Stun         = the monster's attack timer is frozen 10 s, level 10, 15 mana, 30 s cooldown (the King's limit keeps running); a monster's stunResist % can make it fail
regen        = (1 + gear regen) HP/s with no active fight, gear regen only during one; knockout restores 30 % of max HP
potion       = +35 / +90 HP (not above max), 8 s cooldown shared by all potions in a fight
monster level: level = spawnLevel + min(growthLevels, floor(age / growthInterval))    growthLevels 10, interval 1800 s (LIMITS, via limitOf); age counts only while not being fought
               spawn level: rat window [1 + (castle−1), +2] capped at 10; King [15 + floor(0.8 × (castle−1)), +3] capped at 25; rolled from the monster id (no Math.random)
rat level L  : HP = round(100 × 1.5^((L−1)/2))  → level 1 / 3 / 5 / 7 / 9 = 100 / 150 / 225 / 338 / 506     attack = round(4 × 1.25^((L−1)/2))     armor = 0.5 × (L−1)
King level L : HP, attack = base × levelScale(L) / levelScale(15)  (1000 HP, 11 attack at 15), armor 15 + 0.5 × (L−15), 8 % crit x1.5, 20 % Stun resist
hit dealt    = max(1, your damage × (1 − armorReduction(armor)))     monster hit = mitigate(attack [× 1.5 on a crit], your armor)
rewards      : rewardSec = 90 × 1.17^(L−1) (rat), 3600 × 1.03^(L−15) (King)
               gold = floor(max(10, gold/s × rewardSec × (1 + 0.005 × Luck) × (1 + goldFind%)) × (1 + killRewardPct/100))   Luck = character + merchant + gear
               xp   = max(5, xp/s × (1 + xpGain%) × rewardSec) × (1 + killRewardPct/100)
               hide = floor(hide/s × rewardSec × 0.6)      COMBAT.rewards.hideShare; pelts are a share of the farm's income, 0 without deer and pigs; also x3 on a lucky rat
drops        : see [10-loot-system.md](10-loot-system.md): profile -> rolls -> source level -> item level -> rarity -> base -> affixes
               rat: gear 12 % + 1 % per level above 1, rarity rolled (Common 70 / Uncommon 22 / Rare 7 / Epic 1 / Legendary 0.2, gated by item level);
               potion 25 % + 1.5 % per level (Greater from level 7)              (level 1: 90 s of income, level 9: ~316 s)
               Rat King: 1 item of his own (rolled rarity) + 1 Rattatui piece (missing ones first) + 40 % a second one + 5 % (pity up to 15 %) a legendary weapon + 2 Minor and 1 Greater potion
               chest (item result, 8 % of chests): one item - gear 82 % (rolled rarity) or a potion, 1.9 % a legendary weapon instead
item level   : a monster's drops are at its own level (rat 1-20, King 15-35); chest 4 and the merchant 4, +3 per castle level; gear power x levelScale(level) = 1 + 0.07 x (level - 1)
spawn        : first rat 120 s after the start (a valid site must be free: owned land 2-9 tiles from the castle), then every 900 s, at most min(40, 30 % of the free land) waiting per kind; a boss (one at a time) every 10800 s of spawn time (COMBAT.spawn.bossIntervalSec)
Rat King     : level 15: 1000 HP behind 15 armor, attack 11 every 3 s, 75 s limit
```

The King's numbers were tuned with `npm run fight-sim` (a bot with the real combat rules; tables in [generated/fight-sim.md](generated/fight-sim.md)) and are
held by `tests/fightBalance.test.ts`: the starter kit and plain wood never win, full steel does not, full obsidian wins with seconds to spare, the Rattatui set comfortably,
and no loadout trivialises him. Rats are basic enemies and are not tuned around him.

Set bonuses (`catalog/sets.ts`) may carry the set-only stats `incomePct`, `xpPct`, `killRewardPct`, `offlineEff`, `offlineCapHours`, `clickPct`, `damagePct` and `maxHpPct`; `xpGain% = attributes + set XP %`, the away limits add the set's away hours and efficiency points. The two sets are generated into [generated/item-catalog.md](generated/item-catalog.md), with where every effect is applied.

Items, sets, rarities, stats, drop pools and the merchant stock are generated into [generated/item-catalog.md](generated/item-catalog.md) from `src/catalog`.
Combat numbers live in `src/config/combatConfig.ts`.

## 11. Building cost

```
building number n (1-based, `built = n - 1` already stand)   factor(built) =
  built < 4              : starter[built]                       x0.4, x0.6, x0.8, x1.0     (BUILDING_COST.starter)
  k = built - 3           : 1.15^min(k, 12) x 1.09^clamp(k - 12, 0, 16) x 1.025^max(k - 28, 0)
cost (gold / wood / stone) = floor(base x factor x (1 - Thrift))     base = 500 / 250 / 150
```

| Building | factor | gold |
| --- | --- | --- |
| 1 | 0.4 | 200 |
| 2 | 0.6 | 300 |
| 3 | 0.8 | 400 |
| 4 | 1.0 | 500 |
| 5 | 1.15 | 575 |
| 10 | 2.31 | 1,157 |
| 16 | 5.35 | 2,675 |
| 20 | 7.55 | 3,776 |
| 32 | 21.2 | 10,621 |
| 40 | 25.9 | 12,941 |

The price follows the tile curve in shape (steep, then gentler, then gentler again) but starts lower, so a building is a fraction of a tile at the same point of the game.
`src/config/gameConfig.ts` `BUILDING_COST` and `buildingCostFactor` in `src/utils/gameUtils.ts`; `tests/buildOnTile.test.ts` holds the shape.

## 12. Limits and bonus hooks (what upgrades and rebirth will extend)

Bounds that progression is meant to raise live in `src/config/limits.ts` (`LIMITS`: monster growth levels and interval, merchant shelf size, rotation and refresh cost, bag size) with a `HARD_LIMITS` ceiling for what a save may hold. Code reads them through `limitOf(key, ctx)` (`src/lib/limits.ts`), which adds the bonuses registered in `LIMIT_BONUSES` (today only Pack Rat on the bag size); a new upgrade or Ember effect is one entry there and every reader follows. Likewise every gold payout for something the player sells goes through `sellMultiplier(ctx)` / `sellPayout` (`utils/gameUtils.ts`) with the bonuses in `SELL_BONUSES` (today Haggler): resources, bag gear, junk, auto-sold drops, the merchant previews and the cloud net-worth check all use it, so a "+20 % selling" effect applies to all of them alike (`tests/limitsAndSelling.test.ts` proves it with a registered bonus).
