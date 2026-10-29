# 14 · Server-authority audit for the planned features, catalogs and the free-plan data budget (design draft)

Question: is everything that must be server-side (solid game rules, events, best practice) already there, and what has to move for the planned features ([12](12-rebirth-biomes.md), [13](13-rebirth-reset-and-paragon.md), [15](15-leaderboard-and-world-preview.md), [17](17-crafting.md))? Method: the code at `main` (626f3d4), [11](11-server-authority.md), the ROADMAP backlog, and **read-only aggregate queries on the live project** (no names, no ids).

## 1. What the live project looks like today (queried 2026-10-29)

| Fact | Value | Meaning |
|---|---|---|
| Players (`player_saves`) | 5, all `schema` 6, all **0 rebirths** | no one needs a rebirth migration; every new rule starts clean |
| Tiles owned | median 158, max 339, castle level max 4, level max 31 | calibration point for the biome distances ([12](12-rebirth-biomes.md)) |
| Database size | 12 MB total | the free plan's database limit is 500 MB (check the dashboard; limits change) |
| Row sizes | save about 2.8 KB, ledger about 3.1 KB, history copy about 2.5 KB, map 1.2-1.5 KB | one active player is about 10 KB live plus up to 6 history copies (`HISTORY_KEEP` = 6) = about 25 KB |
| Ledgers with `inv` null | 2 of 5 | rows from before `inventory_ledger.sql` are seeded lazily on first request; every new ledger column must follow the same lazy pattern |
| `player_stats` | 5 rows, 0 `trusted` | the leaderboard table exists and is written on every save, but no one is trusted yet |
| `pg_cron` | not installed | enabling it is a dashboard action; not needed (see 4) |

Rough capacity: about 25 KB per player means 5,000 players is about 125 MB. Storage is not the free-plan risk. The risks are **request volume** and **write amplification** (section 5).

## 2. Verdict: what is already server-side

Done and sound (no action): chest/monster timing, placement and rewards; offline progress; fights; gems; the inventory (bag, worn gear, pity, auto-sell filter); sealed, idempotent rolls with compare-and-swap; Luck.

## 3. What is not, ranked for the planned features

| # | Gap | Why it matters now | Where / how |
|---|---|---|---|
| 1 | **Attribute allocation is the browser's** | respec + the +20 pool ([13](13-rebirth-reset-and-paragon.md)) make "points spent <= points earned" the rule; the fight profile reads attributes from the save | extend `reconcileCharacter` with `20 x ledger.rebirths`; run it in `acceptSave`; no table |
| 2 | **Rebirth is client-authoritative**; the server only notices `rebirths + 1` | the inventory wipe must be the server's | idempotent wipe action in `/api/inventory`, then a server-owned `/api/rebirth` that also checks `emberGain(castle_level, tiles_owned)` against the previous row |
| 3 | **Biome legality unchecked** | rebirth-locked biomes and distance minimums | `verify.ts` flags `biome_locked`, `biome_too_near` ([12](12-rebirth-biomes.md) section 6) |
| 4 | **Merchant is not server-priced** | T2 trade gating, crafting-material sinks and gold for gear are all unverified | roadmap item 4; route behind the existing store actions, no UI change |
| 5 | **`verify.ts` only flags** | an un-ranked cheater still plays; fine for testing | roadmap item 1; do it before public rankings matter |
| 6 | Castle upgrade, farm, building costs | economy | roadmap item 2, batch not per-click |
| 7 | Tile buying and the biome roll | stays client-side with autosave (reasoned in the roadmap); the **result** is verified by #3 and `netWorth.ts` | no change |
| 8 | Spawn caps from the estimate | roadmap item 5 | no change |

New server-owned things the features add (all follow the lazy, additive, ledger pattern):
- **Crafting state** (crafting XP and level, crafting pity): `player_ledger.craft jsonb`, additive nullable column (migration `crafting_ledger.sql`), applied **before** the code that reads it (the deploy-order rule in the ROADMAP). Details in [17](17-crafting.md).
- **Roads** ([18](18-biome-buildings-and-material-tiers.md) section 5.2): an optional `road` flag per tile in `player_worlds.extra`, a breadth-first connection check in `buildingEconomy`, priced in `netWorth.ts`; no SQL.
- **Legacy record** (`player_ledger.legacy jsonb`: Idol levels and later cap upgrades, [18](18-biome-buildings-and-material-tiers.md) section 6): additive nullable column, migration `legacy_ledger.sql`, applied before the code; Idol level-ups are server operations because Idols change server-computed values (Luck, kill rewards, XP, offline, damage, HP).
- **Generic monster tickets** ([20](20-monster-families-and-rewards.md)): `bank` keeps its jsonb column, `upgradeBank` reads old rows lazily.
- **Paragon level**: derived from clamped XP, nothing stored besides the leaderboard copy.
- **Discovered biomes**: derived from the map on upload, nothing stored on the server.

## 4. Catalogs: keep in code, not in the database

Items, monsters, biomes, resources and affixes stay as TypeScript modules (`src/catalog`, `config/*`). Reasons: the API routes and the browser import the same files, so they cannot disagree; the database would add reads on every fight (the free-plan hot spot); content changes ship with a deploy anyway because art and tests ship with them; a catalog row cannot be unit-tested the way the current simulations (`fight-sim`, `loot-sim`, `tests/catalog.test.ts`) are. Revisit only if content must change **without a deploy** (live events); then add one small `catalog_overrides` jsonb row read once per process and cached, not a table per catalog.

Not secret either: the catalogs are in the client bundle by design. The secrets are `LOOT_SECRET` and the seed of every roll, which stay server-only. (Rotate the example `LOOT_SECRET` in `.env.example` before any public release, as noted in the ROADMAP.)

## 5. Free-plan budget (the real constraint)

1. **Fight polling writes.** An open fight polls every 2 s (about 1,800 requests/hour), each with an auth check, two reads and a ledger UPDATE even when nothing changed but the anchor. Do this *before* adding crafting and leaderboards: skip the ledger write when only the anchor moved, and poll slower while the fight is only watched (ROADMAP "hot spot").
2. **No new per-click or per-tick calls.** Craft is one request per craft (and a "craft x10" batch); the leaderboard and the map preview are read-only and cacheable (see [15](15-leaderboard-and-world-preview.md)).
3. **Reads over polls.** Rankings fetch on open and every few minutes, never in a loop.
4. **Row growth.** `save_history` is capped at 6 copies per player; keep that cap. A big map (50,000 tiles) writes about 75 KB per save on the client's side, but `player_worlds` is rewritten only when the map changes; leaderboard preview must read it with the service role through a route, never through a public table.
5. **No cron needed** for current rankings: `player_stats` is written inside `save_player_state` (one atomic call that already runs on every save). A cron job only for history/seasons later ([15](15-leaderboard-and-world-preview.md)).

## 6. Save compatibility: how to prove it

- The additive rule from [07](07-saves-and-security.md) holds for everything in this plan: new optional fields, new biome letters, new nullable ledger columns, no renames. So no `SAVE_SCHEMA` bump and no data migration.
- **Frozen fixtures** `tests/fixtures/saves/v1..v5`: add a v6 fixture now (the schema all live saves are on) and keep it.
- **Dry run against the real rows before each release** (new script `scripts/check-live-saves.ts`, dev machine only, uses the service role key, prints only counts and failure reasons): for every `player_saves` row run `unpackBody` -> `sanitizeSave` -> `repairSave` under the new rules and report anything refused. Today that is 5 rows, so it runs in a second; it stays useful as the player count grows.
- A rule that moves (a maximum, a curve) goes through `repairSave` (leniency), never through refusal, per the "technical risks" section of the ROADMAP.

## 7. Proposed SQL migrations (all additive; none run now)

| Migration | Content | Needed by |
|---|---|---|
| `leaderboard_columns.sql` | `player_stats` + `xp numeric`, `paragon int`, `player_class text`, `trusted_at`; extend the public column grant; keep RLS (trusted rows only) | [15](15-leaderboard-and-world-preview.md) |
| `crafting_ledger.sql` | `player_ledger.craft jsonb` nullable, no default | [17](17-crafting.md) |
| `profiles_epoch.sql` | `profiles.epoch smallint not null default 0`, unique index on `lower(character_name)` (after a collision check), `avatar_id text` nullable | [21](21-classes-avatars-achievements-offline-report.md) (the reset when classes ship) |
| `legacy_ledger.sql` | `player_ledger.legacy jsonb` nullable (Idol levels, cap upgrades) | [18](18-biome-buildings-and-material-tiers.md) |
| `ledger_skip_noop_writes` (code, not SQL) | do not write the ledger when only the anchor changed | section 5 |
| `public_world_rpc.sql` *(optional)* | `security definer` function returning biome letters of one player's map; or do it in a route with the service role (recommended, easier to rate-limit) | [15](15-leaderboard-and-world-preview.md) |

Each is applied with Supabase's migration tool on the project, then added to `supabase/migrations/` and `supabase/schema.sql` (the existing convention).

## 8. Assumptions

**Assumed (no objection raised; say so if wrong):**
1. Catalogs stay in code, not in the database.
2. `verify.ts` stays flag-only while the game is in testing; enforcing (rejecting) comes before the rankings go public.
3. The fight-polling write fix is scheduled before the new features ([ROADMAP](ROADMAP.md) order), not as a parallel track.
