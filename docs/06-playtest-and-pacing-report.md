# 06 · Playtest, pacing & the first rebalance pass

**Why:** a friend "finished" the live game in about 3 days. This document records what the playtest found, which fixes were applied first and why, and what the simulation says now. Applied items are *not* repeated in the backlog ([05](05-balance-backlog-and-roadmap.md)).

## 0b. First-rebirth pass: rebirth around day 7, hide, slower levels (current numbers)

**Why:** with server-run combat in, the owner (185 tiles, level 32, 3-4 real days in) hit a "hide wall" and could not see a rebirth before about day 12. Goals: rebirth *available* around day 7 for a person who checks in a few times a day (more room to push on after it: the Ember gain grows with castle level and tiles), no tile material that silently becomes the limiter, levels that need several rebirths to reach 100. Scope: the first run, one enemy (rat) and its boss (Rat King); the runs after a rebirth were only checked for "faster than the run before".

**What the analysis found (before any change).**

- Hide was not the limiter at the owner's 185 tiles (gold 36 min per tile, hide 18 min, wood 12, stone 14, coal 8, food 3) but it had no way to grow: deer and pigs only, 12 of each, while the gold price climbs ~0.7 % per tile.
- The real day-7 blocker was the castle: 5→6 cost 20 M gold + 10 M food up front and then a 3-day timer, so a player with an empty purse at day 3.5 could not start it in time. The sim bots never noticed because they sell every surplus and top up at the merchant (castle 6 at ~4.5 d); the owner hoards (3 M meat, 4 M coal unsold).
- Combat was not in the sim at all.
- The level curve (x1.3 per level, forever) made level 100 worth ~1e14 XP for one level, and tile XP (125 x 1.02^k x k/4) was ~90 % of all XP.

**New sim profiles** (`scripts/sim.ts`): `human` (one click a second, plays 8-9, 12-13 and 18-23, a visit once an hour, at most 8 tiles per visit, never sells surplus; calibrated so it has ~185 tiles after ~3.3 days like the owner), `human-rebirth6` / `human-rebirth8` (the same, rebirthing at castle 6 / 8; they no longer start a castle upgrade past their rebirth level), all with a combat model (a rat every 900 s, the King every 3 h, `GEAR_SCHEDULE`: starter kit, knight gear from day 1.5, obsidian from day 5) paying the real `killIncome`. The table at the end of `generated/sim-milestones.md` shows, per tile count, the minutes the income needs to cover what is *missing* of each part of the next tile.

**What changed** (`src/config/gameConfig.ts` unless noted):

| Area | Before | Now |
| --- | --- | --- |
| Castle 4→5 / 5→6 timer | 1 d 12 h / 3 d | 1 d / 2 d |
| Castle 5→6 cost | 20 M gold, 10 M food (rest unchanged) | 8 M gold, 4 M food |
| Deer / pig hide per second | 0.0375 / 0.075 | 0.075 / 0.15 (merchant price 4 → 2 gold, so gold income is unchanged) |
| Tannery | +15 % hide per level | +25 % per level |
| Pasture (new farm upgrade) | — | +8 % eggs, milk and hide per level, 10 levels, 5 K food + 2.5 K wood x 1.6^n |
| Tile price in materials | hide 3 % from tile 120, stone 25 % | hide 2 % from tile 100, stone 20 % |
| Hide from kills (`COMBAT.rewards.hideShare`) | none | rat and King pay hide/s x reward seconds x 0.6 (server-sealed, in the ledger totals) |
| Tile XP (`BASE_XP_PER_TILE`) | 125 | 45 |
| Level curve | x1.3 per level | x1.3 up to level 38 (identical), x1.045 after (`XP_LEVEL_SOFT`, `xpToLeaveLevel`) |

The level curve is the old one wherever a save already is (it only ever gives *more* levels for the same XP), so there is no migration; `sanitizeSave` accepts the stat points of the old, lower level for a save written before the change.

**Result** (`npm run sim -- --seeds=3`, median game time):

| milestone | human | idle | hardcore |
| --- | --- | --- | --- |
| 100 / 200 / 300 tiles | 1.8 d / 4.0 d / 5.8 d | 7.7 h / 1.5 d / 2.4 d | 7.8 h / 1.3 d / 1.8 d |
| castle 5 / castle 6 | 3.6 d / **5.8 d** | 2.4 d / 4.8 d | 2.2 d / 4.3 d |
| level 35 / 40 / 50 | 4.8 d / 6.0 d / 7.6 d | 1.9 d / 2.4 d / 3.5 d | 1.5 d / 1.8 d / 2.8 d |

Rebirth available at castle 6: day 5.8 for the `human`, 4.3-4.8 d for the bots; the real owner, whose economy is about half the human's, lands around day 7. At that moment the human is level 40 with 25 Embers (castle 7 first would give about twice that). Runs after it: castle 6 again after 4.0 / 3.3 / 3.5 d (69 % then 57-60 % of the first run). Pushing on to castle 8 first: day 13.0, level 71, 105 points; castle 6 comes again after 3.1 / 2.8 / 2.1 d. Level 100 is not reached by a human in 26 days of one run (level 75 at day 15); a hardcore bot gets it at day 22 in the first run, so a deep run plus one or two rebirths is the realistic path, and the planned rebirth XP modifiers will shorten it ([13](13-roadmap-building-and-resources.md)). Hide is no longer the limiter for the bots that play like people (at most 5 minutes of income against 23-66 for gold); it is still the slowest part for the 24 h auto-clicker between 100 and 200 tiles (11-15 minutes, because that bot sells every surplus), and stone, with the thinnest income, is about as slow as gold for the idle bot (34 against 28 minutes at 300 tiles).

**Caveats.** The `human` is one calibration point (the owner's 185 tiles at day 3.5), not a measurement of players; the bots still beat it by 2-3x. `GEAR_SCHEDULE` is an assumption taken from fight-sim.md. After the first rebirth the sim bot spends its Embers builders-first and stops getting faster after the third run (castle 6 at 3.3-3.5 d, bounded by the castle timers): that is the later "max the rebirth shop" design, not this pass. If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.

## 0. Early-game pace pass (numbers before the first-rebirth pass)

The sections below describe the first rebalance (which stretched the old 3-day game to about 4 weeks for the first 40 tiles). The
next pass changed the goal: the first ~100 tiles should be **easy** (hours), then the climb should be a **2-3 day** project up to
200-300 tiles, and the price should steepen clearly after 300, because enemies and resources are still to come and a rebirth must
be faster than the run before it. What changed (all in `src/config/gameConfig.ts`):

- **Tile price**: ×1.13 per tile up to 15, ×1.07 up to 100, ×1.007 up to 300, then `(n / 300)^4.5` (was ×1.45 / 1.27 / 1.17 and `(n / 100)^2.5`).
- **Castle upgrade costs** (all resources) are 20 % of what they were; the build timers are unchanged and are now what paces the castle.
- **Building prices** grow ×1.15 / 1.09 / 1.025 per building (was ×1.35 / 1.25 / 1.15) so buildings still matter next to cheaper tiles.
- **Rebirth** needs castle 6 **and 100 tiles** (was 20); the gain formula is unchanged.
- **Farm**: first animal costs 1 K / 10 K / 60 K / 400 K food (was 10 K / 50 K / 200 K / 1 M) with growth ×1.3-1.4 (was ×1.5-1.8); farm upgrades are 3-10× cheaper.
- **Start ring**: the castle's 3×3 is only plains and forest (no lakes or hills).

Simulated result (`npm run sim`, median game time; see [generated/sim-milestones.md](generated/sim-milestones.md)):

| milestone | idle | casual | hardcore | autoclicker |
| --- | --- | --- | --- | --- |
| 100 tiles | 8.6 h | 8.6 h | 7.3 h | 3.3 h |
| 200 tiles | 1.4 d | 1.2 d | 21.9 h | 16.4 h |
| 300 tiles | 2.1 d | 1.9 d | 1.5 d | 1.2 d |
| 400 tiles | 3.7 d | 3.0 d | 2.3 d | 1.9 d |
| castle 6 (first rebirth possible) | 7.2 d | 6.7 d | 6.2 d | 5.7 d |
| castle 10 | 26.7 d | 26.0 d | 25.5 d | 24.9 d |

The 100 tiles take hours, the next 200 about two days, and the 100 tiles after 300 take about twice as long as the 100 before them.
The hardcore bot that rebirths at castle 6 gets to castle 6 again after 6.2 d, 4.4 d, 3.8 d and 3.2 d (and has 100 tiles after 7.3 h, 2.6 h,
1.6 h and 0.6 h). The castle timers (24 d to castle 10) are now the longest pole: if the first run should be longer once new content
exists, lengthen `CASTLE_UPGRADE.durationsSec` rather than the tile curve.

## 1. What the playtests showed

Two independent measurements of the **old** game agree:

- **Browser playthrough** (real UI, clock sped up, a bot clicking 2×/s): effectively everything — castle 5/6, max click multiplier, all four animals, 35+ tiles — was reached by day 3.5–4; castle 6 was only delayed by bot mistakes.
- **Headless simulation of the real store with the old parameters** (`npm run sim -- --legacy`): a player who clicks at 20 clicks/s all day finishes (castle 6, max click, 40 tiles) in **2.2 days**; 4 clicks/s for 8 h/day takes 13 days; never clicking takes 25 days. So the "3-day finish" is an auto-clicker / very heavy clicking result.

Why the old game was so fast, in order of impact:

1. **Click income scaled with income and had no limit**: gold per click = total gold/s × up to 16, any click anywhere (UI buttons included). Income ≈ passive × (1 + clicks/s × 16): ~160× with 10 clicks/s.
2. **Meat sold for 15 gold** (food 0.75): one liquidation of unsold meat/coal/stone/wood produced 17.9 M gold in the playtest and bought four tiles plus the last click upgrade at once. The farm was the main engine.
3. **The castle was cheap relative to income** and doubled everything; its full price was about one merchant sale.
4. **Resources piled up unused** (stone 3.7×, coal 8.7× the next castle need) — everything was sellable gold.
5. **Tiles stopped being a goal**: tile 25 → 434 K, tile 38 → 29 M gold for ~0.1 gold/s (the original complaint "cost is insane after 25"), so the real progression was castle + farm + clicks, all of which ended in days.
6. Levels/stat points, chests (5–50 min of passive income) and tile taps were irrelevant next to clicking.

## 2. Decision: what was applied first (and why this order)

The order follows leverage and risk — remove the exploit-like multipliers first, then add the gates, then make the late game worth playing:

| # | Change | Why first / what it fixes |
| --- | --- | --- |
| 1 | **Click limiter** (burst 8, 5/s, long-run ≈1.5/s) + only trusted clicks on the **map** + click power 50–180 % of gold/s (was ×2–×16) | the single biggest lever (1); autoclickers can no longer beat a dedicated human, fast humans are never limited |
| 2 | **Meat 15 → 1 gold**, animals **stack** (each purchase adds one animal) | removes the gold fountain (2) and makes later animal purchases matter |
| 3 | **Castle**: costs ×10, **timed builds** (1 h … 72 h, tick-counted), castle XP bonus implemented | the finish line can no longer be bought in one go (3); timers survive clock edits |
| 4 | **Tiles**: cost curve ×1.45/tile to 20, ×1.27 to 40, ×1.17 after (was ×1.42 everywhere, tile 40 = 95 M → 10.8 M), **extra wood/stone/coal/food from larger territories**, biome yield ×1.3 | tiles stay a meaningful long-term sink and finally give wood/stone/coal/food a use (4, 5) |
| 5 | **Buildings cost resources** (×1.6 each, later replaced by the cheap-start three-stage curve in [03](03-formulas-and-scaling.md)), Blacksmith 0.1 → 0.07 | a choice instead of a free pick |
| 6 | **Chest timer pauses at the cap**, reward 10–60 min, +0.5 %/Luck; **farm critters** 45 s → ~10 s gifts, 20–40 s apart, one at a time, real clicks only | removes two easy bonuses (6) |
| 7 | **T1**: the hidden +10 % gold / +25 % XP modifier removed (modifiers start at 0); castle output has a single source of truth | honest numbers; part of the intended slowdown |
| 8 | **Clock/offline safety** (monotonic time, tick clamp), validated actions, encrypted IndexedDB saves ([07](07-security-and-exploits.md)) | closes the cheap exploits so the new pacing means something |

Tuning method: `npm run sim` (bots on the real store) — first reproduce the old behaviour with `--legacy`, then iterate the constants until the dedicated-human finish time was ≈ 4 weeks, an auto-clicker no better than ~1.06× that, and the first hours stayed quick (16 tiles in ≈ 4 h, castle 2 in ≈ 19 h).

## 3. Result (sim, new parameters)

From [generated/sim-milestones.md](generated/sim-milestones.md) (median of 3 seeds; game time until the milestone is first reached):

| milestone | idle | casual (1 click/s, 3 h/day) | hardcore (4 clicks/s, 8 h/day) | autoclicker (20 clicks/s, 24 h/day) |
| --- | --- | --- | --- | --- |
| 16 tiles | 4.6 h | 4.6 h | 4.6 h | 0.8 h |
| castle 2 | 21 h | 20 h | 17 h | 13 h |
| castle 3 | 2.6 d | 2.3 d | 2.2 d | 1.7 d |
| castle 4 | 7.6 d | 6.5 d | 4.9 d | 3.8 d |
| castle 5 | 18.2 d | 16.3 d | 13.2 d | 10.2 d |
| 40 tiles | 22.4 d | 19.9 d | 13.8 d | 9.2 d |
| **finished** (castle 6 + best click + 40 tiles) | **39.5 d** | **35.7 d** | **31.8 d** (27.1–44.5) | **24.2 d** (23.0–34.8) |

For comparison the old parameters give 25.4 / 22.9 / 13.3 / **2.2** days for the same four bots, so the auto-clicker went from 2.2 days to about 3.5 weeks and a dedicated human is about 20 % faster than someone who never clicks.

Two things to know when reading the numbers:

- **Biome luck now dominates the spread.** The Coast biome and water clustering (merged from the biome work) make some seeds end up with a lot of lake and coast and little wood/stone, so a single seed can be 40 % slower (hardcore range 27–45 d). That is why the table uses 3 seeds and shows ranges; differences below ~15 % are noise.
- **The auto-clicker is faster than the hardcore bot (24 d vs 32 d)**, which is more than the ~1.06× the limiter alone gave before the biome change (28.6 d vs 27.4 d on the same seed). The long-run click allowance is the same for both; what the 24 h bot adds is perfect attention (it buys tiles, tops up and starts the castle the moment it can, around the clock). That is the "player who never sleeps" case rather than a click exploit, and it is listed in [05](05-balance-backlog-and-roadmap.md) (BL1 / BL11) for the next balance pass.

## 4. Endgame results (castle 7–10 and Rebirth)

Castle 7–10 take 3 d, 4 d, 5 d and 7 d to build (24 d 5 h in total with levels 2–6) and cost about 1.6× the previous step. Median of 3 seeds, game time:

| milestone | idle | casual | hardcore | autoclicker |
| --- | --- | --- | --- | --- |
| castle 6 | 39.5 d | 35.7 d | 31.8 d | 24.2 d |
| castle 7 | 56.4 d | 51.7 d | 45.8 d | 35.5 d |
| castle 8 | 75.0 d | 69.0 d | 60.8 d | 48.3 d |
| castle 9 | 96.0 d | 88.8 d | 77.9 d | 62.4 d |
| castle 10 | 123.6 d | 114.0 d | 99.9 d (86.0–117.2) | 82.7 d (78.1–88.7) |

Target for the dedicated player was 70–100 d for castle 10.

**Rebirth** (hardcore bot that rebirths at castle 6 with 40+ tiles and spends all points greedily): first run 31.8 d → 9 points, then castle 6 again after **21.4 d** (67 % of the first run, 20.1–29.5 across seeds), 15.9 d (run 3), 12.2 d (run 4). A bot that plays all the way to castle 10 first earns 55 points and reaches castle 6 in **9.3 d** on the second run. So an early rebirth is worth about a third off the next run, and a late rebirth is a big boost but only after about three months. The shop is the soft cap: once the points are spent the only gain per extra point is the +5 % income.

## 5. Caveats and what is not decided

- The bots are one plausible strategy (castle-first, top up missing resources with gold, sell surplus). They tap tiles (about one click in eight), catch about half of the golden map critters and some farm critters, and buy Ember upgrades, but they do not use the class picker. Numbers are good for *comparing changes*, not as absolute truth ([04 B7](04-unfinished-and-known-issues.md)).
- 4 weeks was the active-player target chosen for this pass; after the Coast/water-clustering change the dedicated bot's median is 4.5 weeks (idle ≈ 5.5). Re-tune with the sim before moving the numbers again. The gap between active and idle is modest by design of the castle timers (5 d 5 h of mandatory waiting to castle 6).
- Remaining balance questions (levels/stat points, chest relevance, merchant depth, endgame) are in [05 §1](05-balance-backlog-and-roadmap.md).
- The old browser playtest numbers (tile purchase times, stockpiles) were measured on the pre-rebalance game and are kept only as the motivation above.

## 6. Round 3 check: farm products and upgrades, merchant bonuses, rarer critters

What changed for the economy: every animal also yields eggs, milk or hide (sold for 3 / 4 / 6 gold, 25-40 % of the animal's meat value), five farm upgrades (Feed +5 % meat per level, Hen House / Dairy / Tannery +10 %, Pen Expansion +2 % output and +4 animals per kind), a pen limit of 12 per kind, and far fewer critters (farm every 60-120 s instead of 20-40 s, map every 14-30 s instead of 4-9 s). The sim bot buys the farm upgrades when it has resources to spare and sells the products it does not need; it does **not** buy the merchant bonuses (Haggler, Bulk Discount, Lucky Charm, Pack Rat) and does not fight.

Hardcore bot, game time (3 seeds, median and range). The unchanged game (re-measured today at the start of this work) against this version:

| milestone | before | after |
| --- | --- | --- |
| castle 6 | 29.1 d (23.4-32.2) | 21.5 d (19.8-25.3) |
| castle 8 | 47.3 d (45.6-56.3) | 40.3 d (37.0-46.3) |
| castle 10 | 75.0 d (73.6-94.9) | 63.3 d (62.8-74.4) |

A 6-seed check to day 70 gave castle 6 at 23.4 d against 22.2 d and castle 8 at 45.6 d against 41.6 d, so most of the early gap is seed noise; the new mechanics add roughly 8-10 % to income in the late game (the same run with every new mechanic switched off, `--set=` overrides, reached castle 10 at 68.8 d). That is inside the 10-15 % budget for this round, and the dedicated player now needs a bit under 10 weeks for castle 10 (the earlier target was 70-100 d, and the table in section 4 was measured before the free starting ring). If it needs to slow down again, lower `FARM_UPGRADES.*.effectPerLevel` first, then the product sell prices in `MERCHANT_RESOURCE_PRICES`.

Rebirth, same bots: the second run reaches castle 6 in 14.2 d after a first run of 21.5 d (66 %), and in 7.3 d after a castle-10 first run.

## Update: right-click buildings

Buildings moved from Grounds lots to any explored tile (cheap first four, then three-stage growth, see [03](03-formulas-and-scaling.md)). The bot now builds on the first free explored tile
whenever it has 3x the gold. One seed per profile, compared with the earlier 3-seed medians: castle 6 at 26 d idle (was 25 d), 23.5 d casual (28 d), 19.5 d hardcore (21.5 d),
the autoclicker profile 15.9 d (26 d); castle 10 at 83 d idle (82 d) and 65 d hardcore (63 d). Pacing stays within about 10 % except for the auto-clicker profile, which now has
more to spend its gold on; the long tail (castle 7-10) is unchanged.
