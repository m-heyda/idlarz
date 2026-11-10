# Pacing

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The pace the economy is tuned for, and the bot simulation that checks it.

**Contents**

- Targets: [Pacing targets](#pacing-targets)
- Magnitude targets: [`MAGNITUDE_BANDS`](#magnitude-bands)
- The sim: [The bot simulation](#the-bot-simulation), [The parallel sim runner](#the-parallel-sim-runner), [The class picker acceptance](#the-class-picker-acceptance)

## Targets

<a id="pacing-targets"></a>

### Pacing targets

Source: [`scripts/sim.ts:16`](../../scripts/sim.ts)

What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in `docs/generated/sim-milestones.md` (`npm run sim`, refreshed by `npm run docs:gen`) and `docs/generated/balance-tables.md`.
Open balance questions are in `docs/plan/ROADMAP.md`.

| Stage | Target |
| --- | --- |
| First ~100 tiles | easy: hours for an active bot, between a day and a half and two days for the `human` profile (the four free start tiles make the first hours a little slower than the old 3x3 start) |
| 200-300 tiles | a 2-3 day project |
| After 300 tiles | clearly steeper (the `(n/300)^3.5` tail, [`tilePrice`](economy.md#tileprice)); a map of tens of thousands of tiles stays buyable |
| First Rebirth (castle 6 + 400 tiles) | around day 5-7 for a person who checks in a few times a day (to become about day 4-6 when the shorter castle timers and cheaper early castle costs of `docs/plan/19-first-build-steps.md` ship; the sim measured 4.6 d for the `human` profile) |
| Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
| Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, [`LEVELING`](progression.md#leveling)) |
| First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |

**What the pace rests on**

- **Castle timers are the floor of the first run.** Levels 2-6 take 30 min, 2 h, 6 h, 12 h and 24 h (1 d 20 h 30 min in all), levels 7-10 another 1.5, 2, 2.5 and 3.5 days (11 d 8 h 30 min to castle 10); Master Builders shortens them.
  The cost of 5 to 6 is what a player who plays a few times a day must be able to pay while the 4 to 5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
- **Tile price in materials** ([`TILE_RESOURCE_COST`](economy.md#tile-resource-cost)). The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `sim-milestones.md`).
  Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (deer and pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
- **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
- **Combat is in the sim**: the `human*` profiles fight a normal monster every 900 s and the plains boss every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from `docs/generated/fight-sim.md`), paying the real kill income.

**Caveats.** The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x. After the first rebirth the sim bot spends its Embers builders-first and stops getting faster after the third run;
"max the rebirth shop" is a later design (ROADMAP). If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.

See also: [`MAGNITUDE_BANDS`](pacing.md#magnitude-bands), [`CASTLE_UPGRADE`](economy.md#castle-upgrade)

## Magnitude targets

<a id="magnitude-bands"></a>

### `MAGNITUDE_BANDS` <small>const</small>

Source: [`scripts/sim.ts:857`](../../scripts/sim.ts)

The bands of the magnitude targets (IDL-128): the table below is their one copy, the sim prints them next to the measured value.

Magnitude targets (decided 2026-11-07, IDL-128): measured with the real store (`casual`, trace to day 16; `human-rebirth8`, `hardcore-rebirth6-x10`) and set as the design ceiling every cap decision is checked against.
"Income multiplier" is total income at castle 10 relative to run 1 at castle 10, all sources together (Embers, gear, Idols, Monument, Paragon). The bands are the constants below: they are the only copy, the sim prints them next to the measured value
with a status (lines outside a band are also printed as `WARNING` on stderr, the run does not fail).

| Checkpoint | Gold per second | Income multiplier | Lifetime Embers | Unspent gold |
| --- | --- | --- | --- | --- |
| Run 1, castle 10 (day ~13, ~850 tiles) | 3,000 to 6,000 (was 2,500 to 5,000 before the gentler tile tail, IDL-181) | x1 | 0 | <= 4 h |
| Rebirth 5 (run 6 at castle 10) | x3 to x6 of run 1 | **x4** | about 90 to 140 with rebirths at castle 6, 350 to 500 at castle 8 | <= 4 h |
| Rebirth 10 (run 11 at castle 10) | x7 to x15 of run 1 | **x10** | about 190 to 300 with rebirths at castle 6 | <= 4 h |

- **Embers per rebirth** (fits the decided formula, IDL-183, with the +50 tiles per rebirth of IDL-181): castle 6 about 18 to 28 (400 to 460 tiles), castle 8 about 70 to 100 (450 tiles), castle 10 about 400 to 650 (850 to 1,000 tiles). See [`emberGain`](progression.md#embergain).
- **Stocks**: any non-gold resource at most 24 hours of its production rate at castle 10; above it the sim warns. The merchant, auto-sell and the Monument are the sinks.
- **Ember path alone** (`1 + 0.1 x E^0.6`): x4 to x6 at 300 to 600 lifetime Embers; capped gear, Idols and the Monument add about x2.5 on top, which is how x10 at rebirth 10 is reached without Paragon doing the heavy lifting.
- **Finding to keep in mind**: `human-rebirth8` finishes run 2 in 99 % of run 1's time (castle timers set the pace), while hardcore falls to 48 to 72 %. The run-2 ratio of 60 to 70 % is therefore a hardcore-profile target;
  humans feel the Ember gain as bigger numbers and a larger map, not as shorter runs.
- The multiplier compares the same castle level in two runs because the bots rebirth before castle 10, so it is an indication. The existing +-15 % pacing guard (IDL-17) is separate.

## The sim

<a id="the-bot-simulation"></a>

### The bot simulation

Source: [`scripts/sim.ts:1`](../../scripts/sim.ts)

The sim (`scripts/sim.ts`): a bot drives the **real store** with a seeded RNG and a mocked clock. Profiles: `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound), `human` (one click a second, plays 8-9, 12-13 and 18-23,
a visit once an hour, at most 8 tiles per visit, never sells surplus; calibrated to about 185 tiles after 3.3 days like the owner's real run), `human-rebirth6` / `-rebirth8`, `hardcore-rebirth6` / `-rebirth10` and `hardcore-rebirth6-x10`
(ten runs, used to fit the level anchors). "finished" in the milestone table = castle 6 + best click power + the Rebirth territory.

Flags: `--seeds=3` (median and min-max over 3 seeds), `--no-write` (print only), `--maxdays=60` (stop early), `--legacy` (approximate the pre-rebalance game), `--except=a,b` (every profile but the named ones), `--list` (print the profile names), `--class=mage` (every profile plays that hero class; the default `none` is the neutral baseline, and a class run writes nothing: `npm run sim:classes` measures all four against it, IDL-78),
`--dump=file.json` (run the profiles and save the raw results only: a CI shard), `--merge=dir` (run nothing: merge the dumps in dir, every profile exactly once, and write the docs), `--set=SCALING_CONFIG.growthLate=1.25` (try a tweak without editing files).

**Rules for a balance change**: change one parameter group, run `npm run sim -- --seeds=3`, compare with the committed `sim-milestones.md`, keep the targets, then `npm run docs:gen` and commit the diff. The pacing guard (`comparePacing`) compares the
baseline with the base branch in CI.

<a id="the-parallel-sim-runner"></a>

### The parallel sim runner

Source: [`scripts/sim-parallel.ts:1`](../../scripts/sim-parallel.ts)

`npm run sim:parallel`: the full sim on all your cores. `scripts/sim.ts` plays one profile after another on one core; CI already runs the profiles as shards (`--dump`) and puts them together
(`--merge`), whose result is byte-identical to one full run. This script does the same on one machine: one child process per profile (at most `--jobs=N`, default the number of cores minus one), then
the merge. The wall time drops from the sum of all profiles to about the slowest one (`hardcore-rebirth6-x10`).

  npm run sim:parallel                      every profile, writes docs/generated like `npm run sim`
  npm run sim:parallel -- --seeds=3         the flags of sim.ts (`--seeds`, `--maxdays`, `--set`, `--legacy`, `--no-write`) go to every shard and to the merge
  npm run sim:parallel -- --jobs=4          limit the processes (each needs about 1 GB)

Needs no profile names (it always runs all of them, the merge insists on that); for one profile use `npm run sim -- <name>`.

<a id="the-class-picker-acceptance"></a>

### The class picker acceptance

Source: [`scripts/sim-classes.ts:1`](../../scripts/sim-classes.ts)

`npm run sim:classes`: the class picker's pacing acceptance (IDL-70, IDL-78, RELEASE-PLAN B7). Plays `idle` and `casual` (or the profiles named on the command line) once with no class (the neutral baseline
the committed numbers are measured with) and once with each hero class, all at the same time in separate processes, then compares every guarded milestone of each class run with the baseline using the pacing guard's own rule
(`comparePacing`: +-15 % and 5 game days). The last line is the acceptance line, and the exit code is 1 when a class moves a milestone out of the band. Writes nothing under docs/.

  npm run sim:classes                       idle and casual, every class
  npm run sim:classes -- human --maxdays=60 other profiles and the other flags of sim.ts go through

The sim bots play the real store, so they carry the XP, tile-discount and fight passives; offline efficiency and chest speed act on the server's grants and tickets, which the sim does not model.
