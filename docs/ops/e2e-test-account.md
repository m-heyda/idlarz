# 29 · The end-to-end test account

**Every test that needs a real login uses one account: `lepryko@gmail.com`.** No other account is used for browser tests, manual checks of the server, or experiments with saves. The account lives in the Supabase project that `.env.local` points at. Its password is never in the repo. Two ways to sign in:

- **By hand** (the default): the test opens Chrome and waits for the person to sign in.
- **From `.env.local`**: put `E2E_TEST_PASSWORD=...` in your git-ignored `.env.local` (the empty entry is in `.env.example`). `npm run e2e` then signs in through the app's own `/api/auth/login` route. `E2E_MANUAL_LOGIN=1` forces the by-hand path. Traces are off so the request body (the password) is never recorded. **Run this yourself in your own terminal; an assistant does not read `.env.local` or run the test with the password set.**

## Run a browser test

1. **Clear the account** so the run starts from a new game (dry run first, it only lists what it would do):

   ```bash
   npm run reset-test-account
   npm run reset-test-account -- --yes
   ```

   It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (environment or `.env.local`); check which project they point at.

2. **Run the smoke test**; without `E2E_TEST_PASSWORD` sign in when the browser window opens (the test waits up to ten minutes for the session). It fails if the account is not the test account:

   ```bash
   npm run e2e
   ```

   It starts the dev server on port 3004 (or reuses one that runs), opens your installed Chrome (`E2E_CHANNEL=chromium` uses Playwright's own browser after `npx playwright install chromium`), and runs `e2e/smoke.spec.ts`. It is a local run, not part of CI, because CI has no login and no test project.

## What the reset clears

`npm run reset-test-account` ([scripts/reset-test-account.ts](../../scripts/reset-test-account.ts)) finds the account by e-mail and runs [reset-players](reset-players-cli.md) for that one user with `--hard --reset-gems --purge-history --no-backup`:

| Cleared | Kept |
|---|---|
| the save: map, buildings, castle, level, XP, rebirths, Embers; worlds and stats | the login |
| the whole ledger: bag, gear, fight, spawn timers, tickets, rebirths | the profile (character name and class) |
| the rebirth history and the `save_history` rollback copies | |
| the gems, back to the starting amount | |

The e-mail is hard-coded (`e2e/account.ts`); the script has no option to point at another user. The browser the test used starts empty, so no local save is left to clear.

## What the smoke test covers

Signing in and the account check; the game opens on a new game; income arrives; a click on the map pays gold; a tile can be bought (through `window.__game`, which the dev server exposes); the game menu opens Settings; Save game and a reload bring the same map back.

**Not covered yet** (IDL-124 keeps these open): the monster growth badge, the battle queue markers and the Next strip, because they need a live fight and selectors checked against it; opening the Rebirth dialog (the button is locked on a new game, the test only checks that it is there); the offline report.
