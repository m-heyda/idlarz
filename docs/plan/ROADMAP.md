# Roadmap: open work, known issues, server migration

The one place to look when planning the next step. It lists only what is **still open**; finished work is in git history. Legend: 🚧 unfinished feature · 🔧 small fix · ⚠️ needs a decision. Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week.

**Tasks live in Linear (team IDL, projects R0-R12 and the Economy track); each decided item carries a "Decided 2026-11-07" block.** This file is the narrative index and the specs are the numbered docs. Where an old doc line disagrees with a Linear decision block, the decision block and the doc section it names win. **The plan for what comes next, in order, is [26-next-updates-plan.md](26-next-updates-plan.md)** (core cleanup, item assets, loot pools and variety, the rest of the monsters, then the rebirth world below). The big plan behind it is to move more of the economy to the server (see "Server authority") and to optimise afterwards.

## Where each decision lives (2026-11-07 planning pass)

| Topic | Spec | Linear |
| --- | --- | --- |
| Magnitude targets (gold/s, income multiplier, Embers, stocks) | [pacing targets](../game/pacing-targets.md) | IDL-128 |
| Perk families, caps and the legendary roster (11, two pools, Vault, relics) | [loot](../game/loot.md), [28](28-reuse-items-and-stats.md) section 6, [20](20-monster-families-and-rewards.md) | IDL-143..149, 111 |
| Monster chests (no keys, 2 % per kill) | [loot](../game/loot.md) | IDL-163 |
| Spawn tables per distance band, boss rules, rosters for hills, coast and lake | [20](20-monster-families-and-rewards.md), [12](12-rebirth-biomes.md) | IDL-53, 55, 201 |
| Five rebirth biomes (names, rosters, tile output rule) | [12](12-rebirth-biomes.md) | IDL-105, 199 |
| Set bonuses, palettes, accessory themes, new stats, affix tier labels | [28](28-reuse-items-and-stats.md), [art README](../../art_style_reference/equip/README.md) | IDL-39, 23, 164, 176, 45 |
| Launch achievements, tutorial steps and bundles | [21](21-classes-avatars-achievements-offline-report.md) | IDL-73, 74, 194 |
| Crafting unlocks, salvage, War Medal legendary craft | [17](17-crafting.md) | IDL-152, 151, 120 |
| Ember price book, cosmetics, Monument, autobuyers | [18](18-biome-buildings-and-material-tiers.md) section 6 | IDL-97, 184, 185, 195 |
| Map size, milestones, roads (the tile price tail is built, IDL-79/181) | [18](18-biome-buildings-and-material-tiers.md) | IDL-131, 198, 98 |
| Rankings (four boards, daily snapshot), preview map, +20 attribute points | [15](15-leaderboard-and-world-preview.md), [13](13-rebirth-reset-and-paragon.md) | IDL-113, 115, 100 |
| Paragon | [13](13-rebirth-reset-and-paragon.md) section 5 | IDL-104, 186, 187 |
| Gem sinks, the Gem shop, Cap Breaks | [30](30-gem-sinks.md) | IDL-188..194, 228..232, 234, 236, 237 |

## Item art in three passes (decided 2026-11-08, owner)

The same idea as the MVP art: first something that ships, then better. **Do not wait for the finished art to build the items.**

1. **Pass 1: use what exists.** The good icons already in `public/pixel/items/` (115 supplied 64 px pieces: belts, boots, trousers, necklaces, rings, off-hand shields, swords, maces and mauls, legendary weapons, 12 potions) are registered in the icon registry (`src/config/itemIcons/`, IDL-18) and wired to catalog items first. They keep their files; nothing is regenerated.
2. **Pass 2: placeholders for the rest.** Every item we plan that has no good icon yet (shoulders, chest, gloves, capes, charms, head, tomes, orbs, quivers, starter G1-G2 families, the S1-S3 set pieces, dagger/axe/spear/bow/staff/wand grades) gets a **lower-quality placeholder generated in Python** (`scripts/pixel`, the procedural renderer that made the 78 `item_*` icons, palette-swapped per grade and set with the palettes of IDL-23), written with Claude like the MVP art. A placeholder is a registry line with `provenance: "placeholder, scripts/pixel"` and a `grade`; the item ships enabled-ready behind `enabled: false` until its loot work (Phase C) says otherwise. Good enough to read at 20 px, not final.
3. **Pass 3: replace with Sprite Fusion (later release).** The batches in [item-resource-art-prompts](item-resource-art-prompts.md) (sections 3.7 and 3.8) regenerate slot by slot; each replaced icon is a one-line registry change (new file, new provenance), the catalog id never changes, so saves are untouched. Order: whatever players see most (weapons, chest, head), then the rest; placeholders stay until their replacement is approved. Budget is in that doc.

Order of work: pass 1 (IDL-26..31 wiring) -> pass 2 -> the loot work of phase C of [26](26-next-updates-plan.md) -> pass 3 slot by slot in later releases. Pass 2 is cheap and unblocks C; pass 3 is polish and never blocks a release. Linear: IDL-217 (pass 2), IDL-218 (pass 3), IDL-219 (test benchmark).

**Where the item art stands (2026-11-09).** Pass 1 and pass 2 are done and G1-G3 is live (PR 116, 125, 130): every grade has an icon, either real supplied art or an `art_ph_*` placeholder, and the legacy wood, cloth, steel and Obsidian pieces were mapped onto the ladder or retired (IDL-243). **The weapon art is the MVP art and the owner wants it replaced as soon as possible** (IDL-239, raised to High): the G1-G3 weapons of every type are Python placeholders, and the real supplied weapon icons are mostly **not used yet** (24 sit behind disabled reuse items: 10 swords, 4 maces, 2 mauls, 2 axes, 3 spears, 1 bow, 1 staff, 1 wand; plus 8 shields, 5 feet, 6 legs, 10 necklaces). They are wired grade by grade as G4+ goes live (IDL-238). **Not all of it goes to the four live biomes:** G4-G6 (and the Steel and Obsidian bases) go to forest, swamp and tundra; **G7-G9, the special sets S1-S3 and the legendary roster are kept for the five rebirth biomes** (jungle, fields, orchard, blight, battlefield; S1 Sunhoney pairs with Fields and Orchard, S2 with the Battlefield, S3 with the Blight) so each biome release brings new gear with its art. The exact split is decided with the owner when IDL-238 starts (IDL-244). The assets in `public/pixel/assets_to_assess_and_use/` (48 potions, buildings, map details) are not weapons; the potions can serve crafted potions (crafting v0.1).

**The test benchmark moves with the items.** Fight and loot tests use "a strong kit" as a fixture; since the Rattatui set was deleted (2026-11-08) that is the Obsidian set plus a legendary maul. Once the grade ladder (G1-G9), the new legendary pool and sets S1-S3 exist, Obsidian is no longer the top of the game, so the fixtures must be **one named kit per grade** from a single helper (not `fullSet('obsidian', ...)` scattered through the tests), and `fight-sim`, `monster-ladder` and `fightBalance` pin their numbers to those grades. Ticketed in Linear; until then do not add new tests that name Obsidian as "the best".

## The next update: the rebirth world (design drafts, nothing built)

One theme, ten docs. Each doc lists what exists in the code, the design, the server and save impact, and its open questions. Numbers and names in them are proposals until the questions are answered.

| Doc | Feature | Size | Needs first |
|---|---|---|---|
| [14](14-server-audit-and-data-plan.md) | **Server audit**, catalogs stay in code, free-plan budget, save-compat method (the polling-write fix is built) | S-M | nothing |
| [12](12-rebirth-biomes.md) | **Five biomes, one per rebirth (1-5)**, distance rules, five T2 materials, merchant gating, monster slots per biome, dev tools, Guide text | L (art-heavy) | P0 rules need nothing; art per biome |
| [13](13-rebirth-reset-and-paragon.md) | **Rebirth reset**: +20 points per rebirth (respec and the bag and gear wipe are built); **Paragon** after level 100 | M | nothing |
| [15](15-leaderboard-and-world-preview.md) | **Rankings** from `player_stats` (no cron), **preview map** of another player's world | M | paragon (for ordering), avatar decision |
| [16](16-landing-and-play-route.md) | **Landing page**, auth-protected `/play`, login and avatar polish | M-L | rebirth-biome art for the final background |
| [18](18-biome-buildings-and-material-tiers.md) | **Biome buildings** (Producer, Extractor, Idol per biome, one of each, upgrade timers), **material tiers T0-T4**, (the shorter timers and the resource-key registry are built) | L | Extractors feed crafting |
| [20](20-monster-families-and-rewards.md) | **Monster families and rewards**: capped absolute rewards multiplied by level, hide/food goods, tiered item drops, spawn pressure, generic tickets | L | the biomes |
| [21](21-classes-avatars-achievements-offline-report.md) | **Class bonuses, separate avatars, the one-time progress reset (reserved unique names), guided tutorial, offline report bar**; achievements and glossary as drafts | M-L | avatar art, class numbers |
| [22](22-glossary-and-mastery.md) | **Glossary and mastery**: unknown black monsters, kill-count reveals, permanent mastery bonuses for kills and mined resources | M | the lifetime counters (`player_ledger.stats`), the New chapter release |
| [17](17-crafting.md) | **Crafting** (Luck = rarity, Intelligence = affix quality, persistent crafting level, about 10 weeks to level 100, instant crafts, slot-themed extract recipes), enchanted craft (reroll/add one affix) locked behind Ichor | L | T2 materials; server-priced merchant to enforce it |

Release order (confirmed 2026-10-29; the castle timers, the resource registry and the polling fix are built, and [26](26-next-updates-plan.md) puts core cleanup and item assets in front of it): **the "New chapter" release ([21](21-classes-avatars-achievements-offline-report.md): classes, avatars, reserved names, the one-time reset, initial tutorial, with [16](16-landing-and-play-route.md) landing and the sign-up pickers) -> 12 P0-P1 (rules + first biome art) with 18 buildings P1-P3 (the reset has already wiped old maps, so no legacy-building refund) -> 13 the +20 pool -> 15 rankings -> 12 P2-P4 (T2 materials, flags, Guide entries) -> 17 crafting -> 20 and 12 P5-P6 (distance bands, monster families, reward caps)**. Ship the reset exactly once: put everything that would otherwise need another wipe (class and avatar columns, unique names, the epoch) into that release. Biomes, rankings and the landing are otherwise independent; Items 1-5 of the *Server authority* list below are the dependencies that turn these features from "flagged" into "enforced".

**Principles agreed for the whole update**

- **The map and its biomes reset on every rebirth, always.** What persists: character (level, attributes budget), crafting level, Embers and the shop, `discovered` biomes, and the **Idol levels** (re-placed free at their level; cap 5 for now).
- **Soft caps everywhere, raised with legacy points (Embers) later.** Every limit goes through `limitOf` / `LIMITS` with a `HARD_LIMITS` ceiling so a raise never invalidates a save ([18](18-biome-buildings-and-material-tiers.md) section 6 has the table: Idol level, building level, builder slots, crafting level, bag, offline cap ...). New Ember shop items have this shape (caps and slots), not just flat percentages.
- **Position bonus on buildings:** the castle's area bonus multiplies every building in its range (Producers and Extractors in full, Idols capped at x2), and buildings beyond the range get a frontier bonus that grows with distance, so the far biomes stay competitive ([18](18-biome-buildings-and-material-tiers.md) rule 7).
- **Roads connect buildings to the castle for +100 % (additive)**: per-tile, per-biome road art and cost (swamp, tundra and bridges dearer), built instantly, priced in gold and resources ([18](18-biome-buildings-and-material-tiers.md) section 5.2). **Building level caps go up to 15 with Ember purchases** (Master Craftsmen, 10 levels).
- **Content will grow: about ten new items, new monsters and biomes are coming.** Crafting, loot and rewards are data-driven by tag and tier, never tuned against today's gear alone ([17](17-crafting.md), [20](20-monster-families-and-rewards.md)).
- **Monster rewards are capped per monster and multiplied by level**, so weak monsters fade and strong ones pay (gold, hide/food, tiered items) ([20](20-monster-families-and-rewards.md)).

**Later features agreed in principle (drafts, see [21](21-classes-avatars-achievements-offline-report.md))**

- **Guided tutorial instead of the wall-of-text Guide**: steps stored as catalog data, unlocked with the features and when the player discovers them, shown as small coach tips plus a Guide journal of unlocked entries (locked ones as "???"); it is also the initial tutorial replayed after the class-release reset ([21](21-classes-avatars-achievements-offline-report.md) section 7). Each later feature adds its own steps.
- **Tutorial rework (decided 2026-11-07, build IDL-74):** one progressive tutorial replaces `Tutorial.tsx` and the wall-of-text Guide: catalog steps tied to features, coach tips and a Guide journal, progress per account, an initial path of 8 steps with two starter bundles ([21](21-classes-avatars-achievements-offline-report.md) section 7). The **rebirth result window** (Embers gained, kept and reset, new unlocks, a first-steps tip) is IDL-103. Each later feature ships its own steps.
- **One-time progress reset when classes ship**: every player keeps account and **reserved name** (unique names enforced), picks class and avatar and replays the initial tutorial; old state is archived to `save_history` (pinned); an epoch column and `needsReset` gate make it repeatable ([21](21-classes-avatars-achievements-offline-report.md) section 6).
- **Class bonuses**: classes stop being cosmetic and give small passives (one economy, one combat); avatars are separate (8 to choose, more unlocked by achievements).
- **Server-based achievements**: 12 at launch (decided, 600 gems and 4 avatars: [21](21-classes-avatars-achievements-offline-report.md) section 3), then **grind ladders** (lifetime gold 1M / 1B / 1T / 1Q ..., one ladder per resource, tiles placed, monsters killed in total and per type) fed by lifetime counters in a new ledger record; and a **Glossary** generated from the catalogs. **Monsters start unknown (the real sprite in black, no HP or level), unlock on the first fight, reveal a layer every 100 kills, and give permanent mastery bonuses (500 kills: +XP/loot; resources: 1 million unlocks the entry, 1 trillion gives +25 % income of that resource)** ([22](22-glossary-and-mastery.md)). The tutorial ships first, the glossary later ([21](21-classes-avatars-achievements-offline-report.md) sections 3-4).
- **Offline report rework**: a bar of away time against the cap, a clear "capped, N h earned nothing" state with a Night Watch / Steward hint, also on the landing's Continue card.
- **Landing**: name **IDLE REALM** (a big IDLE patch in hills tiles), Continue card for signed-in players, password reset on and email confirmation off for now ([16](16-landing-and-play-route.md)).
  - **Paint the landing scene in the Map lab.** When the landing page is built, compose its background in `/map-lab` ([01 Map lab](../game/architecture.md)): paint the big **IDLE** lettering with the hills biome and surround it with the other biomes (tundra, forest, swamp ...) so the page looks like a real corner of the realm. Export the lab file (JSON) as the source and keep it in the repo, so the strip can be re-baked when the name or the art changes (see the re-bake note in [16](16-landing-and-play-route.md)). The lab already has biome painting, brush size, undo and export; if the lettering needs a straight-line or stamp tool, it is one more function in `lib/mapEdit.ts`. Size S, part of the landing work (release step with [16](16-landing-and-play-route.md)).

Cross-cutting rules for all of it: additive save fields only (no `SAVE_SCHEMA` bump), nullable ledger columns applied before the code that reads them, no new per-click server calls, catalogs stay in TypeScript ([14](14-server-audit-and-data-plan.md)).

## Known bugs and leftovers

Triaged on 2026-10-29; the fixed ones are removed.

- **R7** (`dangerBonus` is 0 or 1 because monsters stand at most 9 tiles out) is decided: per-band danger offsets and spawn tables replace it ([20](20-monster-families-and-rewards.md) section 8, IDL-53); delete this line when IDL-53 ships.
- **B6** (chests and clicks are small) is decided (BL1 + BL3 below, IDL-80/197). **B7** (sim bots are simple) is an acceptance line of each release step that changes player choices (class picker, `BUILD_ORDER`, respec, craft-sim; IDL-78).
- **Open bugs are in Linear:** IDL-169 (building cost ignores Charisma and Bulk Discount; `calculateBuildingCost` uses Thrift only), IDL-170, IDL-172.

## Server authority (the migration backlog, ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

0. **From the rebirth-world plan ([14](14-server-audit-and-data-plan.md); IDL-101)**: the attribute sum check needs the `20 x rebirths` term (`reconcileCharacter` and `/api/rebirth` are built without it), biome legality flags in `verify.ts`, `player_ledger.craft`.
1. **Enforce `verify.ts`** (today it only flags): reject a save that gained more than the server granted (IDL-112, IDL-167).
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
- **Secret in the repo**: `.env.example` carries a concrete `LOOT_SECRET` ("the shared one every new workspace starts with"). Fine while the repo is private; rotate it and give every deployment its own before any public release.
- **Deploy order**: apply additive SQL migrations before deploying the code that reads the new column (a release that read `player_ledger.combat` before `combat_ledger.sql` ran made every ledger read fail; the same goes for `inv` and `inventory_ledger.sql`).

## Features and content (in suggested order)

**Small polish and safety nets** (CI and the Playwright smoke test `e2e/smoke.spec.ts` are built: [ops/commands.md](../ops/commands.md))

| Item | Size | Acceptance |
|---|---|---|
| Framework upgrades (IDL-125) one at a time: Next 16, TypeScript 7, ESLint 10, `@types/node` 26 (held back on purpose; Next 16 fixes two PostCSS advisories bundled in 15; check `typescript-eslint` / `eslint-config-next` peer ranges) | M | build, tests and sim output unchanged |

**Content**

1. **Item upgrading** is replaced by crafting: the enchanted craft (reroll or add one affix, behind Ichor, IDL-120) and the War Medal legendary craft ([17](17-crafting.md)); rebirth salvage is IDL-151.
2. 🚧 **Building rework** (L): Producer, Extractor and Idol per biome with timed levels ([18](18-biome-buildings-and-material-tiers.md); Linear project R7); demolish and swap with a refund are part of it.
3. 🚧 **Quests** (L): the merchant's *Quests* tab is a placeholder. Early guidance, item rewards, tracking in the store. Brainstorm: IDL-203 (self-completing kill/gather quests plus rotating dailies).
4. 🚧 **Gambling** (M): the *Gambling* tab is a placeholder. Uses `luck`; every payout must be computed on the server side, limited by cooldown. Gold only, never gems (IDL-205).
5. 🚧 **Mobile layout** (L, IDL-123): the pixel UI is desktop-first; touch pan exists, the rest is untested. Responsive modals, bigger tap targets, test on a real phone.
6. **Monsters and combat depth**: rosters for hills, coast and lake (decided, IDL-201); the glossary and bestiary with kill counts ([22](22-glossary-and-mastery.md)); more skills and a skill tree (IDL-202); monster abilities, a daily bounty monster and elites (IDL-204); monster chests are decided (IDL-163).
7. **Ambient life** (cheap, optional): weather (rain tint), day/night tint by real clock, castle flag animation. Each switchable in Settings and covered by `prefers-reduced-motion`.
8. **Zoom 0.5** step for an overview (the minimap covers it today; the wheel zoom is four fixed steps).

**Config extensions planned (the shape is ready)**

- **Biomes unlocked by rebirth**: `BIOME_RULES` has `unlockAfterPurchases` today (swamp 6, tundra 10); a rebirth-based unlock plus a minimum castle distance and distance-weighted rolls is designed in [12](12-rebirth-biomes.md). A monster's `biomes` list already follows whatever biomes exist. The new monster families of the enemy rework need a generic ticket list in the ledger bank (not just a rule change).
- **Per-biome loot and modifiers**; per-monster loot sources exist (`lootSourceId`).
**Paragon levels (draft, not built; the current design is in [13](13-rebirth-reset-and-paragon.md) section 5, the leaderboard ranks level then paragon).** The level curve ends at 100 (soft cap 80, level 90 around the 5th rebirth, 100 around the 10th). Past it a paragon track would give the endless part of the game without feeding the attribute economy (a level-100 character already holds 157 attribute points): the same lifetime XP keeps counting, each paragon level gives one point, points go into a few small, capped, account-wide bonuses (income, XP gain, Luck, offline efficiency), and the leaderboard ranks level then paragon level. **Decided 2026-11-07 (IDL-104; build tasks IDL-186 levels and points, IDL-187 bonuses):** the paragon level comes from clamped XP (step growth 1.06, cap 400 levels), points are server-held and spent or respecced for gems, bonuses are an income and XP account bucket, Luck, offline efficiency and Ember Power; months to the top is intended.

## Gem sinks and the Gem shop (design draft, nothing built; spec [30](30-gem-sinks.md))

Gems are the premium currency (start purse 1,000, a gem roll on every chest, a server-held balance that survives rebirth) and **nothing spends them yet**. The decided base is IDL-188 (fair-play line: convenience, time within limits, identity, cosmetics, temporary boosts; never bulk resources or permanent stat power; gems may be sold later). Added 2026-11-08 (owner): a **Gem shop window** and **Cap Breaks**, gems as the late-game currency that permanently raises the cap of upgrade ladders. Rejected the same day: keeping a % of a resource through a rebirth, skipping a stage of the tile requirement, instantly finishing a castle timer.

1. 🚧 **G1 Engine, shop window, identity, sources** (L, with R5): spend engine IDL-189, Gem shop window IDL-230 (header gem chip, five tabs), class/name/respec IDL-190, achievement and daily-login gems IDL-194, price check with the gem sim IDL-229.
2. 🚧 **G2 Convenience and time** (M): bag and battle-queue slots IDL-191, longer away time and filter slots IDL-234, Hourglass and Chest Beacon IDL-192, timed boosts IDL-193 (the last two need the server-owned economy, IDL-134).
3. 🚧 **G3 Cap Breaks** (M-L, after R8): +1 max level, at most 3 per ladder, economy ladders only (merchant IDL-231, farm and Ember shop IDL-232). **Decided 2026-11-08 (IDL-228):** accepted as an explicit exception to the IDL-188 fair-play line, economy only; prices wait for the gem sim (IDL-229).
4. 🚧 **G4 Affix re-roll** (M, after crafting v0, IDL-236) and **G5 patron titles and Monument** (S-M, with rankings, IDL-237).

Placement in the release order: [RELEASE-PLAN](RELEASE-PLAN.md) section 4, "Gem track".

## Draft ideas for later (not committed to)

Loose ideas, not scheduled and not sized; each needs a design pass before it enters the lists above.

**Economy upgrades** (the Ember shop and the merchant ladders are flat percentages today; BL5, BL6, BL9, BL10)
- *Market saturation*: the price of a resource drops with the volume sold and recovers over ~30 min, so burst selling is not the best move.
- *New Ember shop item shapes* (a longer chest timer cap, a free animal slot, a start with a tier-2 resource). Embers stay permanent: no reroll or respec. (A second Ember currency, storage caps and caravans were closed on 2026-11-07, IDL-137: the endless Ember sink, cosmetic Ember shop and Paragon cover the late sink.)
- *More economy sets*: the Obsidian set pays income, XP and away time; a later tier could pay different things (chest rewards, merchant prices, farm output).
- *Autobuyers* (decided 2026-11-07, IDL-133; permanent Ember shop unlocks, online only, no per-click server calls). First version: a **tile buyer** (placement: most owned neighbours first, then nearest the castle; about 40 Embers), a **castle auto-upgrade** (starts the next upgrade when affordable and none runs; about 100 Embers) and a **surplus auto-sell** for resources above a set threshold (about 40 Embers). Bulk buy ("buy next N" with a cost preview, summing the price stage by stage) is free for everyone. Offline autobuying waits for the server-owned economy (IDL-134).
- *Building auto-upgrade and auto-build* (draft, **not scheduled**): when buildings get levels and specialisation (the building rework of [18](18-biome-buildings-and-material-tiers.md), Linear project R7) an autobuyer can build the best producer for a tile's biome and raise building levels by a cheapest-first rule. It needs the building level costs and caps first, and the same Ember-unlock shape as above (priced when the levels exist). Kept here so the building design leaves room for it: costs must be computable as a pure function of (building, level) and a purchase must be one batched request on the server.

**Crafting queue** (owner request 2026-11-08; design in [plan/crafting-v0.md](crafting-v0.md); Linear IDL-233, IDL-235)
- *Timed batch crafting*: every recipe gets a time per item and the player queues a batch of up to 1,000 items (for example 4 h of potions) that the **server** keeps running while the player is away; finished items are claimed into the bag (bag-full: they wait, never converted). v0.0 crafts instantly in batches of 1 to 10 and is built so this is an addition, not a rewrite.
- *Grind and rankings*: new recipes unlock by crafting level only (gained by crafting the earlier ones), and the crafting level becomes a global ranking column later (derived from the ledger, so it cannot be forged).
- *Upgrades around it*: faster crafts (a Workbench), more queue slots, a longer offline run, a larger batch cap, and cheaper inputs; every number is a `limitOf` entry with a hard ceiling. The no-printer rule (cost between sell value and shop price) holds for every upgrade.

**Combat upgrades** (the two ability slots hold Heal and Stun; one weapon per rarity tier)
- *Gem sockets* in gear (parked, IDL-137; the gem sinks that are planned are in [30](30-gem-sinks.md)).
- *Skills rework: a skill tree with levels and player choice (draft only, nothing decided).* Today there are two ability slots holding Heal and Stun with fixed behaviour (`catalog/skills.ts`, `lib/skills.ts`), and classes are cosmetic. Idea: skills get **levels** (spent skill points, earned with character level and rebirths) and a **tree** per class or per school (for example healing, control, damage), where the player **chooses** which branch to deepen and which skills fill the slots, so builds differ. Draft questions: where points come from (character level, a separate pool that survives rebirth, respec cost); how many slots and when they unlock; whether a level changes numbers only (heal amount, stun length, cooldown, mana cost) or also adds modifiers (heal over time, stun chance on crit); how the choice interacts with *Auto-use* (`COMBAT.auto` uses a fixed preset today, it would follow the chosen loadout); that fights run on the server, so skill effects must be computed there and the chosen tree stored in the ledger or a validated save field; class bonuses of [21](21-classes-avatars-achievements-offline-report.md) as the entry point. A new tutorial step for each unlock.
- *Set depth*: more sets per gear tier, set bonuses that scale with the item level (today they are fixed amounts), loadout swapping between an economy set and a combat set.

**Server authority follow-ups**: the ledger-owned inventory above, server-run castle upgrades (start, cost, finish time), a server-priced merchant, enforcing `verify.ts`, and a server-owned `/api/rebirth`.

## Constraints for the building rework and late-game resources

> The rework itself is [18](18-biome-buildings-and-material-tiers.md): three buildings per biome (Producer, Extractor, Idol) with timed levels replace the 16 generic ones (`BUILDINGS`, one permanent building per tile). This section keeps only the rules the rework must not break.

**What the first-run pacing fixed in place (do not undo)** - targets are in [pacing targets](../game/pacing-targets.md):

- Rebirth is the first real goal and arrives around day 5-7 (castle 6 plus 400 tiles, +50 per rebirth).
- **Gold is the tile limiter, never a material.** Any new building or resource that adds a tile cost must pass the sim's "minutes to cover what is missing" check.
- **Hide is the template for a second-tier material**: three sources (the farm, kills via `COMBAT.rewards.hideShare`, later buildings). A material needed in a large amount must have more than one scalable source.
- XP is slow on purpose (tile XP 45 per base unit, the anchored level curve).

**Order of work:** see [18](18-biome-buildings-and-material-tiers.md) section 10 and the Linear project R7 (the old six-step list was replaced by it).

Things the rework must keep: monsters not standing on buildings; `netWorth.ts` plausibility must price the new levels; the sim bot's `BUILD_ORDER` has to learn the new choices; **acceptance:** with `human-rebirth6` / `-rebirth8`, run 2 reaches the same point in at most about 65-70 % of run 1, and the first rebirth stays available around day 7.

**Resource tiers.** The tier is a catalog field (`tier` in `src/catalog/resources.ts`, `RESOURCE_TIERS`); the header draws one boxed group per tier: `currency` (gold, gems, Embers), `t0` (wood, stone, coal, food, meat), `t1` (eggs, milk, hide), and a planned `t2` (iron, fish, mana, crystals; today only `RESERVED_RESOURCES` icons exist, nothing produces or spends them). Rules for adding a tier-2 resource, in one change set:

1. An entry in `catalog/resources.ts`, the `Resources` type, `INITIAL_RESOURCES`, `sanitizeSave` and the ledger totals (`GrantTotals`) **together** (the full list of hand-kept key lists is above), or a save is rejected.
2. At least two sources and one sink on day one (e.g. iron: a Smithy and a monster drop; sink: gear crafting and the 6→7+ castle costs).
3. Not a tile material before 300 tiles; it enters the castle costs first (levels 7-10 are the late-game gate), then the larger tile prices.
4. A line in the sim (stock, income, "minutes to cover" in the tile-wait table).
5. Decide explicitly whether offline income and the chest bundles include it (`LIMITS`, `CHEST.bundle.resources`).

The five T2 materials of the rebirth biomes (Hardwood, Cloth, Honey, Ichor, War Medals) and their gating are drafted in [12](12-rebirth-biomes.md); Ichor and Medals are crafting-only ([17](17-crafting.md)). Open: should the merchant buy tier 2 at all (it would turn it into gold, as meat did)? Does tier 2 reset on rebirth (proposed: yes, except what the Ember shop buys back)?

**Rebirth hooks.** Content gated by rebirth count (monsters via `MonsterDef.spawn.minRebirths`, biomes, tier-2 buildings); bigger maps and bigger starts (BL16: `TILE_PRICE.tailFrom` / `tailExponent`, the `provisions` shop item, which needs a tier-2 part).

## Balance backlog (each needs approval before changing)

Measure with `npm run sim -- --seeds=3`, never from numbers copied into prose: [generated/sim-milestones.md](../generated/sim-milestones.md). Keep the targets of [pacing-targets](../game/pacing-targets.md). How the pacing guard works: [ops/commands.md](../ops/commands.md).

| # | Topic | Observation | Idea |
| --- | --- | --- | --- |
| BL1 + BL3 | **Active vs idle gap, and chests and map clicks are small** (decided 2026-11-07, IDL-80) | gold is not the limiter (casual sits on 11-27M unspent gold; casual vs idle is only 4-20 % apart on pacing) | gold click ladder and chest gold stay; chest bundles get a bigger resource share and size (build task IDL-197); the click Idol and ranger passive give resources or chest speed, never gold; target casual 15-25 % faster than idle |
| BL4 | **Meat/food is the strongest engine** (decided 2026-11-07, IDL-81) | farm is about 60 % of sellable income; `costScaling` +0.10 moves it only to 55 % (food piles up, the pen cap limits the count) | no cost change, no upkeep; the Harvest Scarecrow Idol adds inside the existing farm bracket, hard cap +25 % |

The magnitude targets these rows are checked against are in [pacing targets](../game/pacing-targets.md) (IDL-128).

## Technical risks

- **Performance on a big map** (`npm run perf`, and synthetic maps in the admin panel): at 50,000 tiles a purchase takes ~16 ms, the income pass ~11 ms, saving 12 ms (75 KB), loading and validating a save ~80 ms, the minimap ~4 ms; the screen mounts ~550 tile elements and ~20 terrain canvases. Panning stays at 60 fps with an occasional 33-60 ms frame while tiles enter the view. Follow-ups if it matters: one lightweight component (or event delegation) for plain explored tiles, incremental income on a purchase, chunk drawing off the main thread (OffscreenCanvas), minimap filters and "go to castle/workshop".
- **No UI tests**: logic is covered by `npm test`; components are verified manually.
- **Save compatibility**: an unreadable save falls back to the backup, then to a new game, and the damaged text is kept. A new field is optional (no bump); a renamed or removed one bumps `SAVE_SCHEMA` and older saves are refused (no migrations are kept, see [saves and server](../game/saves-and-server.md)). Between seasons the server data is reset with `npm run reset-players` ([23](../ops/reset-players-cli.md)).
- **Float drift**: resources are doubles capped at 1e21 (`RESOURCE_CAP`). With castle 10 and Ember bonuses the income grows by orders of magnitude, so watch the cap when adding multipliers.
- **Per-tile store subscriptions**: a `Tile` reads only primitives and is `React.memo`'d; the 10 Hz `set()` that rebuilds `resources` is the remaining cost. Measure before optimising.
