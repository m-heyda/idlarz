# 06 · Pacing targets

What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in [generated/sim-milestones.md](generated/sim-milestones.md) (`npm run sim`, refreshed by `npm run docs:gen`) and [generated/balance-tables.md](generated/balance-tables.md). Open balance questions are in the [ROADMAP](ROADMAP.md).

## Targets

| Stage | Target |
| --- | --- |
| First ~100 tiles | easy: hours for an active bot, about a day and a half for the `human` profile |
| 200-300 tiles | a 2-3 day project |
| After 300 tiles | clearly steeper (`(n/300)^4.5` tail, [03 §1](03-formulas-and-scaling.md#1-tile-cost)); a map of tens of thousands of tiles stays buyable |
| First Rebirth (castle 6 + 100 tiles) | available around day 5-7 for a person who checks in a few times a day |
| Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
| Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, [03 §2](03-formulas-and-scaling.md#2-xp-and-levels)) |
| First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |

## What the pace rests on

- **Castle timers are the floor of the first run.** Levels 2-6 take 1 h, 4 h, 12 h, 24 h and 48 h (3 d 17 h in all), levels 7-10 another 3, 4, 5 and 7 days (22 d 17 h to castle 10); Master Builders (Ember shop) shortens them. The cost of 5→6 is what a player who plays a few times a day must be able to pay while the 4→5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
- **Tile price in materials** (`TILE_RESOURCE_COST`): wood 30 %, stone 20 % from tile 15, coal 20 % from 30, food 10 % from 40, hide 2 % from 100. The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `sim-milestones.md`). Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (deer and pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
- **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
- **Combat is in the sim**: the `human*` profiles fight a rat every 900 s and the King every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from [generated/fight-sim.md](generated/fight-sim.md)), paying the real kill income.

## The sim (`scripts/sim.ts`)

A bot drives the **real store** with a seeded RNG. Profiles: `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound), `human` (one click a second, plays 8-9, 12-13 and 18-23, a visit once an hour, at most 8 tiles per visit, never sells surplus; calibrated to about 185 tiles after 3.3 days like the owner's real run), `human-rebirth6` / `-rebirth8`, `hardcore-rebirth6` / `-rebirth10` and `hardcore-rebirth6-x10` (ten runs, used to fit the level anchors). "finished" in the table = castle 6 + best click power + the Rebirth territory.

```bash
npm run sim -- --seeds=3 hardcore      # median and min-max over 3 seeds
npm run sim -- --no-write human        # print only
npm run sim -- --set=SCALING_CONFIG.growthLate=1.25   # try a tweak without editing files
```

Rules for a balance change: change one parameter group, run `npm run sim -- --seeds=3`, compare with the committed `sim-milestones.md`, keep the targets above, then `npm run docs:gen` and commit the diff.

## Caveats

- The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x.
- After the first rebirth the sim bot spends its Embers builders-first and stops getting faster after the third run; "max the rebirth shop" is a later design ([ROADMAP](ROADMAP.md)).
- If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.
