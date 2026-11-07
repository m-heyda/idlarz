# 10 · Loot system

One shared, data-driven pipeline gives out gear for every source (rats, the Rat King and later bosses, chests and the merchant's shelf). Numbers: [generated/loot-sim.md](generated/loot-sim.md) and [generated/item-catalog.md](generated/item-catalog.md).

## The five separate ideas

| Idea | Where it lives |
|---|---|
| **How many items** (drop chance, number of rolls) | the source's *loot profile* (`rolls`) in `src/catalog/lootConfig.ts` |
| **Rarity** (Common … Legendary) | rolled from the profile's `rarityWeights`; behaviour (affix count, colour, sell value) in `src/catalog/rarity.ts` |
| **Item level** (power) | the source's level: a monster's own level (it passes it in), or the castle level for chests and the merchant (never the player's level), plus the profile's offset/variance |
| **Eligibility** (which items may appear) | pools (`LOOT_POOLS`) match items by id, tags or their own `pools`; each item has an item level window |
| **Definition vs instance** | an item *definition* says what it is; a dropped/owned *instance* is `{ base, level, rarity, quality, affixes[] }` (`ItemInstance`) |

Rarity never decides the item level and the item level never decides the rarity. A Common drop from a high level source is a Common item with high level stats; a low level source cannot make a high level item whatever rarity it rolls.

## The pipeline (`generateLoot`, src/lib/loot/generate.ts)

1. `source` (`rat` / `ratKing` / `chest` / `merchant`) names a profile (`LOOT_SOURCES`).
2. Roll count: the first `guaranteed` rolls always succeed, the rest with `chancePerRoll (+ chancePerLevel per monster level above 1)`.
3. Source level = the monster's level when the caller passes one, else `base + perCastleLevel × (castle − 1)` (chests, the shelf), clamped to 1..100.
4. Item level = source level + profile offset ± variance, inside the profile's bounds.
5. Eligible bases = pool members whose window contains the item level.
6. Rarity: the profile weights, minus rarities gated above this item level (`rarityLevelGate`), minus rarities with no eligible base, normalised. One draw, never chained checks.
7. Base: weighted by `poolWeight` among the eligible bases that allow the rarity.
8. Instance: quality roll (0-100, 50 = authored), affix count from the rarity, affixes picked without replacement (one per group, item level and tag checks).
9. Bonus tables run after as extra rolls: named set pieces, the legendary pool, potions. `placement`: `extra` (default) adds, `fallback` only when no gear dropped yet, `replace` cancels the general gear roll when it triggers (a chest's legendary).

An empty pool never silently drops something else: the result carries a `warnings` entry and a `trace` per roll (source, profile, levels, eligible counts, rarity chances, chosen rarity/item, affixes) for bug reports. In the browser, the admin panel's *Loot: chest* button rolls through the real pipeline and `console.table` the trace.

## Stats

```
statsAtLevel = baseStats × levelScale(level) / levelScale(minItemLevel) × qualityMultiplier(quality) × rarity.statMultiplier   (rounded per stat)
levelScale(L) = 1 + 0.07 × (L − 1)            POWER_PER_LEVEL, MAX_ITEM_LEVEL 100      (catalog/stats.ts)
per stat      : factor = 1 + (levelScale ratio − 1) × STAT_DEFS[stat].levelShare   damage/armor/maxHp 1.0, maxMana 0.7, regen 0.6, luck/goldFind/manaRegen 0.5, spellPower 0.4, crit/superCrit/dodge/lifeLeech 0.3
affix value   = affixMagnitude(stat, L) × power × (roll range)                           (catalog/affixes.ts)
sell value    = rarity.sellValue × valueCurve(level) × qualityValue × affixesValue       (itemInstance.sellValueOf; see "What gear is worth")
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

`validateLootData` (src/lib/loot/validate.ts, run by `tests/lootValidate.test.ts`) checks: sources reference profiles, profiles reference pools and rarities, weights are non-negative with at least one positive, roll counts and guarantees, level windows, known slots/tags/rarities, no empty enabled pool, and that every weighted rarity has an eligible base at **every item level the source can reach** (a monster source's `levels` range, or castle 1-10 for chests and the shelf).

## Saves

Gear is saved as instances (the current schema is 7, see [07](07-saves-and-security.md)): equipment `{ slot: { base, level, rarity, quality, affixes: [{ id, roll }] } }`, bag gear `{ item: {...} }`, consumables `{ id, qty }` as before. New optional fields: `lootPity` (bad-luck counters by `profile:table`) and `autoSellUpTo` (rarity id).

## The merchant's shelf

The `merchant` source (level 4 + 3 per castle level above 1, like a chest) runs the `merchant_stock` profile: twelve guaranteed rolls on the general pool (the shelf keeps the first six) at +-2 item levels, rarity weights common 60 / uncommon 40 (nothing better), no legendary and no bonus tables. `generateMerchantStock` (src/lib/merchant.ts) turns the drops into the shelf; the price is `ceil(sellValueOf(item) × 5)`, derived each time, never saved. The shelf is the optional save key `merchantStock` (`{ at, offers }`, every offer read by the same item validation as the bag, at most 12 offers).

## Player-facing

- **Pity**: the King's legendary weapon table adds +1 % per miss up to +10 %; a drop resets it. Set pieces already prefer ones you do not own.
- **Auto-sell**: *Merchant → Goods → Sell items → Auto-sell new gear up to ...* sells matching drops the moment they drop (with the Haggler bonus), so a bigger drop volume does not clog the bag. Never offered for the two rarest tiers.

## Perk families and caps (decided 2026-11-07, IDL-149; sim checks pending)

Legendary perks and set bonuses use the same families. Each family is its own `(1 + sum)` bucket (docs/25 item 12); the gear bucket (sets plus legendary perks) is clamped at the family cap. Tier magnitudes are fixed numbers, they do not scale with item level.

| Family | Common | Rare | Top | Gear cap | Combines with |
| --- | --- | --- | --- | --- | --- |
| Income | 8 % | 15 % | 25 % | 50 % | Embers (+6 % each), Paragon: separate buckets |
| XP | 8 % | 15 % | 25 % | 40 % | Paragon account bucket |
| Kill reward | 8 % | 15 % | 25 % | 60 % | Luck / Gold Find apply after the monster reward cap |
| Click gold | 8 % | 15 % | 25 % | 40 % | click Idol |
| Damage | 4 % | 6 % | 10 % | 45 % | S2 38, S3 40; set plus one legendary hits the cap |
| Offline efficiency | 8 | 15 | 25 points | HARD_LIMITS 100 % | Steward, Night Watch |
| Offline cap hours | +2 h | +4 h | +6 h | HARD_LIMITS 72 h | Ember shop |
| Max HP | 8 % | 15 % | 25 % | 50 % | attributes |
| Building time | 8 % | 15 % | 25 % | -60 % combined | Embers (Builders, max -50 %) and Idols; tooltip shows the capped total |
| Chest interval | 8 % | 15 % | 25 % | -40 %, floor 8 min | chest Idol, Beacon potion |

Which items carry what: see docs/28 section 6 (11 legendaries, one headline family each, two launch handlers). The Rattatui set is removed (IDL-55); sets S1-S3 carry the set bonuses of docs/28 section 10.

## Monster chests (decided 2026-11-07, IDL-163; not built)

A kill sometimes drops a **chest item** into the bag, opened later from the inventory (`open` op on `/api/inventory`).

- **No keys in v1.** A chest opens free; keys can return later for locked Royal chests.
- **Drop chance:** 2 % per normal kill, a boss always drops its Royal chest, a golden monster drops an Arcane chest. Always `placement: 'extra'`, never `replace`.
- **Tiers by biome:** Wooden (home), Iron Strongbox, Mossy, Coral, Frost, Magma as the biomes arrive; Royal (boss) and Arcane (golden) on top. Chest level = the dropping monster's level, capped.
- **Contents:** gear, potions (including buffs), materials, XP orbs and gold, from the existing loot pipeline. **No permanent stat gifts. No gems** (gem sources stay achievements and the daily bonus, IDL-188/194). Legendary rolls stay inside the legendary rules (docs/28 section 6).
- **Safety:** the roll is sealed on a counter (a reload cannot reroll); gold is recorded as `granted`; a full bag converts the chest to its sell value; "Sell common" never sweeps chests.
- **Budget:** the expected value of chests must stay at 10 % of hourly income or less at every tier; `loot-sim` gets a chest-tier table and fails the check above that.

## Not done yet (kept on purpose)

Salvage / materials and reroll / upgrade (real gear sinks), set bonuses that follow the item level (today a set bonus is a fixed amount, bigger on purpose so it matters before the first rebirth), `requiredLevel`, elite monsters and premium chests, and rebalancing the monsters with the world level (see [ROADMAP](ROADMAP.md)).

A monster source has no level of its own: `LootRequest.level` is the monster's level, and the source's `levels` range (rat 1-20, King 15-35) is what `validateLootData` checks the pools against. Per-level chances (`chancePerLevel`) replace the old per-tier ones (half the size: a tier was two levels). A boss is a monster def with `grade: 'boss'` whose `lootSourceId` names its own source and profile, so boss-only drops need data only.

## What gear is worth

`sellValueOf` = the rarity's value at level 1 (common 300 ... legendary 45000) x `valueCurve(level)` x the quality roll x the affixes (`ITEM_VALUE`, `catalog/stats.ts`): steep up to level 10 (x1.3 per level) and flatter after (x1.12), so an item is worth minutes of the income of the stage it drops in, a well rolled rare clearly more than a plain one. The merchant sells at 5x.

## Luck and sealed rolls

`LootRequest.luck` raises the chance of the general gear roll (`dropChanceMultiplier`) and multiplies the weights of rare-and-better rarities (`rarityLuckMultiplier`, from `LUCK.rarityFromOrder`); `extraGearRolls` adds guaranteed rolls (lucky monsters). Luck 0 changes nothing. For signed-in players the server runs the same pipeline with a sealed random source (`lib/offline/seal.ts`) - see [11](11-server-authority.md).
