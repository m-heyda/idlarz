# 26 · Next updates: a draft plan in logical order

> **Status note (2026-11-07):** the steps below are tracked as Linear issues (R0 for phase A, R1 and R2 for B and C, R3 for D). A step is done when its issue is Done, not when it is listed here. Decisions made after this plan was written (docs 06, 10, 13, 15, 17, 18, 20, 21, 28 and the "Where each decision lives" table in the [ROADMAP](ROADMAP.md)) win over any older line below.

Written after the balancing pass (castle timers, rebirth wipe and respec, the Ember curve, the merchant clock, the 16-monster roster, the growth badge and the battle queue are built, and so is the icon registry (B1); see [game/](../game/overview.md)). This is a **proposal**: the order is meant to make the core readable and cheap to change first, then fill the game with content, then go back to the rebirth world ([ROADMAP](ROADMAP.md), [RELEASE-PLAN](RELEASE-PLAN.md)). Sizes: S ≈ half a day, M ≈ 1-2 days, L ≈ a week.

## Why this order

1. The next stretch is **content** (items, affixes, loot pools, biome goods). Content work touches the same few files again and again (`gameStore.ts` 1,350 lines, `gameConfig.ts` 940, `gameUtils.ts` 920, `fight.ts` 480 (sizes before A2-A4, which split them), `lootConfig.ts`, `sanitizeSave.ts` 550). Cleaning those first makes every later change smaller and the diffs readable.
2. The art is **already here and unused**: `art_style_reference/equip` holds about 600 equipment icons and 48 potions per sheet, a 12-grades-per-slot plan and three special sets ([equip/README](../../art_style_reference/equip/README.md)); the monster art in `public/pixel/enemies` is already wired for four biomes. Wiring item art is mechanical and has no balance risk, so it comes before the loot work that needs it.
3. Loot depends on the monsters (done) and on the items that exist. Once the items exist as data, the pools, affixes and uniques can be tuned with `npm run loot-sim` and `npm run monster-ladder`.

## Phase A · Core you can read (M-L in total, no behaviour change)

Built and removed from this section: A1 (Prettier), A2 (store slices), A3 (config and maths split), A4 (fight engine split), A6 (`Tile.tsx` split), A8 (the pacing guard). A7 is split: its generated-docs half is built; the tests-by-area half is IDL-214.

Rule for every step: **no gameplay change, the sim and the generated docs stay identical** (`npm run sim -- --no-write human hardcore` before and after), one PR each.

| # | Step | Size | Notes |
|---|---|---|---|
| A5 | **Rename the rat leftovers.** `bank.rats`, `TicketKind 'rat'`, `LUCK.luckyRat`, `ratsMinted`, `luckyRatChance`, `monster_rat` icons: say `monsters` / `normal` / golden monster (the golden variant itself stays, see the section below). The ledger bank is stored JSON: no reader for the old names is needed (the ledger is reset), so rename, bump `SAVE_SCHEMA` if the save changes, and run `npm run reset-players` with that release. | M | Ships with the epoch reset (IDL-76), not earlier: the ledger names change and the reset is what makes that safe. Replaces the "additive ledger columns first" rule of [14](14-server-audit-and-data-plan.md) for this step. |

## Phase B · Prepare the item assets (M-L, art and data, no balance change)

Goal: every item we will ship exists as **data with an icon**, behind a switch, so the loot work in Phase C only chooses what drops.

| # | Step | Size | Notes |
|---|---|---|---|
| B0 | **Three art passes** (see [ROADMAP](ROADMAP.md) "Item art in three passes"): pass 1 wire the existing good icons first (IDL-26..31), pass 2 generate placeholders in Python for everything that has none, pass 3 replace with Sprite Fusion in later releases, one registry line each. | M | Decided 2026-11-08 (IDL-217 pass 2, IDL-218 pass 3). Pass 2 is what lets B3 (all 12 grades as data) finish without waiting for art. |
| B2 | **Cut and register the prepared sheets** by the procedure in the art README (`extract_sheet.py`, nearest-neighbour, our 40 px, no baked glow): potions first (hp, mana, buffs, antidotes), then weapons by type (sword, dagger, axe, mace, spear, bow, crossbow, staff, wand), then armour by slot (head, shoulder, chest, hands, legs, feet), then neck/ring/charm/cape. Gaps to draw in our kit: shields and off-hands, tomes, quivers, shoulders, gloves, capes. | L | One PR per family; the PR description names the sheet and region (art README rule 8). |
| B3 | **Item definitions for the 12-grade ladder** (G1-G9 plus three special sets S1-S3) as entries in `catalog/items/*.ts` with `enabled: false` (new flag) and the grade as a tag, so they exist and are validated by `tests/catalog.test.ts` but nothing drops them yet. | M | The names are working titles in the equip README section 4. **Partly built (2026-11-07):** the `enabled` flag exists and `src/catalog/items/reuse.ts` holds 91 disabled items (feet, legs, neck, ring, off-hand, sword, mace/maul, legendary), never sold and never dropped (tests). Still open: grade mapping G1-G9 and S1-S3, the belt slot, dagger/axe/spear/bow/crossbow/staff/wand, and chest/head/shoulder/hands/cape/charm art. |
| B4 | **Consumables beyond HP potions**: mana, stamina/regen, buff potions, antidotes with their effects as data (`consumable: { healHp | healMp | buff }`), shown in the bag and hotkeys. Needs a buff model on the server (a timed modifier in `CombatState`); a design for consumables, buffs and drop chests exists on another branch (`agntc/mystifying-turing-7454b2`, not merged yet) and should be taken from there. | M-L | Server-side effect first, art second. Decided in IDL-22 and IDL-160 (timed combat buffs, 4 utility potions); the 12 potion icons sit in `public/pixel/items/consumable/`, no definitions yet. |
| B5 | **Old art retirement.** Delete the superseded `item_*` icons and the procedural gear sprites in the same PR that switches each catalog entry (art README rule 6). | S | |

## Phase C · Loot pools, variety and uniques (L)

| # | Step | Size | Notes |
|---|---|---|---|
| C1 | **Per-biome loot pools.** Pools get a `biomes` / `grade` tag and a monster's `lootSourceId` picks a pool by biome and grade (plains G1-G3, forest G2-G4, swamp G3-G5, tundra G5-G7), so the ladder in `generated/monster-ladder.md` and the gear tiers line up. Normal monsters stop sharing one `monster` source. | M | Update `loot-sim` to print drops per biome. |
| C2 | **Bosses own their drops.** Each boss gets its own source: a guaranteed piece of its biome's set or a named unique; the **Rattatui set stops dropping from every boss** (it keeps one source). | M | |
| C3 | **More affixes and stats.** New affix groups on the existing level curve (thorns, dodge, mana regen, gold find, XP gain, crit damage, resist stun, per-weapon-type bonuses) and **tiered affixes** (a higher item level unlocks a stronger tier of the same affix). New stats need: `catalog/stats.ts`, `effectiveStats.ts`, the server profile (`playerProfile`) and the fight engine, in that order. | M-L | Each stat is data plus one use in the engine; keep a test per stat that it changes the right number. |
| C4 | **Legendary and unique items with special effects.** An item can carry an `effect` id (on-hit, on-kill, on-low-HP, aura) implemented by small named handlers in the engine (`lib/offline/effects.ts`): e.g. Emberbrand burns, a ring that refunds a potion, a cloak that dodges the first hit. Legendaries get fixed names and lore text; drop only from a boss or a rare event. | L | The fight engine is the place; the effects must be deterministic from the sealed stream. |
| C0 | **Re-base the test fixtures on the grade ladder.** The tests' "strong kit" is Obsidian plus a legendary maul only because the Rattatui set was deleted; Obsidian stops being the benchmark once G1-G9, S1-S3 and the legendary pool exist. One helper with a named kit per grade, `fightBalance`, `battleQueue`, `goldenFight` and the sims use it. | S-M | IDL-219. Before C1, so the loot tuning has a stable yardstick. |
| C5 | **Rarity and item-level windows revisited** with the monster ladder and `loot-sim`: how many drops per hour per tier, pity for sets, the auto-sell filter defaults. | S-M | Numbers from the sims, not from prose. |
| C6 | **Merchant shelf follows the pools** (grade by the player's gear, the shelf never sells the next tier) and shows the new items. | S | |

## Phase D · Monsters for the rest of the world (M, per biome)

Hills, coast and lake have art or are missing it (hills has none). Enable a biome's roster the way the plains one was: stats in `BIOME_TIER`, entries in `MONSTERS`, the ladder table, the loot pool of C1. **Decided 2026-11-07 (IDL-58, build task IDL-201): monsters may spawn on lake and coast tiles themselves, so no shoreline rule is needed (IDL-57 superseded); ladder: coast easy (levels 2-12), hills between forest and swamp (6-16), lake between swamp and tundra (10-19).** Then the reward caps of [20](20-monster-families-and-rewards.md), generic spawn weights per monster, and the glossary of [22](22-glossary-and-mastery.md).

## Phase E · The rebirth world (as in the ROADMAP release order)

Only after A-C: server-run rebirth (`/api/rebirth`, closes the short window in which a modified client can sell old gear), the "New chapter" release ([21](21-classes-avatars-achievements-offline-report.md): classes, avatars, reserved names, the one-time reset, tutorial), then biomes (12), buildings (18), rankings (15), crafting (17). Crafting needs Phase B/C: it consumes the item grades and the new materials.

## Golden monsters stay (keep and extend)

The rats had a **golden ("lucky") variant** and we keep that for every monster: the server decides it when the monster appears (`luckyRatChance` in `lib/luck.ts`, `LUCK.luckyRat`: 2 % plus Luck, at most 10 %), the map draws it gold-tinted (`.tile-monster[data-lucky]` in `Monsters.css`) and a kill pays x3 gold and XP plus one extra gear roll (`rollKillLoot`). It still works for the new roster. What is missing, to do with the monster phases:

- **Rename** `luckyRat` / `luckyRatChance` to golden/lucky *monster* (part of A5); the ledger ticket field `lucky` stays.
- **Show it everywhere**: the gold tint also in the fight window (`CombatPanel`), the "Next" strip of the queue and the glossary; a small sparkle on the tile so it is seen from far away; the badge star already exists.
- **Per-monster golden art** later: a hand-picked gold palette per monster instead of one sepia filter (the art sheets are single images, so this is a palette swap in the pipeline).
- **Tune per biome**: the chance and the multiplier follow the monster ladder (a golden tundra monster is worth more than a golden plains one; the x3 reward is capped by the reward caps of [20](20-monster-families-and-rewards.md)); decide whether bosses may be golden (today they never are).
- **Drops**: a golden monster rolls from the next grade's pool (C1) once pools exist, so finding one is an event.

## Small things to do on the way

- Show the **estimated win chance** of each queued monster in the Next strip (`offline/winChance.ts` already computes it); decide whether a defeat should also switch Auto-battle off. **Decided 2026-11-07 (IDL-59): coloured Safe/Risky/Unlikely bucket with the percent on hover; three defeats in a row pause Auto-battle.**
- Per-band danger offsets (`dangerBonus` is 0 or 1, ROADMAP R7).
- Doc 19 and [game/pacing-targets.md](../game/pacing-targets.md): check that their castle timer numbers match `CASTLE_UPGRADE.durationsSec`.
- Look at the growth badge, the queue markers and the Next strip in a real browser session once (nobody has yet), and write a Playwright smoke test for them.

## Decisions needed

1. Phase A first as proposed, or items first? (Proposed: A1-A4, then B, with A5-A8 alongside.)
2. How many special effects at launch of C4 (proposed: 6 handlers, 10 legendaries).
3. Is `enabled: false` item data allowed to ship in the catalog (proposed: yes, it is validated and never dropped).
4. Prettier style (tabs, single quotes, print width 160 to match the code today) so that A1 changes as little as possible.
