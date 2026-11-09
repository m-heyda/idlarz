# Reset-proof browsers: per-browser keys and the epoch guard (IDL-248)

Status: **audit done, client guard built (dark), everything on the server is NOT built** (it belongs to IDL-76). The code half is documented in the JSDoc of `src/lib/epochGuard.ts` (`docs/reference/saves-and-server.md`, "Browser state"); this page lists what is not built and why each key is treated the way it is.

## Why

The New chapter release (IDL-76) resets every account once by raising the server's `GAME_EPOCH`. IDL-247 (an account with no cloud save, a browser link at revision N: 404 `no_save`, 409 loops) and IDL-249 (409 recovery) showed that a browser keeps state that no longer matches the server after a reset. Existing mechanism: `lastReset` (season reset marker) in `GET /api/save` makes `page.tsx` put aside a browser save older than it. It covers the local save only; the keys below are not touched by it (`canResumeTab`, `cloudSaveGone`, PR 140, repair the link after the fact).

## The keys

All are `localStorage` unless stated, all go through `scoped(...)` (a `.dev` suffix on localhost). No cookies and no IndexedDB are used by the game; the Supabase auth cookie is the server's session and survives a reset on purpose (the account stays).

| Key | Holds | If stale after an epoch flip | Decision |
| --- | --- | --- | --- |
| `idlarz.cloud` (`cloudClient`) | link: account id + revision of its cloud save | the server has no row (rev 0): `POST /api/save` answers 409 rev 0; before PR 140 sync stopped, now one reload. If the new game already has rev 1..N the stale rev N makes `resolveConflict` look at a fresh save as "behind" | **clear on epoch change** |
| `idlarz.cloud.attempts` | last 5 unconfirmed uploads (base rev, play time) | `isOwnSave` could match a new game's save by rev step + play time and re-base over it: tiny chance, wrong base | **clear on epoch change** |
| `idlarz.cloud.conflicts` | counters of 409s and overwrites (diagnostics) | harmless to play, but mixes old and new game in the one-week watch IDL-249 asks for | **clear on epoch change** (also zeroes the counters; acceptable) |
| `idlarz.cloud.manual` | time of the last manual cloud save | the first manual save of the new chapter can wait up to 10 minutes | **clear on epoch change** |
| `idlarz.combat.cursor` | number of the last applied combat event, per account | the server's log restarts with the new ledger: a high cursor makes `combatSync` replay from 0 (harmless), a low one skips the new game's first events (a lost kill reward) | **clear on epoch change** |
| `idlarz.offline.pending` | idempotency key of an unanswered offline claim | the server replays or rejects an unknown key; the claim of the reset ledger is a different one. Cannot pay twice (anchor moved), but a stuck key blocks nothing | **clear on epoch change** (cheap) |
| `idlarz.save`, `.backup` | the local game | an old game uploaded over the new chapter = the worst outcome (server compare-and-swap is the last line, see below) | **archive then reset** (`archiveForNewGame` + `resetSave`) |
| `idlarz.save.damaged` | unreadable save text kept for the player | none | cleared by `resetSave` (already) |
| `idlarz.save.previous-game` | the game a New Game replaced | a safety copy, must survive | **keep** (never cleared) |
| `sessionStorage` `idlarz.entered` | "this tab is past the start check" | lets a tab skip the start check, which hides a missing link (IDL-247 reason 2) | **clear on epoch change** (and `canResumeTab` already requires a link) |
| `idlarz-settings`, `idlarz.ui.*`, `idlarz.section.*` | sound, view options, collapsed sections | cosmetic | **harmless, keep** |
| `idlarz.epoch` (new) | the epoch this browser last saw | n/a | written last, after a successful wipe |

## The guard (built, dark)

- `fetchMe` reads optional `epoch` and `needsReset` from the `/api/auth/me` body. The route does not send them yet, so the guard does nothing today (`epochVerdict(.., undefined) = 'none'`).
- `epochVerdict(seen, server)`: no stored epoch counts as `BASELINE_EPOCH = 1` (what the server has today), so every browser that predates the guard is wiped on the flip, a new browser is not. A lower server epoch (rollback) never wipes.
- `wipeStaleBrowser(epoch)`: archive the local game, reset it, clear the stale keys, record the epoch last, page reloads into the start check. If the archive cannot be kept nothing changes and the page shows "accounts unavailable" instead of syncing with a stale link (retried on the next load).
- Wired into `page.tsx` for both entry points (`check` on load, `signedIn` after a login).

## Not built (IDL-76 and follow-ups)

1. **Server sends the epoch.** `GET /api/auth/me` adds `epoch: GAME_EPOCH` and `needsReset` (the profile's epoch is below it). Raising `GAME_EPOCH` is the release; the client needs no other change to wipe.
2. **Route to the New chapter screen.** `needsReset` true should show the New chapter screen (class, avatar, tutorial) before `SaveHub`. Today the guard only wipes and reloads; the existing start check then starts a plain new game. The screen has to take over `page.tsx` after `guardEpoch` and before `admit`.
3. **A tab that is open during the flip** never calls `/api/auth/me` again. It keeps its in-memory old game and old link and uploads. This is the dangerous one: with a stale link rev N against a fresh server row at rev 1, `resolveConflict` (`judgeRebase`) rules the old game "ahead" and, after `QUIET_MS`, **overwrites the new chapter** (the replaced save is pinned in the history, but the player loses the new game). The server must refuse it: `POST /api/save` (and `/api/offline`, spawn) compare the request's epoch, or the row's `ledger.ver` compare-and-swap, and answer a distinct `epoch` error (not 409 rev 0). The client then needs one branch in `useCloudSync` (`pushCloud` status `epoch`): toast, `wipeStaleBrowser`, reload. Not built because it changes the server contract; the RELEASE-PLAN risk table already names the CAS and the deleted-row test.
4. **Dry run before the release.** `check-live-saves` (IDL-12 / IDL-216) should report accounts with a ledger but no save, and the count of browsers that will wipe (not knowable; only accounts).
5. **Real-browser rehearsal** on the E2E test account: seed stale keys (link rev 5, attempts, cursor, local save), raise the epoch on a Supabase branch, sign in, expect a fresh game and a link at rev 1 after the first upload.
6. The `lastReset` branch in `page.tsx` (season reset, save older than the marker) stays as is; once the epoch flow ships it is redundant for the chapter reset but still serves `npm run reset-players`.
