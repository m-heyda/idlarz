# Save compatibility after the New Chapter

Owner decision 2026-11-11: the New Chapter release (the `GAME_EPOCH` flip, IDL-253) is the **last free reset**. From then on saves and ledgers must stay readable forever, so resources, items, monsters, biomes, buildings, avatars, achievements and numbers can be added or tuned without wiping or breaking anyone. This page is the audit of what was at risk, what this PR changed, and the rules and tooling for every later release. The code is the source of truth for mechanics (JSDoc, `docs/reference/`); this page is the plan and the checklist. Do not touch `GAME_EPOCH` here.

## 1. The rule

A change is **save-compatible** when it is only one of these:

- a new optional field, read with a default (add it to `PERSISTED_KEYS`, let `sanitizeSave` default it; no version bump);
- a new id in a catalog (resource, item, monster, biome, building, recipe, avatar, achievement, upgrade ...), **appended**: never removed, renamed or reordered; retire content with a flag (hide it, stop dropping it), keep the id;
- a changed number (price, rate, drop chance, cap): stored values are never derived from a number that changed, or the reader clamps (section 3);
- a tolerant reader: it reads what it knows, drops what it does not, never throws.

Anything else (a renamed, moved or reinterpreted field, an id that must become another id, a lowered limit) is **not** compatible: bump `SAVE_SCHEMA`, add a pure upgrade step (section 4), and for a release that wants every row moved at once run the migration script (section 5). The guards in section 6 make a PR fail when it breaks this by accident.

## 2. Audit: how each stored thing is read

"Strict" = the reader refuses the whole save or row. "Tolerant" = it keeps what it understands and drops or defaults the rest. The column "before" is the state at the start of this PR, "now" the state after it.

### The cloud save body (`player_saves.core` + `player_worlds`, and the browser text `IDLZ2.`)

| Thing | Before | Now |
| --- | --- | --- |
| Schema number `v` | newer: refused; older: refused ("older season"), no upgrade path | newer: refused; older: upgraded by `SAVE_UPGRADES` (`src/lib/saveUpgrade.ts`), refused only without a path (empty chain today) |
| Missing optional field (`farmUpgrades`, `gems`, `merchant*`, `prestige`, `equipment`/`bag` ...) | defaulted | defaulted |
| Missing resource key | **strict** unless the catalog entry carried `optionalInSave` (easy to forget: a new resource would have rejected every old save) | **tolerant**: any key but `gold` and `xp` reads as 0 |
| Unknown top-level key | ignored | ignored |
| Unknown key on a land entry / extra entry / merchant stock | **strict** (refused) | **tolerant** (ignored) |
| Unknown biome letter / unknown biome name | strict | strict **by design**: a tile cannot be dropped without breaking the connected map. Protected by the append-only guard instead (letters frozen) |
| Unknown building id, wrong biome, duplicate, bad level | dropped (IDL-259) | dropped |
| Unknown merchant / farm / Ember upgrade id | **strict** | **tolerant**: dropped (Embers come back, see below) |
| Unknown animal id | **strict** | **tolerant**: dropped |
| Unknown loot-pity table | **strict** | **tolerant**: dropped |
| Unknown gear base, rarity, affix, slot; item level, quality or affix rolls outside a (changed) window | **strict** for the whole save | **tolerant**: that piece is dropped (empty bag slot / empty gear slot) |
| Unknown consumable id; stack above a lowered stack size | **strict** | **tolerant**: empty slot / cut to the new stack size |
| Upgrade level, animal count or click level above a (later lowered) maximum | **strict** | **tolerant**: cut to the maximum |
| Castle upgrade timer longer than a (shortened) duration | **strict** | **tolerant**: cut to the duration |
| HP / mana above a (lowered) maximum | **strict** | **tolerant**: cut to the maximum |
| Attribute points that no longer match what the level pays (the points-per-level rule changed) | **strict** ("too many" / "too few", 5 points of slack) | **tolerant**: too few are credited; too many are a free respec (nothing gained) |
| XP below what the owned tiles paid for (the XP formula was raised) | **strict** | **tolerant**: lifted to that floor |
| Ember balance (`legacyPoints + spent = earned`) when an upgrade is gone or its price changed | **strict** (every rebirthed player refused) | **tolerant**: unspent = earned - spent; still refused only when the shop costs MORE than all Embers ever earned |
| Value above a (later raised) limit | n/a (raising never breaks) | n/a. `HARD_LIMITS` must only grow: guarded |
| Value above a (later **lowered**) limit | strict | cut (above); the guard forbids lowering `HARD_LIMITS` anyway |
| Number outside 0..1e21, NaN, wrong type, `land` not a list, castle missing, second castle, disconnected land | strict | strict (this is damage, not change) |
| Castle level above `CASTLE_UPGRADE.maxLevel`, castle upgrade to a level that is not next | strict | strict (castle levels only ever grow; guarded) |

**Positional things (dangerous to extend or reorder):**

- `clickLevel` is an **index** into `CLICK_LADDER`: append tiers, never insert or reorder (retune the numbers in place). Guarded by length only; the doc comment on the ladder says it.
- The `bag` is a list indexed by slot: it may grow (padded), never shrink below what a save holds (`HARD_LIMITS.bagSize` 200, only grows).
- `land` runs are `[y, x0, letters]` and `extra` entries are `[x, y, props]`: strict **3-tuples**. A 4th element would refuse every save, so any new per-tile data goes in `props` (a key), never a new tuple slot. The biome **letters** are frozen (`BIOME_CODES`).
- Resource keys: stored by **name** in an object, so a new key is safe. The order is positional only in the catalog test that pins it, and in nothing stored. Append, never insert.
- Enum-like ids stored as strings (`playerClass`, rarities, slots) are keyed by name, not by number. Rarity **order** decides the "sell up to" filter: insert a rarity in the middle only on purpose.

**Derived values that are stored instead of derived:** `core` keeps only the player's own state: level, `previousLevel`, `activeChests`, tile upgrade costs and combat stats are left out and rebuilt (`NOT_WRITTEN`). `player_saves` typed columns (`level`, `rates`, `derived`, `play_seconds`, ...) are the server's derived copy of the save, rebuilt on every accepted save; they go stale only until the next save. `derived.xpBase` (the most XP the server has seen) and `profiles.avatar_id` are real stored state. `buildings_owned` and `rebirth_history.buildings` are legacy NOT NULL columns written as 0.

### `player_ledger` (service role only)

| Column | Reader | Missing | Unknown id / value | Notes |
| --- | --- | --- | --- | --- |
| `bank` | `upgradeStoredBank` (spread over `emptyBank`) | defaults | ticket with an unknown monster `type` falls back to the plains monster/boss (`monsterTypeOf`) | **Temporary legacy reader** for the old `rats`/`king` shape. Delete it only after the reset (IDL-253), not before launch |
| `inv` (bag, gear, pity, auto-sell) | was: raw (`row.inv ?? null`), **no validation** | null: seeded from the save | was: unknown ids reached the game and could crash UI lookups | now `readInventory`: unknown ids dropped, `ver` bumped, unknown pity tables kept |
| `combat` | was: raw spread, only `queue` defaulted | null: seeded | was: an open fight with an unknown monster type reached `monsterDef(...)` and threw | now `readCombat`: unknown-type fight closed, lists/cooldowns default |
| `craft` | `craftFromJson` | zeros | unknown recipe ids kept in `queue`/`stock` (harmless counters) | tolerant already |
| `buffs` | `readBuffs` | `[]` | unknown family dropped | tolerant already |
| `stats` | `readStats` | zeros | unknown monster ids kept as counters, achievement ids kept | tolerant already |
| `granted`, `granted_seen` | `{ ...zeroTotals(), ...row }` | new resources read 0 | removed resource keys stay (harmless) | tolerant already |
| `legacy` | `legacyFromJson` (Idol levels that survive a rebirth) | `{ idols: {} }` | malformed reads as nothing kept; unknown idol ids are kept as numbers | tolerant. `migrate-saves` selects it, so a repaired row never wipes it |
| `last_result` | opaque (replayed to the client once) | null | n/a | idempotency answer |

### Other tables

| Table | Read how | Risk |
| --- | --- | --- |
| `profiles` | `character_name`, `player_class`, `avatar_id`, `epoch`. An unknown avatar falls back to the class default (`fitAvatar`) | **`player_class_known` is a CHECK constraint** (`warrior, paladin, ranger, mage`): a new hero class needs a SQL migration first. Not fixed here (see backlog) |
| `player_achievements` | insert-only mirror, ids as text | none: an id the catalog lacks pays nothing (`payAchievements`) and is kept |
| `save_history` | full body copy with `schema`; read by the restore tools and the chapter archive | rows keep their own `schema`; restoring an old row runs the same `decodeSave` chain. Pinned copies: never trimmed (chapter archive, `migration_backup`) |
| `player_stats`, `rebirth_history` | typed columns | additive columns only |

## 3. Quick reworks in this PR

- `sanitizeSave` / `unpackBody`: the tolerant rows of the table above (unknown ids dropped, over-limit values cut, missing resources 0, unfit gear dropped, stat points / XP / Embers repaired). Structural damage is still refused; the tests that pinned the old refusals now pin the new outcome (`tests/saves/saves.test.ts`, `tests/audit/server.test.ts`, `tests/saves/saveTolerance.test.ts`).
- `src/lib/offline/ledgerRead.ts`: `readInventory` and `readCombat`, used by `ledgerFromRow` (now exported with `ledgerToRow`).
- `src/lib/saveUpgrade.ts`: the version chain (section 4). `src/lib/offline/ledgerUpgrade.ts`: the ledger row steps.
- `scripts/migrate-saves.ts` + `scripts/migrateSaves.ts` + `npm run migrate-saves` (section 5).
- Guards and fixtures (section 6).

Behaviour the owner should know about: a hand-edited save with too many attribute points is now **repaired** (free respec) instead of refused, and a click level beyond the ladder is cut to the top. Neither gives an advantage (the net-worth and XP checks still price what is claimed); both were refusals only because a rule change could not be told from a forgery.

## 4. Versioning: the one thing that cannot be additive

`SAVE_SCHEMA` (7 today) is in `saveFormat.ts`. `decodeSave` upgrades an older body with `upgradeBody(body, from, SAVE_SCHEMA)`: the steps `SAVE_UPGRADES[from]`, `[from + 1]`, ... each a pure `(body) => body`, run on read, so a player is upgraded when their browser or the server reads the save and written in the new schema by the next save. The JSDoc of `src/lib/saveUpgrade.ts` has the rules (pure, total, idempotent, never edited or deleted after shipping) and a worked example (a rename plus a removed field). Ledger rows have no version, so a ledger step recognises the old shape itself (`src/lib/offline/ledgerUpgrade.ts`, also with an example).

Recipe for a non-additive release:

1. Bump `SAVE_SCHEMA`, add `SAVE_UPGRADES[old]`, and run `npm run gen-save-fixtures` (new fixture of the new shape; the old ones stay).
2. `tests/saves/saveFixtures.test.ts` must pass with the OLD fixtures untouched.
3. SQL first if a column changes (section 5), code second.
4. `npm run migrate-saves` dry run, deploy, dry run again (everything `current`), then `--yes` if you want every row moved now instead of when it is read.

## 5. Migration tooling

`npm run migrate-saves` (a template: the chains are empty, so today every row is `current` and it writes nothing).

- **Dry run by default**; `--yes` writes; `--user <uuid>` (repeatable) limits it to some accounts: try one account first. Same service-role pattern and env check as `check-live-saves` and `reset-players`.
- **Counts only**: per outcome (`current`, `upgraded`, `repaired`, `newer`, `unreadable`) and the code's fixed reason texts. No names, ids or numbers out of a game; database error text is withheld.
- **Idempotent**: a row already in the new shape is `current` and untouched, so a second run finds nothing to do. A row that does not load is `unreadable` and never written; a row of a newer schema is left alone.
- **Backup first**: the old body of every save row to be rewritten goes into `save_history` as a pinned copy flagged `migration_backup` (never trimmed, like the chapter archive), and everything to be rewritten is dumped to `backups/migrate-<time>.json` (gitignored). Undo, per kind of row: **a save** = put the history copy's `state` back (`schema`, `core`, and the map in `player_worlds`, with `world_hash` = its hash: all three together, or the save refuses to load with "the map does not match the save"). **A ledger row is NOT in `save_history`**: restoring a save does not undo a `player_ledger` rewrite. Its old row is only in the local `backups/migrate-<time>.json` (`ledgers` array, full rows as read); to undo, write those rows back with the service role, `where user_id` and keep their `ver` + 1 (the same compare-and-swap the script uses), and restore the matching save at the same time so the ledger and the save stay consistent (a ledger from the new shape with a save in the old one, or the reverse, is the mismatch to avoid). Keep that JSON file until the release has settled; it holds player data, never commit it.
- **Compare-and-swap**: a save row is written only `where rev` is unchanged, a ledger row only `where ver` is; a player who saved in between is skipped and caught by the next run. The core and the map are two tables and cannot be one transaction from a script: when a step changes the map it is written first and put back if the save's revision check fails, but a crash between the two writes can still leave them apart (restore both from the backup). A release whose step changes `land`/`extra` should ship a SQL function that rewrites both under the rev check (nullable additive SQL, with a rollback) before this script runs it; run it while few people are online.
- Unit tests run the same functions on the fixtures, with an injected chain and no network (`tests/ops/migrateSaves.test.ts`).

**SQL migration template** (`supabase/migrations/<name>.sql` and `<name>_rollback.sql`, written as files and applied by the owner, never by a session):

```sql
-- <name>.sql
alter table public.player_ledger add column if not exists <col> jsonb;   -- nullable, additive: old rows read null, the reader defaults it
comment on column public.player_ledger.<col> is '<what it holds, which migration added it>';

-- <name>_rollback.sql
alter table public.player_ledger drop column if exists <col>;
```

Order: **SQL before code** (an old build ignores a column it does not select; a new build that selects a missing column fails every request), nullable and additive only (no `NOT NULL` without a default, no type change, no rename: add the new column, copy, switch the reader, drop later), a rollback file next to it, and `supabase/schema.sql` updated to match. Never drop or narrow a column in the same release that stops reading it.

## 6. Guards and fixtures (for every future PR)

- **`tests/saves/appendOnly.test.ts`** + `tests/fixtures/saves/released-ids.json`: the ids that shipped (resource keys, biome letters, item, monster, recipe, component, building, avatar, achievement, merchant/farm/Ember upgrade, animal, class, rarity, slot, buff family ids) must still exist; resource keys keep their order; biome letters never change; the limits a stored value is checked against (`HARD_LIMITS`, max levels, castle max level, click ladder length) only grow. Adding on purpose: `npm run gen-save-fixtures -- --ids` appends to the list (it never removes).
- **`tests/saves/saveFixtures.test.ts`** + `tests/fixtures/saves/save-*.json`, `ledger-*.json`: one real-shaped save and ledger per released shape, generated from the code of that release (made-up data, no real player). Each is loaded by the current code, accepted by `acceptSave`, and must round-trip with nothing lost. **Never edit or delete a fixture to make a PR pass**; a release adds new ones.
- **`tests/saves/saveTolerance.test.ts`**: pins the tolerant behaviours of section 2.
- **`tests/saves/saveUpgrade.test.ts`**: the chain is pure, ordered, idempotent, refuses gaps.

## 7. Risks found and not fixed here (Linear backlog)

1. `profiles.player_class_known` CHECK constraint hard-codes the four classes: a fifth class needs a SQL migration first (and the same list is in `PLAYER_CLASSES`). Priority: Medium.
2. Biomes cannot be dropped tolerantly (a tile has to stay for the map to stay connected): the append-only guard is the only protection. A "retired biome renders as plains" fallback would remove the constraint. Priority: Low.
3. `clickLevel` is an index into a ladder with no ids: reordering is not detectable by a test (only the length is). Give tiers ids if the ladder is ever reworked. Priority: Low.
4. `acceptSave` / `restoreTrust` read `save_history` and `player_saves.core` through the same `decodeSave`; a **derived column** that changes meaning (`rates`, `derived.*`) is rebuilt on the next save but is stale for a player who does not come back. `migrate-saves` does not recompute derived columns yet. Priority: Low (add a `--recompute` when a release changes a derived value).
5. The Ember conservation check can still refuse a save when an upgrade's price rises above everything a player ever earned (needs a very high price jump). Priority: Low.
6. `upgradeStoredBank` stays until the reset has run (IDL-253); delete it then (separate task, not before launch).
