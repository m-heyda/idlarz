# Ops

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Commands, CI, the pacing guard, season resets and the E2E test account.

**Contents**

- Commands: [Commands and documentation generation](#commands-and-documentation-generation)
- CI: [The pacing guard and CI sharding](#the-pacing-guard-and-ci-sharding)
- Operator guides: [Season restart (reset-players)](#season-restart-reset-players), [Checking live saves before a release](#checking-live-saves-before-a-release), [The end-to-end test account](#test-account-email)

## Commands

<a id="commands-and-documentation-generation"></a>

### Commands and documentation generation

Source: [`scripts/docs-reference.ts:1`](../../scripts/docs-reference.ts)

Commands. Generated reports go to `docs/generated` and are never edited by hand; the documentation of how the game works is generated from the JSDoc into `docs/reference` (`build`).

- `npm run docs:code` regenerates `docs/reference` from the JSDoc (seconds). The git pre-commit hook runs it for every commit and stages the result; `npm run docs:code:check` and `tests/docs/reference.test.ts` fail when it is stale.
- `npm run docs:gen` regenerates everything in `docs/generated` (report, sim, catalog-report, fight-sim, monster-ladder, loot-sim, kill-sim, craft-sim). Run it and commit the diff whenever balance values change; CI (job `generated`) fails a PR whose
  `docs/generated` differs from a fresh run. `npm run docs:check` is that gate in one local command (about 9 minutes, the sim is most of it).
- `npm run sim` is the bot simulation (see the Pacing page); `npm run perf` prints timings of the map at 5k / 50k / 250k tiles; `npm run lint`, `npm test` (node:test over every `*.test.ts` under tests/).
- Every npm script, computed from `package.json`:

**npm scripts (from package.json)** _(computed from the code)_

| Script | Runs |
| --- | --- |
| `npm run dev` | `next dev --turbopack` |
| `npm run build` | `next build` |
| `npm run start` | `next start` |
| `npm run lint` | `eslint . --max-warnings=0` |
| `npm run sim` | `tsx scripts/sim.ts` |
| `npm run sim:parallel` | `tsx scripts/sim-parallel.ts` |
| `npm run sim:classes` | `tsx scripts/sim-classes.ts` |
| `npm run perf` | `tsx scripts/perf-world.ts` |
| `npm run test` | `tsx --test "tests/**/*.test.ts"` |
| `npm run report` | `tsx scripts/balance-report.ts` |
| `npm run reset-test-account` | `tsx scripts/reset-test-account.ts` |
| `npm run e2e` | `playwright test` |
| `npm run stat-audit` | `tsx scripts/stat-audit.ts` |
| `npm run reset-players` | `tsx scripts/reset-players.ts` |
| `npm run check-live-saves` | `tsx scripts/check-live-saves.ts` |
| `npm run fight-sim` | `tsx scripts/fight-sim.ts` |
| `npm run perk-caps` | `tsx scripts/perk-caps.ts` |
| `npm run monster-ladder` | `tsx scripts/monster-ladder.ts` |
| `npm run catalog-report` | `tsx scripts/catalog-report.ts` |
| `npm run loot-sim` | `tsx scripts/loot-sim.ts` |
| `npm run kill-sim` | `tsx scripts/kill-sim.ts` |
| `npm run craft-sim` | `tsx scripts/craft-sim.ts` |
| `npm run docs:code` | `tsx scripts/docs-reference.ts` |
| `npm run docs:code:check` | `tsx scripts/docs-reference.ts --check` |
| `npm run docs:gen` | `npm run docs:gen:rest && npm run docs:gen:sim` |
| `npm run docs:gen:rest` | `npm run docs:gen:rest:quick && npm run docs:gen:rest:fights && npm run docs:gen:rest:loot` |
| `npm run docs:gen:rest:quick` | `npm run report && npm run stat-audit && npm run catalog-report && npm run kill-sim -- --md && npm run craft-sim -- --md` |
| `npm run docs:gen:rest:fights` | `npm run fight-sim -- --md && npm run monster-ladder -- --md` |
| `npm run docs:gen:rest:loot` | `npm run loot-sim -- --md` |
| `npm run docs:gen:sim` | `npm run sim:parallel` |
| `npm run docs:check` | `npm run docs:gen && git add -N docs/generated && git diff --exit-code docs/generated` |
| `npm run format` | `prettier --write .` |
| `npm run format:check` | `prettier --check .` |
| `npm run prepare` | `git config core.hooksPath .githooks && chmod +x .githooks/pre-commit || exit 0` |
| `npm run assets:catalog` | `tsx scripts/assets-catalog.ts` |
| `npm run assets:catalog:check` | `tsx scripts/assets-catalog.ts --check` |
| `npm run storybook` | `storybook dev -p 6006` |
| `npm run build-storybook` | `storybook build` |

## CI

<a id="the-pacing-guard-and-ci-sharding"></a>

### The pacing guard and CI sharding

Source: [`scripts/pacing-guard.ts:1`](../../scripts/pacing-guard.ts)

The pacing guard, and how CI generates the docs.

`npm run sim` writes `docs/generated/sim-baseline.json`; CI (job `generated`) runs this script, which compares it with the copy on the base branch and fails the PR when a guarded milestone moves by more than +-15 % **or by more than 5 game days**
(`PACING_MAX_DRIFT_DAYS` in `scripts/pacingCompare.ts`; without it a milestone at day 220 could drift for a month inside 15 %). The job log starts with a table per profile (guarded milestones, how many moved, the largest move in percent and days).
Regenerating the baseline cannot hide a change, because the comparison is against the base branch. An intended pacing change carries the `pacing-change` label: the guard then prints the report and passes. The label only takes effect on a new run,
so **re-run the job after adding it**.

**CI sharding.** The job `generated` is three stages: `scope` (does the PR touch what the docs come from), `generate` (a matrix that runs in parallel: the profile `hardcore-rebirth6-x10` alone, about 5 minutes; every other sim profile via `--except`;
the three groups `docs:gen:rest:quick|fights|loot` of the other generators; a new generator goes into one of those scripts), and `generated` (the required check), which downloads the shards, runs `sim --merge` and then the two gates (stale docs, pacing guard).
Wall time is about the slowest shard, not the sum. A new sim profile joins the `sim-rest` shard by itself; a profile in two shards or in none fails the merge.

## Operator guides

<a id="season-restart-reset-players"></a>

### Season restart (reset-players)

Source: [`scripts/reset-players.ts:1`](../../scripts/reset-players.ts)

Season restart: `npm run reset-players` gives every player a fresh game while keeping who they are. It talks to Supabase with the service role, so it is run by hand from a trusted machine, never from the app. The usage and flags are in the header
of the script. Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (environment or `.env.local`); they decide which project is wiped: check them first, and try one account with `--user` before running it for everyone.

| Data | Result |
| --- | --- |
| Auth account, `profiles` (`character_name`, `player_class`) | **kept** |
| `player_ledger.gems` | **kept** (a player with a save but no ledger row keeps the save's gems) |
| `player_saves` | **deleted**: level, XP, gold, castle, tiles, buildings, rebirths, everything in `core` |
| `player_worlds`, `player_stats` | deleted by cascade; the leaderboard row returns after the player's first new save |
| `player_ledger` (all but `gems`) | **reset** to new-game values: spawn timers and tickets, granted totals, combat, inventory (bag and gear), rebirths. `run_id` and `ver` are bumped, so sealed rolls never repeat across the restart |
| `rebirth_history` | **deleted** (the log of the season that ended; it is in the JSON backup). Needs the `rebirth_history` migration |
| `save_history` | kept by default (rollback copies); deleted with `--purge-history` |

Before a real reset the tool writes `backups/reset-<timestamp>.json` (gitignored: it holds player data). Procedure: run the dry run and check the player list and the project URL; do it while few people are online (a player with the game open must reload:
their old save no longer matches the server and is rejected, then they start a new game); run with `--yes`.

**Local copies in browsers.** The server side is fully reset, but a browser may still hold its own local save. The tool cannot touch browsers, so the client does it: the reset ships together with a `SAVE_SCHEMA` bump ([`SAVE_SCHEMA`](saves-and-server.md#save-schema)).
A local save of any older schema is refused ("from an older season, start a new game"). Gems stay the server's. After a later restart, bump `SAVE_SCHEMA` again in the same release.

**Undoing it**: restore from the JSON backup, or from `save_history` when it was kept (the latest copy per player is at most about 30 minutes older than their last save). There is no automated restore tool yet.

See also: [`ensureSeasonReset`](saves-and-server.md#ensureseasonreset)

<a id="checking-live-saves-before-a-release"></a>

### Checking live saves before a release

Source: [`scripts/check-live-saves.ts:1`](../../scripts/check-live-saves.ts)

Before a reset or a release that tightens the save rules: `npm run check-live-saves` is a read-only dry run (IDL-12; method in `docs/plan/14-server-audit-and-data-plan.md` section 6). Run it with the same Supabase environment **before** a release that
tightens the save rules or switches on `ENFORCEMENT` (the epoch reset IDL-76, IDL-208), and again after, to see what the reset left. It prints counts and reasons only: saves rejected and why, saves that would be clamped or flagged, how many `ENFORCEMENT`
would refuse, how many players are in the middle of a castle upgrade, ledgers without a save or inventory. It writes nothing. If it reports saves that would be refused, reset those players or write the conversion before the release.

<a id="test-account-email"></a>

### The end-to-end test account

Source: [`e2e/account.ts:23`](../../e2e/account.ts)

The one account every end-to-end test signs in with (docs/reference/ops.md). The password is never in the repo: the person running the test types it.

**Every test that needs a real login uses one account: `lepryko@gmail.com`.** No other account is used for browser tests, manual checks of the server, or experiments with saves. The account lives in the Supabase project that `.env.local` points at.
Its password is never in the repo. Two ways to sign in: **by hand** (the default; the test opens Chrome and waits for the person to sign in) or from `.env.local` (`E2E_TEST_PASSWORD=...` in your git-ignored `.env.local`; `npm run e2e` then signs in through
the app's own `/api/auth/login` route; `E2E_MANUAL_LOGIN=1` forces the by-hand path; traces are off so the password is never recorded). **Run this yourself in your own terminal; an assistant does not read `.env.local` or run the test with the password set.**

1. **Clear the account** so the run starts from a new game: `npm run reset-test-account` (dry run), then `npm run reset-test-account -- --yes`. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check which project they point at.
2. **Run the smoke test**: `npm run e2e`. Without `E2E_TEST_PASSWORD` sign in when the browser window opens (the test waits up to ten minutes). It fails if the account is not the test account. It starts the dev server on port 3004 (or reuses one that runs),
   opens your installed Chrome (`E2E_CHANNEL=chromium` uses Playwright's own browser) and runs `e2e/smoke.spec.ts`. It is a local run, not part of CI, because CI has no login and no test project.

`reset-test-account` finds the account by e-mail and runs the season reset for that one user with `--hard --reset-gems --purge-history --no-backup`: it clears the save (map, buildings, castle, level, XP, rebirths, Embers, worlds and stats), the whole ledger
(bag, gear, fight, spawn timers, tickets, rebirths), the rebirth history and the rollback copies, and puts the gems back to the starting amount. It keeps the login and the profile (character name and class). The e-mail is hard-coded here; the script has no
option to point at another user.

The smoke test covers: signing in and the account check; the game opens on a new game; income arrives; a click on the map pays gold; a tile can be bought (through `window.__game`, which the dev server exposes); the game menu opens Settings; Save game and a
reload bring the same map back. Not covered yet (IDL-124 keeps these open): the monster growth badge, the battle queue markers and the Next strip, opening the Rebirth dialog, the offline report.
