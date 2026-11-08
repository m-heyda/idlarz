# 06 · Pacing targets

What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in [generated/sim-milestones.md](../generated/sim-milestones.md) (`npm run sim`, refreshed by `npm run docs:gen`) and [generated/balance-tables.md](../generated/balance-tables.md). Open balance questions are in the [ROADMAP](../plan/ROADMAP.md).

## Targets

| Stage | Target |
| --- | --- |
| First ~100 tiles | easy: hours for an active bot, between a day and a half and two days for the `human` profile (the four free start tiles make the first hours a little slower than the old 3x3 start) |
| 200-300 tiles | a 2-3 day project |
| After 300 tiles | clearly steeper (`(n/300)^3.5` tail, [economy.md](economy.md) §3); a map of tens of thousands of tiles stays buyable |
| First Rebirth (castle 6 + 100 tiles) | available around day 5-7 for a person who checks in a few times a day (**to become about day 4-6** when the shorter castle timers and cheaper early castle costs of [19](../plan/19-first-build-steps.md) ship; the sim measured 4.6 d for the `human` profile) |
| Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
| Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, [progression.md](progression.md) §1) |
| First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |

## What the pace rests on

- **Castle timers are the floor of the first run.** Levels 2-6 take 30 min, 2 h, 6 h, 12 h and 24 h (1 d 20 h 30 min in all), levels 7-10 another 1.5, 2, 2.5 and 3.5 days (11 d 8 h 30 min to castle 10); Master Builders (Ember shop) shortens them. The cost of 5→6 is what a player who plays a few times a day must be able to pay while the 4→5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
- **Tile price in materials** (`TILE_RESOURCE_COST`): wood 30 %, stone 20 % from tile 15, coal 20 % from 30, food 10 % from 40, hide 2 % from 100. The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `sim-milestones.md`). Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (deer and pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
- **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
- **Combat is in the sim**: the `human*` profiles fight a rat every 900 s and the King every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from [generated/fight-sim.md](../generated/fight-sim.md)), paying the real kill income.

## The sim (`scripts/sim.ts`)

A bot drives the **real store** with a seeded RNG. Profiles: `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound), `human` (one click a second, plays 8-9, 12-13 and 18-23, a visit once an hour, at most 8 tiles per visit, never sells surplus; calibrated to about 185 tiles after 3.3 days like the owner's real run), `human-rebirth6` / `-rebirth8`, `hardcore-rebirth6` / `-rebirth10` and `hardcore-rebirth6-x10` (ten runs, used to fit the level anchors). "finished" in the table = castle 6 + best click power + the Rebirth territory.

```bash
npm run sim -- --seeds=3 hardcore      # median and min-max over 3 seeds
npm run sim -- --no-write human        # print only
npm run sim -- --set=SCALING_CONFIG.growthLate=1.25   # try a tweak without editing files
```

Rules for a balance change: change one parameter group, run `npm run sim -- --seeds=3`, compare with the committed `sim-milestones.md`, keep the targets above, then `npm run docs:gen` and commit the diff.

## Magnitude targets (decided 2026-11-07, IDL-128)

Measured with the real store (`casual`, trace to day 16; `human-rebirth8`, `hardcore-rebirth6-x10`) and set as the design ceiling every cap decision is checked against. "Income multiplier" is total income at castle 10 relative to run 1 at castle 10, all sources together (Embers, gear, Idols, Monument, Paragon).

| Checkpoint | Gold per second | Income multiplier | Lifetime Embers | Unspent gold |
| --- | --- | --- | --- | --- |
| Run 1, castle 10 (day ~13, ~850 tiles) | 3,000 to 6,000 (today ~4,500 to 5,500; was 2,500 to 5,000 before the gentler tile tail, IDL-181) | x1 | 0 | <= 4 h |
| Rebirth 5 (run 6 at castle 10) | x3 to x6 of run 1 | **x4** | about 90 to 140 with rebirths at castle 6, 350 to 500 at castle 8 | <= 4 h |
| Rebirth 10 (run 11 at castle 10) | x7 to x15 of run 1 | **x10** | about 190 to 300 with rebirths at castle 6 | <= 4 h |

- **Embers per rebirth** (moved 2026-11-08 to fit the decided formula `3 x (castle - 5)^1.3 x (sqrt(tiles / 10) + 0.02 x surplus)`, IDL-183, with the +50 tiles per rebirth of IDL-181): castle 6 about 18 to 28 (400 to 460 tiles), castle 8 about 70 to 100 (450 tiles), castle 10 about 400 to 650 (850 to 1,000 tiles; it was 80 to 130, which no territory reaches with this formula). The lifetime-Embers column above follows from these (about n x the per-rebirth band).
- **Stocks:** any non-gold resource at most 24 hours of its production rate at castle 10; above it the sim warns (today food reaches about 15 hours, 235M at day 12). The merchant, autoSell and the Monument are the sinks.
- **Ember path alone** (`1 + 0.1 x E^0.6`): x4 to x6 at 300 to 600 lifetime Embers; capped gear, Idols and the Monument add about x2.5 on top, which is how x10 at rebirth 10 is reached without Paragon doing the heavy lifting.
- **Finding to keep in mind:** `human-rebirth8` finishes run 2 in 99 % of run 1's time (castle timers set the pace), while hardcore falls to 48 to 72 %. The run-2 ratio of 60 to 70 % is therefore a hardcore-profile target; humans feel the Ember gain as bigger numbers and a larger map, not as shorter runs.
- **Sim print (built, IDL-128):** `npm run sim` adds a "Magnitude targets" section to `generated/sim-milestones.md`: per profile, gold per second, unspent gold and the biggest stock at castle 10 of run 1, Embers per rebirth by castle level, lifetime Embers after rebirth 5 and 10, and the income multiplier, each with its band and a status; lines outside a band are also printed as `WARNING` on stderr (the run does not fail). The bands are `MAGNITUDE_BANDS` in `scripts/sim.ts`: change them here and there together. The multiplier compares the same castle level in two runs because the bots rebirth before castle 10, so it is an indication. The existing +-15 % pacing guard (IDL-17) is separate.
- **What it says now (2026-11-08, after IDL-183, IDL-181 and the moved bands; 8 lines outside):** the Ember rows are inside their bands; the lines still outside are the late-game gold (unspent gold at castle 10 is 467 to 1,966 hours of income for every bot except `casual`, band 4, the food stock reaches 63 hours for the hardcore bots and the `human` bot hoards 145 hours of hide, band 24: cheaper late tiles are bought sooner and nothing absorbs the gold; Monument IDL-185, autobuyers IDL-195). The income multiplier is only judged at castle 10 (the bots rebirth at castle 6, so those rows show the ratio as an indication with no status; the full-game sources, capped gear, Idols and the Monument, are not built yet). Tiles 10 to 300 did not move with IDL-181; level 80 comes sooner (hardcore 13.2 to 9.1 days) because the cheaper late tiles give more tile XP.

## Caveats

- The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x.
- After the first rebirth the sim bot spends its Embers builders-first and stops getting faster after the third run; "max the rebirth shop" is a later design ([ROADMAP](../plan/ROADMAP.md)).
- If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.
