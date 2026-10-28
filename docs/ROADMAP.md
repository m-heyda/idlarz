# Roadmap: open work, known issues, server migration

The one place to look when planning the next step. It lists only what is **still open**; finished work is in git history. Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week.

The big plan is to move more of the economy to the server (see "Server authority") and to optimise afterwards. Until then the mechanics stay as they are; the items below are ordered so each can be picked up on its own.

## Where things stand

- **Accounts only.** There is no guest or "play without account" mode: the game needs the server to spawn, place and fight. A server outage shows a retry screen; the browser save is a cache and the export path. (Paid offline *progress* is a kept feature: [11](11-server-authority.md).)
- **The server owns:** when chests and monsters appear, **where a monster stands**, what a chest or a kill holds, the gem balance, the XP ceiling, and **every fight** (player HP and mana, cooldowns, hits both ways, potions drunk, the kill's reward). See [11](11-server-authority.md) and the combat section of [02](02-mechanics.md).
- **A click starts a fight; the server runs it.** With *Auto-battle* on (locked until the first rebirth) the server also sends the player against the next monster. Potions and skills have hotkeys (1-5) and an *Auto-use* switch with a fixed preset (`COMBAT.auto`).
- **Still the browser's:** the economy (income, tile and building purchases, the map), the stat allocation, the merchant, the farm, rebirth. The server checks them only by plausibility ([07](07-saves-and-security.md), [09](09-cloud-saves.md)).

## Known bugs and leftovers

| # | What | Where | Note |
|---|---|---|---|
| R2 | Chests are placed on a tile by the browser (`pickChestSpot`); only their count is the server's | `lib/chests.ts`, `lib/offline/reconcile.ts` | harmless today (a position carries no value); move it to the server with monster placement |
| R3 | `luck`, `goldFind`, income `rates`, equipment and the bag the server rolls with come from the **last accepted save**, which the client wrote; `cloudSave/verify.ts` only flags | `cloudSave/summary.ts`, `lib/offline/profile.ts` | the fight profile is read from the save when a fight starts; a forged save can claim gear it never found. Closing this is the ledger-owned inventory below |
| R4 | No "can I win this?" gate: auto-battle engages the weakest waiting monster at 80 % HP, loses to anything too strong and rests; a monster that beat the player is left alone for 5 min (a boss 10) | `COMBAT.auto` | enough for now; a win-chance estimate would let it skip hopeless fights |
| R5 | Potions the server drank are removed from the **browser's** bag when the event arrives; the server counts them against the saved bag (`consumed` minus `consumedSeen`). A reload in the middle can leave the local bag one potion too full for a moment | `lib/offline/fight.ts`, `cloudSave/pipeline.ts` | the server never lets a potion be drunk twice; the right fix is the server-owned bag |
| R6 | A fight uses the gear of the last accepted save, frozen when the fight starts. The cloud save goes out soon after an equip, but not at once | `useCloudSync` | equipping is blocked while a fight is open in the browser |
| R7 | `dangerBonus` (one level per 8 tiles from the castle) is now 0 or 1: monsters stand at most 9 tiles out | `lib/monsters.ts` | the frontier is no longer more dangerous than the home land; rework with the biomes |
| R8 | The King's balance changed with auto-attack (1000 HP, 75 s clock): the best gear wins comfortably, obsidian narrowly, steel not | `MONSTERS.ratKing`, [generated/fight-sim.md](generated/fight-sim.md) | needs a real playtest |
| R9 | Local development needs a Supabase project and `LOOT_SECRET`: there is no guest mode to run the game without them | `README.md` | a dev-only fake backend would bring that back. Dev sessions on localhost use their own browser keys (`.dev` suffix) |
| 🔧 B4 | The castle upgrade is only visible inside the castle dialog and tooltip | | add a small timer badge on the castle tile / header (S) |
| ⚠️ B6 | Chests and map clicks are small next to the rest of the economy (the click is the only click income for now; the tile tap was removed) | | decide whether they should scale with progress, together with the click rework (BL3) |
| ⚠️ B7 | `sim.ts` bots build on the first free explored tile (round-robin through six buildings), do not use the class picker, allocate stat points by a fixed policy, and play one reasonable style (reserve for the castle, top up at the merchant) | `scripts/sim.ts` | fine for pacing checks; extend the bot before tuning small effects |

## Server authority (the migration backlog, ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

1. **Ledger-owned inventory and equipment** (closes R3, R5, R6): the bag, the worn gear and the loot pity live in the ledger; the browser shows them. Then a fight can never use gear the player does not own.
2. **Enforce `verify.ts`** (today it only flags): reject a save that gained more than the server granted.
3. **Economy actions** by the server where they pay out: castle upgrade, rebirth/Embers, farm purchases, building costs. Batch them (one call per few seconds) rather than one per click.
4. **XP award** of tile purchases and the attribute allocation (the server already models and clamps XP, `cloudSave/xpModel.ts`, and derives the fight level from the saved XP).
5. **Merchant and sell** (gold for gear, resource sell/buy, upgrades): server-priced. Every merchant action is a store action over `buyOffer`, `buyItem`, `sellResources`, `buyResource` and `buyMerchantUpgrade`, so moving them behind routes changes no UI.
6. **Chest placement** (R2) next to monster placement.
7. **Spawn caps from the real map**: monsters count free tiles from the map; chests and the overall share (`SPAWN_LIMIT`) still use an estimate from the owned-tile count.

Notes from reading the code (not measured against the live project):

- **No cron job and no Realtime channel are needed now.** Everything the server decides is computed lazily on a request from timestamps; the browser only talks to `/api/*`. Add `pg_cron` only for something that must progress while nobody is online (a leaderboard season roll-up, expiring events).
- **Catalogs stay in code, not in the database.** The API routes import the same TypeScript modules as the browser, so client and server cannot disagree. Move a catalog to tables only if content must change without a deploy.
- **Rebirth and Embers are client-authoritative.** `sanitizeSave` checks conservation and ranges; nothing checks that the Embers earned match the castle level and tiles of the run that ended. Cheap next step: a shadow flag in `cloudSave/verify.ts` comparing the claimed gain with `emberGain(castle_level, tiles_owned)` of the previously stored row. Later: a server-owned `/api/rebirth` (item 3).
- **Free-tier hot spot: polling during a fight.** While a fight is open the browser calls `/api/spawn` / `/api/fight` every 2 s (about 1,800 requests an hour). Each does `auth.getUser()`, a read of `player_saves` and `player_ledger`, and **a ledger UPDATE even for a read-only sync** (`onlineStep` returns `anchorAt: nowMs`; `toRow` stamps `updated_at`). Next: skip the write when nothing but the anchor changed, or poll less while the fight is only watched.
- **Resource key lists are hand-kept in several places** (the `Resources` interface, `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `FARM_PRODUCT_KEYS`, `zeroResources`, `sanitizeSave` `OPTIONAL_RESOURCES`, `offline/grant.ts`, `offline/ledger.ts` `zeroTotals`). A new resource must be added to all of them together; `tests/catalog.test.ts` fails if a stored resource has no tier.
- **Secret in the repo**: `.env.example` carries a concrete `LOOT_SECRET` ("the shared one every new workspace starts with"). Fine while the repo is private; rotate it and give every deployment its own before any public release.
- **Deploy order**: apply additive SQL migrations before deploying the code that reads the new column (a release that read `player_ledger.combat` before `combat_ledger.sql` ran made every ledger read fail).

## Features and content (in suggested order)

**Small polish and safety nets**

| Item | Size | Acceptance |
|---|---|---|
| Castle-timer badge (B4) | S | remaining time visible without opening the dialog |
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
- **Biomes unlocked by rebirth**: `BIOME_RULES` has `unlockAfterPurchases` today (swamp 6, tundra 10); a rebirth-based unlock is not built. A monster's `biomes` list already follows whatever biomes exist.
- **Per-biome loot and modifiers**; per-monster loot sources exist (`lootSourceId`).
- **Fight tunables** all sit in `COMBAT` (`tickSec`, `maxCatchUpSec`, `maxFightSec`, `poll`, `auto`): thresholds, retry cooldowns, which monster is next (`engageOrder`).

**Paragon levels (draft, not built).** The level curve ends at 100 (soft cap 80, level 90 around the 5th rebirth, 100 around the 10th). Past it a paragon track would give the endless part of the game without feeding the attribute economy (a level-100 character already holds 157 attribute points): the same lifetime XP keeps counting, each paragon level gives one point, points go into a few small, capped, account-wide bonuses (income, XP gain, Luck, offline efficiency), and the leaderboard ranks level then paragon level. Open: points per level, the caps, whether levels 81-100 should give extra attribute points, and how the Ember shop and Ancestral Tithe interact.

## Building rework and late-game resources (design draft, nothing built)

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

Open: should the merchant buy tier 2 at all (it would turn it into gold, as meat did)? Does tier 2 reset on rebirth (proposed: yes, except what the Ember shop buys back)?

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
- **Save compatibility**: an unreadable save falls back to the backup, then to a new game, and the damaged text is kept. A new field is optional (no bump); a renamed or removed one needs `SAVE_SCHEMA` + `MIGRATIONS` and a frozen fixture ([07](07-saves-and-security.md)). Content removed from the game (an item, a building) still makes `sanitizeSave` reject old saves unless a migration replaces it.
- **Float drift**: resources are doubles capped at 1e21 (`RESOURCE_CAP`). With castle 10 and Ember bonuses the income grows by orders of magnitude, so watch the cap when adding multipliers.
- **Per-tile store subscriptions**: a `Tile` reads only primitives and is `React.memo`'d; the 10 Hz `set()` that rebuilds `resources` is the remaining cost. Measure before optimising.

## Combat and items: known limits

- Monsters are one family (rats) plus one boss (the Rat King); there is one weapon per rarity tier and no item upgrading yet.
- The Rat King (1000 HP behind 15 armor, 75 s) is the only source of Rattatui pieces. When gear or monsters change, rerun `npm run fight-sim -- --md` (`tests/fightBalance.test.ts` pins the tuning).
- Crits and weapon speed, Heal and Stun, selling, affixes, item levels, bag expansion (Pack Rat), auto-battle and a beatable King are built; offline-safe combat is the server's.
