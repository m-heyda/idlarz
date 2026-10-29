# 15 · Rankings and "preview map" (design draft, nothing built)

Players see each other's name, avatar and a few numbers in rankings, and can peek at another player's generated world (biome layout and castle location only).

## 1. What exists

- `player_stats` (in `supabase/schema.sql`) is already the leaderboard table: one narrow row per player with `display_name, level, tiles_owned, castle_level, rebirths, legacy_earned, gold_per_min, play_seconds, trusted`, written **inside `save_player_state` on every accepted save** (atomic with the save). Public `select` for `anon` and `authenticated` on the listed columns, **only rows with `trusted = true`**, indexes per ranking. No UI reads it yet.
- `trusted` = not a test account, a young game at the first save (`freshStart`) and never flagged (`pipeline.ts`). Today 0 of 5 rows are trusted, so the first ranked players will be new accounts or a decision to re-trust testers.
- `profiles.player_class` (warrior, paladin, ranger, mage) is the avatar today; portraits exist (`CharacterPortrait`).
- The map is in `player_worlds` (`land` = runs of biome letters, `extra` = buildings, levels, chests), **select-own only**.

## 2. Rankings: no cron needed

The data is already collected live, for free, inside the save call. A cron job would only duplicate it. Plan:

1. **Migration `leaderboard_columns.sql`** (additive): `player_stats` + `xp numeric`, `paragon integer default 0`, `player_class text`; extend the column grant with `xp, paragon, player_class` (never `user_id` linkage to anything private). The server fills them in `save_player_state` (extend `p_stats`): `xp` from the clamped XP model, `paragon` derived from it ([13](13-rebirth-reset-and-paragon.md)), `player_class` from the profile.
2. **Read path**: a route `GET /api/rankings?by=level|income|rebirths|tiles&limit=50&cursor=...` (or direct PostgREST from the browser with the existing policy). Keyset pagination on the existing indexes, 50 rows, cached 60 s (`Cache-Control: s-maxage=60`) so a busy page does not hit the database per viewer. Gold per hour = `gold_per_min x 60`, formatted in the UI.
3. **Ranking order**: level, then paragon, then lifetime XP; separate boards for income (gold/h), rebirths then Embers earned, tiles. A player sees their own rank through a count on the same index (`count(*) where level > mine`), not by loading everyone.
4. **UI**: a Rankings overlay (header menu), rows = avatar (class portrait), name, level / paragon, rebirths, gold/h, an eye icon. The own row is pinned.
5. **Privacy**: other players can read only name, avatar (class), level/paragon, rebirths, tiles, castle level, income, play time, as the grant already says. No ids in the public payload (use `user_id` only as an opaque cursor/preview token; see 3). A "hide me from rankings" switch is a cheap column (`listed boolean`); proposal: add it with the migration.
6. **When a cron does earn its place** (later): a daily snapshot table `player_stats_daily (user_id, day, level, xp, rebirths, gold_per_min)` for "gained this week" and seasons, with 30-day retention (about 100 bytes x 30 x players, trivial). `pg_cron` is not installed on the project; it is a dashboard toggle. Alternative without a cron: write the snapshot lazily on the first save of each day inside the same RPC. Recommendation: lazy daily row, no cron, until seasons exist.

## 3. Preview map (the eye icon)

Goal: a read-only look at another player's world: biomes and castle only, in a clear "Previewing <name>" mode with a close button.

- **Data**: `land` (letters) is biome-only and `extra` holds buildings/levels/chests, so the response contains **`land` only** plus the castle position (fixed at `CASTLE_X, CASTLE_Y`). That also hides how far the owner has built or what they own. 1.2-1.5 KB per map today (kB-scale even at 50,000 tiles).
- **Access**: `player_worlds` stays select-own. Add a route `GET /api/world/<token>` using the service role, which (a) returns `land` for a **trusted/listed** player only, (b) rate-limits per caller (a handful per minute), (c) answers with `Cache-Control: private, max-age=300`. The token is the ranking row's opaque id, never an auth id the client can enumerate. This avoids a public policy on a big table, and keeps the cost to one primary-key read.
- **Client**: a `previewStore` separate from `gameStore` (so the preview can never touch or save the real game): `{ owner: {name, class}, tiles }`. The map view reads tiles from the preview store while `mode === 'preview'`; economy, autosave, `useSpawnSync`, fights and polling are **paused** and the cloud sync is blocked (`useCloudSync` must not run, otherwise the preview could overwrite the player's own save: this is the one dangerous bug to test). A banner and a "Close preview" button return to the real game; Esc closes it too.
- **Rendering**: reuse `TerrainLayer`, `Minimap` and the biome art with an empty building/monster layer; the world is built with `packLand`'s inverse (`worldFromPart` in `lib/offline/placement.ts` already does it).
- **Tests**: preview store has no path to `saveStorage`; a route test that `extra` never leaves the server; a rate-limit test.

## 4. Decisions and open questions

**Decided (2026-10-29):**
- **Avatar is separate from the class** (`player_stats.avatar_id`, from `profiles.avatar_id`; [21](21-classes-avatars-achievements-offline-report.md)); the leaderboard shows avatar, name, level/paragon, rebirths, gold/h.
- **Trusted players are listed by default, with an opt-out `listed` switch** in Settings. A player who is not listed has no ranking row and **cannot be previewed**; the preview route checks `listed` and `trusted`.

**Still open:**
1. ~~Re-trust testers?~~ **Moot (decided by the plan):** the class-release reset ([21](21-classes-avatars-achievements-offline-report.md) section 6) deletes every save, so every game is fresh and `freshStart` is true for all; rankings start empty with everyone eligible.
2. Add the lazy daily snapshot with the first migration (recommended: one row per player and day written inside the same save RPC, 30-day retention), or later?
