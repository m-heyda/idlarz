# 10 · Loot system

One shared, data-driven pipeline gives out gear for every source (rats, the Rat King, chests). Design: [superpowers/specs/2026-10-27-loot-system-design.md](superpowers/specs/2026-10-27-loot-system-design.md). Numbers: [generated/loot-sim.md](generated/loot-sim.md) and [generated/item-catalog.md](generated/item-catalog.md).

## The five separate ideas

| Idea | Where it lives |
|---|---|
| **How many items** (drop chance, number of rolls) | the source's *loot profile* (`rolls`) in `src/catalog/lootConfig.ts` |
| **Rarity** (Common … Legendary) | rolled from the profile's `rarityWeights`; behaviour (affix count, colour, sell value) in `src/catalog/rarity.ts` |
| **Item level** (power) | the source's level: monster tier + castle level (never the player's level), plus the profile's offset/variance |
| **Eligibility** (which items may appear) | pools (`LOOT_POOLS`) match items by id, tags or their own `pools`; each item has an item level window |
| **Definition vs instance** | an item *definition* says what it is; a dropped/owned *instance* is `{ base, level, rarity, quality, affixes[] }` (`ItemInstance`) |

Rarity never decides the item level and the item level never decides the rarity. A Common drop from a high level source is a Common item with high level stats; a low level source cannot make a high level item whatever rarity it rolls.

## The pipeline (`generateLoot`, src/lib/loot/generate.ts)

1. `source` (`rat` / `ratKing` / `chest`) names a profile (`LOOT_SOURCES`).
2. Roll count: the first `guaranteed` rolls always succeed, the rest with `chancePerRoll (+ chancePerTier per tier above 1)`.
3. Source level = `base + perTier × (tier − 1) + perCastleLevel × (castle − 1)`, clamped to 1..100.
4. Item level = source level + profile offset ± variance, inside the profile's bounds.
5. Eligible bases = pool members whose window contains the item level.
6. Rarity: the profile weights, minus rarities gated above this item level (`rarityLevelGate`), minus rarities with no eligible base, normalised. One draw, never chained checks.
7. Base: weighted by `poolWeight` among the eligible bases that allow the rarity.
8. Instance: quality roll (0-100, 50 = authored), affix count from the rarity, affixes picked without replacement (one per group, item level and tag checks).
9. Bonus tables run after as extra rolls: named set pieces, the legendary pool, potions. `placement`: `extra` (default) adds, `fallback` only when no gear dropped yet, `replace` cancels the general gear roll when it triggers (a chest's legendary).

An empty pool never silently drops something else: the result carries a `warnings` entry and a `trace` per roll (source, profile, levels, eligible counts, rarity chances, chosen rarity/item, affixes) for bug reports. In the browser, the admin panel's *Loot: rat T5 / Rat King / chest* buttons roll through the real pipeline and `console.table` the trace.

## Stats

```
statsAtLevel = baseStats × levelScale(level) / levelScale(minItemLevel) × qualityMultiplier(quality) × rarity.statMultiplier   (rounded per stat)
levelScale(L) = 1 + 0.07 × (L − 1)            POWER_PER_LEVEL, MAX_ITEM_LEVEL 100      (catalog/stats.ts)
per stat      : factor = 1 + (levelScale ratio − 1) × STAT_DEFS[stat].levelShare   damage/armor/maxHp 1.0, regen 0.6, luck/goldFind 0.5, crit/superCrit/dodge 0.3
affix value   = affixMagnitude(stat, L) × power × (roll range)                           (catalog/affixes.ts)
sell value    = rarity.sellValue × levelScale(level)                                     (itemInstance.sellValueOf)
```

Capped percentage stats (crit, dodge) follow only a share of the curve, or they would hit their caps (crit 75 %, dodge 40 %) within a few levels.

Stats are derived at load and never stored, so retuning the curve retunes every existing item and a save can only describe items the generator could make (`instanceProblem` checks base, level window, rarity, affix ids, counts and roll ranges).

## Adding content (data only)

- **A base item**: add `gear(id, name, slot, rarity, stats, { tier, ... })` to a file in `src/catalog/items/`. Its stats are authored at the first level of its tier's window (`LEVEL_WINDOW_BY_TIER`). It joins the general pool automatically (tags `gear`, not `named`). Register its icon in `src/config/pixelIcons.ts` if it has art.
- **A named item** (fixed identity and rarity): same builder with `named: true, pools: ['some_pool']`, then put the pool in a profile's `bonusTables`.
- **An affix**: one row in `src/catalog/affixes.ts` (`pair(...)` makes a prefix and a suffix of a stat).
- **A rarity**: one row in `RARITIES`, then a weight for it in each profile that should drop it, and `allowedRarities` already includes every rarity key for bases. No generator change (`tests/lootGenerate.test.ts` proves it with a fake rarity).
- **A profile / source** (elite monster, premium chest): add the profile and a `LOOT_SOURCES` entry, then point the monster or chest at it.
- **Tuning**: weights, chances, levels and curve are all config. Run `npm run loot-sim -- --md`.

`validateLootData` (src/lib/loot/validate.ts, run by `tests/lootValidate.test.ts`) checks: sources reference profiles, profiles reference pools and rarities, weights are non-negative with at least one positive, roll counts and guarantees, level windows, known slots/tags/rarities, no empty enabled pool, and that every weighted rarity has an eligible base at **every item level the source can reach** (tier 1-5, castle 1-10).

## Saves

Schema 3 stores gear as instances: equipment `{ slot: { base, level, rarity, quality, affixes: [{ id, roll }] } }`, bag gear `{ item: {...} }`, consumables `{ id, qty }` as before. Schema 2 saves (bare item ids) are converted by `MIGRATIONS[2]` using the frozen table in `src/lib/legacyGear.ts`: each old id becomes the item at its authored level, neutral quality, no affixes and its old rarity, so its stats do not change (`tests/saves.test.ts` checks all 76 gear ids). The old encrypted vault format goes through the same step. New optional fields: `lootPity` (bad-luck counters by `profile:table`) and `autoSellUpTo` (rarity id).

## Player-facing

- **Pity**: the King's legendary weapon table adds +1 % per miss up to +10 %; a drop resets it. Set pieces already prefer ones you do not own.
- **Auto-sell**: *Merchant → Sell items → Auto-sell new gear up to ...* sells matching drops the moment they drop (with the Haggler bonus), so a bigger drop volume does not clog the bag. Never offered for the two rarest tiers.

## Not done yet (kept on purpose)

Salvage / materials and reroll / upgrade (real gear sinks), flat set bonuses that fade at high level, `requiredLevel`, weapon attack speed in combat, offline loot (there is no offline progress), elite monsters and premium chests, a Luck effect on rarity weights, and rebalancing the monsters with the world level (see the follow-up list in the design spec).
