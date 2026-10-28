# 13 · Roadmap draft: the building rework and late-game resources

A **draft** for the next big design step, written while the first-run pacing was being fixed ([06 §0b](06-playtest-and-pacing-report.md)). Nothing here is built. It records the constraints the pacing work already put in place, so the rework does not undo them. The state of the code today is in [12 §1](12-roadmap-features-and-bugs.md); the open building issue is [04 U13](04-unfinished-and-known-issues.md).

## 1. What the first-run pacing fixed in place (do not undo)

- **Rebirth is the first real goal and is reached around day 7**: castle 6 (`CASTLE_UPGRADE`, 5→6 now 2 d) plus 100 tiles. A human who never sells surplus gets there at about day 5.6-8 in the sim; the Ember gain grows with castle level and tiles, so castle 7 roughly doubles the first rebirth's points ([03 §9](03-formulas-and-scaling.md)).
- **Gold is the tile limiter, never a material.** Tile materials (wood, stone, coal, food, hide) cost a share of the gold price (`TILE_RESOURCE_COST`); the sim's per-resource "minutes to cover what is missing" must keep every material under gold's. Any new building or resource that adds a tile cost must pass the same check.
- **Hide is the template for a second-tier material.** It has three sources: the farm (deer, pigs, Tannery, Pasture), kills (`COMBAT.rewards.hideShare` of the farm's income per reward second) and, later, buildings. A material the player needs in a large amount must have more than one scalable source, or a cap on its only source becomes a wall past 300 tiles.
- **XP is slow on purpose**: tile XP 45 per base unit, the level curve is x1.3 to level 38 and x1.045 after ([03 §2](03-formulas-and-scaling.md)). Level 100 is about 5e9 XP in total: a deep run (castle 8-10, 600+ tiles) gets to the 70s, so level 100 is a multi-rebirth goal that the planned rebirth XP modifiers will shorten.

## 2. Building system rework

Today: 16 buildings, one per tile, permanent, each a flat `resourceGeneration` ([12 §1](12-roadmap-features-and-bugs.md)). Direction, in the order I would build it:

1. **Demolish and swap with a partial refund** (U13). Smallest step, removes the "wrong building forever" frustration, and makes the rising `BUILDING_COST` curve less punishing.
2. **Building levels.** A building gets levels bought with resources (tier 1 first), output growing per level, so a built tile stays a sink after the cheap ladder ends. Level caps follow the castle level (castle 6 allows level 3, and so on) so a rebirth restarts the climb.
3. **Specialisation bonuses (BL8).** +x% per k same-kind buildings in a cluster (reuse `lib/cluster` / `utils/cluster.ts`), which makes placement a decision. Keep the adjacency bonus for biomes (`SCALING_CONFIG.adjacencyBonus`) as is.
4. **Production buildings for second-tier materials** (see §3): a Tannery (hide), a Smithy (iron), a Harbour (fish), an Arcane Tower (mana). Each is unlocked by a rebirth count or a castle level, not sold from the start.
5. **Server-owned building costs** (docs/12 §3 item 3): one batch call per few seconds, because a building purchase pays out permanent income.

Things the rework must keep: a monster stands only on a tile without a building (`canSpawnOn`); `cloudSave/netWorth.ts` plausibility must price the new levels; the sim bot's `BUILD_ORDER` has to learn the new choices or the pacing tables stop meaning anything.

## 3. Resource tiers

The tiers are a field of the catalog (`tier` in `src/catalog/resources.ts`, list `RESOURCE_TIERS`); the header draws one boxed group per tier, left to right, so the table below is also the header layout.

| Catalog tier | Resources | Source today | Role |
| --- | --- | --- | --- |
| `currency` | gold, gems, **Embers** | castle and land, chests / starting purse, rebirth | gold buys everything; gems are premium; Embers buy permanent upgrades |
| `t0` base materials | wood, stone, coal, food, meat | biomes, buildings, castle, farm animals | tiles, castle, animals |
| `t1` | eggs, milk, **hide** | farm (+ hide from kills) | farm upgrades, hide for tiles from 100 |
| `t2` (planned) | iron, fish, mana, crystals | none (`RESERVED_RESOURCES` icons only, BL14) | gear crafting, castle 7-10, abilities, later biomes |

Rules for adding a tier-2 resource (one change set, like hide's):

1. An entry in `catalog/resources.ts` (`tier`, label, icon, source, price or "cannot be bought"; a new tier is one more entry in `RESOURCE_TIERS`), the `Resources` type, `INITIAL_RESOURCES`, `sanitizeSave` and the server ledger totals (`GrantTotals`, `lib/offline/ledger.ts`) **together**, or a save is rejected. The header needs no edit (it reads the tiers); `tests/catalog.test.ts` fails if a stored resource has no tier. The full list of hand-kept key lists is in [12 §3b](12-roadmap-features-and-bugs.md#3b-server-authority-and-free-tier-notes).
2. At least two sources and one sink on day one, e.g. iron: a Smithy building and a rat drop; sink: gear crafting and the 6→7+ castle costs.
3. Not a tile material before 300 tiles. Tier 2 enters the **castle** costs first (levels 7-10 are the late-game gate), then the larger tile prices.
4. A line in the sim: the new resource's stock and income in the trace, and its "minutes to cover" in the tile-wait table.
5. Offline income and the chest/bundle tables decide explicitly whether the resource takes part (`LIMITS`, `CHEST.bundle.resources`).

Open questions: should the merchant buy tier 2 at all (it would turn it into gold, as meat did, see [06 §1](06-playtest-and-pacing-report.md))? Does tier 2 reset on rebirth (proposed: yes, except what the Ember shop buys back)?

## 4. Rebirth hooks

- **XP and level modifiers for rebirth** (deferred): the per-run level curve stays; an Ember upgrade or a per-rebirth multiplier on tile XP would be the lever. Today the Embers' +5 % income applies to passive and kill XP but not to tile XP, which is the biggest source.
- **Content gated by rebirth count**: monsters (`MonsterDef.spawn.minRebirths`, already in the shape), biomes (`BIOME_RULES.unlock.rebirths`, not built), tier-2 production buildings.
- **Bigger maps and bigger starts** (BL16): `TILE_PRICE.tailFrom` / `tailExponent` and the `provisions` shop item; with tier 2 the starting bundle needs a tier-2 part.
- **Acceptance test for every addition**: with the sim's `human-rebirth6` / `human-rebirth8` profiles, run 2 reaches the same point in at most about 65-70 % of the time of run 1, and the first rebirth stays available around day 7.

## 5. Order of work (proposal)

1. Demolish/swap + refund (small, UI + store + save check).
2. Building levels for tier 1 buildings.
3. First tier-2 resource (iron: Smithy + rat drop + castle 7 cost), as the dry run of §3.
4. Specialisation bonuses.
5. Rebirth-gated content and the XP modifier.
6. Server-owned building costs, together with the ledger-owned inventory (docs/12 §3).
