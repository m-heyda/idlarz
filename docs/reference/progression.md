# Progression

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Levels, attributes, skills, rebirth, Embers, limits and gems.

**Contents**

- Levels: [`LEVELING`](#leveling), [`xpToNextLevel`](#xptonextlevel), [`totalStatPoints`](#totalstatpoints), [`cumulativeXp`](#cumulativexp), [`calculateLevel`](#calculatelevel), [`reconcileCharacter`](#reconcilecharacter)
- Attributes: [`CHARACTER_STAT_CONFIG`](#character-stat-config), [`calculateStatResourceModifiers`](#calculatestatresourcemodifiers), [`calculateCombatStats`](#calculatecombatstats)
- Rebirth: [`REBIRTH`](#rebirth), [`emberGain`](#embergain), [`emberIncomeBonus`](#emberincomebonus), [`rebirthStatus`](#rebirthstatus), [`rebirthUnlockIntro`](#rebirthunlockintro)
- Ember shop: [`EMBER_UPGRADES`](#ember-upgrades), [`emberUpgradeCost`](#emberupgradecost)
- Limits: [`LIMITS`](#limits), [`limitOf`](#limitof)
- Gems: [`STARTING_GEMS`](#starting-gems)
- Crafting: [`CRAFTING`](#crafting), [`CRAFT_GEAR`](#craft-gear), [`gearItemLevels`](#gearitemlevels), [`qualityBiasOf`](#qualitybiasof), [`pityMultiplier`](#pitymultiplier), [`rollGear`](#rollgear), [`gearOdds`](#gearodds)
- Class passives: [`classPassives`](#classpassives), [`classXpBucket`](#classxpbucket)
- Achievements: [`settleAchievements`](#settleachievements), [Achievements](#achievements)
- Guided tutorial: [`guideLive`](#guidelive), [`buildNumbers`](#buildnumbers), [`readProgress`](#readprogress), [`applyTutorial`](#applytutorial), [`TutorialGuide`](#tutorialguide), [The guided tutorial](#tutorial-path)

## Levels

<a id="leveling"></a>

### `LEVELING` <small>const</small>

Source: [`src/config/character.ts:55`](../../src/config/character.ts)

Character level 1-100 (`maxLevel`). XP is lifetime and **carries over a rebirth**, so the curve is paced over rebirths, not days.

The curve is written as anchors, the total XP needed to reach a level: 10 -> 1.4e5, 30 -> 1.0e8, 80 -> 3.0e9, 90 -> 6.5e9, 100 -> 1.85e10. The first step (level 1 to 2) is 5,000 XP (`firstStepXp`).
Between two anchors each step is the one before times a constant ratio, solved by bisection so the segment sums to the anchor and steps never shrink at a join ([`xpToNextLevel`](progression.md#xptonextlevel), [`cumulativeXp`](progression.md#cumulativexp), [`calculateLevel`](progression.md#calculatelevel)).
The soft cap level is 80 (`softCapLevel`, informational). Retune the anchors (not the code) when the sim's XP supply changes.

XP sources: passive `rates.xp x (1 + XP gain %)`, every tile purchase ([`calculateXpGain`](economy.md#calculatexpgain)), and server payouts (kills, chests, away time).

**Attribute points**: 1 per level, plus 2 extra per level for levels 2-30 (`earlyBonusUntil` 30, `earlyBonusPoints` 2), see [`totalStatPoints`](progression.md#totalstatpoints). There is no paragon level and no +20 points per rebirth in the code.

**Total XP to reach a level** _(computed from the code)_

| Level | Total XP |
| --- | --- |
| 2 | 5,000 |
| 5 | 29.6 K |
| 10 | 140 K |
| 20 | 3.45 M |
| 30 | 100 M |
| 50 | 853 M |
| 80 | 3 B |
| 90 | 6.5 B |
| 99 | 16.8 B |
| 100 | 18.5 B |

See also: [`xpToNextLevel`](progression.md#xptonextlevel), [`totalStatPoints`](progression.md#totalstatpoints)

<a id="xptonextlevel"></a>

### `xpToNextLevel` <small>function</small>

Source: [`src/utils/game/character.ts:186`](../../src/utils/game/character.ts)

XP to go from `level` to the next one (Infinity at the maximum level). The one place the level curve lives (see LEVELING in the config);
everything that shows or checks a level threshold uses this.

**Formula**

```text
step(level -> level+1) = previous step x ratio of its anchor segment      (ratio solved so the segment sums to the anchor)
cumulativeXp(level)    = sum of steps up to level                         hits every LEVELING.anchors entry exactly
```

<a id="totalstatpoints"></a>

### `totalStatPoints` <small>function</small>

Source: [`src/utils/game/character.ts:151`](../../src/utils/game/character.ts)

The attribute points a character that has reached `level` has earned in all (a level gives 1; the early levels give extra, see LEVELING).

`reconcileCharacter` hands every point back when a character holds more than its level has earned.

**Formula**

```text
totalStatPoints(level) = (level - 1) + (min(level, 30) - 1) x 2
```

**Attribute points earned by level** _(computed from the code)_

| Level | Total points |
| --- | --- |
| 2 | 3 |
| 10 | 27 |
| 30 | 87 |
| 80 | 137 |
| 100 | 157 |

See also: [`reconcileCharacter`](progression.md#reconcilecharacter)

<a id="cumulativexp"></a>

### `cumulativeXp` <small>function</small>

Source: [`src/utils/game/character.ts:198`](../../src/utils/game/character.ts)

The total XP at which `level` is reached (level 1 is 0).

<a id="calculatelevel"></a>

### `calculateLevel` <small>function</small>

Source: [`src/utils/game/character.ts:210`](../../src/utils/game/character.ts)

Level from total XP: each level needs more than the one before (see `xpToNextLevel`), up to MAX_LEVEL, where the bar is full.

<a id="reconcilecharacter"></a>

### `reconcileCharacter` <small>function</small>

Source: [`src/utils/game/character.ts:166`](../../src/utils/game/character.ts)

Puts a character's attributes in line with an XP total: when more points are spent (and left to spend) than that XP's level has earned
(the XP was lowered: the server clamped an impossible total, or a curve change), the attributes go back to their start value and every
point the level has earned is left to spend again. A character that is within its points is returned as it is.

## Attributes

<a id="character-stat-config"></a>

### `CHARACTER_STAT_CONFIG` <small>const</small>

Source: [`src/config/character.ts:92`](../../src/config/character.ts)

Attributes. Five attributes start at 5 (`INITIAL_CHARACTER_STATS`). Resource effects use **all** points; combat effects count the points **above 5** (`STAT_RULES.base`).

| Attribute | Economy per point | Combat per point (above 5 unless noted) |
| --- | --- | --- |
| Strength | +2.5% stone and coal | +2% damage with physical weapons, +0.25 armor, +1% crit damage |
| Dexterity | +2.5% wood and food | +0.5 armor, +0.25% attack speed, +0.5% crit damage; +0.25% crit chance (all points) |
| Intelligence | +2.5% gold; +0.2% XP production; +0.2% XP gained | +2.4% damage with staves and wands (and Heal), +4 max mana (all points), +0.05 mana/s (all points) |
| Vitality | +2.5% food and wood | +0.5 armor; +3 max HP (all points) |
| Charisma | +2.5% gold and coal; +0.25% XP production; +0.25% XP gained; -0.5% tile cost (max 25%); +1 Luck | +0.5% crit damage; +0.5% crit chance (all points); +0.25 HP (all points) |

Sources: this config, `STAT_RULES` ([`COMBAT`](combat.md#combat)), [`calculateStatResourceModifiers`](progression.md#calculatestatresourcemodifiers), [`calculateCombatStats`](progression.md#calculatecombatstats). Mana base is 20, so a new character has 40 mana.

See also: [`calculateStatResourceModifiers`](progression.md#calculatestatresourcemodifiers), [`calculateCombatStats`](progression.md#calculatecombatstats)

<a id="calculatestatresourcemodifiers"></a>

### `calculateStatResourceModifiers` <small>function</small>

Source: [`src/utils/game/character.ts:234`](../../src/utils/game/character.ts)

What the five attributes add to the income modifier of each resource (all points count, not only those above 5).

**Formula**

```text
modifier[r] += 0.025 per attribute point on each resource the attribute feeds; xp: +0.2% (Int) / +0.25% (Cha) per point
```

<a id="calculatecombatstats"></a>

### `calculateCombatStats` <small>function</small>

Source: [`src/utils/game/character.ts:267`](../../src/utils/game/character.ts)

The combat numbers the attributes give (max HP and mana pools, crit chance, ...), from all points or the points above 5 as each rule says.

## Rebirth

<a id="rebirth"></a>

### `REBIRTH` <small>const</small>

Source: [`src/config/rebirth.ts:22`](../../src/config/rebirth.ts)

Rebirth: restart with a permanent bonus paid in Embers. The rules live in `REBIRTH` and are checked by [`rebirthStatus`](progression.md#rebirthstatus), the one function the button, the dialog, the store and the server share.

- **Requirements**: castle level >= 6 (`minCastleLevel`), economy tile count >= `400 + 50 x rebirths already done` (`minTiles`, `tilesPerRebirth`), no castle upgrade running, and at least 1 Ember of gain.
- **Embers gained**: see [`emberGain`](progression.md#embergain). **Income bonus**: see [`emberIncomeBonus`](progression.md#emberincomebonus).
- **What resets** (`rebirth` in `src/stores/game/rebirthSlice.ts`): map (new start ring), resources, castle, animals, buildings, chests, monsters and any open fight, click level, farm upgrades, all merchant upgrades except Pack Rat,
  the bag and worn gear (back to the starter kit; the Pack Rat bag size is kept), loot pity, attributes (all points are handed back to spend again), HP and mana refilled.
- **What is kept**: name, class, play time, gems, all Embers and shop levels, lifetime XP and level, the auto-sell setting, the merchant's shelf with its rotation clock and the refresh count (a rebirth is no free reshuffle).
- The server runs the rebirth first (`POST /api/rebirth`): it checks the stored save, wipes the ledger's inventory to the starter kit and pays at most its own computed gain; the browser takes the lower number.
- Auto-battle unlocks after the first rebirth (`COMBAT.auto.minRebirths`).

**Known issues**

- IDL-223 the gear wipe on rebirth is live without a crafting sink (RELEASE-PLAN P11); needs an owner decision.

See also: [`rebirthStatus`](progression.md#rebirthstatus), [`emberGain`](progression.md#embergain)

<a id="embergain"></a>

### `emberGain` <small>function</small>

Source: [`src/utils/game/rebirth.ts:97`](../../src/utils/game/rebirth.ts)

Embers a rebirth gives: the castle and territory formula, plus the Ancestral Tithe's bonus.

`REBIRTH.gain`: `gainScale` 3, `castleExponent` 1.3, `surplusPerTile` 0.02. The Ancestral Tithe merchant upgrade adds +5% per level.

**Formula**

```text
base = floor(3 x (castle level - 5)^1.3 x (sqrt(tiles / 10) + 0.02 x max(0, tiles - tilesNeeded)))
gain = floor(base x (1 + 0.05 x Ancestral Tithe level))
```

**Embers gained (no Ancestral Tithe)** _(computed from the code)_

| Castle level | Tiles | Rebirths already done | Embers |
| --- | --- | --- | --- |
| 6 | 400 | 0 | 18 |
| 6 | 450 | 0 | 23 |
| 8 | 500 | 0 | 113 |
| 10 | 500 | 0 | 220 |
| 10 | 1000 | 0 | 534 |
| 10 | 450 | 1 | 163 |

<a id="emberincomebonus"></a>

### `emberIncomeBonus` <small>function</small>

Source: [`src/utils/game/rebirth.ts:49`](../../src/utils/game/rebirth.ts)

The income bonus (0.5 = +50 %) that `earned` Embers ever earned give: linear when `incomeExponent` is 1, flatter when it is below 1.

Folded into the income modifier of every resource ([`calculateResourceBreakdown`](economy.md#calculateresourcebreakdown)). Spending Embers never lowers it, because it counts the Embers ever earned.

**Formula**

```text
income bonus = 0.1 x (Embers ever earned)^0.6          multiplier = 1 + bonus
```

**Income bonus from Embers ever earned** _(computed from the code)_

| Embers earned | Income bonus |
| --- | --- |
| 10 | +40% |
| 22 | +64% |
| 47 | +101% |
| 76 | +134% |
| 170 | +218% |
| 500 | +416% |

<a id="rebirthstatus"></a>

### `rebirthStatus` <small>function</small>

Source: [`src/utils/game/rebirth.ts:128`](../../src/utils/game/rebirth.ts)

Can the player rebirth, and if not what is missing. The header button, the rebirth window and the store's `rebirth`
all read this one function, so what the tooltip promises is what the action checks.

**Formula**

```text
can rebirth = castle level >= 6  and  economyTiles >= 400 + 50 x rebirths  and  no castle upgrade running  and  Embers gained >= 1
```

<a id="rebirthunlockintro"></a>

### `rebirthUnlockIntro` <small>function</small>

Source: [`src/utils/game/rebirthUnlocks.ts:28`](../../src/utils/game/rebirthUnlocks.ts)

The biome a rebirth unlocks, with what its tiles make, for the small modal shown right after the rebirth. `null` when that rebirth unlocks nothing (the sixth and later).

## Ember shop

<a id="ember-upgrades"></a>

### `EMBER_UPGRADES` <small>const</small>

Source: [`src/config/rebirth.ts:58`](../../src/config/rebirth.ts)

The Ember shop: level N+1 costs `ceil(baseCost x costGrowth^N)` Embers ([`emberUpgradeCost`](progression.md#emberupgradecost)); the upgrades have 10 levels, except Deep Pockets (+4 bag slots per level, 3 levels, 30 / 54 / 98 Embers; it reads through `limitOf('bagSize')`). Shop levels are permanent: nothing refunds Embers.
The save is valid only if `unspent + spent = earned` and `rebirths = 0` implies `earned = 0` (checked in `src/lib/sanitizeSave.ts`). Thrift shares the 45% tile-discount cap with Charisma and Bulk Discount; buildings take Thrift only.

**The Ember shop** _(computed from the code)_

| Id | Label | Base cost (Embers) | Effect per level |
| --- | --- | --- | --- |
| thrift | Thrift | 2 | -2% tile and building cost |
| builders | Master Builders | 3 | -5% castle build time |
| mastery | Click Mastery | 2 | +25% gold per click |
| provisions | Provisions | 2 | start every run with +1 bundle(s) of gold 1,500, wood 400, stone 400 |
| nightwatch | Night Watch | 2 | +1 hour of paid away time |
| steward | Steward | 3 | +5% income while away |
| deeppockets | Deep Pockets | 30 | +4 bag slots |

<a id="emberupgradecost"></a>

### `emberUpgradeCost` <small>function</small>

Source: [`src/utils/game/rebirth.ts:26`](../../src/utils/game/rebirth.ts)

Cost in Embers of buying the next level of an upgrade, given its current level.

**Formula**

```text
cost of level N+1 = ceil(baseCost x 1.4^N) Embers
```

## Limits

<a id="limits"></a>

### `LIMITS` <small>const</small>

Source: [`src/config/limits.ts:14`](../../src/config/limits.ts)

Limits that upgrades raise. These are base values; code reads them through [`limitOf`](progression.md#limitof), which adds the bonuses registered in `LIMIT_BONUSES` (today: Pack Rat and the Deep Pockets Ember upgrade raise the bag size; Night Watch and set bonuses the away hours;
Steward and set bonuses the away efficiency). `HARD_LIMITS` is the most a save may hold, so raising a limit later never invalidates a save and a forged save cannot go beyond it.

**Limits (base values and hard caps)** _(computed from the code)_

| Limit | Base | Hard cap | Raised by |
| --- | --- | --- | --- |
| `monsterGrowthLevels` | 10 | 40 | nothing yet |
| `monsterGrowthIntervalSec` | 1,800 | n/a | nothing yet |
| `battleQueue` | 10 | 16 | nothing yet |
| `merchantOffers` | 6 | 12 | nothing yet |
| `merchantRotateSec` | 1,800 | n/a | nothing yet |
| `merchantRefreshBase` | 10 K | n/a | nothing yet |
| `bagSize` | 60 | 200 | Pack Rat +8 per level, Deep Pockets +4 per level |
| `offlineCapHours` | 8 | 72 | Night Watch +1 h per level, set bonus hours |
| `offlineEfficiency` | 0.5 | 1 | Steward +0.05 per level, set bonus points |
| `offlineMinGapSec` | 300 | n/a | nothing yet |
| `craftBatchCap` | 1 B | 1 B | nothing yet |
| `craftQueueSlots` | 3 | 5 | nothing yet |
| `craftOfflineHours` | 8 | 72 | nothing yet |
| `craftSpeed` | 1 | 4 | nothing yet |

See also: [`limitOf`](progression.md#limitof)

<a id="limitof"></a>

### `limitOf` <small>function</small>

Source: [`src/lib/limits.ts:37`](../../src/lib/limits.ts)

The current value of a limit: its base plus the registered bonuses.

**Formula**

```text
limit = LIMITS[key] + LIMIT_BONUSES[key](context)           or HARD_LIMITS[key] with ctx.hardCap
```

## Gems

<a id="starting-gems"></a>

### `STARTING_GEMS` <small>const</small>

Source: [`src/config/economy.ts:219`](../../src/config/economy.ts)

Gems every player starts with (also granted to saves from before Gems existed).

Gems: premium currency, not part of `Resources`. Every player starts with 1,000 (also saves from before gems existed), the cap is 1e9 (`GEMS_CAP`), a rebirth keeps them and nothing spends them yet.
The only gem source is the chest bonus roll. The server's ledger holds the real balance, an upload can never raise it.

## Crafting

<a id="crafting"></a>

### `CRAFTING` <small>const</small>

Source: [`src/config/crafting.ts:14`](../../src/config/crafting.ts)

Crafting: the crafting level curve and the per-request limits. First draft, see `docs/plan/crafting-v0.md`. The curve is written as anchors like [`LEVELING`](progression.md#leveling): the total crafting XP at which a level is reached; between two anchors every step
is the one before times a constant ratio (`src/lib/crafting.ts`). Recipes are data in `src/catalog/recipes.ts`. The crafting level is kept on rebirth (like the character level). Batch cap, queue slots, offline run hours and speed are limits
([`LIMITS`](progression.md#limits): `craftBatchCap`, `craftQueueSlots`, `craftOfflineHours`, `craftSpeed`).

<a id="craft-gear"></a>

### `CRAFT_GEAR` <small>const</small>

Source: [`src/config/crafting.ts:46`](../../src/config/crafting.ts)

Gear crafting (IDL-241, docs/plan/17-crafting.md sections 2 and 7): the knobs of the `craft` loot source. A gear recipe is a grade and a slot; the server rolls the result at claim time through
the loot pipeline (`LOOT_SOURCES.craft`, profile `craft`, pool `equipment_craft`), sealed on the lifetime craft counter `craft.ord`.

- **Grades**: G1-G4 (`ceilingGrade`); a recipe unlocks at the crafting level of its grade (`unlock` in `src/catalog/recipes.ts`: G1 1, G2 8, G3 15, G4 25, owner 2026-11-07).
- **Item level**: inside the grade's window, rising with the crafting level from the grade's unlock to the next grade's (`gradeLevel`), +-1 around the centre. Never above the window, so a Hide recipe always makes Hide gear.
- **Rarity**: the profile's weights among the rarities the grade carries (`GRADE_INFO`), Luck multiplying rare and better (`rarityLuckMultiplier`); the crafting level caps it (`rarityCeiling`: up to rare, epic from 50, never legendary).
- **Pity**, per grade, kept in `craft.pity` across rebirths: every craft that misses the grade's best rarity adds `pity.perMiss` to a multiplier on that rarity's weight (up to `pity.maxMultiplier`), a hit resets it. A grade with one rarity has none.
- **Intelligence** leans the quality and every affix magnitude toward the top (`rollLeaning`): bias = (Intelligence - 5) x `qualityPerInt`, at most `qualityBiasCap`. It never touches the rarity or the affix count.

**Gear crafting by grade** _(computed from the code)_

| Grade | Unlock (crafting level) | Item level at unlock / at the next unlock | Seconds each | Rarities | Rarity chances at Luck 0 | at Luck 250 (cap) | Best rarity (pity) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 Starter | 1 | 1-2 / 7-8 | 20 | common | common 100% | common 100% | none (one rarity) |
| G2 Hide | 8 | 9-10 / 17-18 | 30 | common, uncommon | common 76.09%, uncommon 23.91% | common 76.09%, uncommon 23.91% | uncommon |
| G3 Iron | 15 | 19-20 / 29-30 | 45 | uncommon | uncommon 100% | uncommon 100% | none (one rarity) |
| G4 Steel | 25 | 31-32 / 41-42 | 60 | uncommon, rare | uncommon 78.57%, rare 21.43% | uncommon 69.62%, rare 30.38% | rare |

<a id="gearitemlevels"></a>

### `gearItemLevels` <small>function</small>

Source: [`src/lib/craftGear.ts:37`](../../src/lib/craftGear.ts)

The item level a recipe of this grade makes, by crafting level: the grade's window (`gradeLevels`) is climbed from its bottom at the grade's unlock to its top at the next grade's unlock, and the roll is +-1 around that centre, never outside the window.

**Formula**

```text
centre = round(window low + (window high - window low) x clamp((crafting level - unlock) / (next unlock - unlock), 0, 1))
item level = centre - 1 .. centre + 1, held inside the grade's window
```

<a id="qualitybiasof"></a>

### `qualityBiasOf` <small>function</small>

Source: [`src/lib/craftGear.ts:57`](../../src/lib/craftGear.ts)

Intelligence's lean on the quality and the affix magnitudes of a craft, for `rollLeaning`.

**Formula**

```text
bias = min(1, 0.01 x (Intelligence - 5)), 0 at 5 or less
```

<a id="pitymultiplier"></a>

### `pityMultiplier` <small>function</small>

Source: [`src/lib/craftGear.ts:78`](../../src/lib/craftGear.ts)

The pity multiplier on the grade's best rarity after `misses` crafts that missed it.

**Formula**

```text
multiplier = min(1.5, 1 + 0.05 x misses)        a hit resets the counter; a grade with one rarity has none
```

<a id="rollgear"></a>

### `rollGear` <small>function</small>

Source: [`src/lib/craftGear.ts:114`](../../src/lib/craftGear.ts)

One crafted piece: the `craft` loot source rolls rarity (Luck, pity, ceiling), base, quality and affixes (Intelligence) for the recipe's slot inside the grade's item level window, and the piece is marked `crafted`. Null when nothing is eligible (a
configuration error, never silently replaced).

The roll of one gear craft. The server calls it once per delivered piece with `sealedRng(secret, user, 0, 'craft', craft.ord + n)`: the lifetime counter, not the run's, so a rebirth never repeats a sequence and a replayed claim rolls the same pieces.
Rarity: the `craft` profile's weights among the grade's rarities, Luck on rare and better, the pity multiplier on the grade's best rarity, the crafting level's ceiling. Item level: [`gearItemLevels`](progression.md#gearitemlevels). Quality and affix magnitudes: [`qualityBiasOf`](progression.md#qualitybiasof).

See also: [`gearOdds`](progression.md#gearodds), [`CRAFT_GEAR`](progression.md#craft-gear)

<a id="gearodds"></a>

### `gearOdds` <small>function</small>

Source: [`src/lib/craftGear.ts:140`](../../src/lib/craftGear.ts)

What the Crafting window's odds panel shows for a recipe: the rarity chances at the player's Luck, pity and crafting level, the item level range, the pity multiplier and the quality lean. Read from the roll's own loot trace (`generateLoot` with a fixed rng), so the panel is the real odds and cannot drift from the roll.

## Class passives

<a id="classpassives"></a>

### `classPassives` <small>function</small>

Source: [`src/lib/classPassives.ts:24`](../../src/lib/classPassives.ts)

The passives of a hero class (`CLASS_PASSIVES`, `src/config/playerClasses.ts`): one combat and one economy bonus each (the Mage's combat one is mana and Spell Power together).

| Where it lands | How |
| --- | --- |
| Armor, max mana, Spell Power (healing) | added to the character's own number before it is used ([`armorOf`](combat.md#armorof), `maxMana`, [`healAmount`](combat.md#healamount)) |
| Crit chance, HP regeneration | added to the merchant's `CombatBonus` (`withClassBonus`), so they count in fights, in the idle regeneration and in the win chance |
| Tile discount | added to Charisma, Thrift and Bulk Discount, inside the tile-discount cap ([`effectiveTileDiscount`](economy.md#effectivetilediscount)) |
| Offline efficiency | added to the Steward and the set bonuses, under the hard limit (`offlineEfficiency`) |
| XP gain | added to the gear's XP bucket, under the XP perk-family cap ([`classXpBucket`](progression.md#classxpbucket)) |
| Chest speed | the chest interval is divided by `1 + chestSpeed / 100` ([`chestIntervalSec`](economy.md#chestintervalsec)) |

No class passive has a multiplier bucket of its own. The class is read from the profile row (the save route stamps it over the upload, see
`acceptSave`), never from a number the browser sends, and the server runs the fight profile and the economy summary on it.

**Class passives** _(computed from the code)_

| Class | Combat | Economy |
| --- | --- | --- |
| Warrior | +2 armor | -3% tile cost |
| Paladin | +0.25 HP/s regeneration | +5% offline efficiency |
| Ranger | +2% crit chance | +5% chest speed |
| Mage | +8 max mana, +5% spell power | +5% XP gain |

<a id="classxpbucket"></a>

### `classXpBucket` <small>function</small>

Source: [`src/lib/classPassives.ts:46`](../../src/lib/classPassives.ts)

The gear's XP bucket with the class's XP added, held under the XP perk-family cap: the class counts like gear, it never lifts the bucket above `PERK_CAPS.xpPct`.

**Formula**

```text
xp bucket = min(PERK_CAPS.xpPct, gear XP% + class XP%)          then + the attributes' XP gain
```

## Achievements

<a id="settleachievements"></a>

### `settleAchievements` <small>function</small>

Source: [`src/lib/offline/achievements.ts:111`](../../src/lib/offline/achievements.ts)

Lazy evaluation, once per online request: the achievements that became due are paid and recorded in the same ledger write (a compare-and-swap, so two requests
at once cannot both pay; a replayed request finds the id recorded and pays nothing). The caller mirrors the ids into `player_achievements` with
`insert ... on conflict do nothing` after the write lands (`AchievementRepo`).

- **Gems**: `rewards.gems` is added to `ledger.gems` (capped by `GEMS_CAP`) and to `granted.gems`, like a chest's gem find. Gems are not an economy input, so the pacing sim does not move.
- **Avatar and title** are only recorded with the achievement; the avatar picker (IDL-71) offers the avatars of the earned ones.
- **Early tester** is never checked here: the new chapter reset grants it.
- **Dark until the new chapter**: while the guide is dark (`guideLive`: `GAME_EPOCH` still the baseline and no `NEXT_PUBLIC_GUIDE=on`) nothing is paid, so the live game gets no surprise gems and the first achievement
  (the tutorial's end) cannot be reached anyway. The one-line epoch flip switches it on together with the guide.

See also: `achievementsDue`, `payAchievements`

<a id="achievements"></a>

### Achievements

Source: [`src/catalog/achievements.ts:51`](../../src/catalog/achievements.ts)

The 12 launch achievements: 600 gems in total and 4 avatars (docs/plan/21 section 3). Gems are paid once per account by the server when the condition first holds
([`settleAchievements`](progression.md#settleachievements)); the early tester is granted by the new chapter reset instead of being checked. "Rat King defeated" was replaced by the first boss, The Great Auroch.
The first one ends where the guided tutorial's starter path ends. Later releases add grind ladders (R6) after these.

**The launch achievements (12, 600 gems in total)** _(computed from the code)_

| # | Id | Title | Condition | Gems | Avatar / title |
| --- | --- | --- | --- | --- | --- |
| 1 | `tutorial` | Learned the ropes | last step of the starter path done | 25 | - |
| 2 | `first-tile` | Landowner | tiles >= 1 | 25 | - |
| 3 | `first-building` | Builder | buildings >= 1 | 25 | - |
| 4 | `first-fight` | First blood | kills >= 1 | 25 | - |
| 5 | `first-chest` | Treasure hunter | chests >= 1 | 25 | - |
| 6 | `castle-2` | Growing keep | castle level 2 | 25 | - |
| 7 | `castle-6` | Stout walls | castle level 6 | 75 | - |
| 8 | `castle-10` | Architect | castle level 10 | 100 | architect |
| 9 | `first-rebirth` | Reborn | rebirths >= 1 | 75 | reborn |
| 10 | `great-auroch` | Boss slayer | 1 x `bossGreatAuroch` | 50 | boss-slayer |
| 11 | `golden-kill` | Golden touch | golden >= 1 | 50 | - |
| 12 | `early_tester` | Early tester | granted by the new chapter reset | 100 | early-tester / early-tester |

See also: [`settleAchievements`](progression.md#settleachievements), `achievementsDue`

## Guided tutorial

<a id="guidelive"></a>

### `guideLive` <small>function</small>

Source: [`src/lib/tutorial/live.ts:10`](../../src/lib/tutorial/live.ts)

Whether Brother Alder is on at all. The tutorial ships dark with the new chapter: until `GAME_EPOCH` is raised (the release flip, IDL-253) nobody sees it, so accounts that are
playing the old chapter get no bubbles. To try it on a build before the flip, set `NEXT_PUBLIC_GUIDE=on`.

<a id="buildnumbers"></a>

### `buildNumbers` <small>function</small>

Source: [`src/lib/tutorial/numbers.ts:31`](../../src/lib/tutorial/numbers.ts)

The numbers the tutorial texts quote, read from the live config at the moment they are shown (a changed price changes the text, nothing is typed in):
the first tile's price, the first animal and its food price, the first castle upgrade's price and time, the chest interval, the offline cap and
efficiency, and the rebirth requirements.

<a id="readprogress"></a>

### `readProgress` <small>function</small>

Source: [`src/lib/tutorial/progress.ts:18`](../../src/lib/tutorial/progress.ts)

Reads the stored `stats.tutorial` (or an answer from the server) back: a missing field, null or anything malformed reads as nothing done, ids that are
not in the catalog any more (a step removed in a later release) are dropped, nothing is trusted to be the right shape.

<a id="applytutorial"></a>

### `applyTutorial` <small>function</small>

Source: [`src/lib/offline/tutorial.ts:45`](../../src/lib/offline/tutorial.ts)

Applies one tutorial request to the ledger. `done` records a step once and pays its bundle (gold and wood as `granted` totals, items through
`receiveInto`); repeating it, with the same key or another, changes nothing and pays nothing. `lesson` records a fired lesson, `skip` ends the starter path
(later bundles are forfeited), `sync` only reads. Progress lives in the ledger's `stats` and resets with it at a new chapter.

See also: [`readProgress`](progression.md#readprogress)

<a id="tutorialguide"></a>

### `TutorialGuide` <small>function</small>

Source: [`src/components/game/tutorial/TutorialGuide.tsx:39`](../../src/components/game/tutorial/TutorialGuide.tsx)

Brother Alder, the tutorial guide. Mounted once in the game (GameApp). It counts the few events the state does not keep (map clicks, chests opened, fights won),
evaluates the triggers twice a second (`lib/tutorial/engine.ts`), records finished steps and fired lessons on the account (the server may pay a starter bundle),
and draws the bubble and the focus layer for the beat that is on show. Nothing is drawn while the guide is dark (`guideLive`), switched off in Settings, or before the
account's progress has arrived; a target that is not on screen shows the bubble alone and never blocks the game.

<a id="tutorial-path"></a>

### The guided tutorial

Source: [`src/catalog/tutorial.ts:131`](../../src/catalog/tutorial.ts)

The guided tutorial (IDL-74): **Brother Alder**, a monk drawn on the left of the screen with a speech bubble. It ships dark: nothing is shown until `GAME_EPOCH` is raised (the new chapter release), or on a build with `NEXT_PUBLIC_GUIDE=on` ([`guideLive`](progression.md#guidelive)).

- **Intro**: on the first start of a chapter the screen dims and Alder speaks three short bubbles. **Starter path**: eight steps in the order of [`TUTORIAL_PATH`](progression.md#tutorial-path). The first step that is *ready* and not done is on show (the castle upgrade waits until it can be paid, the next ready step is shown meanwhile); a step the player did on their own is recorded without being shown. **Milestone lessons** (`TUTORIAL_LESSONS`) fire the first time something is reached, in any order, after the path; each is kept in the Guide's journal tab (locked ones read '???').
- **Focus**: `strict` dims and blurs the whole game with a cut-out around the `data-tutorial` target and blocks every click outside it (the intro and the first two steps); `soft` only dims. A target that is not on screen shows the bubble alone and never blocks the game. **Skip** is on every bubble and ends the starter path (lessons still come); the guide can be switched off in Settings.
- **Texts** are one or two sentences with numbers read from the config ([`buildNumbers`](progression.md#buildnumbers)). **Order is data**: a step is inserted between two others by putting it there (the new building system adds its 'build' step that way).
- **Progress is per account on the server** (`stats.tutorial` in the ledger: done ids, fired lessons, skipped; no migration) and resets with the ledger at a new chapter. **Starter bundles** are paid once per account by the server when a step is recorded, only if the last accepted save shows the step happened, and counted as `granted` ([`applyTutorial`](progression.md#applytutorial)). The sim bot receives them at the same events.
- The long reference page (`Tutorial.tsx`) stays as the Guide's reference tab until every section has a journal entry.

**The starter path and its bundles** _(computed from the code)_

| # | Step | Focus | Bundle (once per account) |
| --- | --- | --- | --- |
| 1 | `click-gold` | strict | - |
| 2 | `buy-tile` | strict | 100 gold, 20 wood |
| 3 | `buy-animal` | soft | - |
| 4 | `castle-upgrade` | soft | 300 gold |
| 5 | `open-chest` | soft | - |
| 6 | `first-fight` | soft | - |
| 7 | `merchant` | soft | - |
| 8 | `stat-point` | soft | 3 x potion_minor |

**Milestone lessons** _(computed from the code)_

| Lesson | Journal heading | Spotlight |
| --- | --- | --- |
| `res-wood` | Wood | `res-wood` |
| `res-stone` | Stone | `res-stone` |
| `res-coal` | Coal | `res-coal` |
| `res-food` | Food | `res-food` |
| `res-hide` | Hide | `res-hide` |
| `res-meat` | Meat | `res-meat` |
| `res-eggs` | Eggs | `res-eggs` |
| `res-milk` | Milk | `res-milk` |
| `income-offline` | Income, timers and time away | `top-resources` |
| `gear-bag-potions` | Gear, bag and potions | `tab-equipment` |
| `rebirth-embers` | Rebirth and Embers | `rebirth-button` |
| `auto-battle` | Auto-battle | none |

See also: [`applyTutorial`](progression.md#applytutorial), [`buildNumbers`](progression.md#buildnumbers), [`guideLive`](progression.md#guidelive)
