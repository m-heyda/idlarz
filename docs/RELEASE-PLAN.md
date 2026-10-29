# Release plan: from today's game to the rebirth world (proposal v1, for review)

Status: **decisions D1-D11 accepted (2026-10-29); ready to start P0.1.** Written 2026-10-29 against `main` at `0728da3`. Nothing from docs 12-22 is built (checked: no `middleware.ts`, no `config/branding.ts`, no v6 fixture, no `legacyDurationsSec`, no generic ticket bank, no `/play` route). This file orders the work of [ROADMAP](ROADMAP.md) and drafts [12](12-rebirth-biomes.md)-[22](22-glossary-and-mastery.md) into small, independently shippable steps, written as a product brief (what the player gets, what is needed, what is still open), not as implementation.

Legend: **S** half a day, **M** 1-2 days, **L** about a week. 🎨 = needs art. 🧱 = ships with a placeholder asset first. ❓ = needs your answer. Every step is its own pull request to `m-heyda/idlarz` and must leave `tsc`, `lint`, `npm test` and `npm run sim` green.

## 0. Reading guide

| Section | What it holds |
|---|---|
| 1 | Rules every step follows (game integrity) |
| 2 | Triage of **Known bugs and leftovers** and the **Balance backlog**: fix first / absorbed by the plan / ignore |
| 3 | Overview: the releases in order |
| 4 | The phases P0-P13 with their steps |
| 5 | The landing page, v1 to v2 |
| 6 | Asset plan (what is placeholder, what needs art, the `art_style_reference/` folder) |
| 7 | Decisions I need from you |
| 8 | Risk register (edge cases found while reading the code and docs) |

## 1. Integrity rules for every step

1. **Additive saves only**: optional fields, new biome letters, nullable ledger columns; no `SAVE_SCHEMA` bump. A moved rule goes through `repairSave`, never refusal ([07](07-saves-and-security.md)).
2. **SQL before code**: apply a migration on the project first, then deploy the code that reads it ([ROADMAP](ROADMAP.md) deploy-order note). Rehearse each migration on a **Supabase branch** first.
3. **Run `scripts/check-live-saves.ts`** (new in P0) against the real rows before every release that touches save or ledger rules.
4. **Dark first, switch later**: server code and data shapes ship before the UI or the content that uses them, behind a constant (`GAME_EPOCH`, an unlock count) so the release moment is a one-line change.
5. **Placeholder art never blocks mechanics**: new content ships with the nearest existing sprite or a tinted generic one (🧱); real art replaces it later without a code change (the sprite is a catalog key).
6. **Sim and docs travel with the change**: `npm run sim -- --seeds=3`, `npm run docs:gen`, and the relevant doc updated in the same PR.
7. **The reset happens exactly once** (P2). Everything that would need another wipe goes into that release or is designed not to need one.
8. One small behaviour change per release where possible, so a bad number is easy to attribute and roll back.

## 2. Triage of the two ROADMAP sections

### 2.1 Known bugs and leftovers

| # | Verdict | Why | What happens |
|---|---|---|---|
| **R7** `dangerBonus` is 0 or 1 | **Absorb, fix in P3.4** | monsters stand at most 9 tiles out, `dangerStep` is 8; after "rats 2-6" it is always 0. No bug today, a dead rule | replaced by a per-band danger offset on `DISTANCE_BANDS` (P0.6 adds the bands, P3.4 uses them); delete the row when P3.4 ships |
| **R8** King balance (steel and wood cannot win) | **Resolved by decision (2026-10-29): delete the row** | the Rat King was a beta-test boss. It becomes a basic monster, and the **Rattatui set is retired** (see P3.6): it no longer drops, existing pieces stay valid, nothing is balanced around it | P3.6 retires the set and re-tunes the King as a normal monster. The crafting gate (P11.3) now asks that a craftable starter tier beats the home-land monsters, not the King |
| **R9** local dev needs Supabase and `LOOT_SECRET` | **Ignore / delete from the roadmap** | offline play is gone by decision; the README already says what is needed | keep one README sentence; a fake backend is a different project |
| ⚠️ **B6** chests and clicks are small | **Merge into BL3, decide before P6.3** | same question; and the Scarecrow King Idol (+gold per click) and the ranger's chest speed build on the answer | ❓ D2 |
| ⚠️ **B7** sim bots are simple | **Delete as a standalone item** | it is a duty, not a bug: each phase that changes player choices updates the bot (class picker P2, `BUILD_ORDER` P6, respec P7, craft-sim P11) | becomes an acceptance line in those phases |

Also fixed first, because they endanger later steps (not in the roadmap tables, found in the docs and code): fight-polling ledger writes (P0.3), the castle-timer in-progress-save trap (P0.4), hand-kept resource key lists (P0.5), the example `LOOT_SECRET` (P2.7), the hard-wired rat/king ticket bank (P3.1).

### 2.2 Balance backlog (each needs your approval; nothing is changed by this file)

| # | Verdict | Reason |
|---|---|---|
| BL1 active vs idle gap | **Keep, merge with BL3** | decided together (D2) |
| BL2 levels barely matter | **Answered by the plan, delete** | respec + 20 points per rebirth ([13](13-rebirth-reset-and-paragon.md)), class bonuses, Idols. Becomes a sim check in P7 |
| BL3 chests and clicks | **Keep ❓ D2** | blocks the click Idol and the ranger passive tuning |
| BL4 food/meat is the strongest engine | **Keep ❓ D3** | the Harvest Scarecrow Idol (+farm output) would stack on it; decide the farm cost scaling before P6.3 |
| BL5 thin resource sinks | **Answered, delete** | building levels, roads, crafting, castle 7-10 and T2/T3 recipes are all sinks; checked by the "minutes to cover" table each phase |
| BL6 merchant depth | **Move to Draft ideas (already listed there)** | the merchant becomes server-priced later; saturation only if burst selling shows up |
| BL7 late tiles expensive | **Merge into BL16** | |
| BL8 idle tile income / specialisation | **Answered, delete** | Producer +2 % per owned tile of its biome ([18](18-biome-buildings-and-material-tiers.md) rule 3) |
| BL9 Ember shop shape | **Answered, delete** | Idol Mastery, Master Craftsmen, Extra Builder decided ([18](18-biome-buildings-and-material-tiers.md) section 6), built in P6.4 |
| BL10 late Ember runs flatten | **Answered in part, delete** | cap items are the sink; re-check with the sim after P6.4 |
| BL11 biome luck vs 24 h bot | **Delete as a standalone** | covered by the "rebirths = 0 gives the identical roll" regression test in P5.1 |
| BL12 combat rewards | **Replaced by [20](20-monster-families-and-rewards.md), delete** | the capped reward model plus a kill-reward sim in P3.3 |
| BL13 round-2 numbers | **Mostly obsolete, delete** | the ten newer buildings are replaced by the 36 biome buildings; the chest table stays under BL3 |
| BL14 reserved resources | **Superseded, delete** | the T2/T3 ladder replaces it; the reserved icons (`res_iron`, `res_fish`, `res_mana`, `res_crystal`, `res_sapphire`, `res_shard`) are reused as placeholder T3 icons |
| BL15 four free start tiles | **Delete, measure only** | re-check the opening once in the P0.4 sim run |
| BL16 late tile price and map scale | **Keep ❓ D4, decide before P5** | the biome distances (22-34 tiles out with the +12 offset) and the price tail `(n/300)^4.5` need one agreed map-size target per rebirth |

**Applied 2026-10-29:** the ROADMAP tables were trimmed. They now hold only BL1+BL3 (one row), BL4, BL16. The "Combat and items: known limits" section of the ROADMAP also loses its Rat King / Rattatui paragraph when P3.6 ships.

## 3. The releases in order

Deviation from the confirmed order of [ROADMAP](ROADMAP.md) (**approved as D1**): **monsters with real stats move earlier (P3)**, because they need no new art (placeholder sprites), fix the hard-wired ticket bank before the biomes need it, close R7, and give the glossary and crafting something to build on. Everything else keeps the confirmed order (castle timers, registry, polling fix, New chapter, biomes with buildings, respec, rankings, crafting with the wipe).

| Phase | Release name | Player sees | Size | Art |
|---|---|---|---|---|
| **P0** | Foundation | shorter castle timers (3 d 17 h to 2 d 17 h); nothing else | M | none |
| **P1** | Front door | landing v1 at `/`, game at `/play`, monster growth badge, offline bar | M | 🧱 one still |
| **P2** | **New chapter (v1 launch)** | reset once; class bonuses, avatars, reserved names, achievements, guided tutorial | L | 🎨 8 portraits |
| **P3** | Monster engine | more monster kinds in the home land with real stats and rewards; rats stay near the castle | L | 🧱 generic sprite |
| **P4** | Glossary and mastery | black unknown monsters, glossary, mastery bonuses | M | none |
| **P5** | Biome engine (invisible) | nothing (dev tools only) | M | none |
| **P6** | Buildings | 3 buildings per home biome, levels, Idols, Extractors, T3 materials, roads | L x3 | 🧱 then 🎨 |
| **P7** | Respec | rebirth refunds points, +20 per rebirth | S-M | none |
| **P8** | Jungle (rebirth 1) | the first new biome, Hardwood, its buildings and monsters | L | 🎨 |
| **P9** | Rankings | leaderboard, preview map, paragon display | M | small |
| **P10** | Fields + Orchard (rebirth 2, 3) | two biomes, Cloth, Honey | L | 🎨 |
| **P11** | Crafting + gear wipe | crafting overlay; rebirth wipes bag and gear | L | small |
| **P12** | Blight + Battlefield (rebirth 4, 5) | the two **special** biomes, Ichor, War Medals, enchanted crafts, bosses | L | 🎨 fancy |
| **P13** | **MVP: landing v2** | new landing with all biomes; public-release checklist | M | 🎨 |

## 4. The phases

### P0 · Foundation (invisible hardening)

Goal: remove every known edge-case hazard before anything is built on top.

| Step | What | Size | Notes |
|---|---|---|---|
| 0.1 | **CI**: GitHub Action running `tsc`, `lint`, `test`, `build`; sim pacing guard (first-finish time moves by more than 15 % fails) after 0.4 | S | no `.github` exists today |
| 0.2 | **Fixtures and dry run**: freeze a `v6` save fixture; new `scripts/check-live-saves.ts` (dev machine, service role, counts and reasons only) | S | [14](14-server-audit-and-data-plan.md) section 6; also reports who is mid castle upgrade |
| 0.3 | **Fight-polling write fix**: skip the ledger write when only the anchor moved; poll slower while a fight is only watched | M | free-plan hot spot (about 1,800 requests an hour per open fight); must land before crafting and rankings add load |
| 0.4 | **Castle timers** 1/3/9/16/36 h and first five castle costs x0.75 ([19](19-first-build-steps.md) step A) with its three compatibility fixes (`sanitizeSave` bound, `castle_jump` clamp, offline note), the sim "waiting" diagnostic, docs | S | the only player-visible change of P0; update the first-rebirth target to day 4-6 |
| 0.5 | **Resource registry** ([19](19-first-build-steps.md) step B): one catalog entry per resource, tier ladder `t0`-`t4`, empty tiers hidden | M | pure refactor; acceptance is identical sim output and an empty `docs:gen` diff |
| 0.6 | **Distance helper and bands**: `castleDistance` to `lib/distance.ts`, `DISTANCE_BANDS` (home 1-6, outskirts 7-12, frontier 13-21, wilds 22+) read by biome, monster and chest code | S | no behaviour change; prerequisite of P3.4 and P5 |

Acceptance of P0: tests green; sim summary and the live-save dry run pasted in the PRs; no `castle_jump` flag when replaying an old in-progress upgrade. Ship order inside P0: 0.1, 0.2, 0.3, 0.4, 0.5, 0.6 (each can be merged alone).

### P1 · Front door (landing v1, `/play`, small UI wins)

| Step | What | Size |
|---|---|---|
| 1.1 | `config/branding.ts` with `GAME_TITLE` = **IDLE REALM**; metadata, Guide and README read it (today still "Idle Explorer") | S |
| 1.2 | **`/play` route**: today's gate and game move there unchanged; `middleware.ts` refreshes the session and redirects guests to `/?login=1&next=/play`; the "entered" marker and logout behaviour stay ([16](16-landing-and-play-route.md) sections 2 and 5) | M |
| 1.3 | **Landing v1** at `/` (see section 5): title banner, login/register window, five feature cards, a **Continue** button and character card (name, class, level, rebirths) for signed-in visitors, redirect to `/play` after login | M |
| 1.4 | **Monster growth indicator** (UI only): blue frame and glow at maximum level, progress ring to the next level, tooltip "Level 7 of 12, grows in 14 min" | S |
| 1.5 | **Offline report bar**: "Away 6 h 20 m of 8 h", a "capped, N h earned nothing" state with Night Watch / Steward hint, read from the server claim (not recomputed); also on the Continue card via an extended `/api/auth/me` | M |
| 1.6 | Password reset on, email confirmation off (needs the project's email sender; rate-limited per account and IP) ❓ D5 | S-M |

Clarify: whether the landing's Continue card shows the offline bar already in v1 (it is cheap once 1.5 exists; I propose yes). Assets: one still image of a map strip (🧱, made by the existing terrain renderer, no new art) and the hills-tile lettering pattern for IDLE / REALM.

### P2 · New chapter (the v1 launch, one reset for everything)

Goal: classes become real, avatars exist, names are reserved, the game teaches itself, and every player starts clean once. Everything that would need another wipe is in here. Steps 2.1-2.6 ship **dark** (the epoch is not yet raised); 2.8 is the switch.

| Step | What | Size |
|---|---|---|
| 2.1 | **Migrations on a Supabase branch, then live**: `profiles.epoch`, `profiles.avatar_id`, case-insensitive unique index on `character_name` (collision list first), `player_achievements`, `player_ledger.stats` | S |
| 2.2 | **Lifetime counters** in `player_ledger.stats` (kills per type, chests, tiles placed, resources earned from verified save gains); additive, lazily seeded; nothing shows them yet | M |
| 2.3 | **Class passives**: +5 % each, one economy and one combat per class (warrior armor and kill gold, paladin regeneration and offline efficiency, ranger crit and chest speed, mage mana/spell power and XP); folded into `summarize()` and the fight profile; class change costs 500 gems, never mid-fight | M |
| 2.4 | **Avatars**: catalog of 8 starters (knight, druid, scout, scholar, miner, farmer, bard, alchemist), picker, server accepts only starter or unlocked ids 🎨 | M |
| 2.5 | **Achievements**: catalog in code, about 12 launch achievements (tutorial, first tile, first building, castle 2/6/10, first fight, first rebirth, first Rat King kill, early tester), 4 extra avatars as rewards; evaluated lazily on existing requests | M |
| 2.6 | **Guided tutorial**: `catalog/tutorial.ts` steps, coach tips, Guide journal with "???" for locked entries, initial path of about eight steps, small starter bundles granted once by the server; replaces `Tutorial.tsx` when every section has an entry | L |
| 2.7 | **Secrets hygiene**: new `LOOT_SECRET` per deployment, placeholder in `.env.example`. Free here because the reset invalidates every sealed roll anyway | S |
| 2.8 | **Epoch flow**: `GAME_EPOCH`, `/api/auth/me` returns `needsReset`, "A new chapter" screen (before `SaveHub`) with class, avatar, tutorial; idempotent `POST /api/auth/epoch` archives to a **pinned** `save_history` row, resets saves, stats and ledger, keeps account, reserved name and gems; local save archived through `archiveForNewGame()`; early-tester grant. Flip the constant = the release | M |
| 2.9 | Landing sign-up gets the class and avatar pickers | S |

Acceptance: epoch gate test (needs/does not need reset), idempotent endpoint, pinned archive created and not trimmed, a stale tab cannot overwrite the fresh row (also when the row was deleted), unique-name collision path, the dry run of 0.2 counts affected rows, **restore rehearsal** from the archive on a branch. Sim bot learns the class picker (B7).

Clarify ❓: D6 launch achievement list and names; unlockable avatars and which achievement gives which; size and steps of the tutorial starter bundles; tutorial tone and length. Assets: 8 avatar portraits (40x40 bust style), selected frame, locked silhouette, about 4 unlockable portraits, optional early-tester title.

### P3 · Monster engine with placeholder art (real stats, generic sprite)

Goal: more monster kinds with **real stats, rewards and spawn rules** in the existing land, shipped before any new biome. Art is a catalog key (`sprite`), so a family can ship tinted or generic and get its real sprite later.

| Step | What | Size |
|---|---|---|
| 3.1 | **Generic ticket bank**: `{ n, type, at, x, y, spawnLevel, lucky }` list in `player_ledger.bank`; `upgradeBank` reads old rows lazily; in-flight rat and King tickets survive the deploy; remove the `'rat' \| 'king'` unions. Behaviour identical | M |
| 3.2 | **Placeholder art mechanism**: `MonsterDef.sprite` key with fallback `monster_generic` (one 2-frame sheet in the house style) tinted per family by a CSS variable; bosses use a scaled generic with a crown. 🧱 | S |
| 3.3 | **Reward model** ([20](20-monster-families-and-rewards.md)): gold and XP `min(rewardSec x income, cap) x levelMult^(level - refLevel)`, goods by family type, caps tuned so rats and King pay the same on day 1; new `scripts/kill-sim.ts` (kill income stays a small share of income) | M |
| 3.4 | **Spawn tables per distance band and relevance fade** (outgrown families rarer, floor 0.1, never gone); **rats 2-6**; per-band danger offset (closes R7) | M |
| 3.5 | **Home families**: wolf (forest), bog thing (swamp), frost hare (tundra), each with stats, `refLevel`, drops and a loot pool tag; `fight-sim`, `loot-sim`, `monsterConfig.test.ts` cover them without code changes | M |
| 3.6 | **Retire the Rattatui set and demote the Rat King** (R8 resolved): the King is a basic monster with the normal reward model and a normal loot source; the 12 Rattatui pieces and their set bonus leave every loot pool and the `ratKing` source, but **their item definitions stay** so existing pieces keep loading, equipping and selling (flag `retired: true` on the base, excluded from `LOOT_POOLS` and drop generators; `repairSave` is not needed because nothing is removed). Update `fightBalance.test.ts`, `fight-sim`, `loot-sim`, `item-catalog` doc, the sim `GEAR_SCHEDULE` and doc 20. Note: the P2 reset wipes every bag anyway, so "keep your items" matters only between this step and P2 if 3.6 ships first | M |

Clarify ❓ D7: stats, `rewardSec` and caps of the three families (I will propose numbers from the sim, you approve); whether Luck / Gold Find apply after the cap (proposed yes); what the demoted King keeps (HP, boss timer, spawn distance, see D11). Assets: one generic sprite sheet (small); real sprites for wolf, bog thing, frost hare listed in section 6 and swapped in later.

### P4 · Glossary and mastery

| Step | What | Size |
|---|---|---|
| 4.1 | **Unknown monsters**: `stats.seen` in the ledger, tickets of unseen types sent without name, level or HP, drawn as the real sprite in black with a "?" (works with placeholders), first fight unlocks the type; the tutorial's first fight unlocks the rat | M |
| 4.2 | **Glossary overlay**: monsters (layers every 100 kills), resources, biomes, items, buildings, generated from the catalogs; `statsVer` pattern, no new endpoint | M |
| 4.3 | **Mastery**: monster 500 kills +10 % XP and +5 % loot chance, repeating to a cap; resource 1 million unlocks, 1 trillion +25 % income of that resource; computed on the server; sim line against the Ember bonus | M |
| 4.4 | **Grind achievements**: ladders for gold and each resource, tiles, kills, chests | S-M |

Clarify ❓ D8: loot-chance cap per type and the effect on boss guaranteed drops, the resource ladder above 1 trillion, whether unknown hides the golden lucky state (proposal: a faint outline stays).

### P5 · Biome engine (invisible)

Goal: all biome rules exist and are tested, nothing visible changes for players. This is [12](12-rebirth-biomes.md) P0 and P3.

| Step | What | Size |
|---|---|---|
| 5.1 | New `BIOME_RULES` fields (`unlockAfterRebirths`, base minimum distances, `BIOME_DISTANCE_OFFSET` +12, conflicts, 2-owned-neighbours rule, distance weights); `biomeVerdicts` takes `{ rebirths, distance }` and the tile tooltip says why a biome is not allowed. **Regression test: with `rebirths = 0` the roll is identical to today for the same seed** | M |
| 5.2 | Five new letters in `BIOME_CODES` (`j d o b w`, frozen once shipped); `discovered: string[]` optional in the save core and a legal-by-map server check; discovery survives rebirth | S |
| 5.3 | Dev tools: unlock all (ignores the offset), grow N tiles outward, paint a patch, set rebirths | S |
| 5.4 | `verify.ts` shadow flags `biome_locked` and `biome_too_near` | S |
| 5.5 | Sim: rebirth-aware expansion pattern to calibrate the minimum distances | M |

Clarify ❓ D4: the target map size per rebirth (BL16) before 5.5 fixes the offset; basic-output rates of each new biome (set with the sim in its own phase). Placeholder: flat-colour palettes for dev only; no art.

### P6 · Buildings (three releases, home biomes first)

Goal: replace the 16 generic buildings with three per biome on the **seven existing biomes** first (21 buildings). New biomes add their own three later. Old buildings need no refund because the P2 reset already wiped every map ([18](18-biome-buildings-and-material-tiers.md) section 8).

**P6a Producers and the build model**
| Step | What | Size |
|---|---|---|
| 6.1 | Build menu by the tile's biome, one of each type per map, Producers only, +2 % per owned tile of the biome (cap +100 %), relocation for 50 % of the cost | M |
| 6.2 | Levels 1-5 gated by `min(5, castle level)`, upgrade timers 10 min / 45 min / 3 h / 8 h, **one shared builder queue** with the castle (`castle_jump` becomes `timer_jump`), `netWorth.ts` prices levels, legacy 16 types removed through `repairSave` | L |
| 6.3 | 🧱 Existing 16 sprites mapped to the nearest new building; sim `BUILD_ORDER` rewritten (closes B7) | S |

**P6b Extractors and T3 materials (home biomes)**
| Step | What | Size |
|---|---|---|
| 6.4 | Seven Extractors and their T3 materials (Herbs, Sap, Iron Ore, Spores, Frostshard, Pearls, Salt); header group hidden until discovered; 🧱 placeholder icons from the reserved set (`res_iron` for Iron Ore, `res_crystal` for Frostshard, `res_sapphire` or `res_fish` for Pearls, `res_mana` for Spores ...) | M |
| 6.5 | Position bonus `positionBonus(distance, castleLevel)` (castle area bonus on every building in range, frontier bonus beyond), folded into `buildingEconomy(world)` so offline grants, `verify.ts` and `netWorth.ts` agree | M |

**P6c Idols, soft caps, roads**
| Step | What | Size |
|---|---|---|
| 6.6 | `player_ledger.legacy` (migration first); seven Idols (+2 % per level, position bonus capped at x2), levels persist across rebirth, free re-placement at the remembered level, castle gate applies to upgrading only | L |
| 6.7 | Ember shop cap items: Idol Mastery, Master Craftsmen, Extra Builder, as `LIMITS` / `LIMIT_BONUSES` with `HARD_LIMITS` | M |
| 6.8 | **Roads**: per-tile overlay, +100 % for a connected Producer or Extractor (additive), cost about 3 % of the tile price times a biome multiplier, built instantly, `road` flag in tile `extra`, breadth-first connection check on the server | L |
| 6.9 | 🎨 Real building sprites (21 for the home biomes) and the first road sets replace placeholders | L (art) |

Clarify ❓: **D2 and D3 must be answered before 6.6** (the click Idol and the farm Idol depend on them). Open numbers from [18](18-biome-buildings-and-material-tiers.md): Extractor rates, timers above level 5, Luck points per Idol level, road multipliers and refund, whether the castle may cut the builder queue, whether the frontier bonus counts the +12 offset. The combined build-time reduction cap (proposal 60 %). Sim acceptance: all-Idols-maxed line against the Ember income bonus, the run-2 ratio stays 60-70 %, payback of a road in hours not days.

### P7 · Rebirth respec (no wipe yet)

| Step | What | Size |
|---|---|---|
| 7.1 | Respec on rebirth (all attribute points back to the pool) and **+20 points per rebirth** (`totalStatPoints(level) + 20 x rebirths`) | M |
| 7.2 | Server sum check: `reconcileCharacter` uses `rebirths` from the ledger inside `acceptSave`; a save above the maximum is repaired, not refused | S |
| 7.3 | Rebirth dialog preview (refunded points, +20, what is wiped later) and **sell all for gold** button | S |
| 7.4 | Sim bot learns to respec (B7); re-measure BL2 and the run-2 ratio | S |

Note: a tester who rebirthed before P7 gets the bonus from the next rebirth only (nobody is affected today).

### P8 · Jungle (rebirth 1)

The pattern for every biome release: **rules are already there (P5), so a biome release is art + catalog data + its three buildings + its monsters + Guide text.** Substeps ship separately.

| Step | What |
|---|---|
| 8.1 🎨 | Biome art: ground, deep tier, rim against every neighbour, props, decor, building pads, ambient critters, minimap and highlight colour; pixel pipeline plus its TypeScript port and parity test |
| 8.2 | **Hardwood** (T2, 0.1/s per tile), header slot on discovery, offline yes and chests no; basic outputs gold and hide |
| 8.3 | Jungle Logging Camp, Serpent Pit (Venom), Totem of the Wild, jungle road set 🎨 (placeholders first) |
| 8.4 | Jungle monsters (3-4 plus boss) with real stats, 🧱 generic sprite until the art lands, then swapped |
| 8.5 | Guide entries and Rebirth dialog line ("Rebirth 1 unlocks the Jungle") |

Clarify ❓: names (Jungle, Hardwood are proposals), monster list, the boss, hide/hardwood output rates.

### P9 · Rankings and the preview map

| Step | What | Size |
|---|---|---|
| 9.1 | `leaderboard_columns.sql` (xp, paragon, class, avatar, `listed`), `GET /api/rankings` cached 60 s, Rankings overlay, own row pinned | M |
| 9.2 | **Paragon display only**: level past 100 derived from clamped XP; no bonuses yet | S |
| 9.3 | Preview map: `GET /api/world/<token>` returns `land` only, rate-limited, separate `previewStore` with **no path to the save**; banner and close button | M |
| 9.4 | **Enforce `verify.ts`** (reject, not only flag) before rankings are public | M |

Clarify ❓: lazy daily snapshot row now or later; whether paragon bonuses get designed here or after crafting.

### P10 · Fields and Blossom Orchard (rebirth 2 and 3)

Same pattern as P8, twice: art 🎨, **Cloth** and **Honey**, three buildings each (Hen Barn / Dye Works / Scarecrow King; Dairy Barn / Apiary / Blossom Shrine), monsters 🧱 then real, Guide entries. These are the mild, pastoral biomes: closest to the current look, so they are the cheapest art.

### P11 · Crafting and the gear wipe

| Step | What | Size |
|---|---|---|
| 11.1 | `player_ledger.craft` (migration first); `POST /api/craft`, lifetime `ord`, sealed rolls, per-tier pity | M |
| 11.2 | Recipes as data keyed by tag and tier (slot-themed extract costs), crafting overlay with the odds panel, crafting XP and level (target about 10 weeks to 100, never resets) | L |
| 11.3 | `scripts/craft-sim.ts`, craft source in `loot-sim`, gate: the cheapest craftable tier beats the home-land monsters of the matching level (the King is no longer a benchmark) | M |
| 11.4 | **Server-side idempotent inventory wipe** on rebirth (bag, gear, pity reset; Pack Rat kept) called before the upload; the rebirth dialog confirms and lists worn rare-or-better pieces | M |
| 11.5 | Enchanted craft button present but disabled ("Needs Ichor from the Blight") | S |

The wipe **must not ship before 11.1-11.3 are live**. Materials are still paid by the browser and audited by `granted.spent`; enforcing them waits for the server-priced merchant (decision D9: schedule that item next to P11 or accept flagging only).

### P12 · Blight and Battlefield (the two special biomes)

Same release pattern, with a deliberately **richer look**: they are the last two, unlocked at rebirth 4 and 5, and should feel like a reward for the whole journey while still reading as the same map (same tile size, outline rules and palette discipline). Direction in section 6.

| Step | What |
|---|---|
| 12.1 🎨 | Blight: violet-black ground, slime pools, pulsing blob props, tendril rims; **Ichor** (crafting only); Tar Pit, Ooze Vat (Corrupted Core), Maw Idol |
| 12.2 🎨 | Battlefield: churned mud and ash, banners, bone piles, broken weapons, scorch marks; **War Medals** (crafting only); Siege Works, Salvage Yard (Scrap Steel), War Memorial |
| 12.3 | Bosses with their own timers and distances; **T4 relics** from bosses (they survive rebirth) |
| 12.4 | Enchanted craft unlocked (needs Ichor), legendary tier gated on War Medals |
| 12.5 | `verify.ts` and `netWorth.ts` price T2 and relics; Guide and glossary entries |

### P13 · MVP: landing v2 and public readiness

| Step | What |
|---|---|
| 13.1 🎨 | Landing v2 (section 5): full re-bake with all twelve biomes, new buildings and roads in view |
| 13.2 | Mobile layout pass (responsive modals, tap targets, test on a real phone) |
| 13.3 | Playwright smoke test in CI; framework upgrades one at a time (Next 16, TypeScript 7, ESLint 10) |
| 13.4 | Public checklist: email confirmation on, `verify.ts` enforcing (done in 9.4), rotated secrets, rate limits, free-plan load check |
| 13.5 | Drop `BIOME_DISTANCE_OFFSET` to the calibrated value if the sim says so |

### Not in this plan (parked, from the ROADMAP lists)

Item upgrading (replaced by crafting's enchant), the Quests and Gambling merchant tabs, ambient weather, zoom 0.5, market saturation, caravans, second Ember currency, gem sockets, skill tree. Paragon **bonuses** (points to spend) wait for their own design after P9.

## 5. Landing page: v1 now, v2 at the MVP

| Version | When | What it is | Assets |
|---|---|---|---|
| **v1 simple** | P1, with the reset in P2 adding the pickers | a title banner "IDLE REALM" (big IDLE in hills tiles, REALM smaller), one **static** background still of the seven current biomes, a login / create-account window (collapses to a bottom sheet on phones), five feature cards, a **Continue** card for signed-in visitors with the character card and the offline bar; signed-in visitors reach the game via `/play` | one baked still (existing renderer), lettering pattern, 5 small feature icons |
| **v1.1 animated** (optional, any time after P2) | between phases when engineering is free | the baked tall strip scrolling bottom to top with ambient critters, `prefers-reduced-motion` gives the static frame | `npm run landing:bake` output, seven biomes only |
| **v2 MVP** | P13 | re-baked strip with **all twelve biomes**, the two special biomes as the finale, building and road clusters in view, a new Open Graph image; the progress it shows is the point: visitors who saw v1 see a bigger world | baked strip from the final art; reuses `art_style_reference/landing/` samples |

Switching is cheap by design: the background is one baked file and the title lives in `GAME_TITLE`, so v2 is a new file plus a copy edit, with no change to the route or the login flow. Open (❓ D10): final wording of the feature cards, whether the landing shows a public players-online number (not in v1).

## 6. Asset plan and the `art_style_reference/` folder

New folder at the repo root: `art_style_reference/` (created with this plan; see its README). Upload samples there; I will recreate them in the procedural pipeline (`scripts/pixel/`) so they match the map. Existing references stay in `scripts/pixel/reference/` (STYLE.md rules apply to all new work).

**Fixed rules for all new art**: the seven existing biomes stay **unchanged**; new buildings and resources must read as part of the current map (48 px terrain tiles, buildings 48x60 transparent with no ground, 40 px resource icons, coloured 1 px outline, 5-tone ramp lit from the top left, no ground shadows, integer scaling).

| Asset group | Count | Placeholder until real art | Sample folder |
|---|---|---|---|
| Avatar portraits (8 starters, about 4 unlockables, locked silhouette, selected frame) | about 14 | none (P2 needs them) | `ui-and-portraits/` |
| T2 icons: Hardwood, Cloth, Honey, Ichor, War Medals | 5 | tinted existing icons | `resources/` |
| T3 icons (12 extracts) | 12 | reserved icon set (`res_iron` ...) | `resources/` |
| T4 relic icons | few | generic crate icon | `resources/` |
| Buildings: 3 per biome, 36 total (21 home biomes, 15 new), 2 looks each (levels 1-2 and 3-5, glow on level 5) | 36 x 2 | the 16 old sprites | `buildings/` |
| Road sets (one per ground family, 16 autotile variants plus end caps and bridge) | about 10 sets | none (P6c) | `roads/` |
| New biomes: Jungle, Fields, Orchard, Blight, Battlefield (ground, rim, props, decor, pads, critters, minimap colour) | 5 | flat-colour dev palettes | `biomes/` |
| Monsters: home families (3), 3-4 per new biome plus a boss (about 20 more) | about 25 | `monster_generic` tinted | `monsters/` |
| Landing: lettering pattern, 5 icons, baked strips v1 and v2 | | the still of v1 | `landing/` |

**The two special biomes (Blight, Battlefield) brief.** Same tile geometry and outline discipline as every other biome, but richer: an extra animated layer (pulsing slime pools, drifting embers and ash, flapping banners), a deeper interior tier with its own prop set, 2 building pad variants instead of 1, a fuller rim set against every neighbour, a distinct minimap and highlight colour, and building sprites with a **glow on level 3+**, so reaching them feels like arriving somewhere. Keep the palette tied to the established 28-colour discipline so they do not look pasted in. Upload the references you like most for these two and I will build the brief around them.

**What I need from you in `art_style_reference/`**: samples of resources (ingots, ores, goods), buildings (any style you want matched), biome mood images, monster samples, and any road or landing inspiration. Name files `<group>/<what>-<note>.png` (the README explains).

## 7. Decisions

**All recommendations below were accepted on 2026-10-29 (D1-D11).** The "Decision" column is what is now agreed; numbers marked "proposed" are still approved per phase before they ship (balance rows need approval before any change). The plan is ready to start at P0.1.

| ID | Question | Decision | Was blocking |
|---|---|---|---|
| **D1** | ~~Approve moving monsters (P3) ahead of the biomes?~~ | **Approved (2026-10-29): monsters with real stats and placeholder art ship as P3, before the biomes** | none, order is fixed |
| **D2** | Clicks and chests (B6 / BL1 / BL3): keep them small, scale chests with click-inclusive income, or rework clicks? | scale chest rewards with income and keep clicks small; revisit when the click Idol is designed | P6c |
| **D3** | Food/meat engine (BL4): add farm cost scaling or upkeep before the farm Idol? | tune `costScaling`, no upkeep | P6c |
| **D4** | Target map size per rebirth (BL16), tile price tail | decide with the P5.5 sim run; keep the +12 offset until then | P5 |
| **D5** | Password reset in P1 or P2? | P1 (small, and it is landing polish) | P1.6 |
| **D6** | Launch achievements, avatar unlocks, tutorial bundles and tone | I draft the list, you cut it | P2 |
| **D7** | Home family stats and reward caps | I propose numbers from the sim | P3 |
| **D8** | Mastery caps and the ladder above 1 trillion | caps as in [22](22-glossary-and-mastery.md), ladder later | P4 |
| **D9** | Server-priced merchant: schedule it next to crafting or accept flagging only | schedule it right after P11 | enforced crafting |
| **D10** | Landing wording and whether to show a players-online number | no number in v1 | P1.3 |
| **D11** | What does the demoted Rat King keep? (a) stays a rare boss-tagged monster, 1000 HP lowered to a fair number, same 3 h timer; (b) becomes a plain strong monster in the normal spawn table | (a) with HP and timer re-tuned by `fight-sim`, since it is the only boss until the biome bosses exist | P3.6 |

## 8. Risk register (edge cases found in the code and docs)

| Risk | Where it bites | Mitigation (step) |
|---|---|---|
| An in-progress castle upgrade from the old timer makes `sanitizeSave` return `invalid` and `castle_jump` un-rank the account for good | P0.4 | bound by the legacy durations, normalise, clamp `was.remainingSec` (in 0.4); test the replay |
| Open fights write the ledger every 2 s | free-plan limits; worse with crafting and rankings | P0.3 |
| Eight hand-kept resource key lists; one forgotten key rejects saves | every new resource (17 are planned) | P0.5 with a scan test |
| `LOOT_SECRET` in `.env.example` is a real value | any public release | rotate during the reset (2.7) |
| Reset archive trimmed away, or restored over a newer game | P2 | pinned history row, `ledger.ver` compare-and-swap, restore rehearsal |
| A stale browser tab with the old save uploads after the reset | P2 | the pipeline's compare-and-swap; extra test for the deleted-row case |
| Ticket bank hard-wired to rats and one King | any new monster | P3.1 before anything else in P3 |
| Players rebirth before P7, P8 or P11 ship | testers reach rebirth 1 around day 4-6 after P2 | biome unlock is count-based so they get new biomes later without loss; the wipe is the only thing that must wait (P11) |
| The wipe shipping before crafting makes rebirth a punishment | P11 | hard gate: 11.4 after 11.1-11.3 |
| Preview map overwriting the viewer's own save | P9.3 | separate `previewStore`, cloud sync blocked, dedicated test |
| New biome roll drifts the sim baselines | P5 | the `rebirths = 0` identical-roll regression test |
| Build-time bonuses stack past the run-2 target | P6 | combined reduction cap (proposal 60 %), sim check |
| Placeholder art mistaken for final | P3, P6 | placeholders are catalog keys listed in section 6, swapped per phase, tracked in each phase's acceptance |
| Docs drift: doc 21 says "three active players", doc 14 says five accounts; doc 12 section 4's merchant bullet is void | credibility of the docs | tidy in the first docs PR after approval |

## 9. What I will do after your review

1. Apply your answers (D1-D10) and edit this plan.
2. Trim ROADMAP's two tables as triaged in section 2 (only after you approve each row, as the backlog requires).
3. Start P0.1 on its own branch.
