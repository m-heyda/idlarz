# Loot system rework: data-driven pipeline, item instances, rolled rarity/level/affixes

## Context

Today an owned item is `{id, qty}` and everything about it lives in the static catalog (79 items: 77 gear, 2 potions). Rarity is welded to material (all steel = uncommon, all obsidian = rare), every item is itemLevel 10 (unused), primary stats are hand-typed literals, drops are 3 hard-coded string sources (`rat`, `ratKing`, `chest`) with weights stored on each item, and there are no affixes, no item levels, no level source for enemies (rats only get tier 1-5 from age; King is fixed). Sell value is flat per rarity, gear has no sink, saves store ids only.

Goal (from the brief + your answers): one shared, configurable loot pipeline; rarity, item level, eligibility, quantity and definition-vs-instance all independent; Diablo-style rolled instances so the game stays playable long term, **before** new items are added.

**Your decisions:** full item instances (save v2→v3); catalog becomes level-gated bases with rolled rarity; item level = monster level (tier + castle level); small data-driven affix table now; also fixing: sell value by level+rarity, auto-sell filter, pity for targeted pools, loot-sim + validator + drop explanation tooling.

## Design

### 1. Concepts → code (all content in `src/catalog/`, all logic pure in `src/lib/loot/`)

| Concept | Where |
|---|---|
| Rarity defs (rank, label, color/glow, `minAffixes/maxAffixes`, `statMultiplier`=1.0, `sellMult`, `enabled`) | extend `catalog/rarity.ts` (keep ids common/uncommon/rare/epic/legendary; labels are data). Remove all `=== 'legendary'` style logic; order via `rank` |
| Bases (`kind:'base'`): `tags, slot, minItemLevel, maxItemLevel, allowedRarities, poolWeight, baseStats` (authored at `minItemLevel`), `tier` kept for display/icons | `catalog/items/*.ts` via reworked `gear()` builder. **Every existing id stays**, so no id removal and icons keep working |
| Named items (`kind:'named'`): `fixedRarity`, `sourcePools`, min/max level | Rattatui set (12) + 3 legendary weapons, via a `named()` builder |
| Affixes: `{id, name, slot: prefix/suffix, stat, power, roll:[lo,hi], minItemLevel, weight, tags, group, minRarity, enabled}`; value = `affixMagnitude(stat, il) × power × roll` | new `catalog/affixes.ts` (~14 affixes over the 9 existing stat keys) |
| Level curve (single place): `statScale(il)`; stats at level = `baseStats × scale(il)/scale(minItemLevel) × quality` | rewrite `catalog/stats.ts` (`statScale`, `baseStat`, `affixMagnitude`; add `integer` flag to damage/armor/maxHp/luck so values round) |
| Pools: `{id, includeIds?, requireTags?, excludeTags?, enabled}`; profiles; sources | new `catalog/lootConfig.ts` |
| Loot profiles: `rolls{min,max,guaranteed,chancePerRoll,chancePerTier}`, `itemLevel{offset,variance,min,max}`, `rarityWeights`, `rarityLevelGate`, `generalPoolId`, `bonusTables[]` (targeted + consumable channels: `{poolId, chance, chancePerTier, rolls, mode:'rolled'\|'fixed', qty, preferMissing, pity}`) | `catalog/lootConfig.ts` |
| Sources reference a profile: `MONSTERS.rat.lootProfileId='normal_monster'`, `ratKing→'boss'`, chest→`basic_chest` + `rewardLevel` | `config/combatConfig.ts`, `config/gameConfig.ts` |

No elite/premium-chest profiles yet (YAGNI): adding them later is data only; the validator covers them when added.

### 2. Item instance (what a drop and a save hold)

```ts
interface ItemInstance { base: string; level: number; rarity: string; quality: number /*0-100, 50 = neutral*/; affixes: {id: string; roll: number /*0-100*/}[] }
BagSlot   = { item: ItemInstance } | { id: string; qty: number } | null   // gear | consumable stack
Equipment = Partial<Record<EquipmentSlot, ItemInstance>>
```

Stats are **derived** from catalog + curve at load (`resolveItem(inst)`, cached in a WeakMap), never stored. Consequences: retuning the curve retunes existing items; a hand-edited save can only describe items the generator could make (validator checks base exists, level within `[min,max]`, rarity allowed, affix ids exist and compatible, count ≤ rarity max, rolls in range; lower bound on affix count deliberately **not** checked so migrated items stay valid).

**Lossless migration:** legacy `{id}` → `{base:id, level:minItemLevel, rarity:<old def rarity>, quality:50, affixes:[]}`. Because bases are authored at `minItemLevel` with neutral quality, they resolve to exactly the old stats. A golden test proves it for all 77 gear items (snapshot of current stats captured in Phase 0).

### 3. Generation pipeline (`generateLoot(source, ctx, rng, {explain})`, brief §4)

1. profile ← `source.lootProfileId` (validated at load); 2. roll count: guaranteed + `chancePerRoll + chancePerTier×(tier-1)` per extra; 3. source level: monster `base + (tier-1)×perTier + (castleLevel-1)×castleStep`, King fixed boss level + castle offset, chest `rewardLevel`; clamp (never uses player level); 4. `itemLevel = clamp(sourceLevel + offset ± variance)`; 5. eligible candidates by pool, tags, `[min,max]` level, enabled, rarity; 6. rarity: profile weights ∩ `rarityLevelGate` ∩ rarities that have candidates, normalised (never chained checks); 7. base by `poolWeight`; 8. instance: quality roll [0.92–1.08], affix count from rarity range, picked without replacement respecting `group`, `minItemLevel`, tags; 9. validate; empty pool → dev warning, never silent substitution. Bonus tables (named set pieces, legendaries, potions) run after, as **additional** rolls so they never remove general loot. `explain` returns source, profile, source level, item level, eligible counts, effective weights, chosen rarity/base, affix rolls.

Initial values preserve current behaviour (rat gear chance 0.12 + 0.02/tier, potion 0.25 + 0.03/tier, King always 1 set piece +40% extra, 5% legendary, potions always); only deliberate changes: rarities become rolled, King also gets one general boss gear roll (kill feels like an event). All numbers are starting points for the sim, per brief §7.

**Level source:** rat tier 1-5 → levels 1,3,5,7,9 (+3 per castle level above 1), King ≈ 12 (+3/castle), chest `1 + 3×castle`; cap 100. Steel opens at il 5 (rat T3), obsidian at il 9 (rat T5), so old tier gating survives as level windows. Wood/cloth stop dropping past il 20 (data `maxItemLevel`).

### 4. Saves (`SAVE_SCHEMA` 2 → 3)

`MIGRATIONS[2]` converts equipment and bag as above; new frozen `tests/fixtures/saves/v3.sav`, existing v1/v2 fixtures must keep loading. `sanitizeSave`: new bag/equipment validation, optional `lootPity` (`Record<poolId, int ≤ cap>`) and `autoSell` (`{upToRank}`) added to `PERSISTED_KEYS`. Server runs the same sanitize (`acceptSave`), so client+server must ship together; old cloud rows and `save_history` migrate on read. Older clients will refuse v3 saves ("newer version"): expected.

### 5. Weak points fixed here
- **Sell value** = `rarity.sellBase × curve(il)`, still < shop price/3 (existing economy tests keep guarding). Check the `gold_jump`/`networth_exceeds` shadow flags still hold with a test on max single-item payout.
- **Auto-sell filter:** rarity-rank threshold applied at drop time (bag stays viable with many more drops); extends `sellJunk`; shown in loot summary.
- **Pity** per bonus table (soft pity: +x% per miss, capped, reset on drop) + generalised `preferMissing` (what the King does today for Rattatui).
- **Tooling:** `npm run loot-sim` (seeded Monte Carlo per profile/level: rarity %, il percentiles, drops/kill, P(≥1 high rarity), named-item frequency, empty-pool count, power growth to il 100), validator in tests, GameDebug "explain last drop".

### 6. Follow-ups, not in this change (listed so they aren't lost)
Salvage/materials and reroll/upgrade (real gear sinks); set bonuses are flat so they fade at high il; `requiredLevel` (no equip gate exists, item level is power not a gate); weapon `attackSpeed` still unused by click combat; offline loot (no offline progress exists at all); `scripts/sim.ts` ignores combat/gear; duplicated seeded RNGs in fightSim/store/worldGen; stale docs (`docs/03` §10 etc.); elite/premium chest profiles; castle level resets on rebirth while gear persists (kept as is).

## Phases (each ends green: `npm test`, `npm run lint`, `tsc`; one commit per phase)

0. **Baseline.** Write this design to `docs/superpowers/specs/2026-10-27-loot-system-design.md`. Capture golden snapshots: current stats of all gear (`tests/fixtures/legacy-item-stats.json`) and current pool shares (`npm run catalog-report`).
1. **Foundations.** `src/lib/rng.ts` (seedable mulberry32 + `weightedPick`/`int`), curve + stat helpers in `catalog/stats.ts`, rarity defs, `ItemInstance` type + `resolveItem`/`legacyInstance` in `src/lib/itemInstance.ts`, golden parity test.
2. **Catalog reshape.** New `gear()`/`named()` builders, set level windows/tags/pools on all 79 items, `catalog/affixes.ts`, `catalog/lootConfig.ts`, `src/lib/loot/validate.ts` (all brief §12 checks) + tests. Old `ItemDef.drops/DropRule/dropsFor/lootPool` removed once nothing reads them.
3. **Generator.** `src/lib/loot/{levels,pools,generate,pity}.ts`; `rollKillLoot`/`rollChestLoot` become thin adapters with same return shape plus instances; consumable channel; explain trace. Seeded unit + Monte Carlo distribution tests.
4. **Instances through the game.** `types/game.ts`, `inventory.ts` (all ops, `aggregateStats`, `compareDetailed`), `gameStore.ts` actions (`hitMonster`, `collectChest`, equip/unequip, sell/sellJunk/discard/buy, auto-sell), `fightSim.ts` (uses `legacyInstance` so balance numbers stay identical), `sanitizeSave.ts`, `saveFormat.ts` migration + v3 fixture, shop buys a base at `minItemLevel`.
5. **UI.** `ItemTooltip` (item level, quality, affix lines, compare on instances), `ItemSlot`, `Bag`, `CharacterOverlay`, `FightModal`, `ChestNotification`, `ConfirmDialogs`, Merchant sell UI, auto-sell setting, `GameDebug` explain panel; rarity colours from rarity defs.
6. **Tooling & docs.** `scripts/loot-sim.ts` (+ `docs/generated/loot-sim.md`), regenerate `catalog-report`/`fight-sim`, new `docs/10-loot-system.md` (how to add an item / affix / rarity / profile), fix stale `docs/03` §10.
7. **Monster level scaling (optional, separate commit, easy to drop).** `monsterStats` multiplied by the same curve at the monster's level so rising gear level doesn't trivialise combat; identical numbers at castle level 1.

## Critical files
`src/catalog/{rarity,stats,affixes(new),lootConfig(new),loot,index}.ts`, `src/catalog/items/*.ts`, `src/lib/{loot,chests,inventory,itemInstance(new),rng(new),fightSim,sanitizeSave,saveFormat}.ts`, `src/lib/loot/*(new)`, `src/stores/gameStore.ts`, `src/types/game.ts`, `src/config/{combatConfig,gameConfig}.ts`, `src/components/game/{ItemTooltip,ItemSlot,Bag,CharacterOverlay,FightModal,ChestNotification,ConfirmDialogs}.tsx`, tests `loot/catalog/items/inventory/fight/chests/saves/saveStorage/fightBalance`.

Reuse, don't rewrite: `STAT_DEFS`/`sumStats`, `RARITIES` table shape, `pickWeighted` logic, `setCounts`/`setBonusStats`, `sanitizeSave` helpers (`int`, `num`, `isObject`), `migrateBody` + fixture loader test, `catalog-report` generator.

## Verification
- `npm test` (node:test via tsx), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Golden parity: every legacy item resolves to its old stats; v1/v2/v3 fixtures load; v2 bag/equipment convert and re-encode round-trip.
- Seeded distribution tests (e.g. 100k rolls/profile at il 1, mid, cap vs expected rarity %, level bounds, empty-pool = 0); validator test with deliberately broken configs; adding a fake rarity/base in a test requires zero generator edits.
- `npm run loot-sim` and `fight-sim` reports reviewed; King/rat balance tests still pass (Phase 7 aside).
- Manual in the browser pane (`npm run dev`): kill rats and King via GameDebug, open chests, equip/compare/sell/auto-sell, reload to confirm save round trip.

## Process notes
- No commits until you ask. When committing, signing follows your GPG setup (memory: it needs your passphrase); if signing fails I stop and tell you, never bypass it. PRs go to `m-heyda/idlarz`.
- Phases 1-3 are pure additions (nothing in the running game changes); the first behaviour change lands in Phase 4, so you can stop after any phase with a working game.
