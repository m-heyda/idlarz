# Roadmap: open work, known issues, server migration

The one place to look when planning the next step. It lists only what is **still open**; finished work is in git history. Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week.

The big plan is to move more of the economy to the server (see "Server authority") and to optimise afterwards. Until then the mechanics stay as they are; the items below are ordered so each can be picked up on its own.

## Where things stand

- **Accounts only.** There is no guest or "play without account" mode: the game needs the server to spawn, place and fight. A server outage shows a retry screen; the browser save is a cache and the export path. (Paid offline *progress* is a kept feature: [11](11-server-authority.md).)
- **The server owns:** when chests and monsters appear, **where each one stands**, what a chest or a kill holds, the gem balance, the XP ceiling, **what the player carries** (the bag, the worn gear, the loot pity and the auto-sell filter live in the ledger: [11](11-server-authority.md)), and **every fight** (player HP and mana, cooldowns, hits both ways, potions drunk, the kill's reward). See [11](11-server-authority.md) and the combat section of [02](02-mechanics.md).
- **A click starts a fight; the server runs it.** With *Auto-battle* on (locked until the first rebirth) the server also sends the player against the next monster. Potions and skills have hotkeys (1-5) and an *Auto-use* switch with a fixed preset (`COMBAT.auto`).
- **Still the browser's:** the economy (income, tile and building purchases, the map), the stat allocation, the merchant, the farm, rebirth. The server checks them only by plausibility ([07](07-saves-and-security.md), [09](09-cloud-saves.md)).

## The next update: the rebirth world (design drafts, nothing built)

One theme, ten docs. Each doc lists what exists in the code, the design, the server and save impact, and its open questions. Numbers and names in them are proposals until the questions are answered.

| Doc | Feature | Size | Needs first |
|---|---|---|---|
| [14](14-server-audit-and-data-plan.md) | **Server audit**, catalogs stay in code, free-plan budget, save-compat method | S-M | nothing; do the polling-write fix first |
| [12](12-rebirth-biomes.md) | **Five biomes, one per rebirth (1-5)**, distance rules, five T2 materials, merchant gating, monster slots per biome, dev tools, Guide text | L (art-heavy) | P0 rules need nothing; art per biome |
| [13](13-rebirth-reset-and-paragon.md) | **Rebirth reset**: respec, +20 points per rebirth, bag and gear wipe; **Paragon** after level 100 | M | the wipe ships with or after crafting |
| [15](15-leaderboard-and-world-preview.md) | **Rankings** from `player_stats` (no cron), **preview map** of another player's world | M | paragon (for ordering), avatar decision |
| [16](16-landing-and-play-route.md) | **Landing page**, auth-protected `/play`, login and avatar polish | M-L | rebirth-biome art for the final background |
| [18](18-biome-buildings-and-material-tiers.md) | **Biome buildings** (Producer, Extractor, Idol per biome, one of each, upgrade timers), **material tiers T0-T4**, **shorter early castle timers**, the resource-key registry refactor | L | key-list refactor first; Extractors feed crafting |
| [20](20-monster-families-and-rewards.md) | **Monster families and rewards**: capped absolute rewards multiplied by level, hide/food goods, tiered item drops, spawn pressure, generic tickets | L | the biomes; rats to distance 2-6 |
| [19](19-first-build-steps.md) | **First build steps**: castle timers 1/3/9/16/36 h + first five castle costs x0.75 (sim-measured), resource-key registry | S + M | nothing |
| [21](21-classes-avatars-achievements-offline-report.md) | **Class bonuses, separate avatars, the one-time progress reset (reserved unique names), guided tutorial, offline report bar**; achievements and glossary as drafts | M-L | avatar art, class numbers |
| [17](17-crafting.md) | **Crafting** (Luck = rarity, Intelligence = affix quality, persistent crafting level, about 10 weeks to level 100, instant crafts, slot-themed extract recipes), enchanted craft (reroll/add one affix) locked behind Ichor | L | T2 materials; server-priced merchant to enforce it |

Release order (confirmed 2026-10-29): **[19](19-first-build-steps.md) A castle timers, then B resource registry -> 14 polling fix -> the "New chapter" release ([21](21-classes-avatars-achievements-offline-report.md): classes, avatars, reserved names, the one-time reset, initial tutorial, with [16](16-landing-and-play-route.md) landing and the sign-up pickers) -> 12 P0-P1 (rules + first biome art) with 18 buildings P1-P3 (the reset has already wiped old maps, so no legacy-building refund) -> 13 respec and +20 pool (without the wipe) -> 15 rankings -> 12 P2-P4 (T2 materials, flags, Guide entries) -> 17 crafting together with the 13 gear wipe -> 20 and 12 P5-P6 (distance bands, rats 2-6, generic tickets, monster families)**. Ship the reset exactly once: put everything that would otherwise need another wipe (class and avatar columns, unique names, the epoch) into that release. Biomes, rankings and the landing are otherwise independent; the gear wipe must not ship before crafting. Items 1-5 of the *Server authority* list below are the dependencies that turn these features from "flagged" into "enforced".

**Principles agreed for the whole update**

- **The map and its biomes reset on every rebirth, always.** What persists: character (level, attributes budget), crafting level, Embers and the shop, `discovered` biomes, and the **Idol levels** (re-placed free at their level; cap 5 for now).
- **Soft caps everywhere, raised with legacy points (Embers) later.** Every limit goes through `limitOf` / `LIMITS` with a `HARD_LIMITS` ceiling so a raise never invalidates a save ([18](18-biome-buildings-and-material-tiers.md) section 6 has the table: Idol level, building level, builder slots, crafting level, bag, offline cap ...). New Ember shop items have this shape (caps and slots), not just flat percentages.
- **Position bonus on buildings:** the castle's area bonus multiplies every building in its range (Producers and Extractors in full, Idols capped at x2), and buildings beyond the range get a frontier bonus that grows with distance, so the far biomes stay competitive ([18](18-biome-buildings-and-material-tiers.md) rule 7).
- **Roads connect buildings to the castle for +100 % (additive)**: per-tile, per-biome road art and cost (swamp, tundra and bridges dearer), built instantly, priced in gold and resources ([18](18-biome-buildings-and-material-tiers.md) section 5.2). **Building level caps go up to 15 with Ember purchases** (Master Craftsmen, 10 levels).
- **Content will grow: about ten new items, new monsters and biomes are coming.** Crafting, loot and rewards are data-driven by tag and tier, never tuned against today's gear alone ([17](17-crafting.md), [20](20-monster-families-and-rewards.md)).
- **Monster rewards are capped per monster and multiplied by level**, so weak monsters fade and strong ones pay (gold, hide/food, tiered items) ([20](20-monster-families-and-rewards.md)).

**Later features agreed in principle (drafts, see [21](21-classes-avatars-achievements-offline-report.md))**

- **Guided tutorial instead of the wall-of-text Guide**: steps stored as catalog data, unlocked with the features and when the player discovers them, shown as small coach tips plus a Guide journal of unlocked entries (locked ones as "???"); it is also the initial tutorial replayed after the class-release reset ([21](21-classes-avatars-achievements-offline-report.md) section 7). Each later feature adds its own steps.
- **One-time progress reset when classes ship**: every player keeps account and **reserved name** (unique names enforced), picks class and avatar and replays the initial tutorial; old state is archived to `save_history` (pinned); an epoch column and `needsReset` gate make it repeatable ([21](21-classes-avatars-achievements-offline-report.md) section 6).
- **Class bonuses**: classes stop being cosmetic and give small passives (one economy, one combat); avatars are separate (8 to choose, more unlocked by achievements).
- **Server-based achievements** (a simple draft: catalog in code, table written only by the server, evaluated on requests it already handles) and a **Glossary** generated from the catalogs; both will be designed properly later.
- **Offline report rework**: a bar of away time against the cap, a clear "capped, N h earned nothing" state with a Night Watch / Steward hint, also on the landing's Continue card.
- **Landing**: name **IDLE REALM** (a big IDLE patch in hills tiles), Continue card for signed-in players, password reset on and email confirmation off for now ([16](16-landing-and-play-route.md)).

Cross-cutting rules for all of it: additive save fields only (no `SAVE_SCHEMA` bump), nullable ledger columns applied before the code that reads them, no new per-click server calls, catalogs stay in TypeScript ([14](14-server-audit-and-data-plan.md)).

## Known bugs and leftovers

| # | What | Where | Note |
|---|---|---|---|
| R7 | `dangerBonus` (one level per 8 tiles from the castle) is now 0 or 1: monsters stand at most 9 tiles out | `lib/monsters.ts` | the frontier is no longer more dangerous than the home land; rework with the biomes (planned as per-band danger offsets, [12](12-rebirth-biomes.md) section 5) |
| R8 | The King's balance changed with auto-attack (1000 HP, 75 s clock): the Rattatui set wins in 26-35 s, obsidian in 51-64 s, steel and wood not at all (steel lost its old set bonus) | `MONSTERS.ratKing`, [generated/fight-sim.md](generated/fight-sim.md) | needs a real playtest |
| R9 | Local development needs a Supabase project and `LOOT_SECRET`: there is no guest mode to run the game without them | `README.md` | a dev-only fake backend would bring that back. Dev sessions on localhost use their own browser keys (`.dev` suffix) |
| ⚠️ B6 | Chests and map clicks are small next to the rest of the economy (the click is the only click income for now; the tile tap was removed) | | decide whether they should scale with progress, together with the click rework (BL3) |
| ⚠️ B7 | `sim.ts` bots build on the first free explored tile (round-robin through six buildings), do not use the class picker, allocate stat points by a fixed policy, and play one reasonable style (reserve for the castle, top up at the merchant) | `scripts/sim.ts` | fine for pacing checks; extend the bot before tuning small effects |

## Server authority (the migration backlog, ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

0. **New from the rebirth-world plan ([14](14-server-audit-and-data-plan.md))**: the attribute sum check (`reconcileCharacter` + `20 x rebirths`), an idempotent server-side inventory wipe on rebirth (first step of `/api/rebirth`), biome legality flags in `verify.ts`, `player_ledger.craft`, and the polling write fix (skip the ledger write when only the anchor moved).
1. **Enforce `verify.ts`** (today it only flags): reject a save that gained more than the server granted.
2. **Economy actions** by the server where they pay out: castle upgrade (start, cost and finish time in the ledger; today the server only checks the timer on its own clock, `castle_jump`), rebirth/Embers, farm purchases, building costs. Batch them (one call per few seconds) rather than one per click.
3. **XP award** of tile purchases and the attribute allocation (the server already models and clamps XP, `cloudSave/xpModel.ts`, and derives the fight level from the saved XP).
4. **Merchant and sell** (gold for gear, resource sell/buy, upgrades): server-priced. The inventory already is the server's, so only the prices and the shelf (`merchantStock`, rolled in the browser) are left; a purchase today is checked for being a valid item, not for what it costs. Every merchant action is a store action over `buyOffer`, `buyItem`, `sellResources`, `buyResource` and `buyMerchantUpgrade`, so moving them behind routes changes no UI.
5. **Spawn caps from the real map**: monsters and chests count free tiles from the map; the overall share (`SPAWN_LIMIT`, `ticketCap`) still use an estimate from the owned-tile count.

Notes from reading the code (not measured against the live project):

- **No cron job and no Realtime channel are needed now.** Everything the server decides is computed lazily on a request from timestamps; the browser only talks to `/api/*`. Add `pg_cron` only for something that must progress while nobody is online (a leaderboard season roll-up, expiring events).
- **Catalogs stay in code, not in the database.** The API routes import the same TypeScript modules as the browser, so client and server cannot disagree. Move a catalog to tables only if content must change without a deploy.
- **Rebirth and Embers are client-authoritative.** `sanitizeSave` checks conservation and ranges; nothing checks that the Embers earned match the castle level and tiles of the run that ended. Cheap next step: a shadow flag in `cloudSave/verify.ts` comparing the claimed gain with `emberGain(castle_level, tiles_owned)` of the previously stored row. Later: a server-owned `/api/rebirth` (item 2).
- **The inventory's open edges.** The ledger owns the bag, the gear, the pity and the auto-sell filter, but a purchase still pays its gold in the browser and the merchant's shelf is rolled there, so a forged shelf piece can be bought (for its price, which the net-worth check bounds). The bag's size follows the Pack Rat level of the last upload. The dev panel's loot buttons (`GameDebug`) change the local bag only, which the server's picture replaces at the next answer.
- **Free-tier hot spot: polling during a fight.** While a fight is open the browser calls `/api/spawn` / `/api/fight` every 2 s (about 1,800 requests an hour). Each does `auth.getUser()`, a read of `player_saves` and `player_ledger`, and **a ledger UPDATE even for a read-only sync** (`onlineStep` returns `anchorAt: nowMs`; `toRow` stamps `updated_at`). Next: skip the write when nothing but the anchor changed, or poll less while the fight is only watched.
- **Resource key lists are hand-kept in several places** (the `Resources` interface, `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `FARM_PRODUCT_KEYS`, `zeroResources`, `sanitizeSave` `OPTIONAL_RESOURCES`, `offline/grant.ts`, `offline/ledger.ts` `zeroTotals`). A new resource must be added to all of them together; `tests/catalog.test.ts` fails if a stored resource has no tier.
- **Secret in the repo**: `.env.example` carries a concrete `LOOT_SECRET` ("the shared one every new workspace starts with"). Fine while the repo is private; rotate it and give every deployment its own before any public release.
- **Deploy order**: apply additive SQL migrations before deploying the code that reads the new column (a release that read `player_ledger.combat` before `combat_ledger.sql` ran made every ledger read fail; the same goes for `inv` and `inventory_ledger.sql`).

## Features and content (in suggested order)

**Small polish and safety nets**

| Item | Size | Acceptance |
|---|---|---|
| CI: a GitHub Action running `tsc`, `lint`, `test`, `build`, plus `sim -- --maxdays=30 hardcore` as a pacing guard (no `.github` exists yet) | S | PR fails when the first-finish time of a profile moves by more than ±15 % |
| Playwright smoke test: new game, click, buy tile, open Settings and Rebirth, reload keeps state (no UI tests exist) | M | runs in CI; uses `window.__game` only in dev builds |
| Framework upgrades one at a time: Next 16, TypeScript 7, ESLint 10, `@types/node` 26 (held back on purpose; Next 16 fixes two PostCSS advisories bundled in 15; check `typescript-eslint` / `eslint-config-next` peer ranges) | M | build, tests and sim output unchanged |

**Content**

1. 🚧 **Item upgrading** (M): a gold/resource sink tied to the merchant; salvage and reroll are in [10](10-loot-system.md). The merchant's Upgrades tab holds click power and merchant bonuses, not gear enhancement.
2. 🚧 **Building rework** (M-L, see the next section): demolish, levels, specialisation.
3. 🚧 **Quests** (L): the merchant's *Quests* tab is a placeholder. Early guidance, item rewards, tracking in the store.
4. 🚧 **Gambling** (M): the *Gambling* tab is a placeholder. Uses `luck`; every payout must be computed on the server side, limited by cooldown.
5. 🚧 **Mobile layout** (L): the pixel UI is desktop-first; touch pan exists, the rest is untested. Responsive modals, bigger tap targets, test on a real phone.
6. **Monsters and combat depth**: monster families per biome (wolves in forest, crabs on the coast, bog things in swamp), a bestiary with kill counts and monster-specific loot; more skills (the two ability slots hold Heal and Stun; classes are cosmetic, so class skills are open); monster abilities (bleed, enrage), a daily bounty monster; elite monsters and premium chests ([10](10-loot-system.md)).
7. **Ambient life** (cheap, optional): weather (rain tint), day/night tint by real clock, castle flag animation. Each switchable in Settings and covered by `prefers-reduced-motion`.
8. **Zoom 0.5** step for an overview (the minimap covers it today; the wheel zoom is four fixed steps).

**Config extensions planned (the shape is ready)**

- **Monster spawn rules** are per monster (`MonsterDef.spawn`): `biomes`, `minCastleDistance`, `maxCastleDistance` and `minRebirths`. A new monster is one entry in `MONSTERS`; `tests/monsterConfig.test.ts` checks the shape.
- **Biomes unlocked by rebirth**: `BIOME_RULES` has `unlockAfterPurchases` today (swamp 6, tundra 10); a rebirth-based unlock plus a minimum castle distance and distance-weighted rolls is designed in [12](12-rebirth-biomes.md). A monster's `biomes` list already follows whatever biomes exist. Rats are to move from distance 2-9 to 2-6; more families need a generic ticket list in the ledger bank (not just a rule change).
- **Per-biome loot and modifiers**; per-monster loot sources exist (`lootSourceId`).
- **Fight tunables** all sit in `COMBAT` (`tickSec`, `maxCatchUpSec`, `maxFightSec`, `poll`, `auto`): thresholds, retry cooldowns, which monster is next (`engageOrder`).

**Paragon levels (draft, not built; the current design is in [13](13-rebirth-reset-and-paragon.md) section 5, the leaderboard ranks level then paragon).** The level curve ends at 100 (soft cap 80, level 90 around the 5th rebirth, 100 around the 10th). Past it a paragon track would give the endless part of the game without feeding the attribute economy (a level-100 character already holds 157 attribute points): the same lifetime XP keeps counting, each paragon level gives one point, points go into a few small, capped, account-wide bonuses (income, XP gain, Luck, offline efficiency), and the leaderboard ranks level then paragon level. Open: points per level, the caps, whether levels 81-100 should give extra attribute points, and how the Ember shop and Ancestral Tithe interact.

## Draft ideas for later (not committed to)

Loose ideas, not scheduled and not sized; each needs a design pass before it enters the lists above.

**Economy upgrades** (the Ember shop and the merchant ladders are flat percentages today; BL5, BL6, BL9, BL10)
- *Market saturation*: the price of a resource drops with the volume sold and recovers over ~30 min, so burst selling is not the best move.
- *Caravans / trade contracts*: a timed gold-and-resource sink that pays out more than it costs, run on the server clock (the ledger already has the timers pattern).
- *Storage caps tied to the castle*: stockpiles stop at a cap that grows with the castle, which gives wood, stone and coal a reason to be spent.
- *Building levels and specialisation*: the building rework below, with the set-like bonus for clusters of one kind.
- *A second Ember currency or prestige tier* and shop items with a different shape (a longer chest timer cap, a free animal slot, a start with a tier-2 resource). Embers stay permanent: no reroll or respec.
- *More economy sets*: the Obsidian set pays income, XP and away time; a later tier could pay different things (chest rewards, merchant prices, farm output).

**Combat upgrades** (the two ability slots hold Heal and Stun; one weapon per rarity tier)
- *Item upgrading / enchanting*: a gold-and-material sink tied to the merchant, with salvage ([10](10-loot-system.md)); the natural place for the tier-2 materials.
- *Gem sockets* in gear, and gems as the thing the premium currency buys.
- *A skill tree or class skills* (classes are cosmetic today): more skills for the two slots, passive picks per class.
- *Monster families per biome*, a bestiary with kill counts, monster abilities (bleed, enrage), elites and a daily bounty monster.
- *Set depth*: more sets per gear tier, set bonuses that scale with the item level (today they are fixed amounts), loadout swapping between an economy set and a combat set.

**Server authority follow-ups**: the ledger-owned inventory above, server-run castle upgrades (start, cost, finish time), a server-priced merchant, enforcing `verify.ts`, and a server-owned `/api/rebirth`.

## Building rework and late-game resources (design draft, nothing built)

> **Superseded in part by [18](18-biome-buildings-and-material-tiers.md):** the 16 generic buildings are replaced by three per biome (Producer, Extractor, Idol), one of each type, with timed levels; materials get tiers T0-T4 and the merchant trades T0-T1 only. The list below is kept for the constraints it records (pacing rules, what must not be undone); its "order of work" is now doc 18 section 10.

State today: `BUILDINGS` (16 buildings, each a `resourceGeneration` rate) and `BUILDING_COST` in `gameConfig.ts`; `calculateBuildingCost`, `canBuildOn`, `calculateTileOutput` in `gameUtils.ts`; `buildOnTile` in the store; `BuildDialog.tsx`. One building per tile, any land biome except the castle and lakes, nothing on a tile with a chest or monster, permanent (no demolish, swap or levels). The server knows only `tile.building` in the save (plausibility in `cloudSave/netWorth.ts`). A monster stands only on a tile without a building (`canSpawnOn`) and the server moves it if the player builds there.

**What the first-run pacing fixed in place (do not undo)** - targets are in [06](06-pacing-targets.md):

- Rebirth is the first real goal and arrives around day 5-7 (castle 6 plus 100 tiles).
- **Gold is the tile limiter, never a material.** Any new building or resource that adds a tile cost must pass the sim's "minutes to cover what is missing" check.
- **Hide is the template for a second-tier material**: three sources (the farm, kills via `COMBAT.rewards.hideShare`, later buildings). A material needed in a large amount must have more than one scalable source.
- XP is slow on purpose (tile XP 45 per base unit, the anchored level curve).

**Order of work (proposal)**

1. **Demolish and swap with a partial refund** (small; removes "wrong building forever").
2. **Building levels** bought with resources, output growing per level, level caps following the castle level so a rebirth restarts the climb.
3. **Specialisation bonuses** (+x % per k same-kind buildings in a cluster, reusing `utils/cluster.ts`; BL8). Keep the biome adjacency bonus.
4. **Production buildings for second-tier materials** (a Smithy for iron, a Harbour for fish, an Arcane Tower for mana), each unlocked by a rebirth count or castle level.
5. **Rebirth-gated content and an XP modifier** (an Ember upgrade or per-rebirth multiplier on tile XP; today the Embers' +5 % income applies to passive and kill XP but not to tile XP, the biggest source).
6. **Server-owned building costs**, together with the ledger-owned inventory.

Things the rework must keep: monsters not standing on buildings; `netWorth.ts` plausibility must price the new levels; the sim bot's `BUILD_ORDER` has to learn the new choices; **acceptance:** with `human-rebirth6` / `-rebirth8`, run 2 reaches the same point in at most about 65-70 % of run 1, and the first rebirth stays available around day 7.

**Resource tiers.** The tier is a catalog field (`tier` in `src/catalog/resources.ts`, `RESOURCE_TIERS`); the header draws one boxed group per tier: `currency` (gold, gems, Embers), `t0` (wood, stone, coal, food, meat), `t1` (eggs, milk, hide), and a planned `t2` (iron, fish, mana, crystals; today only `RESERVED_RESOURCES` icons exist, nothing produces or spends them). Rules for adding a tier-2 resource, in one change set:

1. An entry in `catalog/resources.ts`, the `Resources` type, `INITIAL_RESOURCES`, `sanitizeSave` and the ledger totals (`GrantTotals`) **together** (the full list of hand-kept key lists is above), or a save is rejected.
2. At least two sources and one sink on day one (e.g. iron: a Smithy and a rat drop; sink: gear crafting and the 6→7+ castle costs).
3. Not a tile material before 300 tiles; it enters the castle costs first (levels 7-10 are the late-game gate), then the larger tile prices.
4. A line in the sim (stock, income, "minutes to cover" in the tile-wait table).
5. Decide explicitly whether offline income and the chest bundles include it (`LIMITS`, `CHEST.bundle.resources`).

The five T2 materials of the rebirth biomes (Hardwood, Cloth, Honey, Ichor, War Medals) and their gating are drafted in [12](12-rebirth-biomes.md); Ichor and Medals are crafting-only ([17](17-crafting.md)). Open: should the merchant buy tier 2 at all (it would turn it into gold, as meat did)? Does tier 2 reset on rebirth (proposed: yes, except what the Ember shop buys back)?

**Rebirth hooks.** Content gated by rebirth count (monsters via `MonsterDef.spawn.minRebirths`, biomes, tier-2 buildings); bigger maps and bigger starts (BL16: `TILE_PRICE.tailFrom` / `tailExponent`, the `provisions` shop item, which needs a tier-2 part).

## Balance backlog (each needs approval before changing)

Measure with `npm run sim -- --seeds=3`, never from numbers copied into prose: [generated/sim-milestones.md](generated/sim-milestones.md). Keep the targets of [06](06-pacing-targets.md).

| # | Topic | Observation | Idea |
| --- | --- | --- | --- |
| BL1 | **Gap between active and idle players is small** | gold is only part of the economy; the castle timers (3 d 17 h to level 6) and resource costs dominate | raise click power further, or let clicks pay a small share of other resources; re-run the sim |
| BL2 | **Levels and stat points barely matter for income** | levels 2-30 give 3 points, later levels 1; +2.5 % each on a pool the castle multiplies | gate castle levels by player level, raise per-point effects, or add respec |
| BL3 | **Chests and map clicks are small** next to income | chest = 10-60 min of *passive* gold; a click = 50-180 % of one second of gold | scale chests with click-inclusive income, give resource packs, or rework clicking altogether |
| BL4 | **Meat/food is the strongest engine** (animal stacking × castle multiplier) | animals dominate mid-game income in the sim traces | revisit `costScaling` or add upkeep |
| BL5 | **Resource sinks are thin after the castle and tiles** | wood/stone/coal beyond tile and castle needs only sell for 0.4-1.1 gold | equipment upgrades, buildings with levels, storage caps tied to the castle |
| BL6 | **Merchant has little depth** | flat prices, no saturation; bonuses, supplies and a shuffling gear shelf exist | optional "market saturation" (price drops with volume sold, recovers over ~30 min) if burst selling shows up again |
| BL7 | **Late tiles are very expensive** | steep `(n/300)^4.5` tail after 300 (table in [generated/balance-tables.md](generated/balance-tables.md)) | fine as an endgame sink; revisit if the Ember discount (cap 45 %) makes late rebirth runs too cheap |
| BL8 | **Idle tile income** | with `BIOME_YIELD.scale` = 1.3 a tile adds ~0.1-0.5 gold-equivalent/s | per-biome specialisation bonuses (e.g. +x % per 4 same biome) |
| BL9 | **Ember shop is six items**, all flat percentages | the choice is mostly "which first" | add one or two with a different shape (longer chest timer cap, a free animal slot). A purchase stays permanent: the shop is not rerolled or respecced, it only gains items |
| BL10 | **Late Ember runs flatten** | gain grows with `sqrt(tiles)` and castle level, the shop caps at 10 levels each | a second prestige tier or a sink for surplus points |
| BL11 | **Biome luck and the 24 h player** | seed spread is large and the 24 h auto-clicker bot is faster than the 8 h/day hardcore bot | tune `BIOME_SPAWN` weights (fewer water tiles early) and re-run `sim --seeds=3` |
| BL12 | **Combat rewards and difficulty** | kill gold / XP / hide are `rewardSec` seconds of income; the `human*` sim profiles fight on an assumed `GEAR_SCHEDULE` | check the share of income from fights stays small, tune `COMBAT.spawn`, `MONSTERS.rat.rewardSec`, armor `K` once real playtests exist |
| BL13 | **Round 2 numbers are first guesses** | the ten newer buildings, the chest reward table (50 / 25 / 12 / 10 / 8), the unlock thresholds and cluster chances were set by feel | run `npm run sim`, then tune `BUILDINGS`, `CHEST.rewards`, `BIOME_RULES` |
| BL14 | **Reserved resources** | iron, fish, mana, blue crystal, sapphire, ability shard and the random-item box exist as icons only | design them as end-game / rebirth currencies and add them to `Resources` + the merchant + `sanitizeSave` together (see the tier rules above) |
| BL15 | **The four free start tiles shape the opening** | 4 free tiles (north, east, south, west of the castle) produce from second 0; the corners are the first tiles to buy | if the opening is too slow or too fast: scale the start tiles' yield, change the start gold, or `SCALING_CONFIG.growthEarly` |
| BL16 | **Late tile price and map scale (rebirth-centred)** | the map is limited only by `COORD_LIMIT` (±16,000) and `MAX_OWNED_TILES` (250,000); price tail `tailFrom` 300, exponent 4.5, `RESOURCE_CAP` 1e21; placeholders until rebirth is designed | pick the intended map size per rebirth tier, then move `tailFrom` / `tailExponent` (and the `TILE_RESOURCE_COST` shares); also check building price, income vs price at 1k+ tiles, the XP curve at 10k+ tiles, and float precision of gold past 2^53 |

## Technical risks

- **Performance on a big map** (`npm run perf`, and synthetic maps in the admin panel): at 50,000 tiles a purchase takes ~16 ms, the income pass ~11 ms, saving 12 ms (75 KB), loading and validating a save ~80 ms, the minimap ~4 ms; the screen mounts ~550 tile elements and ~20 terrain canvases. Panning stays at 60 fps with an occasional 33-60 ms frame while tiles enter the view. Follow-ups if it matters: one lightweight component (or event delegation) for plain explored tiles, incremental income on a purchase, chunk drawing off the main thread (OffscreenCanvas), minimap filters and "go to castle/workshop".
- **No UI tests**: logic is covered by `npm test`; components are verified manually.
- **Save compatibility**: an unreadable save falls back to the backup, then to a new game, and the damaged text is kept. A new field is optional (no bump); a renamed or removed one needs `SAVE_SCHEMA` + `MIGRATIONS` and a frozen fixture ([07](07-saves-and-security.md)). Content removed from the game (an item, a building) or a rule that moved (a maximum, a curve) no longer locks a player out: the game's own copies are read leniently and the broken value is adjusted (`src/lib/repairSave.ts`); a new `sanitizeSave` rule needs its repair there.
- **Float drift**: resources are doubles capped at 1e21 (`RESOURCE_CAP`). With castle 10 and Ember bonuses the income grows by orders of magnitude, so watch the cap when adding multipliers.
- **Per-tile store subscriptions**: a `Tile` reads only primitives and is `React.memo`'d; the 10 Hz `set()` that rebuilds `resources` is the remaining cost. Measure before optimising.

## Combat and items: known limits

- Monsters are one family (rats) plus one boss (the Rat King); there is one weapon per rarity tier and no item upgrading yet.
- The Rat King (1000 HP behind 15 armor, 75 s) is the only source of Rattatui pieces. When gear or monsters change, rerun `npm run fight-sim -- --md` (`tests/fightBalance.test.ts` pins the tuning).
- Crits and weapon speed, Heal and Stun, selling, affixes, item levels, bag expansion (Pack Rat), auto-battle and a beatable King are built; offline-safe combat is the server's.
