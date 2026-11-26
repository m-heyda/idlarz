# Roadmap: open work, known issues, server migration

The one place to look when planning the next step. It lists only what is **still open**; finished work is in git history. Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week.

**Tasks live in Linear (team IDL, projects R0-R12 and the Economy track); each decided item carries a "Decided 2026-11-07" block.** This file is the narrative index and the specs are the numbered docs. Where an old doc line disagrees with a Linear decision block, the decision block and the doc section it names win. **Linear is the truth for what comes next.** The big plan behind it is to move more of the economy to the server (see "Server authority") and to optimise afterwards.

> **Status 2026-11-11:** the **New chapter shipped** (release 0.3.0, `GAME_EPOCH` 2: classes with passives, class-locked avatars, achievements, guided tutorial, full reset, landing and `/play`, buildings with Idols, live biomes at rebirth 1-5, farm and castle rework, potion belt, bigger bags, discovery). Sections below that call it "the next update" or "not built" are partly history; check Linear for the live state. **The game is desktop only (screens 1240 px and wider): there is no mobile or phone layout and none is planned** (IDL-123 canceled).

**Proposal waiting for the owner (2026-11-26): [1-0-punch-list](1-0-punch-list.md), what to finish before 1.0.** The crafting rebalance (IDL-396) is built in PR 319; its numbers are in the code and in `docs/generated/craft-sim.md`.

**UI refresh (layout and UX reference, not an asset refresh; Linear IDL-289, design system in code IDL-290):** [ui-refresh.md](ui-refresh.md) and the board file it describes. Settle these layouts before new mechanics are wired.

## Where each decision lives (2026-11-07 planning pass)

| Topic | Spec | Linear |
| --- | --- | --- |
| Magnitude targets (gold/s, income multiplier, Embers, stocks) | pacing targets | IDL-128 |
| Perk families, caps and the legendary roster (11, two pools, Vault, relics) | loot, [28](28-reuse-items-and-stats.md) section 2, [20](20-monster-families-and-rewards.md) | IDL-143..149, 111 |
| Monster chests (no keys, 2 % per kill) | loot | IDL-163 |
| Spawn tables per distance band, boss rules, rosters for hills, coast and lake | [20](20-monster-families-and-rewards.md), [12](12-rebirth-biomes.md) | IDL-53, 55, 201 |
| Five rebirth biomes (names, rosters, tile output rule) | [12](12-rebirth-biomes.md) | IDL-105, 199 |
| Set bonuses, palettes, accessory themes, new stats, affix tier labels | [28](28-reuse-items-and-stats.md), art README (removed 2026-11-16) | IDL-39, 23, 164, 176, 45 |
| Rebirth salvage | [17](17-crafting.md) | IDL-151 |
| Ember price book, cosmetics, Monument, autobuyers | [18](18-biome-buildings-and-material-tiers.md) section 3 | IDL-97, 184, 185, 195 |
| Hero customisation: click name or badge, nickname glow, name colour, frames (gem One-time tab) | [30](30-gem-sinks.md) section 3 | IDL-296 |
| Map size, milestones (the tile price tail is built, IDL-79/181) | [18](18-biome-buildings-and-material-tiers.md) | IDL-131, 198 |
| Preview map of another player's world | [15](15-leaderboard-and-world-preview.md) | IDL-115 |
| Paragon (levels past 100, points, upgrades, milestones) | [paragon](paragon.md) | IDL-114, 186, 187, 394 |
| Gem sinks, the Gem shop, Cap Breaks | [30](30-gem-sinks.md) | IDL-188..194, 228..232, 234, 236, 237 |

## Item art: what is left

Every grade has an icon today (real supplied art; the Python placeholders are gone), the test fixtures are one named kit per grade (`tests/builders.ts`), and the old items were mapped onto the grade ladder. What is open:

- **Pass 3: replace with Sprite Fusion** (IDL-218, IDL-33 to IDL-36, IDL-41). The batches in [item-resource-art-prompts](item-resource-art-prompts.md) (sections 3.7 and 3.8) regenerate slot by slot; each replaced icon is a one-line registry change (new file, new provenance) in `src/config/itemIcons/`, the catalog id never changes, so saves are untouched. Order: whatever players see most (weapons, chest, head), then the rest. It never blocks a release.
- **Grades by biome.** G4-G6 (and the Steel and Obsidian bases) go to forest, swamp and tundra; **G7-G9, the special sets S1-S3 and the legendary roster are kept for the five rebirth biomes** (jungle, fields, orchard, blight, battlefield; S1 Sunhoney pairs with Fields and Orchard, S2 with the Battlefield, S3 with the Blight), so each biome release brings new gear with its art ([31](31-grade-by-biome-and-source.md)).

## The rebirth world (design docs; the New chapter part is built, the rest is open)

One theme, a few docs. Built already: classes, avatars, achievements, tutorial, reset, landing and the Rankings ([15](15-leaderboard-and-world-preview.md)), home-biome buildings and Idols ([18](18-biome-buildings-and-material-tiers.md), partly), live biomes at rebirth 1-5 (rule only, [12](12-rebirth-biomes.md)), monster discovery ([22](22-glossary-and-mastery.md), first part). Still open: the new biomes' data and art, the preview map, Paragon, the later gem shop slices. Each doc lists what exists in the code, the design, the server and save impact, and its open questions. Numbers and names in them are proposals until the questions are answered.

| Doc | Feature | Size | Needs first |
|---|---|---|---|
| [12](12-rebirth-biomes.md) | **Five biomes, one per rebirth (1-5)**, distance rules, five T2 materials, merchant gating, monster slots per biome, dev tools, Guide text | L (art-heavy) | P0 rules need nothing; art per biome |
| [15](15-leaderboard-and-world-preview.md) | **Preview map** of another player's world (the Rankings are built) | M | nothing |
| [18](18-biome-buildings-and-material-tiers.md) | **Biome buildings** (Producer, Extractor, Idol per biome, one of each, upgrade timers), **material tiers T0-T4**, (the shorter timers and the resource-key registry are built) | L | Extractors feed crafting |
| [20](20-monster-families-and-rewards.md) | **Monster families and rewards**: capped absolute rewards multiplied by level, hide/food goods, tiered item drops, spawn pressure, generic tickets | L | the biomes |
| [22](22-glossary-and-mastery.md) | **Glossary overlay for resources, biomes, items, buildings** and **resource mastery** (the monster half is the built Bestiary) | M | nothing |
| [17](17-crafting.md) | **Crafting** (Luck = rarity, Intelligence = affix quality, persistent crafting level, about 10 weeks to level 100, instant crafts, slot-themed extract recipes), enchanted craft (reroll/add one affix) locked behind Ichor | L | T2 materials; server-priced merchant to enforce it |

**Principles agreed for the whole update**

- **The map and its biomes reset on every rebirth, always.** What persists: character (level, attributes budget), crafting level, Embers and the shop, `discovered` biomes, and the **Idol levels** (re-placed free at their level; cap 5 for now).
- **Soft caps everywhere, raised with legacy points (Embers) later.** Every limit goes through `limitOf` / `LIMITS` with a `HARD_LIMITS` ceiling so a raise never invalidates a save ([18](18-biome-buildings-and-material-tiers.md) section 6 has the table: Idol level, building level, builder slots, crafting level, bag, offline cap ...). New Ember shop items have this shape (caps and slots), not just flat percentages.
- **Position bonus on buildings:** the castle's area bonus multiplies every building in its range (Producers and Extractors in full, Idols capped at x2), and buildings beyond the range get a frontier bonus that grows with distance, so the far biomes stay competitive ([18](18-biome-buildings-and-material-tiers.md) rule 7).
- **Building level caps go up to 15 with Ember purchases** (Master Craftsmen, 10 levels).
- **Content will grow: about ten new items, new monsters and biomes are coming.** Crafting, loot and rewards are data-driven by tag and tier, never tuned against today's gear alone ([17](17-crafting.md), [20](20-monster-families-and-rewards.md)).
- **Monster rewards are capped per monster and multiplied by level**, so weak monsters fade and strong ones pay (gold, hide/food, tiered items) ([20](20-monster-families-and-rewards.md)).

Cross-cutting rules for all of it: additive save fields only (no `SAVE_SCHEMA` bump), nullable ledger columns applied before the code that reads them, no new per-click server calls, catalogs stay in TypeScript.

## Known bugs and leftovers

Triaged on 2026-10-29; the fixed ones are removed.

- **R7** (`dangerBonus` is 0 or 1 because monsters stand at most 9 tiles out) is decided: per-band danger offsets and spawn tables replace it ([20](20-monster-families-and-rewards.md) section 4, IDL-53); delete this line when IDL-53 ships.
- **Open bugs are in Linear** (filter label Bug, plus the audit cleanups IDL-172).

## Server authority (the migration backlog, ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

1. **Enforce `verify.ts`** (today it only flags): reject a save that gained more than the server granted (IDL-208, IDL-211).
2. **Economy actions** by the server where they pay out: castle upgrade (start, cost and finish time in the ledger; today the server only checks the timer on its own clock, `castle_jump`), rebirth/Embers, farm purchases, building costs. Batch them (one call per few seconds) rather than one per click (IDL-134).
3. **XP award** (IDL-135) of tile purchases and the attribute allocation (the server already models and clamps XP, `cloudSave/xpModel.ts`, and derives the fight level from the saved XP).
4. **Merchant and sell** (gold for gear, resource sell/buy, upgrades): server-priced. The inventory already is the server's, so only the prices and the shelf (`merchantStock`, rolled in the browser) are left; a purchase today is checked for being a valid item, not for what it costs. Every merchant action is a store action over `buyOffer`, `buyItem`, `sellResources`, `buyResource` and `buyMerchantUpgrade`, so moving them behind routes changes no UI (IDL-121).
5. **Spawn caps from the real map**: monsters and chests count free tiles from the map; the overall share (`SPAWN_LIMIT`, `ticketCap`) still use an estimate from the owned-tile count.

Notes from reading the code (not measured against the live project):

- **No cron job and no Realtime channel are needed now.** Everything the server decides is computed lazily on a request from timestamps; the browser only talks to `/api/*`. Add `pg_cron` only for something that must progress while nobody is online (a leaderboard season roll-up, expiring events).
- **Catalogs stay in code, not in the database.** The API routes import the same TypeScript modules as the browser, so client and server cannot disagree. Move a catalog to tables only if content must change without a deploy.
- **Rebirth and Embers** are bounded by `cloudSave/emberModel.ts` and run by `/api/rebirth`, but `requireServerRebirth` is off, so a client can still rebirth through a plain save.
- **The inventory's open edges.** The ledger owns the bag, the gear, the pity and the auto-sell filter, but a purchase still pays its gold in the browser and the merchant's shelf is rolled there, so a forged shelf piece can be bought (for its price, which the net-worth check bounds). The bag's size follows the Pack Rat level of the last upload. The dev panel's loot buttons (`GameDebug`) change the local bag only, which the server's picture replaces at the next answer.
- **Free-tier hot spot: polling during a fight.** Idle polls no longer write the ledger (they recompute the timers from the clock). While a fight is open every poll still writes, because the fight state moves; poll less while the fight is only watched if the numbers ask for it.
- **Secret per deployment**: `.env.example` carries an empty `LOOT_SECRET` (IDL-75; `tests/server/lootSecret.test.ts` pins it) and the server warns on the old public default. Before any public release set a new `LOOT_SECRET` in every deployment (Vercel), and decide whether to rotate the Supabase keys (IDL-126).
- **Deploy order**: apply additive SQL migrations before deploying the code that reads the new column (a release that read `player_ledger.combat` before `combat_ledger.sql` ran made every ledger read fail; the same goes for `inv` and `inventory_ledger.sql`).

## Features and content (in suggested order)

**Small polish and safety nets** (CI and the Playwright smoke test `e2e/smoke.spec.ts` are built: ops/commands.md)

| Item | Size | Acceptance |
|---|---|---|
| Framework upgrades (IDL-125) one at a time: Next 16, TypeScript 7, ESLint 10, `@types/node` 26 (held back on purpose; Next 16 fixes two PostCSS advisories bundled in 15; check `typescript-eslint` / `eslint-config-next` peer ranges) | M | build, tests and sim output unchanged |

**Content**

1. **Item upgrading** is replaced by crafting (built: the enchanted craft behind Ichor and the War Medal legendary craft, [17](17-crafting.md)); rebirth salvage is IDL-151.
2. 🚧 **Building rework** (L): **mostly shipped with the New chapter** (Producer, Extractor and Idol per home biome, levels 1-5, builder queue, Idols with levels that persist; [18](18-biome-buildings-and-material-tiers.md); Linear project R7). Open: building art (IDL-99, IDL-245), position bonus (IDL-95), Idol scaling (IDL-287), Monument (IDL-185).
3. 🚧 **Quests** (L): the merchant's *Quests* tab is a placeholder. Early guidance, item rewards, tracking in the store. Brainstorm: IDL-203 (self-completing kill/gather quests plus rotating dailies).
4. 🚧 **Gambling** (M): the *Gambling* tab is a placeholder. Uses `luck`; every payout must be computed on the server side, limited by cooldown. Gold only, never gems (IDL-205).
5. **Mobile layout: dropped** (2026-11-11, owner). Desktop only, screens 1240 px and wider; IDL-123 canceled, the phone-only CSS and plan lines were removed.
6. **Monsters and combat depth**: rosters for hills, coast and lake are decided; monster discovery and the Bestiary with its kill tiers and claims are built ([22](22-glossary-and-mastery.md)); open: a skill tree (IDL-202), monster abilities, a daily bounty monster and elites (IDL-204). Monster chests are built (the rest is IDL-163).
7. **Ambient life** (cheap, optional): weather (rain tint), day/night tint by real clock, castle flag animation. Each switchable in Settings and covered by `prefers-reduced-motion`.
8. **Zoom 0.5** step for an overview (the minimap covers it today; the wheel zoom is four fixed steps).

**Config extensions planned (the shape is ready)**

- **Biomes unlocked by rebirth**: `BIOME_RULES` has `unlockAfterPurchases` today (swamp 6, tundra 10); a rebirth-based unlock plus a minimum castle distance and distance-weighted rolls is designed in [12](12-rebirth-biomes.md). A monster's `biomes` list already follows whatever biomes exist. The new monster families of the enemy rework need a generic ticket list in the ledger bank (not just a rule change).
- **Per-biome loot and modifiers**; per-monster loot sources exist (`lootSourceId`).
**Paragon (levels past 100)**: the design is [paragon.md](paragon.md): a curve that takes about four months to paragon 500, a grid of 4 x 5 upgrades (3 capped, 2 uncapped), milestones every 100 levels, deeds and the Rankings mark. Three projects, all before 1.0: IDL-114 (curve and display), IDL-186 and IDL-187 (points and the upgrades: built, the balance sims are open), IDL-394 (milestones and deeds).

## Gem sinks and the Gem shop (the shop is built; what is left is below; spec [30](30-gem-sinks.md))

Gems are the premium currency (start purse 1,000, a gem roll on every chest, daily and achievement gems, a server-held balance that survives rebirth). The Gem shop window and its first items are built (respec, class and name changes, Builder #2, name colours, castle skins, Overnight Orders; fair-play line IDL-188: convenience, time within limits, identity, cosmetics, temporary boosts; never bulk resources or permanent stat power). What is left of the track:

- **G2 Convenience and time** (M): bag and battle-queue slots IDL-191, longer away time and filter slots IDL-234, Hourglass and Chest Beacon IDL-192, timed boosts IDL-193 (the last two need the server-owned economy, IDL-134).
- **G3 Cap Breaks** (M-L, after R8): +1 max level, at most 3 per ladder, economy ladders only (merchant IDL-231, farm and Ember shop IDL-232). **Decided 2026-11-08 (IDL-228):** accepted as an explicit exception to the IDL-188 fair-play line, economy only; prices wait for the gem sim (IDL-229).
- **G4 Affix re-roll** (M, after crafting v0, IDL-236) and **G5 patron titles and Monument** (S-M, with rankings, IDL-237).

Placement in the release order: [RELEASE-PLAN](RELEASE-PLAN.md) section 4, "Gem track".

## Draft ideas for later (not committed to)

Loose ideas, not scheduled and not sized; each needs a design pass before it enters the lists above.

**Economy upgrades** (the Ember shop and the merchant ladders are flat percentages today; BL5, BL6, BL9, BL10)
- *Market saturation*: the price of a resource drops with the volume sold and recovers over ~30 min, so burst selling is not the best move.
- *New Ember shop item shapes* (a longer chest timer cap, a free animal slot, a start with a tier-2 resource). Embers stay permanent: no reroll or respec. (A second Ember currency, storage caps and caravans were closed on 2026-11-07, IDL-137: the endless Ember sink, cosmetic Ember shop and Paragon cover the late sink.)
- *More economy sets*: the Obsidian set pays income, XP and away time; a later tier could pay different things (chest rewards, merchant prices, farm output).
- *Autobuyers* (decided 2026-11-07, IDL-133; permanent Ember shop unlocks, online only, no per-click server calls). First version: a **tile buyer** (placement: most owned neighbours first, then nearest the castle; about 40 Embers), a **castle auto-upgrade** (starts the next upgrade when affordable and none runs; about 100 Embers) and a **surplus auto-sell** for resources above a set threshold (about 40 Embers). Bulk buy ("buy next N" with a cost preview, summing the price stage by stage) is free for everyone. Offline autobuying waits for the server-owned economy (IDL-134).
- *Building auto-upgrade and auto-build* (draft, **not scheduled**): when buildings get levels and specialisation (the building rework of [18](18-biome-buildings-and-material-tiers.md), Linear project R7) an autobuyer can build the best producer for a tile's biome and raise building levels by a cheapest-first rule. It needs the building level costs and caps first, and the same Ember-unlock shape as above (priced when the levels exist). Kept here so the building design leaves room for it: costs must be computable as a pure function of (building, level) and a purchase must be one batched request on the server.

**Combat upgrades** (the two ability slots hold Heal and Stun; one weapon per rarity tier)
- *Gem sockets* in gear (parked, IDL-137; the gem sinks that are planned are in [30](30-gem-sinks.md)).
- *Skills rework: a skill tree with levels and player choice (draft only, nothing decided).* Today there are two ability slots holding Heal and Stun with fixed behaviour (`catalog/skills.ts`, `lib/skills.ts`), and classes are cosmetic. Idea: skills get **levels** (spent skill points, earned with character level and rebirths) and a **tree** per class or per school (for example healing, control, damage), where the player **chooses** which branch to deepen and which skills fill the slots, so builds differ. Draft questions: where points come from (character level, a separate pool that survives rebirth, respec cost); how many slots and when they unlock; whether a level changes numbers only (heal amount, stun length, cooldown, mana cost) or also adds modifiers (heal over time, stun chance on crit); how the choice interacts with *Auto-use* (`COMBAT.auto` uses a fixed preset today, it would follow the chosen loadout); that fights run on the server, so skill effects must be computed there and the chosen tree stored in the ledger or a validated save field; the four classes (`PLAYER_CLASSES`) as the entry point. A new tutorial step for each unlock.
- *Set depth*: more sets per gear tier, set bonuses that scale with the item level (today they are fixed amounts), loadout swapping between an economy set and a combat set.

**Server authority follow-ups**: the ledger-owned inventory above, server-run castle upgrades (start, cost, finish time), a server-priced merchant, enforcing `verify.ts`, and a server-owned `/api/rebirth`.

## Constraints for the building rework and late-game resources

> The rework itself is [18](18-biome-buildings-and-material-tiers.md): three buildings per biome (Producer, Extractor, Idol) with timed levels replace the 16 generic ones (`BUILDINGS`, one permanent building per tile). This section keeps only the rules the rework must not break.

**What the first-run pacing fixed in place (do not undo)** - targets are in pacing targets:

- Rebirth is the first real goal and arrives around day 5-7 (castle 6 plus 400 tiles, +50 per rebirth).
- **Gold is the tile limiter, never a material.** Any new building or resource that adds a tile cost must pass the sim's "minutes to cover what is missing" check.
- **Hide is the template for a second-tier material**: three sources (the farm, kills via `COMBAT.rewards.hideShare`, later buildings). A material needed in a large amount must have more than one scalable source.
- XP is slow on purpose (tile XP 45 per base unit, the anchored level curve).

**Order of work:** see [18](18-biome-buildings-and-material-tiers.md) and the Linear project R7 (the old six-step list was replaced by it).

Things the rework must keep: monsters not standing on buildings; `netWorth.ts` plausibility must price the new levels; the sim bot's `BUILD_ORDER` has to learn the new choices; **acceptance:** with `human-rebirth6` / `-rebirth8`, run 2 reaches the same point in at most about 65-70 % of run 1, and the first rebirth stays available around day 7.

**Resource tiers.** The tier is a catalog field (`tier` in `src/catalog/resources.ts`, `RESOURCE_TIERS`); the header draws one boxed group per tier: `currency` (gold, gems, Embers), `t0` (wood, stone, coal, food, meat), `t1` (eggs, milk, hide), and a planned `t2` (iron, fish, mana, crystals; today only `RESERVED_RESOURCES` icons exist, nothing produces or spends them). Rules for adding a tier-2 resource, in one change set:

1. An entry in `catalog/resources.ts`, the `Resources` type, `INITIAL_RESOURCES`, `sanitizeSave` and the ledger totals (`GrantTotals`) **together** (the full list of hand-kept key lists is above), or a save is rejected.
2. At least two sources and one sink on day one (e.g. iron: a Smithy and a monster drop; sink: gear crafting and the 6→7+ castle costs).
3. Not a tile material before 300 tiles; it enters the castle costs first (levels 7-10 are the late-game gate), then the larger tile prices.
4. A line in the sim (stock, income, "minutes to cover" in the tile-wait table).
5. Decide explicitly whether offline income and the chest bundles include it (`LIMITS`, `CHEST.bundle.resources`).

The five T2 materials of the rebirth biomes (Hardwood, Cloth, Honey, Ichor, War Medals) and their gating are drafted in [12](12-rebirth-biomes.md); Ichor and Medals are crafting-only ([17](17-crafting.md)). Open: should the merchant buy tier 2 at all (it would turn it into gold, as meat did)? Does tier 2 reset on rebirth (proposed: yes, except what the Ember shop buys back)?

**Rebirth hooks.** Content gated by rebirth count (monsters via `MonsterDef.spawn.minRebirths`, biomes, tier-2 buildings); bigger maps and bigger starts (BL16: `TILE_PRICE.tailFrom` / `tailExponent`, the `provisions` shop item, which needs a tier-2 part).

## Technical risks

- **Performance on a big map** (`npm run perf`, and synthetic maps in the admin panel): at 50,000 tiles a purchase takes ~16 ms, the income pass ~11 ms, saving 12 ms (75 KB), loading and validating a save ~80 ms, the minimap ~4 ms; the screen mounts ~550 tile elements and ~20 terrain canvases. Panning stays at 60 fps with an occasional 33-60 ms frame while tiles enter the view. Follow-ups if it matters: one lightweight component (or event delegation) for plain explored tiles, incremental income on a purchase, chunk drawing off the main thread (OffscreenCanvas), minimap filters and "go to castle/workshop".
- **No UI tests**: logic is covered by `npm test`; components are verified manually.
- **Save compatibility**: an unreadable save falls back to the backup, then to a new game, and the damaged text is kept. A new field is optional (no bump); a renamed or removed one bumps `SAVE_SCHEMA` and older saves are refused (no migrations are kept, see saves and server). Between seasons the server data is reset with `npm run reset-players` (23).
- **Float drift**: resources are doubles capped at 1e21 (`RESOURCE_CAP`). With castle 10 and Ember bonuses the income grows by orders of magnitude, so watch the cap when adding multipliers.
- **Per-tile store subscriptions**: a `Tile` reads only primitives and is `React.memo`'d; the 10 Hz `set()` that rebuilds `resources` is the remaining cost. Measure before optimising.
