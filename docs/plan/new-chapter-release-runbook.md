# New Chapter release runbook (0.3.0): fresh start for everyone

Owner decision 2026-11-11: the New Chapter is the **last free reset**. Every account keeps **its login and its reserved name**; everything else is cleared (kill counts, glossary, achievements, tutorial, everything), each player ends with exactly **1000 gems** and the **Early tester avatar**, and picks name, class and avatar again on the "A new chapter" screen. The full reset is IDL-283 (PR 212): it must be merged before the flip. This page is the order of operations for release day. The code is the source of truth for mechanics (`src/config/epoch.ts`, `src/lib/offline/chapter.ts`, `docs/reference/saves-and-server.md`); this page only sequences them. Tasks: IDL-253 (the flip), IDL-254 (checklist and rehearsal), IDL-279 (save compatibility).

## What the reset does, per thing

| Thing | After the flip |
| --- | --- |
| Auth account, email, password | kept |
| Reserved character name | kept (the player can change it on the chapter screen; a name another account holds is refused) |
| Gems (`player_ledger.gems`) | set to exactly 1000 (`STARTING_GEMS`), whatever the account held (decided 2026-11-11) |
| Class, avatar | chosen again on the chapter screen: only the starters and the Early tester avatar are offered (`earnedAfterReset`); no old unlock |
| Achievements (`player_achievements` rows and `stats.achievements`), kill counts, glossary, tutorial progress | all deleted / zeroed |
| Save, map, leaderboard row, rebirth log | deleted |
| Ledger: tickets, granted totals, combat, bag and gear, craft, buffs, rebirths, counters, stats, achievements | reset to new-game values; `run_id` and `ver` bumped so sealed rolls never repeat |
| The old game | archived first in a pinned `save_history` row flagged `epoch_archive`, never trimmed. If the copy fails the reset stops with nothing deleted |
| Browser keys of the old game | cleared by the epoch guard on the next load (`src/lib/epochGuard.ts`) |
| Early tester | accounts that predate epochs get the `early_tester` achievement |

## PRs that go out together (label `release-0.3`)

1. **Save compatibility** (IDL-279, PR 210) and **the full reset** (IDL-283, PR 212): merge these **first**. It is additive and changes nothing for the reset itself; its fixtures and guards should capture the shapes that ship.
2. **Release notes**: `content/changelog/0.3.0.md` (format in `content/changelog/README.md`; players' words, what changed in the game). Written on request, when the PR list is final.
3. **The flip**: one PR that changes `GAME_EPOCH` 1 to 2 in `src/config/epoch.ts` and nothing else. Merge **last**: merging it is the release.

Keep the two later PRs as drafts until step 4 below is green. Vercel failing on the free-plan rate limit is not a blocker.

## Before release day (nothing here changes players)

1. `npm run verify` green on `main` after the save-compat merge; `npm run docs:gen:fast` hash fresh. Run `npm run gen-save-fixtures -- --ids` and commit `tests/fixtures/saves/released-ids.json`: the list of shipped ids is closed at release time (it only ever grows), so the append-only guard protects every id that ships.
2. SQL: every migration the release needs is already applied (`supabase/migrations/*`, applied by the owner, SQL before code): at least `new_chapter_columns` (`player_ledger.stats`, `legacy`, `player_achievements`, `profiles.epoch`, `avatar_id`). Check `check-live-saves` section "new chapter dry run" says the columns exist.
3. `npm run check-live-saves` (read-only, same Supabase environment as production): accounts the flip would reset, how many hold a save, **name collisions and the forced renames they mean**, rows unreadable by today's rules. Fix or reset anything it reports before the flip.
4. Rehearsal on the test account (`lepryko@gmail.com`, the owner signs in by hand): `npm run reset-test-account`, then walk the chapter screen against a preview or staging with `GAME_EPOCH` raised there: pick name, class, avatar; first set the account's gems to a balance that is NOT 1000 (say 250), then confirm after the reset that the game starts empty, the gems are **exactly 1000**, the old achievements are gone and only the Early tester avatar is offered beyond the starters, the archive row exists in `save_history` (flag `epoch_archive`). Try a stale second tab: it must be refused (412 `stale_epoch`) and reload into the screen.
5. `restore-trust` dry run once against a real account (IDL-209) so the way back exists. Enforcement stays **off** at the flip (`ENFORCEMENT.enabled = false`, `EMBER_MODEL.requireServerRebirth = false`); it is turned on later, see the guide on `ENFORCEMENT` in `verify.ts`.
6. Secrets: new `LOOT_SECRET` per deployment, a placeholder in `.env.example` (RELEASE-PLAN 2.7). The reset invalidates every sealed roll anyway, so rotate it now, in the same deploy window.
7. Announce the downtime-free change if you want (the old tabs reload by themselves), and pick an hour with few players online.

### Rehearsal seeding (a rebirthed mid-game account in seconds)

Rehearsal step 4 above needs an account that has something to lose: a map, an Idol, a rebirth, a started tutorial, discovered monsters, gems that are not 1000, achievements. A rebirth takes hours of play and the dev console is gone, so `npm run seed-rehearsal` writes that state for ONE throwaway account through the server's own save path (revision, world hash, ledger and leaderboard row come out as if the server had written them; the profile epoch stays null). Use a throwaway fake-e-mail account that has signed in once (so it has a profile), never a real player. Nothing is stored that the game does not already store, so it is save-compatible; the script only ever reads and writes the one `--user`.

```bash
# 1. dry run: checks the account (e-mail, epoch null, empty) and prints what it would write, as counts only
npm run seed-rehearsal -- --user <uuid> --expect-email <the fake address>
```

```bash
# 2. apply: backs the rows up to backups/seed-rehearsal-<time>.json first, then seeds
npm run seed-rehearsal -- --user <uuid> --expect-email <the fake address> --yes
```

```bash
# the account already played a little (a save, achievements...)? Wipe it first through the reset-players path (backup first):
npm run seed-rehearsal -- --user <uuid> --expect-email <the fake address> --yes --force-fresh
```

```bash
# undo: puts the rows of that backup back (the current rows are backed up first)
npm run seed-rehearsal -- --restore backups/seed-rehearsal-<time>.json --user <uuid> --expect-email <the fake address> --yes
```

It refuses (and `--force-fresh` cannot override) a wrong e-mail, a missing profile, or a profile whose epoch is not null. Seeded state: one rebirth, 90 tiles, Idols forest 3 and plains 2 standing on the map (`legacy.idols` set), 250 gems, tutorial started and unfinished, three discovered monster types with kills, two achievements (`first_tile`, `first_fight`), a rebirth record. After it, sign in as that account (the browser drops any older local copy and loads the seeded game), then run rehearsal step 4: raise `GAME_EPOCH` on the preview, confirm the chapter screen, and check that the gems are exactly 1000 and the Idol record, tutorial, kills and achievements are gone. The numbers are `REHEARSAL_SEED` in `scripts/lib/rehearsalSeed.ts`.

## Release day

1. Merge the changelog PR (0.3.0).
2. Merge the flip PR (`GAME_EPOCH = 2`). Vercel deploys. From this moment `/api/auth/me` sends `epoch` and `needsReset`, and every request from a browser still on epoch 1 is refused until it reloads.
3. Do **not** run `reset-players`: the per-account chapter flow is the reset (each account resets itself when its owner confirms the screen). `reset-players` is the season tool and is not used for the flip.
4. Sign in yourself on production and confirm the chapter screen, a successful start, and a normal first save (`POST /api/save` accepted, rev 1).

## After the flip

1. Watch for a day, from what the server really emits: `POST /api/auth/epoch` answering **503 with `archiveFailed: true`** (the server also logs the event `chapter_archive_failed`, search for it), **409 with `nameTaken: true`** (not logged: count the 409s on that route in the Vercel logs), `stale_epoch` **412** counts settling to zero, first saves of new accounts accepted (not `invalid`).
2. `npm run check-live-saves` again: accounts still on epoch 1 are the players who have not come back yet; rows that were reset read as new-game saves.
3. Once nobody can still hold the old shape (the first reset has run for everyone who matters), delete `upgradeStoredBank` in `src/lib/offline/tickets.ts` (IDL-281). Not before.
4. From now on every PR follows the save-compatibility rule in `CLAUDE.md` and `docs/plan/save-compatibility.md`.

## If something goes wrong

- **A wave of errors on the chapter screen**: set `GAME_EPOCH` back to 1 in a one-line PR and deploy. The mechanism goes dark (nobody needs a reset, nothing is refused). Accounts that already reset stay reset, and their old game is in the `epoch_archive` row.
- **One player wants their old game back**: the pinned `epoch_archive` row in `save_history` holds the full body; restore it by hand through the same decode path (it is a normal save body; `docs/plan/save-compatibility.md` explains the upgrade chain if the schema moved).
- **A false anti-cheat flag on an honest account** (enforcement is off, so this only costs ranking): `npm run restore-trust -- --user <uuid>` (dry run first).
- **A migration of saved rows is needed later**: `npm run migrate-saves` (dry run, `--user`, backups first), see the save-compatibility doc.
