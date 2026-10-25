# 06 · Playtest, pacing & the first rebalance pass

**Why:** a friend "finished" the live game in about 3 days. This document records what the playtest found, which fixes were applied first and why, and what the simulation says now. Applied items are *not* repeated in the backlog ([05](05-balance-backlog-and-roadmap.md)).

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

- The bots are one plausible strategy (castle-first, top up missing resources with gold, sell surplus). They tap tiles (about one click in eight), catch about half of the golden map critters and some farm critters, and buy Legacy upgrades, but they do not use the class picker. Numbers are good for *comparing changes*, not as absolute truth ([04 B7](04-unfinished-and-known-issues.md)).
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
