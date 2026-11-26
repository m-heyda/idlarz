# 1.0 punch list: what to finish, polish and decide before the release (proposal)

Written 2026-11-26 from the Linear backlog (about 60 open tickets, all read), the code and the git history, after the 0.9.5 release. The owner plans 1.0 about a month out, together with the new art. **Hand-written plan, like the other files here: it lists what is not built.** Linear is the truth for status; this is the proposed order and the cut line. Sizes: S half a day, M 1-2 days, L about a week.

## 0. The cut line

1.0 = the art-complete release (new assets) on top of a game that is safe to open to the public. So: everything **public-readiness** must land, the **balance** work the owner already asked for must land, a **small, finished skills slice** is worth adding, and large new systems (world boss, second realm, quests, gambling, server-run economy) are **after 1.0**.

## 1. Must ship before 1.0

| # | Item | Linear | Size | Why |
|---|---|---|---|---|
| 1 | **Crafting rebalance** (batch cap 25, times, XP, cost curve, Ichor earlier): built in PR 319 (IDL-396); IDL-349 and IDL-379 remain for the end-game recipe costs and G7/G8 tuning | IDL-396, IDL-349, IDL-379 | done | Level 60 was out of reach; queues could run for months |
| 2 | **Paragon: balance sims and tuning** (fight-sim at cap and 500 uncapped, pace profile, stat-audit pins) | IDL-187 | M | Needs the owner's production feedback first |
| 3 | **Paragon 3/3: milestones every 100 levels, deeds, titles, name frames** | IDL-394 | M-L | Owner's calls on the title names first; part of the approved paragon design |
| 4 | **Delete my account** (authenticated server op and confirm dialog) | IDL-392 | M | Required before a public launch |
| 5 | **Privacy policy and Terms page**, footer link | IDL-391 | S | Same (the owner skipped it so far; decide: write it or accept the risk) |
| 6 | **Public readiness checklist**: email confirmation on, rotated secrets, rate limits, free-plan load check | IDL-126 | S-M, mostly dashboard work | Owner and dashboard work, listed in [0-9-2-fixes](0-9-2-fixes.md) |
| 7 | **Turn on the enforcement switches** (`ENFORCEMENT`, `EMBER_MODEL.requireServerRebirth`) after `restore-trust` and `check-live-saves` | IDL-208, IDL-211 | S + checks | Today the server only flags; a public game needs it to refuse |
| 8 | **Walk-through of the unchecked cases** (3-defeats auto-battle pause, stale second tab, second browser, `/reset` from an emailed link) | IDL-300, IDL-384 item 1 | S | Owner testing, no code unless a bug shows |
| 9 | **Landing v2** with the new art and the Open Graph image | IDL-122 | M | Ships with the art |
| 10 | **New art in the game**: biome art for jungle, fields, orchard, blight, battlefield; the building sprites; item pass 3; stand-in monsters; castle 11-15 | IDL-106, 108, 110, 99, 245, 218, 373, 362 | L (art) | The reason for the 1.0 date; placeholders are catalog keys, so art swaps in without code |
| 11 | **Re-read the 1.0 numbers once the art is in**: the changelog 1.0 file, the Guide and glossary text for the new biomes | none yet | S | |

## 2. Should ship (polish and safety, each small)

| Item | Linear | Size |
|---|---|---|
| **Glossary overlay** for resources, biomes, items, buildings and **resource mastery** (the Bestiary half is built) | IDL-83, IDL-84, IDL-393 | M |
| **Spawn tables per distance band and the relevance fade** (closes the R7 danger offset) | IDL-53 | M |
| **Monster chest leftovers**: gear and bag tokens in the contents, a loot-sim Monte Carlo | IDL-163 | M |
| **Stat-audit cleanups**: float noise, the `leechHeal` duplicate, affix level scale | IDL-172, IDL-387 | S |
| **QA of the item-card move** (fight-window hover, Esc order, dock icons) and the `e2e/` specs | IDL-389 | S |
| **Preview map of another player's world** | IDL-115 | M (the Rankings are built, this is its second half) |
| **Position bonus** for buildings | IDL-95 | M |
| **Free-tier hot spot**: poll slower while a fight is only watched | IDL-136 | S |
| **Framework upgrades** one at a time (Next 16, TypeScript 7, ESLint 10, `@types/node` 26) | IDL-125 | M, do it early in the month so any breakage has time |
| **Number notation** past `Sx` (a Settings switch for suffix, scientific, engineering) | none yet | S, only if the late game reaches it (see long-game scaling below) |
| **Offline report bar** already built; consider the "overflow bank" idea only if players complain | none | - |

## 3. Skills before 1.0? A small slice, yes; the full Skills v2 is too big

The question was whether we already have what is needed to support crafting skills. **Partly.** What exists: the crafting queue and recipe system takes any new component recipe (a "core" is one more entry in `RECIPES`), the server owns the crafting stash, the Hero window has a Skills tab placeholder, nine spare skill icons are in `public/pixel/__reuse/skills/`, and the fight engine already runs Heal and Stun on the server. What is missing (this is IDL-352, IDL-353, IDL-359, IDL-202):

- a **skill-material family** (boss fragments dropped by bosses, resource keys append-only, the boss drop table) and the **fragment to core recipes**;
- **skill levels, skill XP per cast and the chosen loadout** in the ledger (additive column, tolerant reader, fixture), plus Auto-use following the loadout;
- **new effects in the fight engine**: damage over time (Flame Hand, Poison), a curse (Evil Eye), a delayed hit (Void Meteor), a crit boost (Starburst), each tested against the damage cap;
- the Skills tab, hotbar levels and a tutorial step per unlock.

**Proposal for 1.0 (L, after the crafting rebalance (built, PR 319), because the core recipes use its batch and time rules):** ship *Skills v2 light*: the third slot, the loadout choice, skill XP and levels 1-10 for Heal and Stun, and **two** new skills with simple server effects (Flame Hand, Poison, both damage over time), unlocked by a fragment-to-core recipe. Breakthroughs (IDL-353), the class skills and the remaining skills follow after 1.0. If the month is tight this is the first thing to cut; nothing else depends on it.

## 4. After 1.0 (not in this plan)

World boss (IDL-345), the Second Realm (IDL-302), quests and daily quests (IDL-203, IDL-361), gambling (IDL-205), combat depth and elites (IDL-204), the lava biome (IDL-371) and biome bosses with relics (IDL-111), **server-run economy actions** (IDL-134, IDL-121, IDL-195 autobuyers, IDL-159 buff potions, IDL-193 boosts), gem track G2-G5 (IDL-191, 192, 234, 236, 237, IDL-354 rework, Cap Breaks IDL-231/232), the Monument (IDL-185), pets with achievements (IDL-284), rebirth salvage (IDL-151), the resource cap past 2^53 (IDL-129), `migrate-saves` and retired-biome fallbacks (IDL-281, IDL-288), a fifth hero class (needs the `player_class_known` SQL first, IDL-280).

**One decision that affects 1.0: long-game scaling** ([the design](../superpowers/specs/2026-11-17-long-game-scaling-design.md) and [plan](../superpowers/plans/2026-11-17-long-game-scaling.md), IDL-277). Rebirth 5 is where the content ends today, and the curve has to carry the game after it (prices that follow your power, monsters that follow player power, endless Ember tails, numbers past `Sx`). It is unbuilt and large. If 1.0 is expected to hold players past rebirth 5 for months, the price curve and the Ember tails (the first two tasks of that plan) belong in section 1; if rebirth 5 is a long enough first act, it stays after 1.0.

## 5. Proposed order for the month

1. Week 1: the remaining crafting work (end-game recipe costs, IDL-349), framework upgrades, the small safety items (IDL-392, IDL-391, IDL-126 checklist), paragon feedback in.
2. Week 2: paragon sims and tuning (IDL-187), paragon milestones (IDL-394), glossary overlay and resource mastery, spawn tables.
3. Week 3: Skills v2 light (if kept), chest leftovers, stat-audit cleanups, QA passes, position bonus.
4. Week 4: art lands (biomes, buildings, landing v2), enforcement switches after the final `check-live-saves`, release notes, tag 1.0.
