# Progression

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Levels, attributes, skills, rebirth, Embers, limits and gems.

**Contents**

- Levels: [`LEVELING`](#leveling), [`xpToNextLevel`](#xptonextlevel), [`totalStatPoints`](#totalstatpoints), [`cumulativeXp`](#cumulativexp), [`calculateLevel`](#calculatelevel), [`reconcileCharacter`](#reconcilecharacter)
- Attributes: [`CHARACTER_STAT_CONFIG`](#character-stat-config), [`calculateStatResourceModifiers`](#calculatestatresourcemodifiers), [`calculateCombatStats`](#calculatecombatstats)
- Rebirth: [`REBIRTH`](#rebirth), [`emberGain`](#embergain), [`emberIncomeBonus`](#emberincomebonus), [`rebirthStatus`](#rebirthstatus)
- Ember shop: [`EMBER_UPGRADES`](#ember-upgrades), [`emberUpgradeCost`](#emberupgradecost)
- Limits: [`LIMITS`](#limits), [`limitOf`](#limitof)
- Gems: [`STARTING_GEMS`](#starting-gems)
- Crafting: [`CRAFTING`](#crafting)

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

Source: [`src/utils/game/character.ts:184`](../../src/utils/game/character.ts)

XP to go from `level` to the next one (Infinity at the maximum level). The one place the level curve lives (see LEVELING in the config);
everything that shows or checks a level threshold uses this.

**Formula**

```text
step(level -> level+1) = previous step x ratio of its anchor segment      (ratio solved so the segment sums to the anchor)
cumulativeXp(level)    = sum of steps up to level                         hits every LEVELING.anchors entry exactly
```

<a id="totalstatpoints"></a>

### `totalStatPoints` <small>function</small>

Source: [`src/utils/game/character.ts:149`](../../src/utils/game/character.ts)

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

Source: [`src/utils/game/character.ts:196`](../../src/utils/game/character.ts)

The total XP at which `level` is reached (level 1 is 0).

<a id="calculatelevel"></a>

### `calculateLevel` <small>function</small>

Source: [`src/utils/game/character.ts:208`](../../src/utils/game/character.ts)

Level from total XP: each level needs more than the one before (see `xpToNextLevel`), up to MAX_LEVEL, where the bar is full.

<a id="reconcilecharacter"></a>

### `reconcileCharacter` <small>function</small>

Source: [`src/utils/game/character.ts:164`](../../src/utils/game/character.ts)

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

Source: [`src/utils/game/character.ts:232`](../../src/utils/game/character.ts)

What the five attributes add to the income modifier of each resource (all points count, not only those above 5).

**Formula**

```text
modifier[r] += 0.025 per attribute point on each resource the attribute feeds; xp: +0.2% (Int) / +0.25% (Cha) per point
```

<a id="calculatecombatstats"></a>

### `calculateCombatStats` <small>function</small>

Source: [`src/utils/game/character.ts:265`](../../src/utils/game/character.ts)

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

Source: [`src/utils/game/rebirth.ts:91`](../../src/utils/game/rebirth.ts)

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

Source: [`src/utils/game/rebirth.ts:48`](../../src/utils/game/rebirth.ts)

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

Source: [`src/utils/game/rebirth.ts:122`](../../src/utils/game/rebirth.ts)

Can the player rebirth, and if not what is missing. The header button, the rebirth window and the store's `rebirth`
all read this one function, so what the tooltip promises is what the action checks.

**Formula**

```text
can rebirth = castle level >= 6  and  economyTiles >= 400 + 50 x rebirths  and  no castle upgrade running  and  Embers gained >= 1
```

## Ember shop

<a id="ember-upgrades"></a>

### `EMBER_UPGRADES` <small>const</small>

Source: [`src/config/rebirth.ts:58`](../../src/config/rebirth.ts)

The Ember shop: level N+1 costs `ceil(baseCost x 1.4^N)` Embers ([`emberUpgradeCost`](progression.md#emberupgradecost)); every upgrade has 10 levels. Shop levels are permanent: nothing refunds Embers.
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

<a id="emberupgradecost"></a>

### `emberUpgradeCost` <small>function</small>

Source: [`src/utils/game/rebirth.ts:25`](../../src/utils/game/rebirth.ts)

Cost in Embers of buying the next level of an upgrade, given its current level.

**Formula**

```text
cost of level N+1 = ceil(baseCost x 1.4^N) Embers
```

## Limits

<a id="limits"></a>

### `LIMITS` <small>const</small>

Source: [`src/config/limits.ts:14`](../../src/config/limits.ts)

Limits that upgrades raise. These are base values; code reads them through [`limitOf`](progression.md#limitof), which adds the bonuses registered in `LIMIT_BONUSES` (today: Pack Rat raises the bag size; Night Watch and set bonuses the away hours;
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
| `bagSize` | 36 | n/a | Pack Rat +4 per level |
| `offlineCapHours` | 8 | 72 | Night Watch +1 h per level, set bonus hours |
| `offlineEfficiency` | 0.5 | 1 | Steward +0.05 per level, set bonus points |
| `offlineMinGapSec` | 300 | n/a | nothing yet |
| `craftBatchCap` | 10 | 1,000 | nothing yet |
| `craftQueueSlots` | 1 | 5 | nothing yet |
| `craftOfflineHours` | 8 | 72 | nothing yet |
| `craftSpeed` | 1 | 4 | nothing yet |

See also: [`limitOf`](progression.md#limitof)

<a id="limitof"></a>

### `limitOf` <small>function</small>

Source: [`src/lib/limits.ts:34`](../../src/lib/limits.ts)

The current value of a limit: its base plus the registered bonuses.

**Formula**

```text
limit = LIMITS[key] + LIMIT_BONUSES[key](context)           or HARD_LIMITS[key] with ctx.hardCap
```

## Gems

<a id="starting-gems"></a>

### `STARTING_GEMS` <small>const</small>

Source: [`src/config/economy.ts:213`](../../src/config/economy.ts)

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
