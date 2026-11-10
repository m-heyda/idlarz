/**
 * The one account every end-to-end test signs in with (docs/reference/ops.md). The password is never in the repo: the person running the test types it.
 *
 * **Every test that needs a real login uses one account: `lepryko@gmail.com`.** No other account is used for browser tests, manual checks of the server, or experiments with saves. The account lives in the Supabase project that `.env.local` points at.
 * Its password is never in the repo. Two ways to sign in: **by hand** (the default; the test opens Chrome and waits for the person to sign in) or from `.env.local` (`E2E_TEST_PASSWORD=...` in your git-ignored `.env.local`; `npm run e2e` then signs in through
 * the app's own `/api/auth/login` route; `E2E_MANUAL_LOGIN=1` forces the by-hand path; traces are off so the password is never recorded). **Run this yourself in your own terminal; an assistant does not read `.env.local` or run the test with the password set.**
 *
 * 1. **Clear the account** so the run starts from a new game: `npm run reset-test-account` (dry run), then `npm run reset-test-account -- --yes`. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check which project they point at.
 * 2. **Run the smoke test**: `npm run e2e`. Without `E2E_TEST_PASSWORD` sign in when the browser window opens (the test waits up to ten minutes). It fails if the account is not the test account. It starts the dev server on port 3004 (or reuses one that runs),
 *    opens your installed Chrome (`E2E_CHANNEL=chromium` uses Playwright's own browser) and runs `e2e/smoke.spec.ts`. It is a local run, not part of CI, because CI has no login and no test project.
 *
 * `reset-test-account` finds the account by e-mail and runs the season reset for that one user with `--hard --reset-gems --purge-history --no-backup`: it clears the save (map, buildings, castle, level, XP, rebirths, Embers, worlds and stats), the whole ledger
 * (bag, gear, fight, spawn timers, tickets, rebirths), the rebirth history and the rollback copies, and puts the gems back to the starting amount (and clears the lifetime counters: kills, discovered monsters, tutorial progress, achievements). It keeps the login and the profile (character name and class); `-- --yes --new-character` deletes the profile and the earned achievements too, so the next login goes through character creation like a new player. The e-mail is hard-coded here; the script has no
 * option to point at another user.
 *
 * The smoke test covers: signing in and the account check; the game opens on a new game; income arrives; a click on the map pays gold; a tile can be bought (through `window.__game`, which the dev server exposes); the game menu opens Settings; Save game and a
 * reload bring the same map back. Not covered yet (IDL-124 keeps these open): the monster growth badge, the battle queue markers and the Next strip, opening the Rebirth dialog, the offline report.
 *
 * @category Ops/Operator guides
 * @order 3
 * @title The end-to-end test account
 */
export const TEST_ACCOUNT_EMAIL = 'lepryko@gmail.com';
