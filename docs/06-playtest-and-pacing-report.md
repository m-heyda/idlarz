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
| 4 | **Tiles**: cost curve ×1.45/tile to 20 then ×1.27 (was ×1.42 everywhere, tile 40 = 95 M → 10.8 M), **extra wood/stone/coal/food from larger territories**, biome yield ×1.3 | tiles stay a meaningful long-term sink and finally give wood/stone/coal/food a use (4, 5) |
| 5 | **Buildings cost resources** (×1.6 each), Blacksmith 0.1 → 0.07 | a choice instead of a free pick |
| 6 | **Chest timer pauses at the cap**, reward 10–60 min, +0.5 %/Luck; **farm critters** 45 s → ~10 s gifts, 20–40 s apart, one at a time, real clicks only | removes two easy bonuses (6) |
| 7 | **T1**: the hidden +10 % gold / +25 % XP modifier removed (modifiers start at 0); castle output has a single source of truth | honest numbers; part of the intended slowdown |
| 8 | **Clock/offline safety** (monotonic time, tick clamp), validated actions, encrypted IndexedDB saves ([07](07-security-and-exploits.md)) | closes the cheap exploits so the new pacing means something |

Tuning method: `npm run sim` (bots on the real store) — first reproduce the old behaviour with `--legacy`, then iterate the constants until the dedicated-human finish time was ≈ 4 weeks, an auto-clicker no better than ~1.06× that, and the first hours stayed quick (16 tiles in ≈ 4 h, castle 2 in ≈ 19 h).

## 3. Result (sim, new parameters)

From [generated/sim-milestones.md](generated/sim-milestones.md) (game time until the milestone is first reached):

| milestone | idle | casual (1 click/s, 3 h/day) | hardcore (4 clicks/s, 8 h/day) | autoclicker (20 clicks/s, 24 h/day) |
| --- | --- | --- | --- | --- |
| 16 tiles | 3.7 h | 3.7 h | 3.7 h | 0.7 h |
| castle 2 | 20 h | 20 h | 19 h | 16 h |
| castle 3 | 2.8 d | 3.1 d | 2.5 d | 1.7 d |
| castle 4 | 7.2 d | 6.3 d | 5.0 d | 3.9 d |
| castle 5 | 16.5 d | 15.3 d | 11.9 d | 10.6 d |
| 40 tiles | 34.5 d | 31.8 d | 13.5 d | 9.8 d |
| **finished** (castle 6 + best click + 40 tiles) | **35.8 d** | **33.2 d** | **27.4 d** | **28.6 d** |

For comparison the old parameters give 25.4 / 22.9 / 13.3 / **2.2** days for the same four bots. The auto-clicker went from 2.2 days to 28.6 days (≈ hardcore), while a dedicated human is ≈ 23 % faster than someone who never clicks. With 3 seeds (random biomes, critters, chests) the hardcore finish ranges 23.9–29.6 d (median 27.4) and the auto-clicker 24.2–28.6 d (median 27.2), so differences below about 10 % are noise. The autoclicker's early lead (16 tiles in 0.8 h) comes from the full long-run bucket at the start and from playing from midnight; the hardcore profile does not start until 07:00.

## 4. Endgame results (castle 7–10 and Rebirth)

Castle 7–10 take 3 d, 4 d, 5 d and 7 d to build (24 d 5 h in total with levels 2–6) and cost about 1.6× the previous step. Time until the milestone, game time, from the same sim:

| milestone | idle | casual | hardcore | autoclicker |
| --- | --- | --- | --- | --- |
| castle 6 | 35.8 d | 33.2 d | 27.4 d | 28.6 d |
| castle 7 | 51.0 d | 47.3 d | 39.8 d | 37.9 d |
| castle 8 | 68.4 d | 63.4 d | 54.6 d | 50.0 d |
| castle 9 | 88.8 d | 82.7 d | 71.0 d | 64.3 d |
| castle 10 | 115.3 d | 106.7 d | 92.3 d | 82.5 d |

Over 3 seeds the hardcore castle 10 is 82.8–92.3 d (median 90.9); the auto-clicker is about 10 % faster later because it plays 24 h a day and the late castle costs are mostly waiting plus the larger gold income. Target for the dedicated player was 70–100 d.

**Rebirth** (hardcore bot that rebirths at castle 6, 40+ tiles, and spends all points greedily): first run 27.4 d → 9 points, then castle 6 again after **20.2 d** (74 % of the first run), 15.7 d (run 3), 12.3 d (run 4). A bot that plays all the way to castle 10 first gets 51 points and reaches castle 6 in **8.8 d** on the second run (tiles 40 in 3.5 d). So rebirth is worth it early for about a quarter off the next run, and a late rebirth is a big boost but only after about three months. The shop is the soft cap: after the points are spent the only gain per extra point is the +5 % income.

## 5. Caveats and what is not decided

- The bots are one plausible strategy (castle-first, top up missing resources with gold, sell surplus). They tap tiles (about one click in eight), catch about half of the golden map critters and some farm critters, and buy Legacy upgrades, but they do not use the class picker. Numbers are good for *comparing changes*, not as absolute truth ([04 B7](04-unfinished-and-known-issues.md)).
- 4 weeks is the active-player target chosen for this pass; idle ≈ 5 weeks. The gap between active and idle is modest by design of the castle timers (5 d 5 h of mandatory waiting to castle 6).
- Remaining balance questions (levels/stat points, chest relevance, merchant depth, endgame) are in [05 §1](05-balance-backlog-and-roadmap.md).
- The old browser playtest numbers (tile purchase times, stockpiles) were measured on the pre-rebalance game and are kept only as the motivation above.
