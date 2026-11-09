# Loot

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The loot pipeline, rarities, affixes, sets, sell values and how to add content.

**Contents**

- Pipeline: [`generateLoot`](#generateloot), [`validateLootData`](#validatelootdata), [`resolveSourceLevel`](#resolvesourcelevel), [`rollItemLevel`](#rollitemlevel), [`receiveDrops`](#receivedrops), [`isAutoSold`](#isautosold), [`eligibleCandidates`](#eligiblecandidates)
- Config: [`LOOT_SOURCES`](#loot-sources), [`LOOT_PROFILES`](#loot-profiles), [`BIOME_LOOT`](#biome-loot)
- Items: [`RARITIES`](#rarities), [`levelScale`](#levelscale), [`valueCurve`](#valuecurve), [`sellValueOf`](#sellvalueof), [`LIVE_GRADES`](#live-grades), [`gradeLevels`](#gradelevels), [`gradeRarities`](#graderarities), [`gradeLegacyItems`](#gradelegacyitems), [`kit`](#kit)
- Adding content: [Adding loot content (data only)](#loot-pools), [`gear`](#gear)

## Pipeline

<a id="generateloot"></a>

### `generateLoot` <small>function</small>

Source: [`src/lib/loot/generate.ts:287`](../../src/lib/loot/generate.ts)

Everything one source gives. `data` and `rng` are injectable so tests and the simulator are reproducible.

The one loot pipeline. Every source (monster, boss, chest, the merchant's shelf) goes through it:

`source -> loot profile -> roll count -> source level -> item level -> eligible items -> rarity -> item -> instance (+ bonus tables)`

Quantity, rarity, level and eligibility are separate steps; nothing in the generator names a rarity, an item or a monster. Data is `src/catalog/lootConfig.ts` (sources, profiles, pools), `src/catalog/rarity.ts`,
`src/catalog/affixes.ts` and the item catalog; the code is pure, with an injectable `rng`, so tests and `npm run loot-sim` are reproducible.

1. A **source** ([`LOOT_SOURCES`](loot.md#loot-sources)) names a **profile**. A monster passes its own level; a chest and the shelf get theirs from the castle level ([`resolveSourceLevel`](loot.md#resolvesourcelevel)); never from the player's level.
2. The profile's `rolls` decide how many equipment rolls succeed: a random count in `min..max`, the first `guaranteed` always, the rest at `chancePerRoll + chancePerLevel x (level - 1)`,
   times the Luck drop-chance multiplier ([`dropChanceMultiplier`](economy.md#dropchancemultiplier)). A lucky monster adds `extraGearRolls`.
3. Each success rolls an **item level** around the source level (`offset +/- variance`, clamped to the profile and to `maxItemLevel`, [`rollItemLevel`](loot.md#rollitemlevel)).
4. The **eligible** items are the profile's pool members whose item level window contains that level (and whose grade is at most `maxGrade`).
5. The **rarity** is rolled from the profile's relative `rarityWeights` among the rarities that have an eligible base at that level and pass `rarityLevelGate`; Luck multiplies the weights of rare and better
   ([`rarityLuckMultiplier`](economy.md#rarityluckmultiplier)), so the other rarities lose share, not weight.
6. The **item** is a weighted pick among the candidates of that rarity; an **instance** gets a quality roll (0-100) and, from the rarity's affix count, affixes picked without replacement, one per group.
7. **Bonus tables** add reward channels on top: a targeted pool (named items), potions, a boss's own pool. `placement` says how a table combines with the general rolls: `extra` adds (default),
   `fallback` only runs when no equipment has dropped, `replace` cancels the gear when it triggers (a chest's legendary weapon). A table may carry pity: each miss adds `perMiss` to its chance (up to `maxBonus`), a drop resets it.

Drops reach the bag through [`receiveDrops`](loot.md#receivedrops): the auto-sell filter ([`isAutoSold`](loot.md#isautosold)) sells what it matches, the rest goes into the bag, and what does not fit turns into gold.

See also: [`LOOT_SOURCES`](loot.md#loot-sources), [`LOOT_PROFILES`](loot.md#loot-profiles), [`receiveDrops`](loot.md#receivedrops), [`validateLootData`](loot.md#validatelootdata)

<a id="validatelootdata"></a>

### `validateLootData` <small>function</small>

Source: [`src/lib/loot/validate.ts:35`](../../src/lib/loot/validate.ts)

Checks the whole loot configuration (docs/reference/loot.md): references resolve, weights and ranges make sense, and every
weighted rarity has an eligible item at every item level a source can reach. Run by the tests (and so CI) and available
to the dev tooling; pure and cheap.

`validateLootData` (run by `tests/loot/lootValidate.test.ts`, and so CI) checks: sources reference profiles, profiles reference pools and rarities, weights are non-negative with at least one positive, roll counts and guarantees,
level windows, known slots/tags/rarities, no empty enabled pool, that something can drop at **every item level the source can reach** (a monster source's `levels` range, or castle 1-10 for chests and the shelf), and that every weighted rarity has an eligible base at some level (a rarity follows the grade of a base, so it may be left out of the roll at levels where no base carries it).

<a id="resolvesourcelevel"></a>

### `resolveSourceLevel` <small>function</small>

Source: [`src/lib/loot/generate.ts:78`](../../src/lib/loot/generate.ts)

The level of a chest or shelf: its base plus steps for the world (castle) level. Never the player's level.

**Formula**

```text
source level = clamp(base + perCastleLevel x (castle level - 1), 1..100)
```

<a id="rollitemlevel"></a>

### `rollItemLevel` <small>function</small>

Source: [`src/lib/loot/generate.ts:89`](../../src/lib/loot/generate.ts)

Rolls the item level around the source level, inside the profile's bounds.

**Formula**

```text
item level = clamp(randomInt(source level + offset - variance, source level + offset + variance), min, max)
```

<a id="receivedrops"></a>

### `receiveDrops` <small>function</small>

Source: [`src/lib/loot/receive.ts:24`](../../src/lib/loot/receive.ts)

Hands drops to the player: the auto-sell filter takes what it matches, the rest goes into the bag, and what does not fit turns into gold.

<a id="isautosold"></a>

### `isAutoSold` <small>function</small>

Source: [`src/lib/loot/autoSell.ts:10`](../../src/lib/loot/autoSell.ts)

Whether the auto-sell filter takes a piece of gear: its rarity ranks at or below the chosen one. `upTo` null keeps everything.

<a id="eligiblecandidates"></a>

### `eligibleCandidates` <small>function</small>

Source: [`src/lib/loot/pools.ts:37`](../../src/lib/loot/pools.ts)

Members that exist at this item level (item window and the pool's own minimum), with their weights.

## Config

<a id="loot-sources"></a>

### `LOOT_SOURCES` <small>const</small>

Source: [`src/catalog/lootConfig.ts:260`](../../src/catalog/lootConfig.ts)

Keyed by the `DropSource` (a monster type, `chest` or the merchant's `merchant` shelf). A monster's drops are at its own level (monsters 1-30, bosses 15-45).

Sources, keyed by the `DropSource` (a monster's biome source `monster_<biome>`, `boss`, `chest`, the merchant's `merchant` shelf). A monster's drops are at its own level (monsters 1-30, bosses 15-45); a chest and the shelf
start at item level 4 plus 3 per castle level above 1.

**Loot sources** _(computed from the code)_

| Source | Profile | Levels |
| --- | --- | --- |
| monster | normal_monster | the caller's level, range 1-30 |
| monster_plains | normal_monster_plains | the caller's level, range 1-20 |
| monster_forest | normal_monster_forest | the caller's level, range 4-24 |
| monster_swamp | normal_monster_swamp | the caller's level, range 8-28 |
| monster_tundra | normal_monster_tundra | the caller's level, range 12-30 |
| boss | boss | the caller's level, range 15-45 |
| chest | basic_chest | own level: 4 + 3 per castle level above 1 |
| merchant | merchant_stock | own level: 4 + 3 per castle level above 1 |

<a id="loot-profiles"></a>

### `LOOT_PROFILES` <small>const</small>

Source: [`src/catalog/lootConfig.ts:195`](../../src/catalog/lootConfig.ts)

Profiles: how many rolls, which rarity weights, which pool, which bonus tables. A normal monster's profile is copied per biome and draws from that biome's pool. All numbers are STARTING POINTS to be tuned with `npm run loot-sim -- --md`.

**Loot profiles** _(computed from the code)_

| Profile | Equipment rolls | Item level | Rarity weights | Bonus tables |
| --- | --- | --- | --- | --- |
| normal_monster | 1 x 12% +1%/level from general_equipment | source level +0 +-1 | common 70, uncommon 22, rare 7, epic 1, legendary 0.2 | rat_potion (potions_rat, fixed, 25%) |
| normal_monster_plains | 1 x 12% +1%/level from equipment_plains | source level +0 +-1 | common 70, uncommon 22, rare 7, epic 1, legendary 0.2 | rat_potion (potions_rat, fixed, 25%) |
| normal_monster_forest | 1 x 12% +1%/level from equipment_forest | source level +0 +-1 | common 70, uncommon 22, rare 7, epic 1, legendary 0.2 | rat_potion (potions_rat, fixed, 25%) |
| normal_monster_swamp | 1 x 12% +1%/level from equipment_swamp | source level +0 +-1 | common 70, uncommon 22, rare 7, epic 1, legendary 0.2 | rat_potion (potions_rat, fixed, 25%) |
| normal_monster_tundra | 1 x 12% +1%/level from equipment_tundra | source level +0 +-1 | common 70, uncommon 22, rare 7, epic 1, legendary 0.2 | rat_potion (potions_rat, fixed, 25%) |
| boss | 1 x 100%, 1 guaranteed from general_equipment | source level +0 +-0 | common 20, uncommon 30, rare 30, epic 15, legendary 5 | king_legendary (legendary_weapons, fixed, 5%); king_potions (potions_king, fixed) |
| basic_chest | 1 x 82% from general_equipment | source level +0 +-1 | common 62, uncommon 24, rare 9, epic 4, legendary 1 | chest_legendary (legendary_weapons, fixed, 1.9%, replace); chest_potion (potions_chest, fixed, fallback) |
| merchant_stock | 12 x 100%, 12 guaranteed from general_equipment | source level +0 +-2 | common 60, uncommon 40 | - |

<a id="biome-loot"></a>

### `BIOME_LOOT` <small>const</small>

Source: [`src/catalog/lootConfig.ts:124`](../../src/catalog/lootConfig.ts)

The grades a biome's normal monsters may drop (docs/plan/26-next-updates-plan.md C1: plains G1-G3, forest G2-G4, swamp G3-G5, tundra G5-G7).
The pool admits every ladder grade up to the biome's ceiling (`maxGrade`; since IDL-243 every piece that drops is on the ladder: the legacy wood, steel and Obsidian pieces are graded or retired); the floor needs no tag because an item only exists inside its grade's item level
window (items/grades.ts), so a level 30 monster cannot drop G1 whatever the pool says. (Excluding the lower grades by tag would leave
a forest kill at level 4-8 with nothing eligible while G1 is the only live grade there.) Only the grades in `LIVE_GRADES` have enabled items,
so a ceiling above the highest live grade changes nothing yet. With G1-G6 live (IDL-238) the item level decides: the plains pool stops at G3, so a plains monster
grown past item level 30 (its levels 1-20 plus 10 levels of growth, plus 1 of variance) finds no base and drops nothing (about half the drops at 31; see docs/plan/31-grade-by-biome-and-source.md).

A biome's grade ceiling. Normal monsters drop from `monster_<biome>` (pool `equipment_<biome>`): ladder grades up to the biome's ceiling (plains G3, forest G4, swamp G5, tundra G7); the floor is the item level window of each grade.
Every base that drops carries a `grade:` tag (IDL-243): the legacy wood, steel and Obsidian pieces that fill a ladder cell are graded by it (Wooden Club G1, Hunting Bow G2, Iron Sword G3, six Steel armour pieces G4, the Obsidian family G6; they keep their ids, art and set bonuses),
the rest of wood, steel and all of cloth are retired (`enabled: false`, ids kept, owned pieces keep working). A graded legacy piece is generated only in its grade's window and rarities (`dropLevels`, `dropRarities`) but stays valid at its old level range for pieces already owned.
The highest live grade is open at the top and takes every rarity ([`gradeLevels`](loot.md#gradelevels), [`gradeRarities`](loot.md#graderarities) in `src/catalog/items/grades.ts`) so nothing is left without a base while the next grade is dark; a rarity with no base at an item level is left out of the roll there.
The merchant's shelf passes `maxGrade` = the best grade the player wears ([`bestWornGrade`](economy.md#bestworngrade)).

## Items

<a id="rarities"></a>

### `RARITIES` <small>const</small>

Source: [`src/catalog/rarity.ts:34`](../../src/catalog/rarity.ts)

Rarities: everything the game knows about one, in one place: label, colour, glow, how many affixes it rolls, what it is worth and how it ranks. Adding a tier is one row here plus a weight in the loot profiles that should drop it.

**Rarities** _(computed from the code)_

| Rarity | Rank | Sell value at item level 1 | Affixes | Enabled |
| --- | --- | --- | --- | --- |
| Common | 0 | 300 | 0 | yes |
| Uncommon | 1 | 1,200 | 1 | yes |
| Rare | 2 | 3,600 | 2-3 | yes |
| Epic | 3 | 12 K | 3-4 | yes |
| Legendary | 4 | 45 K | 4-5 | yes |

<a id="levelscale"></a>

### `levelScale` <small>function</small>

Source: [`src/catalog/stats.ts:195`](../../src/catalog/stats.ts)

Power multiplier of an item level (1 at level 1).

Item power grows linearly with item level: each level adds 7% of the level-1 power (1 at level 1, 1.63 at 10, 7.9 at 100). Gear is authored at its own `minItemLevel`; an instance of level L has
`baseStats x levelScale(L) / levelScale(minItemLevel)`, then the quality roll (+/-8%). Affix values use the same curve. Boss stats use it too ([`monsterStats`](monsters.md#monsterstats)).

**Formula**

```text
levelScale(L) = 1 + 0.07 x (L - 1)         L clamped to 1..100 (MAX_ITEM_LEVEL)
stats(instance) = baseStats x levelScale(L) / levelScale(minItemLevel) x (1 + (quality - 50) / 50 x 0.08)
```

<a id="valuecurve"></a>

### `valueCurve` <small>function</small>

Source: [`src/catalog/stats.ts:168`](../../src/catalog/stats.ts)

Value multiplier of an item level (1 at level 1).

What gear is worth in gold follows its own curve, because the economy grows far faster than gear power: steep up to the knee (level 10), flatter after it.

**Formula**

```text
valueCurve(L) = 1.3^(min(L,10) - 1) x 1.12^max(L - 10, 0)
quality value = 0.75 + 0.5 x quality / 100
affix value   = 1 + sum over affixes of (0.15 + 0.35 x roll / 100)
```

<a id="sellvalueof"></a>

### `sellValueOf` <small>function</small>

Source: [`src/lib/itemInstance.ts:106`](../../src/lib/itemInstance.ts)

What a merchant pays for an instance: the rarity's value at level 1, grown with the item level (`valueCurve`), then by the
quality roll and by every affix, so a well rolled rare is worth clearly more than a plain one. Always at least 1.

The merchant buys at this value (times the Haggler bonus, [`sellPayout`](economy.md#sellpayout)) and sells at 5 times it ([`shopPriceOf`](economy.md#shoppriceof)).

**Formula**

```text
sellValue = max(1, round(rarity.sellValue x valueCurve(item level) x qualityValue(quality) x affixesValue(rolls)))
```

<a id="live-grades"></a>

### `LIVE_GRADES` <small>const</small>

Source: [`src/catalog/items/grades.ts:51`](../../src/catalog/items/grades.ts)

The grade ladder's live grades (IDL-220, IDL-224, IDL-243, IDL-238): G1-G6. Only their items are enabled and so drop; G7-G9 and the special
sets S1-S3 stay disabled data (the legendary named weapons wait for the rebirth biomes). Enabling the next grade is adding it here; the loot
pools select by the `grade:` tag, never by id. The highest entry is open at the top and takes every rarity (`gradeLevels`,
`gradeRarities`), so adding a grade closes the window of the one below.

Reachable item levels today are monsters 1-30 plus up to 10 of growth, bosses 15-45 and chests and the shelf up to 31, so G1-G4 are real
content, G5 (43-54) comes from the last bosses only, and G6 (55+, the Obsidian set) is not reachable yet.

See also: [`gradeLevels`](loot.md#gradelevels), [`gradeRarities`](loot.md#graderarities), [`gradeLegacyItems`](loot.md#gradelegacyitems)

<a id="gradelevels"></a>

### `gradeLevels` <small>function</small>

Source: [`src/catalog/items/grades.ts:79`](../../src/catalog/items/grades.ts)

The item level window an item of this grade is generated in. It is the grade's own window (`GRADE_INFO`), except for the highest
live grade, which stays open at the top until the next grade goes live: bosses (levels 15-45), chests and the shelf reach item
levels past G3's 30 today, and with the legacy Steel and Obsidian gone from the pool they would have nothing to drop (IDL-243).
Enabling the next grade (adding it to `LIVE_GRADES`) closes the window of the one below by itself: with G6 live, G3 ends at item level 30, G4 at 42 and G5 at 54.
What a save may hold is wider for a grade that was once open (`gradeOwnedLevels`).

<a id="graderarities"></a>

### `gradeRarities` <small>function</small>

Source: [`src/catalog/items/grades.ts:94`](../../src/catalog/items/grades.ts)

The rarities an item of this grade may roll as: the grade's own (`GRADE_INFO`), except for the highest live grade, which takes every
rarity until a grade that carries the others is live (today the loot profiles roll common to legendary at item levels 19 and up, and a
rolled rarity must find a base). Enabling the next grade narrows the one below to its own rarities by itself.

The highest live grade takes every rarity until a grade that carries the others is live.

<a id="gradelegacyitems"></a>

### `gradeLegacyItems` <small>function</small>

Source: [`src/catalog/items/ladder.ts:316`](../../src/catalog/items/ladder.ts)

Puts the legacy families on the ladder (IDL-243), so the grade ceilings of the biome pools and the merchant hold for every piece:
 - a piece that fills a ladder cell (Wooden Club, Hunting Bow, Acorn Charm, Iron Sword, the six Steel armour pieces, the Obsidian
   family) keeps its id, name, art, set and the validity window of the pieces already owned, and takes the cell's grade tag and the
   grade's drop window and rarities (`dropLevels`, `dropRarities`); it is enabled with the rest of its grade (`LIVE_GRADES`), so Steel (G4) and Obsidian (G6) drop with their grades;
 - every other legacy piece (cloth, the rest of wood and steel, the starter sword and shield) is retired: `enabled: false`, the id stays
   so owned pieces load and work. The starter sword and shield are still what a new hero wears (catalog STARTER_EQUIPMENT_IDS).

Pieces that predate the ladder keep their ids, art and set bonuses, and a save of an old piece stays valid: `minItemLevel`, `maxItemLevel` and `allowedRarities` stay what an owned piece may be, while `dropLevels` and `dropRarities` (see [`eligibleCandidates`](loot.md#eligiblecandidates)) say what it is generated at.

<a id="kit"></a>

### `kit` <small>function</small>

Source: [`src/lib/fightSim.ts:56`](../../src/lib/fightSim.ts)

A full kit of one ladder grade: all 13 slots plus the belt (both rings), `weapon` as the main hand (a sword by default; special sets wear their own). Items are plain: authored level, neutral quality, no affixes. Grades above the live ones are disabled data, fine for a fight but nothing a player can have yet.

Test and simulation helper: a full kit of one ladder grade, so fight balance (`fight-sim`, `monster-ladder`, `fightBalance`) is pinned to grades rather than to named legacy sets.

## Adding content

<a id="loot-pools"></a>

### Adding loot content (data only)

Source: [`src/catalog/lootConfig.ts:161`](../../src/catalog/lootConfig.ts)

Adding loot content is data only; the generator needs no change.

- **A base item**: add `gear(id, name, slot, rarity, stats, { tier, ... })` ([`gear`](loot.md#gear)) to a file in `src/catalog/items/`. Its stats are authored at the first level of its tier's window (`LEVEL_WINDOW_BY_TIER`).
  It joins the general pool automatically (tags `gear`, not `named`). Register its icon as one line in `src/config/itemIcons/<slot>.json` if it has art (see its README).
- **A named item** (fixed identity and rarity): the same builder with `named: true, pools: ['some_pool']`, then put the pool in a profile's `bonusTables`.
- **A biome's grade ceiling**: [`BIOME_LOOT`](loot.md#biome-loot).
- **An affix**: one row in `src/catalog/affixes.ts` (`pair(...)` makes a prefix and a suffix of a stat).
- **A rarity**: one row in [`RARITIES`](loot.md#rarities), then a weight for it in each profile that should drop it; `allowedRarities` already includes every rarity key for bases. No generator change
  (`tests/loot/lootGenerate.test.ts` proves it with a fake rarity).
- **A profile / source** (an elite monster, a premium chest): add the profile and a [`LOOT_SOURCES`](loot.md#loot-sources) entry, then point the monster or chest at it.
- **Tuning**: weights, chances, levels and curve are all config. Run `npm run loot-sim -- --md`, then [`validateLootData`](loot.md#validatelootdata) (the tests) tells you what no longer fits.

See also: [`gear`](loot.md#gear), [`RARITIES`](loot.md#rarities), [`LOOT_SOURCES`](loot.md#loot-sources)

<a id="gear"></a>

### `gear` <small>function</small>

Source: [`src/catalog/items/define.ts:101`](../../src/catalog/items/define.ts)

The builder every piece of gear is authored with. Gear is authored at the first item level of its material tier's window (`LEVEL_WINDOW_BY_TIER`: tier 1 levels 1-20, tier 2 4-50, tier 3 8-100, tier 4 10-100, tier 5 3-100).
