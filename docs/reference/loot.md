# Loot

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The loot pipeline, rarities, affixes, sets, sell values and how to add content.

**Contents**

- Pipeline: [`generateLoot`](#generateloot), [`validateLootData`](#validatelootdata), [`resolveSourceLevel`](#resolvesourcelevel), [`rollItemLevel`](#rollitemlevel), [`receiveDrops`](#receivedrops), [`isAutoSold`](#isautosold)
- Config: [`LOOT_SOURCES`](#loot-sources), [`LOOT_PROFILES`](#loot-profiles), [`BIOME_LOOT`](#biome-loot)
- Items: [`RARITIES`](#rarities), [`levelScale`](#levelscale), [`valueCurve`](#valuecurve), [`sellValueOf`](#sellvalueof)
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
level windows, known slots/tags/rarities, no empty enabled pool, and that every weighted rarity has an eligible base at **every item level the source can reach** (a monster source's `levels` range, or castle 1-10 for chests and the shelf).

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

## Config

<a id="loot-sources"></a>

### `LOOT_SOURCES` <small>const</small>

Source: [`src/catalog/lootConfig.ts:256`](../../src/catalog/lootConfig.ts)

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

Source: [`src/catalog/lootConfig.ts:191`](../../src/catalog/lootConfig.ts)

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

Source: [`src/catalog/lootConfig.ts:120`](../../src/catalog/lootConfig.ts)

The grades a biome's normal monsters may drop (docs/plan/26-next-updates-plan.md C1: plains G1-G3, forest G2-G4, swamp G3-G5, tundra G5-G7).
The pool admits every ladder grade up to the biome's ceiling (`maxGrade`; the legacy pieces with no grade tag, e.g. Obsidian, stay in every pool as before); the floor needs no tag because an item only exists inside its grade's item level
window (items/grades.ts), so a level 30 monster cannot drop G1 whatever the pool says. (Excluding the lower grades by tag would leave
a forest kill at level 4-8 with nothing eligible while G1 is the only live grade there.) Only the grades in `LIVE_GRADES` have enabled items,
so today every biome drops the same items; raising the ceiling's live grade is what moves a biome.

A biome's grade ceiling. Normal monsters drop from `monster_<biome>` (pool `equipment_<biome>`): ladder grades up to the biome's ceiling (plains G3, forest G4, swamp G5, tundra G7); the floor is the item level window of each grade.
Pieces with no `grade:` tag (the legacy wooden, cloth, steel, obsidian items) are in every pool. The merchant's shelf passes `maxGrade` = the best grade the player wears ([`bestWornGrade`](economy.md#bestworngrade)).

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

## Adding content

<a id="loot-pools"></a>

### Adding loot content (data only)

Source: [`src/catalog/lootConfig.ts:157`](../../src/catalog/lootConfig.ts)

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

Source: [`src/catalog/items/define.ts:100`](../../src/catalog/items/define.ts)

The builder every piece of gear is authored with. Gear is authored at the first item level of its material tier's window (`LEVEL_WINDOW_BY_TIER`: tier 1 levels 1-20, tier 2 4-50, tier 3 8-100, tier 4 10-100, tier 5 3-100).
