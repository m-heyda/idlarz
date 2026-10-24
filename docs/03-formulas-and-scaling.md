# 03 · Formulas & scaling

Constants: [`src/config/gameConfig.ts`](../src/config/gameConfig.ts) · maths: [`src/utils/gameUtils.ts`](../src/utils/gameUtils.ts) · actions: [`src/stores/gameStore.ts`](../src/stores/gameStore.ts). Full tables: [generated/balance-tables.md](generated/balance-tables.md) (`npm run report`); pacing: [generated/sim-milestones.md](generated/sim-milestones.md) (`npm run sim`).

Notation: `n` = tiles owned (castle included), `L` = player level, `C` = castle level.

## 1. Tile cost

```
base(n)  = floor(55 × 1.45^min(n, 20) × 1.27^(min(n, 40) − 20, ≥0) × 1.17^max(n − 40, 0))   SCALING_CONFIG.costFormula
gold     = floor(base × (1 − discount%/100))
extra    = floor(base × share × (1 − discount%/100))  for each TILE_RESOURCE_COST row with n ≥ from
discount%= min(0.5 × Charisma, 25)
```

`TILE_RESOURCE_COST`: wood 10 % and stone 10 % of the gold cost from n = 15; coal 8 % from n = 30; food 8 % from n = 40.

| n | 1 | 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gold (cha 5) | 77 | 343 | 2.2 K | 14.1 K | 90.5 K | 299 K | 988 K | 10.8 M | 51 M |

Past 40 tiles growth drops from ×1.27 to ×1.17 per tile (`growthEndgame`, `lateTiles`), so tile 50 costs ~51 M instead of 118 M and tile 60 ~0.2 B instead of 1.5 B; the first 40 tiles are unchanged, so the pacing milestones in [06](06-playtest-and-pacing-report.md) still hold.

Biome pick every purchase with `n % 4 === 3`. XP and reputation per purchase in §2.

## 2. XP and levels

```
tileXP(k)   = 125 × 1.02^(k−1) × k/4          k = owned count AFTER the purchase
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
         + 0.5 × (C − 1)   (r = xp only; CASTLE_UPGRADE.xpBonus)
         + Σ animals (r = meat only)

modifiers[r] = castleModifier(C)                    castle, all resources (§4)
             + stat modifiers                       2.5 % per point, see 02 §11 (XP: +0.2 %/INT, +0.25 %/CHA)
             + 0.05 × plainsTiles                   (r = meat only)

total[r] = base[r] × (1 + modifiers[r]) × (1 + 0.05 × legacyPointsEarned)     (second factor only after a Rebirth, §9)
```

The old hidden +10 % gold / +25 % XP modifier is gone (modifiers start at 0). Everything is additive inside the single `(1 + Σ)`.

**New game**: gold 0.2 base × 1.45 = **0.29/s**, wood and food 0.05 × 1.45, stone 0.1 × 1.325, xp 0.75 × 1.223 = 0.92/s.

## 4. Castle

```
castleModifier(C)  = 0.2 × 2^(C−1)   for C ≤ 6  → +20 %, +40 %, +80 %, +160 %, +320 %, +640 %
                   = 6.4 + 3.2 × (C−6)  for C > 6  → +960 %, +1280 %, +1600 %, +1920 %      (lateLevelStep)
xp/s (flat)        = 0.5 × (C − 1)
upgrade C→C+1      = pay upgradeCosts[C−1] up front, then wait durationsSec[C−1] × (1 − 0.05 × MasterBuilders) (tick-counted)
```

| Upgrade | Build time | gold | wood | stone | coal | food | meat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1→2 | 1 h | 350 K | 50 K | 50 K | — | — | — |
| 2→3 | 4 h | 1 M | 150 K | 150 K | 100 K | — | — |
| 3→4 | 12 h | 5 M | 500 K | 500 K | 250 K | 1 M | 200 K |
| 4→5 | 1 d 12 h | 20 M | 2 M | 2 M | 1 M | 10 M | 500 K |
| 5→6 | 3 d | 100 M | 10 M | 10 M | 5 M | 50 M | 2.5 M |
| 6→7 | 3 d | 150 M | 15 M | 15 M | 8 M | 80 M | 4 M |
| 7→8 | 4 d | 240 M | 24 M | 24 M | 13 M | 128 M | 6.4 M |
| 8→9 | 5 d | 384 M | 38 M | 38 M | 20 M | 205 M | 10 M |
| 9→10 | 7 d | 614 M | 61 M | 61 M | 33 M | 328 M | 16 M |

Build time to level 6 is 5 d 5 h, to level 10 24 d 5 h (before Legacy discounts). Cost rows come straight from `CASTLE_UPGRADE.upgradeCosts`; the generated tables show the same numbers.

## 5. Farm animals

```
cost of the N-th animal of a kind = floor(baseCost × costScaling^(N−1))   food
meat/s of N animals               = baseProduction × N
meat total                        = base × (1 + castle modifier + 0.05 × plainsTiles)
```

| Animal | first cost | cost × | meat/s each |
| --- | --- | --- | --- |
| Chicken | 10 K | 1.5 | 0.2 |
| Deer | 50 K | 1.6 | 0.5 |
| Pig | 200 K | 1.7 | 1 |
| Cow | 1 M | 1.8 | 2 |

Payback (food valued at its sell price 0.75, meat at 1) is ≈ 10 h for the first chicken and grows with each extra animal (generated §4).

## 6. Merchant, clicks, chests, buildings

```
sell:  gold = floor(amount × price)        wood .5, stone .5, coal 1, food .75, meat 1
buy:   gold = ceil(amount × price × 2)
click: gold = total gold/s × clickPower    0.5 → 0.9 → 1.3 → 1.8   (750 K, 2.5 M, 10 M)
tap:   resource = tile output/s × 0.5 s    (+ crit multiplier on lucky taps), tile cooldown 1.2 s
chest: gold = floor(total gold/s × U{600…3600} s × (1 + 0.005 × Luck))      one per 600 s, ≤ 5 waiting
building cost = floor({500 gold, 250 wood, 150 stone} × 1.6^(buildings already built))
critter gift = max(min, N s of that resource's income)  (×2 golden); N = 10 on the farm, 5 on the map (AMBIENT_LIFE.giftSeconds)
             cooldown: farm 8 s, map 20 s, both gated by the click limiter, amount computed in the store
```

Click limiter: burst bucket 8 tokens refilling 5/s × stamina bucket 20 000 refilling 1.5/s; each paid click takes one token from both.

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

| castle | 20 tiles | 40 tiles | 60 tiles |
| --- | --- | --- | --- |
| 6 | 6 | 9 | 11 |
| 8 | 19 | 27 | 33 |
| 10 | 31 | 45 | 55 |

Conservation rule used by the save check: `legacyPoints + Σ shop spending = legacyEarned`, and `rebirths = 0` implies `legacyEarned = 0` ([07 §3](07-security-and-exploits.md)). More tables in [generated/balance-tables.md](generated/balance-tables.md).

## 10. Combat, monsters and items

```
maxHp        = round(85 + characterStats.hp + Σ gear maxHp + set bonus)         COMBAT.baseHp   (101 at the start)
damage/click = max(1, weapon damage)                                            Wooden Sword 2, Rattatui Fang Blade 3 (COMBAT.maxWeaponDamage)
hit taken    = max(1, round(attack × (1 − armor / (armor + 40))))               COMBAT.armorK
regen        = +1 HP/s with no active fight; knockout restores 30 % of max HP
potion       = +35 HP (not above max), 8 s cooldown shared by all potions in a fight
rat tier t   : HP = round(100 × 1.5^(t−1))  → 100 / 150 / 225 / 338 / 506
               attack = round(4 × 1.25^(t−1)) every 2 s → 4 / 5 / 6 / 8 / 10
tier         = min(5, 1 + floor(age / 1800 s))                                  age counts only while not being fought
rewards      : rewardSec = 90 × 1.5^(t−1)
               gold = floor(max(10, gold/s × rewardSec × (1 + 0.005 × Luck)))
               xp   = max(5, xp/s × (1 + xpGain%) × rewardSec)
drops        : Rattatui piece 8 % + 1 % per tier above 1; potion 25 % + 3 % per tier   (tier 1: 90 s of income, tier 5: ~456 s)
spawn        : first rat 120 s after 5 owned tiles, then 900 s; max 8; Rat King check every 600 s of age after tier 5 (7200 s), 35 %
Rat King     : 1000 HP, attack 5 every 3.5 s, 60 s limit (a starter-kit player takes ~85 damage in that minute)
king invariant: (8 + 5/s × 60 s) clicks × 3 damage = 924 < 1000
```

| Rattatui piece | Slot | Rarity | Armor | Max HP | Damage |
| --- | --- | --- | --- | --- | --- |
| Cap | head | uncommon | 3 | 4 | |
| Shoulderpads | shoulder | uncommon | 3 | 3 | |
| Tunic | chest | rare | 6 | 8 | |
| Gloves | hands | uncommon | 2 | 2 | |
| Trousers | legs | uncommon | 4 | 5 | |
| Boots | feet | uncommon | 2 | 3 | |
| Amulet | neck | rare | | 8 | |
| Cloak | cape | uncommon | 2 | 3 | |
| Ring (x2) | ring | rare | | 5 | |
| Charm | charm | epic | 2 | 10 | |
| Fang Blade | weapon | rare | | | 3 |
| Buckler | shield | rare | 5 | 4 | |

Set bonus: 6 pieces +10 Max HP, 13 pieces +15 Max HP more (both rings count). Everything above lives in `src/config/combatConfig.ts` and `src/config/itemCatalog.ts`.
