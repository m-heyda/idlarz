# Pacing

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The pace the economy is tuned for, and the bot simulation that checks it.

**Contents**

- Targets: [Pacing targets](#pacing-targets)
- Magnitude targets: [`MAGNITUDE_BANDS`](#magnitude-bands)
- The sim: [The pace sim engine](#the-pace-sim-engine), [The pace sim](#the-pace-sim), [The pace profiles](#the-pace-profiles), [The bot's spending](#the-bot-s-spending), [The parallel sim runner](#the-parallel-sim-runner), [The local sim runner](#the-local-sim-runner), [The class picker acceptance](#the-class-picker-acceptance)

## Targets

<a id="pacing-targets"></a>

### Pacing targets

Source: [`scripts/pace/report.ts:1`](../../scripts/pace/report.ts)

What pace the economy is tuned for, why, and how to check it. The measured numbers are **not** copied here: they live in `docs/generated/pace-milestones.md` (`npm run pace`, refreshed by `npm run docs:gen`) and `docs/generated/balance-tables.md`.
Open balance questions are in `docs/plan/ROADMAP.md`.

| Stage | Target |
| --- | --- |
| First ~100 tiles | easy: hours for an active bot, between a day and a half and two days for the `human` profile (the four free start tiles make the first hours a little slower than the old 3x3 start) |
| 200-300 tiles | a 2-3 day project |
| After 300 tiles | clearly steeper (the `(n/300)^3.5` tail, [`tilePrice`](economy.md#tileprice)); a map of tens of thousands of tiles stays buyable |
| First Rebirth (castle 6 + 400 tiles) | around day 5-7 for a person who checks in a few times a day (to become about day 4-6 when the shorter castle timers and cheaper early castle costs of `docs/plan/19-first-build-steps.md` ship) |
| Every later run | faster than the run before it (castle 6 again in roughly 60-70 % of the first run), flattening after the third run because the castle timers bound it |
| Level 80 / 100 | about the 3rd / 10th rebirth (the level curve is lifetime and carries over a rebirth, [`LEVELING`](progression.md#leveling)) |
| First 10 minutes | first tile at about a minute, first animal before the first castle upgrade |

**What the pace rests on**

- **Castle timers are the floor of the first run.** Levels 2-6 take 30 min, 2 h, 6 h, 12 h and 24 h (1 d 20 h 30 min in all), levels 7-10 another 1.5, 2, 2.5 and 3.5 days (11 d 8 h 30 min to castle 10); Master Builders shortens them, a second builder (Gem shop Builder #2) runs a building next to the castle.
  The cost of 5 to 6 is what a player who plays a few times a day must be able to pay while the 4 to 5 timer runs, so a player who hoards instead of selling must not be locked out of it (the sim's `human` never sells surplus on purpose).
- **Tile price in materials** ([`TILE_RESOURCE_COST`](economy.md#tile-resource-cost)). The sim prints, per tile count, the minutes the income needs to cover what is missing of each part of the next tile (table at the end of `pace-milestones.md`).
  Gold must stay the biggest number; if hide or stone becomes the limiter, adjust the farm (pigs make hide, Tannery +25 %, Pasture +8 %) rather than the share.
- **Tile XP is small on purpose** (`BASE_XP_PER_TILE` 45) and the level curve is slow and lifetime, so levels come from passive XP, kills and rebirth-paced play, not from buying tiles.
- **Combat is in the sim**: the `human*` profiles fight a normal monster every 900 s and the plain boss every 3 h with a gear schedule (starter kit, knight gear from day 1.5, obsidian from day 5; an assumption taken from `docs/generated/fight-sim.md`), paying the real kill income.
- **Away time is in the sim for the `human*` profiles**: outside the playing hours the kingdom pays half its income for at most 8 hours of a gap (the server's rule, [`computeOfflineGrant`](saves-and-server.md#computeofflinegrant)); the reference bots keep the game open all day.

**Caveats.** The `human` is one calibration point, not a measurement of players; the bots still beat it by 2-3x. The `human*` profiles were calibrated (about 185 tiles after 3.3 days) before the away rule was in the sim, so their pace is now slower than the owner's measured run
until the knobs `PACE_DECISION`, `PACE_TILES` and `PACE_HOARD` are fitted again. Luck is 0 everywhere. "Max the rebirth shop" is a later design (ROADMAP); the `human-rebirth6-economy` and `-full` profiles show what the shop plans are worth.
If the first run must be longer once more content exists, lengthen `CASTLE_UPGRADE.durationsSec` and keep an eye on the minutes-to-cover table.

See also: [`MAGNITUDE_BANDS`](pacing.md#magnitude-bands), [`CASTLE_UPGRADE`](economy.md#castle-upgrade)

## Magnitude targets

<a id="magnitude-bands"></a>

### `MAGNITUDE_BANDS` <small>const</small>

Source: [`scripts/pace/report.ts:131`](../../scripts/pace/report.ts)

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

<a id="the-pace-sim-engine"></a>

### The pace sim engine

Source: [`scripts/pace/run.ts:1`](../../scripts/pace/run.ts)

The pace sim's engine (`scripts/pace/run.ts`): a bot drives the **real store** (the same actions the buttons call) with a seeded RNG and a game clock it moves itself. What makes it fast:

- **Clicks are batched.** The old sim called `clickForGold` for every click (1.4 million store updates for 12 days of `hardcore`). Here a private copy of the click limiter ([`createClickLimiter`](economy.md#createclicklimiter), the same two buckets) decides how many of
  the step's clicks are paid, one real `clickForGold` gives the gold of a click, and one `addResources` pays the rest.
- **The clock jumps to the next thing that can change.** A step is 20 s in the first quarter hour of a run, 60 s while the player plays, 300 s (the store's longest tick) while away, and is cut short at the next whole hour (the playing
  windows start and end on one), at the end of a castle or building timer, and at the next decision of a person who only checks in now and then.
- **Away time follows the server's rule** for the profiles with `away` (the `human*` ones): the kingdom pays `offlineEfficiency` of its income for at most `offlineCapHours` of a gap, the timers run at full speed, and the player buys nothing.

What the bot also plays now: **Builder #2** and the daily gems (Gem shop), the Ember shop **plans** and the merchant's gold upgrades, and the **rocks** (one per 15 minutes, room for one per 50 tiles; their clicks are taken from the gold clicks).
Rocks pay stone and coal (`rollRockLoot`); the ingredients are counted, not spent. The fights use the gear schedule below; Luck is 0.

<a id="the-pace-sim"></a>

### The pace sim

Source: [`scripts/pace.ts:1`](../../scripts/pace.ts)

The pace sim (`npm run pace`): bots play the **real game store** with a seeded RNG and report when they reach each milestone (tiles, castle levels, click power, levels, the first possible rebirth, every rebirth and what it paid).
The engine is `scripts/pace/run.ts`, the profiles `scripts/pace/profiles.ts`, what they buy `scripts/pace/policies.ts`, the tables `scripts/pace/report.ts`.

  npx tsx scripts/pace.ts                       every shared profile, writes docs/generated/pace-milestones.md and pace-baseline.json
  npx tsx scripts/pace.ts human human-rebirth6  the named profiles
  npx tsx scripts/pace.ts --seeds=3             median and min-max over 3 seeds
  npx tsx scripts/pace.ts --no-write human      print only (tuning runs; a run that does not cover every shared profile never writes)
  npx tsx scripts/pace.ts --except=hardcore-rebirth6-x10   every profile but the named ones (comma separated)
  npx tsx scripts/pace.ts --maxdays=60          stop early
  npx tsx scripts/pace.ts --class=mage          every profile plays that hero class (`none` is the neutral baseline); a class run writes nothing (`npm run pace:classes`)
  npx tsx scripts/pace.ts --set=SCALING_CONFIG.growthLate=1.25   try a tweak without editing files
  npx tsx scripts/pace.ts --list / --list-local print the shared / local-only profile names
  npx tsx scripts/pace.ts --dump=shard.json p1 p2   run the profiles and save the raw results only (a CI shard)
  npx tsx scripts/pace.ts --merge=dir           run nothing: merge the dumps in dir (every shared profile exactly once) and write the docs as a full run does

**Rules for a balance change**: change one parameter group, run `npm run pace -- --seeds=3`, compare with the committed `pace-milestones.md`, keep the targets, then `npm run docs:gen:fast` and commit the diff. The pacing guard (`comparePacing`) compares the
baseline with the base branch in CI. A profile that is not in the shared list (`localOnly`) is run by name and writes nothing: `npm run pace:local`.

<a id="the-pace-profiles"></a>

### The pace profiles

Source: [`scripts/pace/profiles.ts:1`](../../scripts/pace/profiles.ts)

The player profiles of the pace sim, as plain data. A profile says **who plays** (clicks per second, the hours of the day, how it spends) and **what it buys** (the Ember plan, the merchant's gold upgrades,
the Gem shop); `scripts/pace/run.ts` turns it into a run of the real store. A profile with `localOnly` is not in the default run, `--list`, the CI shards, the merge or `docs/generated`.

| Group | Profiles |
| --- | --- |
| Reference bots | `idle`, `casual`, `hardcore`, `autoclicker` (24 h of perfect play, an upper bound) |
| One-run and rebirth bots | `hardcore-rebirth6`, `hardcore-rebirth10`, `hardcore-rebirth6-x10` (ten runs, fits the level anchors) |
| The owner's pace | `human`, `human-rebirth6`, `human-rebirth8`: one click a second, 8-9, 12-13 and 18-23, a visit once an hour, at most 8 tiles per visit, never sells surplus |
| The shop | `human-rebirth6-builder2` (Builder #2 bought on day 0), `human-rebirth6-gems` (Builder #2 bought when the daily bonus has paid 1000 gems), `human-rebirth6-economy`, `human-rebirth6-full` (the Ember plans) |
| The clicker | `hardcore-clicker`: 300 clicks a minute (the limiter's maximum) for 10 h a day, Click Mastery first, gold traded for every missing resource so tiles come before the castle, ten rebirths at castle 6 |
| Rocks | `hardcore-rebirth6-rocks`: the hardcore bot that also mines the rocks |
| Local probes | `maximized` (everything bought, rebirth at the highest castle the shop allows, 15 rebirths: how fast the numbers run away), the `max-*` optimisers and the long `x20` / `x10` runs: `npm run pace:local` |

<a id="the-bot-s-spending"></a>

### The bot's spending

Source: [`scripts/pace/policies.ts:1`](../../scripts/pace/policies.ts)

What the bots buy, one function per spending decision (the pace sim, `scripts/pace/run.ts`). Each takes the `Bot` (the run's state and the real store) and calls the store's own actions, exactly as a button would:
the Ember shop (`spendEmbers`, a plan per profile), the merchant's gold upgrades, the Gem shop (Builder #2), the castle, the buildings, click power, animals, farm upgrades, tiles and the sale of what is left over.
Rocks and fights are in `run.ts` because they take the clicks and the clock.

<a id="the-parallel-sim-runner"></a>

### The parallel sim runner

Source: [`scripts/pace-parallel.ts:1`](../../scripts/pace-parallel.ts)

`npm run pace:parallel`: the full sim on all your cores. `scripts/pace.ts` plays one profile after another on one core; CI already runs the profiles as shards (`--dump`) and puts them together
(`--merge`), whose result is byte-identical to one full run. This script does the same on one machine: one child process per profile (at most `--jobs=N`, default the number of cores minus one), then
the merge. The wall time drops from the sum of all profiles to about the slowest one (`hardcore-rebirth6-x10`).

  npm run pace:parallel                      every profile, writes docs/generated like `npm run pace`
  npm run pace:parallel -- --seeds=3         the flags of pace.ts (`--seeds`, `--maxdays`, `--set`, `--legacy`, `--no-write`) go to every shard and to the merge
  npm run pace:parallel -- --jobs=4          limit the processes (each needs about 1 GB)

Needs no profile names (it always runs all of them, the merge insists on that); for one profile use `npm run pace -- <name>`.

<a id="the-local-sim-runner"></a>

### The local sim runner

Source: [`scripts/pace-local.ts:1`](../../scripts/pace-local.ts)

`npm run pace:local`: the long and advanced sims, on your machine only (IDL-276). It runs the local-only profiles of `scripts/pace.ts` (`maximized`, `hardcore-rebirth6-x20`, `hardcore-rebirth8-x10` and the `max-*` optimisers), one child
process per profile on all your cores (at most `--jobs=N`, default the cores minus one, at most 6; each needs about 1 GB), and puts their tables into **`local-sims/pace-local.md`**. That folder is git-ignored: nothing here is
committed, read by CI, or compared by the pacing guard, and `docs/generated` is never touched (every child runs with `--no-write`). CI does not run these profiles at all, so a long sim never slows a pull request. A full run takes about
three minutes on 8 cores (one seed).

  npm run pace:local                                    every local-only profile
  npm run pace:local -- max-r10 max-ramp                only the named profiles (any profile name works; the output goes to the same file)
  npm run pace:local -- maximized                     the maximized run alone: everything bought, 15 rebirths
  npm run pace:local -- --seeds=3 --jobs=4              more seeds (slower), fewer processes

What the profiles are: `scripts/pace/profiles.ts`. Open them in a spreadsheet or paste the file into a Linear comment; run it again after a balance change to compare.

<a id="the-class-picker-acceptance"></a>

### The class picker acceptance

Source: [`scripts/pace-classes.ts:1`](../../scripts/pace-classes.ts)

`npm run pace:classes`: the class picker's pacing acceptance (IDL-70, IDL-78, RELEASE-PLAN B7). Plays `idle` and `casual` (or the profiles named on the command line) once with no class (the neutral baseline
the committed numbers are measured with) and once with each hero class, all at the same time in separate processes, then compares every guarded milestone of each class run with the baseline using the pacing guard's own rule
(`comparePacing`: +-15 % and 5 game days). The last line is the acceptance line, and the exit code is 1 when a class moves a milestone out of the band. Writes nothing under docs/.

  npm run pace:classes                       idle and casual, every class
  npm run pace:classes -- human --maxdays=60 other profiles and the other flags of pace.ts go through

The sim bots play the real store, so they carry the XP, tile-discount and fight passives; offline efficiency and chest speed act on the server's grants and tickets, which the sim does not model.
