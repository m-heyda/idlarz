# Cloud saves (accounts)

The browser save (localStorage) stays the primary copy and the game works offline. A signed-in player's game is also
copied to Supabase so it follows them to another browser and survives cleared site data. The server verifies what it stores
and derives the numbers a leaderboard or offline progress will need.

## Tables (migrations `cloud_save_v2_split`, `harden_policies_and_rpc`, `autosave_history_by_time`)

The save is split by how it is used, not stored as one blob:

| Table | Rows | Written | Holds |
|---|---|---|---|
| `profiles` | 1 / account | at registration | character name, hero (owner-only RLS) |
| `player_saves` | 1 / account | **every accepted save** (small, ~1 KB core) | `core` (bag, gear, upgrades, monsters, timers: everything but the map), `world_hash`, and typed columns derived by the **server**: `play_seconds, level, xp, gold, gems, click_level, castle_level, tiles_owned, buildings_owned, rebirths, legacy_points, legacy_earned, xp_gain_pct, rates, gold_per_min`, plus `rev`, `schema`, `server_saved_at`, `flags`, `audit_ratio`, `fresh_start`, `ever_flagged`, `last_archive_at` |
| `player_worlds` | 1 / account | **only when the map changed** (a purchase), by `hash` | `land` (runs), `extra`, `tiles`. ~98 % of a save's bytes; a 55,000-tile map is 63 KB of JSON (27 KB stored) |
| `player_stats` | 1 / account | with every save | narrow leaderboard row: `display_name` (from `profiles`, never from the save), `level, tiles_owned, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, trusted`. Public read, **trusted rows only**, never any game state. Partial indexes per ranking |
| `save_history` | sparse | first save, one copy per 30 min of the clock (`last_archive_at`), the first save with a new flag; pinned when a game is replaced by a much younger one (New Game) | full body for rollback. 6 newest + 3 pinned per player |

Rule of thumb for what becomes a column: only what is sorted, filtered or verified. Bag, gear and skills stay in `core`
(small, only ever read as a whole). A separate items table is worth it only when something like trading needs "who owns item X".

### Access
- Players can **read** their own `player_saves` / `player_worlds` rows, and nothing writes except the server route.
- Anonymous and signed-in users can read `player_stats` trusted rows (column-restricted). `save_history` has no policy on purpose.
- The only write path is `public.save_player_state(...)`, executable by `service_role` only: one transaction doing the compare-and-swap on `rev`,
  the map upsert (when given) and the leaderboard row. `SUPABASE_SERVICE_ROLE_KEY` is a server-only env var.

## When the browser saves (`src/lib/syncPolicy.ts`, `src/hooks/useCloudSync.ts`, `src/lib/saveEvents.ts`)

Two copies, two rhythms. The **local** save is written 2 s after the game changes (and always when the tab is hidden or closed), plus at once on a milestone.
The **cloud** copy is about milestones and safety, not about every second:

| Trigger | Upload |
|---|---|
| game start | once, after 4 s |
| milestone: tile bought, building built, castle upgrade started / finished, rebirth, Legacy / farm / merchant / click upgrade, stat point, gear equipped or removed, level up | after a 5 s settle (a burst of purchases is ONE upload), never closer than 30 s to the previous attempt |
| idle | every 5 min (idle income is rebuilt from `rates` on the server, so more frequent uploads add nothing) |
| tab hidden / closed | at once, unless an upload was tried in the last 11 s (the server accepts one per 10 s); `keepalive` only while the body is under 60 kB (browsers cap it at 64 KiB) |
| failure (outage, 429) | backoff 30 s, 1 min, 2 min, then 5 min; normal again after a success |
| 409 conflict, 422 refused, 401 signed out | stop for the session and tell the player (toast) |

Clicks, hits, sales, potions and bag moves are not milestones. An idle tab costs 12 uploads an hour (it used to be 40).
The events are emitted by the store (`withSaveEvents` in `saveEvents.ts`) only when the action succeeded.
The server still enforces its own floor of one accepted save per 10 s, whatever the client does.

## Write path (`POST /api/save`, `src/lib/cloudSave/`)

1. The id comes from the session cookie only; the body is capped at 600 KB.
2. The text must decode (checksum, schema, `sanitizeSave`). The stored copy is **rebuilt from the sanitized state**, never the client's text.
3. `baseRev` must equal the stored `rev` (compare-and-swap, atomic in SQL). Otherwise 409: the hub asks which game to keep.
4. At most one accepted save per 10 s per account (the browser's own cadence is in the section above).
5. Rates and headline numbers are computed on the server. The client sends nothing but the save.
6. Checks, all **shadow mode** (flags stored, save accepted):
   - `networth_exceeds`: gold + stock held (merchant prices) + the least gold the owned tiles, buildings and castle cost must not exceed the income
     the game could have paid over the play time (`netWorth.ts`). Tile prices depend only on how many tiles are owned, so forged land cannot hide behind forged rates.
     An honest bot that spends everything on land sits at 0.10 to 0.27 of the limit (15 min to 24 h); the slack is 3x for clicks, chests and loot.
   - `playtime_fast`, `playtime_regress`, `gold_jump`, `xp_jump`, `gems_increase`, `prestige_regress`, `baseline_rich` (`verify.ts`, from summaries, with the **server's** clock).
7. `trusted` (leaderboard eligibility) = the account's first save was a young game (`fresh_start`, at most 15 min of play) **and** no poisonous flag was ever raised (`ever_flagged`; going back to an older save is not poisonous).

Tune `VERIFY` / `NETWORTH` on real data: `select flags, audit_ratio from player_saves`, then turn chosen flags into rejections.

### Test accounts
A save that goes through a **non-production server** (`next dev`, or a Vercel preview deployment) marks the account `test_account` (sticky, set by the
server from `NODE_ENV` / `VERCEL_ENV` in `environment.ts`, never from the request). The checks still run and the flags are recorded, so a tester can see
them work, but the flags never count (`ever_flagged` stays false), only the regular history copies are made for them (none for a flag), and the account is **never ranked**
(`trusted` is false). A missing `VERCEL_ENV` counts as production, so real players cannot slip out of the checks if the platform variables are not exposed.
Filter tuning queries with `where not test_account`. To undo it: `update player_saves set test_account = false where user_id = ...`.
The dev cheat panel and the `window.__game` console handle exist only when `NODE_ENV` is `development`; neither string is in a production bundle.

### Known limits (be honest about them)
- The client is still authoritative; the server sees snapshots, not actions. A cheater who stays within the spending bound (roughly 3x honest progress at any time) is not caught.
- The save text is not signed (its check code is a plain FNV hash for catching typos), so editing an exported save or localStorage is easy. The server, not the file, is what is trusted: edits that go beyond the spending bound are flagged and unranked. Server-signed checkpoints are the next step (see 07 section 6).
- Gear and bag contents cannot be verified (drops are random): never rank by items.
- The first save of an existing player cannot be delta-checked; its play time is taken as claimed. That is why such accounts are not ranking-eligible (`fresh_start`).
- Gem increases are flagged, not rejected: restoring an older save in the hub can legitimately raise gems relative to a newer cloud save.

## Start flow (`src/lib/startPlan.ts`, `components/auth/SaveHub.tsx`)

Each browser remembers which account and revision its save continues (`idlarz.cloud`). Login compares this browser, the link and the account:
nothing anywhere = new game; this browser continues the account = Continue; new browser = the account save; both exist and differ = choose
(the one not chosen is copied aside: local to `idlarz.save.previous-game`, cloud stays in `save_history`). If the account cannot be reached the local save just plays on.

## Offline progress (next step, not built)

On load the server can return `min(now - server_saved_at, cap) x rates` (cap ~8 h at 50 %, see 08 C7), applied only when the client's `rev`
equals the stored `rev` so the same offline time cannot be claimed from two browsers. Everything it needs (`rates`, `server_saved_at`, `rev`) is already a column.
