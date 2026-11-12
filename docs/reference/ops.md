# Ops

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Commands, CI, the pacing guard, season resets and the E2E test account.

**Contents**

- Commands: [Commands and documentation generation](#commands-and-documentation-generation)
- CI: [The pacing guard and CI sharding](#the-pacing-guard-and-ci-sharding), [The generated-docs inputs hash](#the-generated-docs-inputs-hash), [The local verify script and the pre-push hook](#the-local-verify-script-and-the-pre-push-hook)
- Operator guides: [Season restart (reset-players)](#season-restart-reset-players), [Checking live saves before a release](#checking-live-saves-before-a-release), [Giving a flagged account its trust back (restore-trust)](#giving-a-flagged-account-its-trust-back-restore-trust), [The end-to-end test account](#test-account-email), [Turning enforcement and the server-run rebirth on together](#turning-enforcement-and-the-server-run-rebirth-on-together), [Rehearsal seeding (seed-rehearsal)](#rehearsal-seeding-seed-rehearsal), [Rehearsal seeding (the pure part)](#rehearsal-seeding-the-pure-part)

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
| `npm run sim:local` | `tsx scripts/sim-local.ts` |
| `npm run sim:classes` | `tsx scripts/sim-classes.ts` |
| `npm run perf` | `tsx scripts/perf-world.ts` |
| `npm run test` | `tsx --test "tests/**/*.test.ts"` |
| `npm run report` | `tsx scripts/balance-report.ts` |
| `npm run reset-test-account` | `tsx scripts/reset-test-account.ts` |
| `npm run e2e` | `playwright test` |
| `npm run stat-audit` | `tsx scripts/stat-audit.ts` |
| `npm run reset-players` | `tsx scripts/reset-players.ts` |
| `npm run check-live-saves` | `tsx scripts/check-live-saves.ts` |
| `npm run restore-trust` | `tsx scripts/restore-trust.ts` |
| `npm run migrate-saves` | `tsx scripts/migrate-saves.ts` |
| `npm run seed-rehearsal` | `tsx scripts/seed-rehearsal-account.ts` |
| `npm run seed-dev-world` | `tsx scripts/seed-dev-world.ts` |
| `npm run gen-save-fixtures` | `tsx scripts/gen-save-fixtures.ts` |
| `npm run fight-sim` | `tsx scripts/fight-sim.ts` |
| `npm run perk-caps` | `tsx scripts/perk-caps.ts` |
| `npm run monster-ladder` | `tsx scripts/monster-ladder.ts` |
| `npm run catalog-report` | `tsx scripts/catalog-report.ts` |
| `npm run loot-sim` | `tsx scripts/loot-sim.ts` |
| `npm run kill-sim` | `tsx scripts/kill-sim.ts` |
| `npm run craft-sim` | `tsx scripts/craft-sim.ts` |
| `npm run docs:code` | `tsx scripts/docs-reference.ts` |
| `npm run docs:code:check` | `tsx scripts/docs-reference.ts --check` |
| `npm run docs:gen` | `npm run docs:gen:rest && npm run docs:gen:sim && npm run docs:gen:hash` |
| `npm run docs:gen:rest` | `npm run docs:gen:rest:quick && npm run docs:gen:rest:fights && npm run docs:gen:rest:loot` |
| `npm run docs:gen:rest:quick` | `npm run report && npm run stat-audit && npm run catalog-report && npm run kill-sim -- --md && npm run craft-sim -- --md` |
| `npm run docs:gen:rest:fights` | `npm run fight-sim -- --md && npm run monster-ladder -- --md` |
| `npm run docs:gen:rest:loot` | `npm run loot-sim -- --md` |
| `npm run docs:gen:sim` | `npm run sim:parallel` |
| `npm run docs:gen:hash` | `tsx scripts/gen-inputs.ts --write` |
| `npm run docs:gen:fast` | `tsx scripts/verify.ts --gen-only` |
| `npm run verify` | `tsx scripts/verify.ts` |
| `npm run docs:check` | `npm run docs:gen && git add -N docs/generated && git diff --exit-code docs/generated` |
| `npm run format` | `prettier --write .` |
| `npm run format:check` | `prettier --check .` |
| `npm run prepare` | `git config core.hooksPath .githooks && chmod +x .githooks/pre-commit .githooks/pre-push || exit 0` |
| `npm run assets:catalog` | `tsx scripts/assets-catalog.ts` |
| `npm run assets:catalog:check` | `tsx scripts/assets-catalog.ts --check` |
| `npm run storybook` | `storybook dev -p 6007` |
| `npm run build-storybook` | `storybook build` |

## CI

<a id="the-pacing-guard-and-ci-sharding"></a>

### The pacing guard and CI sharding

Source: [`scripts/pacing-guard.ts:1`](../../scripts/pacing-guard.ts)

The pacing guard, and how CI generates the docs.

`npm run sim` writes `docs/generated/sim-baseline.json`; CI (job `generated`) runs this script, which compares it with the copy on the base branch and fails the PR when a guarded milestone moves by more than +-15 % **or by more than 5 game days**
(`PACING_MAX_DRIFT_DAYS` in `scripts/pacingCompare.ts`; without it a milestone at day 220 could drift for a month inside 15 %). The job log starts with a table per profile (guarded milestones, how many moved, the largest move in percent and days).
Regenerating the baseline cannot hide a change, because the comparison is against the base branch. An intended pacing change carries the `pacing-change` label: the guard then prints the report and passes. The label is read when a run starts,
so after adding it **push a commit or close and reopen the PR** ("Re-run jobs" keeps the labels of the old run).

**Where the work runs.** The slow part (the sims and reports behind `docs/generated`) is done on your machine: `npm run verify` (also run by the `pre-push` hook) regenerates it in parallel on all cores when a file the generators read has changed, and writes `docs/generated/inputs.sha256` (`scripts/gen-inputs.ts`). In CI the job `hash` recomputes that hash (seconds). With a fresh hash the sims are skipped and the job `generated` only runs this guard on the committed baseline against the base branch's. With a stale hash (a PR that did not regenerate, or `main` moved) and always on a push to `main`, every night and on a PR labelled `verify-generated`, the full regeneration runs, sharded (`sim-x10` alone, `sim-rest`, and `docs:gen:rest:quick|fights|loot`; `generated` merges them, a profile in two shards or in none fails the merge, and the committed files must equal the result).

<a id="the-generated-docs-inputs-hash"></a>

### The generated-docs inputs hash

Source: [`scripts/gen-inputs.ts:1`](../../scripts/gen-inputs.ts)

The inputs hash of the generated docs: what lets CI trust `docs/generated` without running every sim again.

`npm run docs:gen` (the sim, the balance tables, the fight and loot reports ...) is deterministic and slow. Instead of repeating it on every pull request, `docs:gen` ends by writing
`docs/generated/inputs.sha256`: a SHA-256 over **every file the generators import** (found with esbuild from the entry scripts named in the `docs:gen:*` scripts of `package.json`, so a new
generator or a new import is picked up by itself) and over `package-lock.json`. Line endings are normalised, so Windows and Linux agree. If any of those files changes, the hash changes:
the committed docs may be stale. The CI job `hash` recomputes it (seconds): **fresh** means `docs/generated` was written for exactly these sources, so CI skips the sims; **stale** (a PR that did not run
`npm run docs:gen`, or `main` moved under it) means CI runs the full regeneration, as it always did, and fails if the committed files differ. So the hash is only a shortcut, never a reason to fail. The full
regeneration also runs on every push to `main`, every night and on a PR labelled `verify-generated`, so a hash written without really regenerating is found within a day.

  npx tsx scripts/gen-inputs.ts            print the current hash and whether the committed one matches (exit 0)
  npx tsx scripts/gen-inputs.ts --check    exit 1 when the committed hash is stale (the CI job `hash` runs it and picks fast or full by the result)
  npx tsx scripts/gen-inputs.ts --write    write docs/generated/inputs.sha256 (the last step of `npm run docs:gen`)
  npx tsx scripts/gen-inputs.ts --list     print the files that count

<a id="the-local-verify-script-and-the-pre-push-hook"></a>

### The local verify script and the pre-push hook

Source: [`scripts/verify.ts:1`](../../scripts/verify.ts)

`npm run verify`: everything CI checks, run here on all your cores before you push.

CI used to repeat the slow work (the sims behind `docs/generated`) on every pull request; now it skips it when the inputs hash says it was done (see `scripts/gen-inputs.ts`). This script does
it: formatting, types, lint, the unit tests and the reference docs check run **at the same time**, and when a file the generators read has changed (the hash is stale) it regenerates
`docs/generated` in parallel too (`sim:parallel` on all cores next to the three report groups) and writes the new hash. The `pre-push` hook (`.githooks/pre-push`) runs it, so a push is
refused while something would fail in CI. When it regenerated files it stops with "commit them" (a hook cannot commit for you); commit and push again.

  npm run verify                everything above; a tree that already passed (same HEAD tree, clean) is skipped
  npm run verify -- --force     ignore the "already verified" marker
  npm run verify -- --no-gen    skip the regeneration of docs/generated even when it is stale (CI will say so)
  npm run verify -- --gen-only  only the regeneration (what `npm run docs:gen:fast` runs)
  npm run verify -- --build     also `next build` (slow, CI runs it)

Skip the hook once with `SKIP_VERIFY=1 git push` or `git push --no-verify`. CI still fails what you skipped.

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
would refuse, how many players are in the middle of a castle upgrade, ledgers without a save or inventory. A last section is the new chapter dry run (IDL-254 item 2): accounts the flip would reset (and how many hold a save), name collisions with the forced renames they mean, and whether `player_ledger.stats` / `legacy` exist and how many rows are still null. It writes nothing. If it reports saves that would be refused, reset those players or write the conversion before the release.

<a id="giving-a-flagged-account-its-trust-back-restore-trust"></a>

### Giving a flagged account its trust back (restore-trust)

Source: [`scripts/restore-trust.ts:1`](../../scripts/restore-trust.ts)

The way back for a false-positive flag (IDL-209): `npm run restore-trust -- --user <uuid>` is a DRY RUN that shows what the account's save carries;
add `--yes` to really give the account its trust back ([`restoreTrust`](saves-and-server.md#restoretrust): flags cleared, ranking eligibility back, the income paid from the
stored game's own rates again). The save it replaces is pinned in `save_history` first, and one JSON audit line is printed (`event: 'trust_restored'`);
keep it with the ticket. Running it twice is safe (the second run says `already_trusted`).

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored .env.local); check which project they point at first (same rule as
reset-players). One account per run, on purpose. Judge the account BEFORE you restore it: if its claimed land is still worth more than the game could
have paid, the next save flags it again.

See also: [`restoreTrust`](saves-and-server.md#restoretrust)

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
(bag, gear, fight, spawn timers, tickets, rebirths), the rebirth history and the rollback copies, and puts the gems back to the starting amount (and clears the lifetime counters: kills, discovered monsters, tutorial progress, achievements). It keeps the login and the profile (character name and class); `-- --yes --new-character` deletes the profile and the earned achievements too, so the next login goes through character creation like a new player. The e-mail is hard-coded here; the script has no
option to point at another user.

The smoke test covers: signing in and the account check; the game opens on a new game; income arrives; a click on the map pays gold; a tile can be bought (by clicking a tile next to the land); the game menu opens Settings; Save game and a
reload bring the same map back. Not covered yet (IDL-124 keeps these open): the monster growth badge, the battle queue markers and the Next strip, opening the Rebirth dialog, the offline report.

<a id="turning-enforcement-and-the-server-run-rebirth-on-together"></a>

### Turning enforcement and the server-run rebirth on together

Source: [`src/lib/cloudSave/verify.ts:115`](../../src/lib/cloudSave/verify.ts)

**Turning enforcement on: `ENFORCEMENT.enabled` and `EMBER_MODEL.requireServerRebirth` together (IDL-208, IDL-211, IDL-209).**
Owner decision (IDL-254, item 10): both are OFF at the new chapter flip and turned on together some time after it. Do it in this order, one release, and tick every line:

1. The way back exists in production: `restoreTrust` / `npm run restore-trust` (IDL-209) is merged and you have run its dry run once against a real account. Enforcement is never on without it.
2. The flip has happened and has settled: `npm run check-live-saves` (read-only, same Supabase environment) shows the rows are readable by today's rules and its new chapter section looks as expected.
3. Read the `flagged` and `would be refused if enforcement were on` lines of that run. Honest accounts must produce zero refusals (`playtime_fast`, `gold_jump`, `gems_increase` on the allowlist). If one does, tune `VERIFY` or take that flag off `ENFORCEMENT.reject`; keep `tests/audit` green. Restore any honest flagged account with `restore-trust`.
4. Rebirth: no client that does not ask the server to rebirth (`askServerRebirth`) can still be open (a deploy plus a grace period), and the real flow was walked in a browser against real Supabase (Rebirth dialog "Asking the server...", refused toast, retry with the same key). Then `requireServerRebirth: true`; a rebirth without a `/api/rebirth` record keeps the old rebirth count.
5. One PR flips both switches (`ENFORCEMENT.enabled = true`, `EMBER_MODEL.requireServerRebirth = true`); `tests/server/serverRebirth.test.ts` and `tests/server/serverTrust.test.ts` pin the behaviour of both states.
6. Watch the `save_rejected` log lines (route `/api/save`) for the first days. A wave of refusals for honest players means: `ENFORCEMENT.enabled = false` (or remove one flag from `reject`), deploy, restore the affected accounts. Nothing was stored for a refused save, so nothing needs repairing.
7. Rollback of the pair: `enabled: false` and `requireServerRebirth: false`; no data migration is involved in either.

See also: [`ENFORCEMENT`](saves-and-server.md#enforcement), [`restoreTrust`](saves-and-server.md#restoretrust)

<a id="rehearsal-seeding-seed-rehearsal"></a>

### Rehearsal seeding (seed-rehearsal)

Source: [`scripts/seed-rehearsal-account.ts:1`](../../scripts/seed-rehearsal-account.ts)

Puts ONE throwaway account into a rebirthed mid-game state, fast, for the new chapter reset rehearsal (`docs/plan/new-chapter-release-runbook.md`, "Rehearsal seeding"). The dev console is gone and a real rebirth takes hours, so this writes the
state through the server's own save path instead (`scripts/lib/rehearsalSeed.ts` says what the account ends up holding). It reads and writes exactly one account and nothing else.

  npm run seed-rehearsal -- --user <uuid> --expect-email <address>                 DRY RUN (the default): checks the account, prints what it would do as counts, writes nothing
  npm run seed-rehearsal -- --user <uuid> --expect-email <address> --yes           backs the account up to `backups/seed-rehearsal-<time>.json`, then seeds it
  npm run seed-rehearsal -- ... --yes --force-fresh                                 first wipes the account's game data (backup first, then the `reset-players` path with --hard), then seeds it
  npm run seed-rehearsal -- --restore <file> --user <uuid> --expect-email <address> [--yes]   puts the rows of a backup back (the account's current rows are backed up first)

**Safety.** `--user` and `--expect-email` are both required. The run refuses unless the account's auth e-mail equals `--expect-email` (never printed) and its profile epoch is null (the pre-flip state the rehearsal needs; neither can be forced).
An account that already holds game data (a save, a leaderboard row, ledger progress, history, rebirth records, achievements), or looks like a real player (more than one rebirth, more than 400 tiles or 120 levels), is refused unless `--force-fresh` wipes it first.
Output is counts and words only: no e-mail, name, id or number out of a game, and no database error text. The profile is never written (the epoch stays null). The browser of the account is told to drop its local copy of an older game (`player_reset` marker),
so it loads the seeded one.

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or the git-ignored `.env.local`): they decide which project is touched, so check them first. This is operator tooling: it is run by hand, never by the app or CI.

See also: `applySeed`, `judgeAccount`

<a id="rehearsal-seeding-the-pure-part"></a>

### Rehearsal seeding (the pure part)

Source: [`scripts/lib/rehearsalSeed.ts:1`](../../scripts/lib/rehearsalSeed.ts)

The pure part of `npm run seed-rehearsal` (`scripts/seed-rehearsal-account.ts`): builds the game, the ledger and the achievements that put ONE throwaway account into a rebirthed mid-game state, writes them through the
server's own save path, and decides whether an account may be seeded at all. No database client lives here: the storage is passed in (`SeedRepos`), so the unit test runs the whole thing against in-memory repos.

**What the seeded account looks like**

| Part | Where it lives | Value |
| --- | --- | --- |
| Rebirthed once | save (`prestige`), ledger (`rebirths`, `runId`), `rebirth_history` | the store's own `rebirth()` ran on a 400-tile castle-6 game, so Embers, the kit and the point conservation are the real ones |
| Mid-game map | save + world | `REHEARSAL_SEED.tiles` owned tiles after the rebirth, an Idol standing on a forest and a plains tile |
| Idols | ledger `legacy.idols` and the save's `idolLevels` | forest 3, plains 2 (the server's record and the claim agree, so nothing is cut back) |
| Gems | ledger `gems` (the server's balance) | 250, not the 1000 gift |
| Tutorial | ledger `stats.tutorial` | started, unfinished: the first two path steps and the intro done |
| Monsters | ledger `stats.kills`, `stats.seen` | three discovered types, a few kills each |
| Achievements | ledger `stats.achievements` and `player_achievements` | two (no gems are paid: the rows are written, not earned) |
| Profile epoch | `profiles.epoch` | **untouched** (null before the release flips `GAME_EPOCH`) |

**Why it is accepted as a normal save.** The ledger row is written first (run 2, rebirths 1, the Idol record, the counters, the gems), then the save goes through [`acceptSave`](saves-and-server.md#acceptsave) exactly as `POST /api/save` does it (revision 1 from base 0,
world hash, summary, leaderboard row, history copy), so the stored rows are the ones the server itself would have written, and the rebirth is logged with the server's own `rebirthRecordOf`. The game is long enough (`playSeconds`) that
the first-save Ember and XP bounds hold, so no flag is raised.

See also: [`acceptSave`](saves-and-server.md#acceptsave), [`startNewChapter`](saves-and-server.md#startnewchapter)
