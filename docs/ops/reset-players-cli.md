# 23 · Season restart: `npm run reset-players`

An operator tool ([scripts/reset-players.ts](../../scripts/reset-players.ts)) that gives every player a fresh game while keeping who they are. It talks to Supabase with the service role, so it is run by hand from a trusted machine, never from the app.

## Usage

```bash
npm run reset-players                       # dry run (default): lists players, changes nothing
npm run reset-players -- --yes              # really reset everyone
npm run reset-players -- --yes --user <uuid> [--user <uuid> ...]   # only these players
npm run reset-players -- --yes --purge-history   # also delete save_history (rollback copies)
npm run reset-players -- --yes --no-backup       # skip the JSON backup (not recommended)
npm run reset-players -- --yes --reset-gems      # the gems go back to the starting amount too (used by reset-test-account, doc 29)
```

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, read from the environment or `.env.local`. They decide which project is wiped: check them first. Try one account with `--user` before running it for everyone.

## What is kept and what is reset

| Data | Result |
|---|---|
| Auth account, `profiles` (`character_name`, `player_class`) | **kept** |
| `player_ledger.gems` | **kept** (a player with a save but no ledger row keeps the save's gems) |
| `player_saves` | **deleted**: level, XP, gold, castle, tiles, buildings, rebirths, legacy points, everything in `core` |
| `player_worlds`, `player_stats` | deleted by cascade; the leaderboard row returns after the player's first new save |
| `player_ledger` (all but `gems`) | **reset** to new-game values: spawn timers and tickets, granted totals, combat, inventory (bag and gear), rebirths. `run_id` and `ver` are bumped, so sealed rolls never repeat across the restart |
| `rebirth_history` | **deleted** (the log of the season that ended: the new season counts its rebirths from 1 again, and the table keeps one row per number); it is in the JSON backup. Needs the `rebirth_history` migration |
| `save_history` | kept by default (rollback copies); deleted with `--purge-history` |

Before a real reset the tool writes `backups/reset-<timestamp>.json` with `player_saves`, `player_worlds`, `player_stats`, `player_ledger` and `rebirth_history` (the folder is gitignored; it holds player data). `save_history` is not part of the dump because it stays in the database unless purged.

## Running it

1. Run the dry run and check the player list and the project URL.
2. Do it while few people are online. A player with the game open must reload: their old save no longer matches the server and is rejected, then they start a new game.
3. Run with `--yes`.

## Local copies in browsers

The server side is fully reset, but a browser may still hold its own local save. The tool cannot touch browsers, so the client does it: the reset ships together with a `SAVE_SCHEMA` bump (7 at the time of writing). A local save of any older schema is refused ("from an older season, start a new game"), so it cannot be offered back at login. Gems stay the server's ([saves and server](../game/saves-and-server.md)). After a later restart, bump `SAVE_SCHEMA` again in the same release.

## Undoing it

Restore from the JSON backup, or from `save_history` when it was kept (the latest copy per player is at most about 30 minutes older than their last save). There is no automated restore tool yet.

## Before the reset: `npm run check-live-saves`

A read-only dry run for the same operator ([scripts/check-live-saves.ts](../../scripts/check-live-saves.ts), IDL-12; method in [14](../plan/14-server-audit-and-data-plan.md) section 6). Run it with the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (environment or `.env.local`, never printed, never committed) **before** a release that tightens the save rules or switches on `ENFORCEMENT` (the epoch reset IDL-76, IDL-208), and again after, to see what the reset left. It runs the current code over every `player_saves` and `player_ledger` row and prints counts and reasons only: saves rejected and why, saves that would be clamped or flagged, how many `ENFORCEMENT` would refuse, how many players are in the middle of a castle upgrade, ledgers without a save or inventory. It writes nothing. If it reports saves that would be refused, reset those players or write the conversion before the release.
