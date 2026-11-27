# Bonus system: where every bonus comes from, how they stack, and every cap

Hand-maintained **index** for agents and humans. The rules themselves stay in the JSDoc (`grep -rn "@category" src`); this page
tells you *which* constant to touch, *which bucket* it lands in and *which cap* stops it.
A visual version with the same data: [bonuses.html](bonuses.html) (open it in a browser).

**Keep it true.** Change a bonus, a cap or the order things are combined → update this file **and** `bonuses.html` in the same change.
`tests/docs/bonuses.test.ts` reads every "cap" comment marker (key, equals sign, value, inside an HTML comment) below (and in the HTML) and fails when the value no longer
matches the live constant. Numbers without a marker are explanatory; their source of truth is the constant named next to them.

## 0. How to read

| Kind | Meaning |
|---|---|
| **BASE** | A starting value or a flat amount per second/hit that every % bonus is applied to |
| **ADD%** | Added with the others **inside one bracket**: `1 + a + b + c`. Two +10 % in one bracket = +20 % |
| **MULT** | Its own bracket, multiplied with the other brackets: `(1 + a) x (1 + b)`. Two +10 % in two brackets = +21 % |
| **FLAT** | A flat number added to a total (HP, armor, gems, seconds) |
| **CAP** | A clamp. Names the constant; "gear only" means other sources are added *after* the clamp |

Order of operations in one line: **BASE sum → ADD% bracket → MULT brackets → cap/clamp → floor/round.**

## 1. Economy (resources per second)

Central function: `calculateResourceBreakdown` in `src/utils/game/income.ts` (nothing else combines income; tick, offline grant and server
summary all call it with `gearIncome(equipment, paragonSpent)`).

```
base[r]     = realm base                    BASE_GENERATION_RATES (gold 0.1, xp 0.25)        src/config/economy.ts
            + farm output  x (1 + Scarecrow% + gear Farm Yield%)                              src/utils/game/farm.ts
            + sum over owned tiles: biome rate x BIOME_YIELD.scale x (1 + 0.25 x same-biome 4-neighbours)
            + Producers + Extractors        buildingOutput                                   src/lib/buildingOutput.ts
            + castle area bonus             each tile in castle range adds (its tile output x castleAreaBonus)
            + castle flat XP                0.5 x (castle level - 1)  (xp only)

modifier[r] = (1 + castleMod + plainsMeat + attributeMod)      <- ONE additive bracket
              x emberMult                                       <- MULT  1 + 0.12 x EmbersEverEarned^0.6
              x foreman[r]                                      <- MULT  1 + Foreman 1%/lvl + Overseer 3%/lvl (not xp)
              x gearIncome[r]                                   <- MULT  (1 + gear income%) x (1 + Paragon Income%)  (not xp)
              - 1
total[r]    = base[r] x (1 + modifier[r])         then clamp to RESOURCE_CAP at the tick/offline grant
```

| Source | Kind | Constant / function | File | Cap |
|---|---|---|---|---|
| Realm base | BASE | `BASE_GENERATION_RATES` | `src/config/economy.ts` | none |
| Tile output | BASE | `BIOMES[*].resourceGeneration` x `BIOME_YIELD.scale` <!-- cap:biome.yieldScale=1.3 --> | `src/config/biomes.ts`, `economy.ts` | none |
| **Adjacent same-biome tiles** | ADD% *inside the tile* | `SCALING_CONFIG.adjacencyBonus` <!-- cap:tile.adjacencyBonus=0.25 --> per same-biome 4-neighbour (0-4 → x1.0 to x2.0). Castle tile gets none | `src/config/economy.ts`, `income.ts` | max 4 neighbours = +100 % |
| Castle tile | BASE | `CASTLE_BASE_RATES` (gold 0.1, wood 0.05, stone 0.1, food 0.05, xp 0.5), no x1.3 | `src/config/castle.ts` | none |
| **Castle level modifier** | ADD% | `castleModifier(L)`: `0.2 x 2^(L-1)` to L6, then `6.4 + 3.2 x (L-6)`; L10 = +1920 % <!-- cap:castle.lateLevelStep=3.2 --> <!-- cap:castle.maxLevel=10 --> | `src/config/castle.ts` (`CASTLE_UPGRADE`), `src/utils/game/castle.ts` | level 10 (15 with Castle Expansion Ember upgrade) |
| Imperial Decree (Ember) | MULT on the castle term | doubles `castleModifier` | `src/config/rebirth.ts` (`EMBER_UPGRADES.decree`) | none |
| **Castle area bonus** | BASE (feeds the base, so every modifier above multiplies it) | `CASTLE_AREA_BONUS`: +50 % below L7 <!-- cap:castle.areaEarlyBonus=0.5 -->, from L7 `radius x 1` (+100/200/300/400 % at L7-10). Counts **tile output only**, not buildings | `src/config/castle.ts`, `src/lib/castleWard.ts` | radius max 4 (9x9) → +400 % |
| Castle range / ward | FLAT radius | `CASTLE_RANGE` (grow from L8), `CASTLE_WARD` (L7: no monsters/chests in range) | `src/config/castle.ts` | radius 4 |
| Plains meat | ADD% (meat only) | `CHARACTER_STAT_CONFIG.plainsMeatModifier` 5 % per owned plains tile | `src/config/character.ts` | none |
| Attributes | ADD% | `resourceModifierPerPoint` 2.5 % per point (STR → stone/coal, DEX → wood/food, INT → gold, VIT → food/wood, CHA → gold/coal) | `src/config/character.ts` | points budget |
| Ember income | MULT | `REBIRTH.incomePerPoint` <!-- cap:ember.incomePerPoint=0.12 --> x earned^`incomeExponent` <!-- cap:ember.incomeExponent=0.6 --> | `src/config/rebirth.ts` | none (diminishing exponent) |
| Foreman / Overseer | MULT bucket, ADD inside | Foreman 1 %/lvl (max 10, merchant), Overseer 3 %/lvl (max 10, Ember shop) | `src/config/merchant.ts`, `rebirth.ts` | level caps |
| Gear income % | MULT | `aggregateStats` → `capPerks` | `src/lib/inventory.ts` | `PERK_CAPS.incomePct` <!-- cap:perk.incomePct=50 --> |
| Paragon Income | MULT (own bucket, on top of gear) | `rate x min(points, PARAGON_CAP_POINTS)` = 0.8 %/pt → max 20 % | `src/config/paragon.ts`, `src/lib/gearEconomy.ts` | 25 points |
| Producer | BASE | `15 x biome rate x 1.3 x (1 + 0.5 x (lvl-1)) x (1 + sizeBonus + milestones)`; sizeBonus `min(bonusCap, 0.02 x ownedOfBiome)` <!-- cap:producer.bonusCap=1 -->; biome milestones +0.25 each | `src/config/buildings.ts` (`BUILDING_RULES`, `BIOME_MILESTONES`), `src/lib/buildingOutput.ts` | building level <!-- cap:building.maxLevel=5 --> (hard 15), +100 % size bonus |
| Extractor | BASE | `0.3 x (1 + 0.4 x (lvl-1)) x (1 + sizeBonus)` | same | same |
| Farm | BASE | `ANIMALS` x `FARM_UPGRADES` (pen, feed, pasture, rooster; all MULT with each other) | `src/config/farm.ts`, `src/utils/game/farm.ts` | upgrade max levels |
| Skinner / Master Skinner | ADD% → MULT on meat+hide | 5 %/lvl + 15 %/lvl | `src/config/merchant.ts`, `rebirth.ts` | level caps |
| Scarecrow + gear Farm Yield | ADD% inside one MULT on all farm products | Harvest Idol, `STAT_RULES.farmYieldCap` <!-- cap:gear.farmYield=25 --> | `src/lib/idolEconomy.ts`, `src/config/combatConfig.ts` | gear 25 % |
| XP: attributes + gear + class + Idol + Paragon | ADD% (one sum) | `xpGainPct`: INT 0.2 + CHA 0.25 per point, gear/class `xpPct` (capped), Forest Idol/Training Yard, Paragon XP (counts from level 100) | `src/lib/gearEconomy.ts`, `idolEconomy.ts` | gear+class `PERK_CAPS.xpPct` <!-- cap:perk.xpPct=50 -->; Idol/Paragon part uncapped |
| Click gold | three MULT buckets | `(1 + Click Mastery 50 %/lvl) x (1 + gear clickPct) x (1 + Scarecrow King + Paragon clickGold 3 x sqrt(pts))`; gear `PERK_CAPS.clickPct` <!-- cap:perk.clickPct=40 --> | `src/stores/game/economySlice.ts`, `src/config/economy.ts` (`CLICK_LADDER`, `CLICK_LIMIT`) | gear 40 |
| Merchant sell price | ADD% bracket | `1 + Haggler 3 %/lvl + Master Haggler 10 %/lvl + Lighthouse/Marketplace` → `floor(unit x qty x mult)` | `src/utils/game/merchant.ts` (`SELL_BONUSES`) | level caps |
| Tile price discount | ADD% sum, then clamp | Charisma `0.5/pt` (cap <!-- cap:tile.charismaDiscountCap=25 -->) + Thrift 2 %/lvl + Bulk 1 %/lvl + class + gear (cap <!-- cap:gear.tileDiscount=10 -->) + Paragon 0.4 %/pt (max 10) | `src/utils/game/rebirth.ts` (`effectiveTileDiscount`) | **total** `discountCapPercent` <!-- cap:tile.discountBaseCap=45 --> + 3 x Treasury Charter lvl, hard `discountMaxPercent` <!-- cap:tile.discountMax=80 --> |
| Build time | ADD% sum, then clamp | Master Builders / Mason's Guild / Shrine Keepers 5 %/lvl + Dwarf Statue + gear Build Speed (cap <!-- cap:gear.buildSpeed=15 -->) + Paragon buildSpeed 0.4 %/pt | `src/lib/buildings.ts` (`buildTimeReduction`) | `IDOL_RULES.buildTimeCap` <!-- cap:build.timeCap=60 --> |
| Idols (10 biomes) | ADD% per field, folded into `IdolEconomy` | `IDOL_RULES.perLevel` <!-- cap:idol.perLevel=2 --> % per level; Swamp Idol Luck `luckPerLevel` 4 | `src/config/buildings.ts`, `src/lib/idolEconomy.ts` | level 5 (hard 100) |
| General buildings | ADD% per field | `GENERAL_RULES.perLevel` <!-- cap:general.perLevel=1 --> % per level per copy | `src/config/buildings.ts`, `src/catalog/buildings.ts` | copies (hard 4), level 5 |
| Offline efficiency | ADD% sum, clamp | 50 % + Steward 5 %/lvl + gear + class + Tundra Idol + Paragon offlineEff (0.8 pt/pt) | `src/lib/offline/limits.ts` | hard 100 % |
| Offline cap hours | FLAT sum, clamp | 8 h + Night Watch + gear | `src/lib/offline/limits.ts` | hard 72 h |
| Stockpile ceiling | CAP | `RESOURCE_CAP` <!-- cap:resource.cap=1e21 --> | `src/config/economy.ts` | |
| Gem store | none on production | builders (max 3), crafting speed/slots/discount, cosmetics, respecs | `src/config/gemShop.ts` | `GEM_BUILDERS_MAX` 3 |
| Avatars, pets, achievements | none | cosmetic or one-off gem rewards | `src/catalog/avatars.ts`, `pets.ts`, `achievements.ts` | |

## 2. Combat (one frozen fight profile)

Built once per fight by `playerProfile()` (`src/lib/offline/profile.ts`), mirrored for the UI by `effectiveStats()` (`src/lib/effectiveStats.ts`).
Gear is summed by `aggregateStats` = `capPerks(sum(items, affixes, legendary perks, set bonuses))`.

```
Max HP   = round((85 + 3 VIT + 0.25 CHA + gear.maxHp) x (1 + gear.maxHpPct%)) x (1 + idol hp%) x (1 + idol maxHp%)   [x potion buff]   no cap
Damage   = gear.damage
           x (1 + (attribute% + merchant/Ember physical|magic%))        <- ONE additive bracket (STR 2 %/pt, INT 2.4 %/pt, > 5)
           x (1 + gear.damagePct%)                                       <- MULT, gear CAP 50
           x (1 + Idol + Watchtower + Paragon damage%)                   <- MULT, UNCAPPED
           x (1 + potion buff%) x (1 + mastery.damage%)                  <- mastery CAP 20 (vs that monster type only)
           then armor of the monster:  x (1 - armorReduction(armor after armor-pen))
Speed    = weapon speed x (1 + (0.25 %/DEX above 5 + Quick Hands + Battle Tempo + min(gear.atkSpeed, 25))%)
Crit     = clamp(0, 75, 0.25 DEX + 0.5 CHA + gear.critChance + Keen Eye + Precision + class)   (potion adds, re-clamped)
Crit dmg = x2 crit / x5 super, each multiplied by critExtra = 1 + (attr% + min(gear.critDamage, 50))%, then x (1 + Paragon critDamage%)
Defence  = armor (gear + 0.5/DEX + 0.5/VIT + 0.25/STR + class) x (1 + idol hp/armor%) → r = a/(a+40), halved past 0.5, ceiling 75 %
```

| Source | Kind | Constant / function | File | Cap |
|---|---|---|---|---|
| Attributes (base 5) | ADD% / FLAT | `STAT_RULES`, `CHARACTER_STAT_CONFIG`; budget `totalStatPoints` + 20 per rebirth | `src/config/combatConfig.ts`, `src/config/character.ts`, `src/lib/statBonuses.ts` | points |
| Gear base stats | BASE | `baseStatsAt` = def x `levelScale(L)` (1 + 0.07(L-1)) x quality (±8 %) x rarity (rare 1.1, epic 1.25, legendary 1.5) | `src/lib/itemInstance.ts`, `src/catalog/stats.ts`, `rarity.ts` | item level 100 |
| Affixes | FLAT / % per stat | `affixValue` = magnitude x power x roll [0.6-1.4] x rarity affix multiplier | `src/catalog/affixes.ts`, `src/lib/itemInstance.ts` | per-stat caps below |
| Set bonuses, legendary perks | summed **before** the perk cap | `SET_DEFS`, `LEGENDARY_PERKS` | `src/catalog/sets.ts`, `src/catalog/items/reuse.ts` | perk caps |
| Perk caps (gear bucket) | CAP | `PERK_CAPS`: damage <!-- cap:perk.damagePct=50 -->, xp 50, income 50, kill reward <!-- cap:perk.killRewardPct=60 -->, click 40 | `src/catalog/perkCaps.ts` | |
| Gear life leech | CAP (gear + merchant + Ember) | `STAT_RULES.lifeLeechCap` <!-- cap:gear.lifeLeech=15 --> | `src/config/combatConfig.ts` | Paragon and Idol leech are added **after** the cap |
| Gear attack speed | CAP | `atkSpeedGearCap` <!-- cap:gear.atkSpeed=25 --> | same | |
| Gear crit damage | CAP | `critDamageGearCap` <!-- cap:gear.critDamage=50 --> | same | Paragon crit damage multiplies on top |
| Armor penetration | CAP | `armorPenCap` <!-- cap:gear.armorPen=30 --> | same | |
| Thorns | CAP | `thornsCap` <!-- cap:gear.thorns=25 --> | same | |
| Heal on kill | CAP | `healOnKillCap` <!-- cap:gear.healOnKill=8 --> | same | |
| Boss timer | FLAT s | gear `bossTimerCapSec` <!-- cap:gear.bossTimerSec=30 --> + Paragon (0.6 s/pt, 25 pts) | same, `src/lib/winChance.ts` | gear 30 s |
| Crit chance / super crit | CAP | `COMBAT.crit.maxCritChance` <!-- cap:crit.maxChance=75 -->, `maxSuperChance` <!-- cap:crit.maxSuperChance=50 --> | `src/config/combatConfig.ts` | |
| Dodge | CAP | `COMBAT.maxDodge` <!-- cap:dodge.max=40 --> (gear only) | same | |
| Armor reduction | CAP (soft) | `armorK` 40, `armorSoftCap` 0.5, `armorSoftSlope` 0.5 → ceiling 75 % | same, `src/lib/combat.ts` | 75 % |
| Potions | CAP | power `potionPowerMaxPct` <!-- cap:potion.powerMaxPct=50 -->, slots <!-- cap:potion.maxSlots=5 -->, cooldown floor <!-- cap:potion.cooldownMinSec=4 --> s | same, `src/lib/potionBelt.ts` | max 5 buffs at once |
| Merchant combat (7) and Ember combat (7) | ADD% / FLAT into the attribute bracket | Quick Hands, Keen Eye, Deadly Aim, Might, Arcana, Vampiric Fang, Second Wind; Battle Tempo, Precision, Execution, Brawn, Sorcery, Bloodthirst, Vigor | `src/config/merchant.ts`, `src/config/rebirth.ts`, `src/utils/game/merchant.ts` (`merchantCombat`) | merchant 6-8 lvl, Ember 10 lvl |
| Class passives | FLAT | `CLASS_PASSIVES` (warrior armor, paladin regen, ranger crit, mage mana + spell power) | `src/config/playerClasses.ts` | |
| Idols / buildings (Blight, Watchtower, Battlefield, Garrison) | MULT, uncapped | `IDOL_RULES`, `GENERAL_RULES`, folded by `idolEconomy` | `src/lib/idolEconomy.ts` | level only |
| Paragon (combat) | MULT / FLAT | capped: `rate x min(pts, 25)` critDamage 2, bossTimer 0.6, lifeLeech 0.12; uncapped: `k x sqrt(pts)` damage 2, maxLife 2 | `src/config/paragon.ts` | <!-- cap:paragon.capPoints=25 --> points; hard `PARAGON_ADD_MAX` per upgrade |
| Mastery | MULT vs one monster type | `MASTERY_CAPS`: damage <!-- cap:mastery.damage=20 -->, defense 20, gold 25, xp 25, loot 20 | `src/catalog/mastery.ts`, `src/lib/mastery.ts` | |
| Monster scaling | BASE | normal: hp x sqrt(1.5)^(L-ref), atk x sqrt(1.25)^(L-ref), armor +0.5/lvl; boss follows gear `levelScale`; growth +1 level / 900 s up to +10 | `src/lib/monsters.ts`, `src/config/combatConfig.ts` | growth hard 40 |

## 3. Kill rewards and loot

```
gold = floor( max(10, min(gold/s x rewardSec, monster cap) x levelMult^(L-ref)
                       x (1 + 0.005 x Luck) x (1 + goldFind%))
              x (golden ? 3 : 1) x (1 + killRewardPct) x (1 + mastery.gold) x (1 + deed.gold) )
xp   = max(5, min(xp/s x rewardSec, cap) x levelMult^(L-ref) x 3) x golden x (1 + killRewardPct) x (1 + mastery.xp) x (1 + deed.xp)
drop rolls  = chancePerRoll(0.12 + 0.01/lvl) x (1 + 0.002 x Luck) x (1 + mastery.loot%)      (+1 guaranteed roll if golden)
rarity      = weights of rare+ x min(1.6, 1 + 0.004 x Luck) x (1 + epicFind%) , normalised; epic pity +5 %/miss up to x3
```

| Source | Kind | Constant | File | Cap |
|---|---|---|---|---|
| Luck | FLAT points | CHA + Lucky Charm + Ember Fortune + gear luck + Swamp Idol + Paragon luck (1.2/pt, 25 pts) | `src/lib/effectiveStats.ts`, `src/lib/cloudSave/summary.ts` | none on points |
| Luck effects | various | `LUCK`: spawn speed 0.6 %/pt floor <!-- cap:luck.spawnFloor=0.5 -->, rarity <!-- cap:luck.rarityCap=1.6 -->, drop chance 0.2 %/pt, chest gem chance <!-- cap:luck.gemCap=0.15 -->, golden monster <!-- cap:luck.goldenCap=0.1 --> | `src/config/spawns.ts` | as marked |
| Gold Find | ADD% | gear `goldFind` + Paragon 0.4 %/pt (25 pts); kills and chests only, not sell prices | `src/lib/loot/kill.ts` | gear part **uncapped** |
| Kill Rewards | MULT | gear `killRewardPct` (cap 60) + Jungle Idol/Garrison + Paragon 1.5 x sqrt(pts) | `src/lib/cloudSave/summary.ts` | Idol and Paragon part uncapped |
| Deed milestones | MULT | +1 % each, `DEED_BONUS_CAP_PCT` <!-- cap:deed.capPct=5 --> per stat | `src/catalog/deedMilestones.ts` | |
| Epic Find (Paragon) | ADD% on rare+ weights | 1 x sqrt(pts); also lifts **rare** (`rarityFromOrder` 2) | `src/lib/loot/generate.ts` | uncapped |
| Chest drop (Paragon) | FLAT pts | monster chest 2 % + 0.2 x sqrt(pts) | `src/lib/loot/kill.ts` | uncapped |
| Crafting discount | CAP | `craftCostFactor` = 1 - min(`CRAFT_DISCOUNT_MAX`, 3 %/Thrifty Hands lvl + Bulk Discount 10 %) <!-- cap:craft.discountMax=0.25 --> | `src/lib/crafting.ts`, `src/config/crafting.ts` | |
| Crafting XP | ADD% | Blossom Idol + Guild Hall + Paragon craftXp (2 x sqrt) | `src/lib/crafting.ts` | uncapped |

## 4. Where one number lives (Paragon, Castle, Shops, Gems)

- **Paragon** `src/config/paragon.ts`. 20 upgrades in 4 categories, 3 capped + 2 uncapped each. `capped: rate x min(points, 25)`, `uncapped: rate x sqrt(points)`. Folded into the economy by `PARAGON_IDOL_FIELD` (`src/lib/idolEconomy.ts`) and into the fight by the `idolFx` stamp (`src/lib/offline/pipeline.ts`). Table: Combat (critDamage 2 %, bossTimer 0.6 s, lifeLeech 0.12 %; damage 2, maxLife 2), Economy (income 0.8, xpGain 0.8, tileDiscount 0.4; clickGold 3, killRewards 1.5), Fortune (luck 1.2, goldFind 0.4, goldenChance 0.1; chestDrop 0.2, epicFind 1), Realm (offlineEff 0.8, buildSpeed 0.4, potionPower 0.6; paragonXp 2, craftXp 2). Sim gate: economy at most +25 % around Paragon 400.
- **Castle** `src/config/castle.ts` + `src/utils/game/castle.ts` + `src/lib/castleWard.ts`: modifier (ADD%), area bonus (BASE), range, ward, upgrade timers.
- **Merchant** `src/config/merchant.ts` (14 upgrades, cost `ceil(base x growth^N)`), **Ember shop** `src/config/rebirth.ts` (`EMBER_UPGRADES`, permanent twins plus cap-raisers: Castle Expansion, Treasury Charter, Master Masonry, Idol Mastery, Imperial Decree).
- **Gem store** `src/config/gemShop.ts`: no production or combat stat. Economy-adjacent only: Additional Builder (3 levels), Master Workbench (+0.5 craft speed), Overnight Orders (+24 h batch), Bulk Discount (-10 % craft cost), Building Slot (+1 copy).

## 5. Master cap register

Every hard clamp, one row each. Value markers are test-checked.

| Cap | Value | Constant | Applies to |
|---|---|---|---|
| Stockpile / XP | 1e21 | `RESOURCE_CAP` | all resources |
| Gear income / XP / kill / click / damage | 50 / 50 / 60 / 40 / 50 | `PERK_CAPS` | gear bucket only |
| Tile discount total | 45 + 3 x Charter, hard 80 | `REBIRTH.discountCapPercent`, `discountMaxPercent` | all sources summed |
| Build time cut | 60 | `IDOL_RULES.buildTimeCap` | all sources summed |
| Crit / super crit / dodge | 75 / 50 / 40 | `COMBAT.crit`, `COMBAT.maxDodge` | final stat |
| Armor | ceiling 75 % | `armorSoftCap`, `armorSoftSlope` | damage reduction |
| Paragon capped upgrades | 25 points | `PARAGON_CAP_POINTS` | 12 upgrades |
| Mastery | 20 / 20 / 25 / 25 / 20 | `MASTERY_CAPS` | per monster type |
| Deed | 5 per stat | `DEED_BONUS_CAP_PCT` | kill gold/xp |
| Craft discount | 25 % | `CRAFT_DISCOUNT_MAX` | craft resources |
| Offline | 72 h, 100 % | `HARD_LIMITS` in `src/config/limits.ts` | away grant |
| Building / Idol / castle level | 5 / 5 / 10 (hard 15 / 100 / 15) | `BUILDING_RULES.maxLevel`, `LIMITS`, `HARD_LIMITS` | levels |
| Builders | 3 (gem) / hard 8 | `GEM_BUILDERS_MAX`, `HARD_LIMITS.builders` | builder count |

## 6. Known drift and loose ends (documented, not decided)

1. Several uncapped stacking paths bypass the gear caps: Idol/Building damage, Paragon crit damage and life leech, Idol/Paragon kill rewards, XP from Idol/Paragon, gear Gold Find. Intentional or not is an owner decision.
2. Guest saves stamp only `damagePct`, `hpArmorPct`, `merchantSellPct` into `idolFx` (`src/lib/guest/localRepos.ts`), so guest fights skip the Paragon maxHp, critDamage, lifeLeech, bossTimer and potionPower bonuses the server applies.
3. Epic Find also lifts **rare** weights (the Paragon text says "epic and better").
4. `effectiveStats.hpRegen` includes the idle 1 HP/s; the in-fight profile does not.
5. Paragon Gold Find does not affect sell prices (its blurb says "drops and sales").

## 7. When you change a bonus

1. Edit the constant and its JSDoc block (`@category`, `@formula`).
2. Update the row here and in `bonuses.html`; update or add the cap comment marker (copy an existing one) and its mapping in `tests/docs/bonuses.test.ts`.
3. New bonus source? Say which bracket it lands in (BASE / ADD% / MULT) and which cap, in the section above.
4. `npx tsx --test tests/docs/bonuses.test.ts`, then `npm run verify`.
