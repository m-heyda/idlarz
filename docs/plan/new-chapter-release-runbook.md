# New Chapter release runbook (0.3.0): fresh start for everyone

Owner decision 2026-11-11: the New Chapter is the **last free reset**. Every account keeps **its login, its reserved name and its gems**; everything else is cleared and each player picks name, class and avatar again on the "A new chapter" screen. This page is the order of operations for release day. The code is the source of truth for mechanics (`src/config/epoch.ts`, `src/lib/offline/chapter.ts`, `docs/reference/saves-and-server.md`); this page only sequences them. Tasks: IDL-253 (the flip), IDL-254 (checklist and rehearsal), IDL-279 (save compatibility).

## What the reset does, per thing

| Thing | After the flip |
| --- | --- |
| Auth account, email, password | kept |
| Reserved character name | kept (the player can change it on the chapter screen; a name another account holds is refused) |
| Gems (`player_ledger.gems`) | **kept** (decided 2026-11-11) |
| Class, avatar | chosen again on the chapter screen (avatar checked against earned achievements, which are cleared, so only starters) |
| Save, map, leaderboard row, rebirth log | deleted |
| Ledger: tickets, granted totals, combat, bag and gear, craft, buffs, rebirths, counters, stats, achievements | reset to new-game values; `run_id` and `ver` bumped so sealed rolls never repeat |
| The old game | archived first in a pinned `save_history` row flagged `epoch_archive`, never trimmed. If the copy fails the reset stops with nothing deleted |
| Browser keys of the old game | cleared by the epoch guard on the next load (`src/lib/epochGuard.ts`) |
| Early tester | accounts that predate epochs get the `early_tester` achievement |

## PRs that go out together (label `release-0.3`)

1. **Save compatibility** (IDL-279, PR 210): merge **first**. It is additive and changes nothing for the reset itself; its fixtures and guards should capture the shapes that ship.
2. **Release notes**: `content/changelog/0.3.0.md` (format in `content/changelog/README.md`; players' words, what changed in the game). Written on request, when the PR list is final.
3. **The flip**: one PR that changes `GAME_EPOCH` 1 to 2 in `src/config/epoch.ts` and nothing else. Merge **last**: merging it is the release.

Keep the two later PRs as drafts until step 4 below is green. Vercel failing on the free-plan rate limit is not a blocker.

## Before release day (nothing here changes players)

1. `npm run verify` green on `main` after the save-compat merge; `npm run docs:gen:fast` hash fresh.
2. SQL: every migration the release needs is already applied (`supabase/migrations/*`, applied by the owner, SQL before code): at least `new_chapter_columns` (`player_ledger.stats`, `legacy`, `player_achievements`, `profiles.epoch`, `avatar_id`). Check `check-live-saves` section "new chapter dry run" says the columns exist.
3. `npm run check-live-saves` (read-only, same Supabase environment as production): accounts the flip would reset, how many hold a save, **name collisions and the forced renames they mean**, rows unreadable by today's rules. Fix or reset anything it reports before the flip.
4. Rehearsal on the test account (`lepryko@gmail.com`, the owner signs in by hand): `npm run reset-test-account`, then walk the chapter screen against a preview or staging with `GAME_EPOCH` raised there: pick name, class, avatar; confirm the game starts empty, gems unchanged, archive row exists in `save_history` (flag `epoch_archive`). Try a stale second tab: it must be refused (412 `stale_epoch`) and reload into the screen.
5. `restore-trust` dry run once against a real account (IDL-209) so the way back exists. Enforcement stays **off** at the flip (`ENFORCEMENT.enabled = false`, `EMBER_MODEL.requireServerRebirth = false`); it is turned on later, see the guide on `ENFORCEMENT` in `verify.ts`.
6. Secrets: new `LOOT_SECRET` per deployment, a placeholder in `.env.example` (RELEASE-PLAN 2.7). The reset invalidates every sealed roll anyway, so rotate it now, in the same deploy window.
7. Announce the downtime-free change if you want (the old tabs reload by themselves), and pick an hour with few players online.

## Release day

1. Merge the changelog PR (0.3.0).
2. Merge the flip PR (`GAME_EPOCH = 2`). Vercel deploys. From this moment `/api/auth/me` sends `epoch` and `needsReset`, and every request from a browser still on epoch 1 is refused until it reloads.
3. Do **not** run `reset-players`: the per-account chapter flow is the reset (each account resets itself when its owner confirms the screen). `reset-players` is the season tool and is not used for the flip.
4. Sign in yourself on production and confirm the chapter screen, a successful start, and a normal first save (`POST /api/save` accepted, rev 1).

## After the flip

1. Watch for a day: `/api/auth/epoch` errors (`archive_failed`, `name_taken` spikes), `stale_epoch` 412 counts settling to zero, first saves of new accounts accepted (not `invalid`).
2. `npm run check-live-saves` again: accounts still on epoch 1 are the players who have not come back yet; rows that were reset read as new-game saves.
3. Once nobody can still hold the old shape (the first reset has run for everyone who matters), delete `upgradeStoredBank` in `src/lib/offline/tickets.ts` (IDL-281). Not before.
4. From now on every PR follows the save-compatibility rule in `CLAUDE.md` and `docs/plan/save-compatibility.md`.

## If something goes wrong

- **A wave of errors on the chapter screen**: set `GAME_EPOCH` back to 1 in a one-line PR and deploy. The mechanism goes dark (nobody needs a reset, nothing is refused). Accounts that already reset stay reset, and their old game is in the `epoch_archive` row.
- **One player wants their old game back**: the pinned `epoch_archive` row in `save_history` holds the full body; restore it by hand through the same decode path (it is a normal save body; `docs/plan/save-compatibility.md` explains the upgrade chain if the schema moved).
- **A false anti-cheat flag on an honest account** (enforcement is off, so this only costs ranking): `npm run restore-trust -- --user <uuid>` (dry run first).
- **A migration of saved rows is needed later**: `npm run migrate-saves` (dry run, `--user`, backups first), see the save-compatibility doc.
