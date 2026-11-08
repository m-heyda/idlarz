# Saves and the server

What the browser keeps, what the server keeps, and what the server decides. Read from `src/lib/saveFormat.ts`, `src/lib/saveStorage.ts`, `src/lib/sanitizeSave.ts`, `src/lib/syncPolicy.ts`, `src/lib/cloudSave/*`, `src/lib/offline/*`, `src/app/api/*`, `supabase/schema.sql`.

## 1. The rule of the game

The game needs an account (there is no guest mode). The browser holds the game state and runs the economy (income, purchases, the map, the farm, the merchant's prices, stat allocation, rebirth bookkeeping). The server owns what is worth cheating for: when chests and monsters appear and where they stand, every kill and chest reward, every fight, the gem balance, the bag and worn gear, away-time pay, the XP ceiling and the Ember bound. The server judges the browser's save by plausibility, not by replaying actions.

## 2. The save in the browser

- **Text format** (`src/lib/saveFormat.ts`): `IDLZ2.` + base64(UTF-8 JSON) + `.` + 8-digit FNV check. Not encrypted; the check only catches cut-off text. `SAVE_SCHEMA` = 7; any other schema is refused (no migrations kept). Max text 3,000,000 chars.
- **Compact map**: only owned tiles, as runs per row, plus `extra` for tiles with a level, building or chest. Derived values (level, combat stats, tile upgrade costs, active chest count) are rebuilt on load.
- **Not saved**: monsters and the open fight (the server's).
- **Where** (`src/lib/saveStorage.ts`): `localStorage` keys `idlarz.save`, `.backup`, `.damaged`, `.previous-game` (on localhost every key gets a `.dev` suffix, `src/lib/storageScope.ts`). Written 2 s after a change (`FLUSH_DELAY_MS`) and on hide/close; the backup rotates every 10 minutes. A read goes through `sanitizeSave`; if `current` is refused the game starts from `backup`, keeps the bad text as `damaged`, then falls back to a new game.
- **One tab** (`src/hooks/useSingleTab.ts`): a Web Lock lets one tab run the game.
- **Validation** (`sanitizeSave`): rejects what the game cannot produce: bad land, a second castle, unconnected tiles, unknown ids, values below 0 or above 1e21, wrong attribute sums, impossible castle upgrades, click level outside the ladder, a prestige block that does not add up, less XP than the owned tiles produced; gear must be valid item instances (`instanceProblem` in `src/lib/itemInstance.ts`). Gear stats are derived, never read from the save.

## 3. Uploading (`src/lib/syncPolicy.ts`, `src/lib/manualCloudSave.ts`)

| Trigger | Upload |
| --- | --- |
| game start | once, after 4 s |
| milestone (tile, building, castle upgrade, rebirth, shop buys, level up, equip, claim ...) | after a 5 s settle, never closer than 30 s to the previous attempt |
| idle | every 5 min |
| tab hidden | at once unless an attempt was made in the last 11 s; `keepalive` only below 60,000 bytes |
| menu "Save game" | at most once per 10 minutes (`MANUAL_CLOUD_COOLDOWN_MS`) |
| failure | backoff 30 s, 1 min, 2 min, 5 min |

## 4. Accepting a save (`POST /api/save`, `acceptSave` in `src/lib/cloudSave/pipeline.ts`)

1. User id from the session cookie only; body capped at 600,000 bytes (`SAVE_BODY_MAX`); at most one accepted save per 10 s per account (`MIN_SAVE_INTERVAL_MS`).
2. The text must decode (checksum, schema, `sanitizeSave`). The stored copy is rebuilt from the sanitized state; rates and headline numbers are computed on the server (`summarize` in `cloudSave/summary.ts`).
3. `baseRev` must equal the stored `rev` (compare-and-swap) or the answer is `conflict`.
4. The server's inventory (bag, gear, pity, auto-sell) is stamped over the upload before anything is derived (a rebirth wipes it once, a New Game takes the new game's).
5. Checks, each producing a flag with a policy in `FLAG_POLICY` (`cloudSave/verify.ts`):

| Flag | Meaning | Decision |
| --- | --- | --- |
| `baseline_rich` | first save holds more gold than its rates and play time explain | flag |
| `networth_exceeds` | land, buildings, castle, merchant levels, gold and stock worth more than income x time x 3 + 3,600 s burst (`netWorth.ts`) | clamp (pay from the last trusted economy) |
| `playtime_regress` | play time went back within a run | flag |
| `playtime_fast` | more play time than real time passed (x1.05 + 30 s) | reject |
| `gold_jump` | gold gain above income x time x 1.5 + burst + 1,000 + 2% of balance + server grants | reject |
| `xp_jump` | XP above what bought tiles, play time and server payouts explain (`xpModel.ts`) | clamp |
| `gems_increase` | gems above the server's balance | reject |
| `prestige_regress` | rebirths or Embers earned went down | flag |
| `castle_jump` | castle level or timer faster than real time | clamp |
| `ember_jump` | Embers above what the last save's castle and land can pay (`emberModel.ts`) | clamp |

- **Rejection is switched off**: `ENFORCEMENT.enabled = false` (`verify.ts`). In this shadow mode flagged saves are stored and only the account's ranking eligibility suffers (`POISON_FLAGS`). With it on, only `playtime_fast`, `gold_jump` and `gems_increase` refuse a save (HTTP 422).
- **Trusted economy** (`trustedEconomy.ts`): after `castle_jump` or `networth_exceeds` the rates, castle level and castle timer the server pays from are those of the last trusted save of the same run; unpaid merchant levels are put back to the last trusted level (Pack Rat excepted).
- **XP model** (`XP_MODEL`): allowed = tile XP of the bought tiles x 1.02 + passive XP x 1.25 + server grants, plus headroom 900 s of income or 2,000. The first save may hold 3x that. The browser takes the lower XP the server returns.
- **Ember model** (`EMBER_MODEL`): Embers only rise with the rebirth count; one rebirth fits between two saves and it must be believable from the previous castle and land; a first save is bounded by 4 hours of play per rebirth and a 1,000-tile best case. `requireServerRebirth` is off.
- **History**: a full copy goes to `save_history` every 30 minutes of the clock and when a new flag appears; 6 newest + 3 pinned per player (`HISTORY_EVERY_MS`, `HISTORY_KEEP`, `PINNED_KEEP`).
- **Test accounts**: a save through a non-production server marks the account `test_account` (sticky); its flags never count and it is never ranked (`environment.ts`).
- **Ranking eligibility** (`trusted`): the first save was a young game (≤ 900 s of play) and no poison flag was ever raised.

## 5. Tables (`supabase/schema.sql`, `supabase/migrations/*`)

`profiles`, `player_saves` (small row: `core`, typed columns, `rev`, `flags`), `player_worlds` (the map, written only when it changed, by hash), `player_stats` (leaderboard row, trusted only), `save_history`, `player_ledger` (the server's own record), `rebirth_history`, `app_settings` (season reset marker). The only write path for a save is `save_player_state`, executable by the service role; the ledger has no SQL logic, its compare-and-swap on `ver` is in TypeScript.

## 6. The ledger (`src/lib/offline/ledger.ts`)

One row per player, written only by the server. It holds: the run id and rebirth count, the away-time anchor, the **ticket bank** (timers and waiting chests and monsters), the kill and chest counters that seal the rolls, `granted` and `grantedSeen` (what the server paid), the gem balance, the last idempotency key and result, `combat` (HP, mana, cooldowns, the open fight, queue, switches, retry times, event log), `inv` (bag, gear, pity, auto-sell, Pack Rat size) and `resetAt`.

- **Sealed rolls** (`src/lib/offline/seal.ts`): every reward is seeded by `HMAC-SHA256(LOOT_SECRET, userId | runId | kind | ordinal)` with a fresh digest per draw. The ordinal is consumed on the server, so a reload cannot reroll. A rebirth or New Game starts a new run id. `LOOT_SECRET` is server-only; without it `/api/offline`, `/api/spawn`, `/api/chest` and `/api/fight` answer 503.
- **Idempotency**: a repeated request with the same key replays the stored answer; two browsers cannot both claim (compare-and-swap).
- **Tickets**: a chest or monster exists only as a ticket the server minted from its own clock. Opening a chest names a tile; no ticket on that tile, no reward. Timers and caps: [monsters.md](monsters.md) §3 and [economy.md](economy.md) §9. The browser draws exactly the tickets the server lists (`reconcileTickets` in `src/lib/offline/reconcile.ts`).

## 7. Endpoints (`src/app/api`)

| Route | Does |
| --- | --- |
| `auth/login`, `register`, `logout`, `me`, `profile` | account and character profile |
| `save` GET / POST / DELETE | read, accept (above), New Game |
| `offline` POST | claim the away income |
| `spawn` POST | tickets due, combat sync; polled |
| `chest` POST | open the chest on a tile |
| `fight` POST | combat commands (fight, queue, potion, skill, dismiss, switches) |
| `inventory` POST | `equip`, `unequip`, `move`, `organize`, `discard`, `sell`, `sellJunk`, `autoSell`, `buyShop`, `buyOffer`; every operation except the two purchases and `autoSell` is refused while a fight is open |
| `rebirth` POST | run the rebirth on the stored save |
| `rebirths` GET | the player's rebirth history |

The merchant's prices and shelf are still the browser's: a purchase through `inventory` is checked for being a valid item, and its gold is paid in the browser.

## 8. Away time (`/api/offline`, `computeOfflineGrant` in `src/lib/offline/grant.ts`)

- Gap = server clock now minus the later of the ledger anchor and the last accepted save. Gaps shorter than 300 s (`offlineMinGapSec`) pay nothing.
- `elapsed = min(gap, cap)` with cap = 8 h + Night Watch + set hours (hard 72 h).
- Paid = `rates x elapsed x efficiency`, efficiency = 50% + Steward + set points (hard 100%); XP also times `(1 + XP gain %)`; floored. If the castle upgrade finishes during `elapsed`, the rest is paid at the higher rates.
- Castle timers and monster growth run at full speed for the whole `elapsed`; chests and monsters arrive at the efficiency rate.
- Online calls are refused with `claim_first` when more than `UNCLAIMED_SEC` = 900 s passed since the player was last seen; a gap over 900 s also rests the hero (`restThrough`). The client heals HP/mana fully for a gap of 600 s or more (`FULL_HEAL_AFTER_SEC` in `src/lib/offline/apply.ts`).
- Write-skipping: a poll that moved only the clock does not write the ledger unless the anchor fell 120 s behind (`ANCHOR_REFRESH_MS`).

## 9. Season resets

`npm run reset-players` writes `app_settings.last_reset`; a player whose ledger `resetAt` is older is reset once at their next login (`ensureSeasonReset` in `src/lib/offline/season.ts`). Operating guide: [reset-players-cli](../ops/reset-players-cli.md).

## 10. Honest limits

- A cheater who stays inside the spending bound (about 3x honest progress) is not caught; flags only un-rank because enforcement is off.
- The save text is not signed; editing localStorage is easy and the server is what is trusted.
- Gear and bag contents cannot be verified from a save, which is why the server owns them.
- Gems cannot be raised by a save; the first save of an existing player cannot be delta-checked.
- Tile purchases, building costs, farm and castle upgrades are paid in the browser, not by the server.

## 11. Threat model and how to extend the save

### What the server guarantees (and what it cannot)

| Guarantee | How |
|---|---|
| Away time is server time | `now - max(ledger.anchor_at, last accepted save)` on the server clock; the client sends no duration |
| Value only comes from server answers | income while away, chest and kill rewards and gems are computed by the server; the **grant ledger** (`granted`) holds the lifetime totals, and the save verifier allows a gain only up to `income x time + what the server granted since the last save` |
| Rolls cannot be re-rolled or predicted | a reward is seeded by `HMAC(LOOT_SECRET, userId / run / kind / ordinal)` (`lib/offline/seal.ts`); the ordinal is consumed on the server, a repeated request with the same key replays the stored answer |
| Opening 5 chests in 5 seconds earns nothing extra | a chest opens only against a **ticket** the server minted from its own clock; no ticket, no reward. The same logic catches a forged gold jump in the next upload (`gold_jump`, `networth_exceeds`) |
| Gems are the server's | `player_ledger.gems` is the balance; an upload can never raise it (a larger number is flagged `gems_increase` and replaced by the ledger balance); a new account starts at the 1000 gift at most |
| Two browsers cannot both claim | every ledger write is a compare-and-swap on `ver` |

**Known limits.** The browser still holds the game state, so someone editing local memory can add anything that stays inside the verifier's bounds without being caught; flags only un-rank an account (shadow mode), they do not reject. Monsters and chests are placed by the server (`lib/offline/placement.ts`). The level a kill is paid at is not claimed by the client: it comes from the ticket's spawn level and age (`levelAtAge` in `lib/monsters.ts`).

### Who checks what

| Thing | Browser | Server |
| --- | --- | --- |
| Time | game time from `performance.now()`, a tick is clamped to 0…300 s, castle timers count tick time | away time is the server clock since the last save or claim; claims are idempotent and compare-and-swap |
| Clicks | only trusted clicks on the map pay; shared token buckets (burst 8, 5/s, long-run 1.5/s) | none needed: click income is bounded by the save checks |
| Merchant | buy rounds up, sell rounds down, shelf price is 5x the sell value; tests sweep every resource | none |
| Edited save text | `sanitizeSave` rejects impossible data and recomputes derived values | the cloud copy is rebuilt from the sanitized state; gold, XP and gems are checked against income and grants |
| XP and level | save floor (XP the owned tiles must have produced) | `cloudSave/xpModel.ts` clamps a save's XP to what bought tiles, play time and server payouts can explain; the browser takes the lower number (`applyServerXp`) |
| Chests, kills, gems | none: a chest opens only against a server ticket | sealed rolls (`HMAC(LOOT_SECRET, user / run / kind / ordinal)`), the ledger holds the gem balance, a save can never raise it |
| Monsters and fights | none: the browser only displays and asks | the server places monsters, runs every fight and pays the win; HP, mana and potions are the ledger's |
| Gold jumps / forged land | none | `networth_exceeds`, `gold_jump`, `playtime_*`, `prestige_regress`, `castle_jump`, `baseline_rich`, `ember_jump` flags, **shadow mode**: stored, the save is accepted; flagged accounts are never ranked (section 4) |
| Rebirth | needs castle ≥ 6 and 400 tiles (+50 per rebirth); points computed in the store; shop spending is checked by the point-conservation rule on every load | the ledger starts a new run (sealed rolls never repeat) |
| Settings in `localStorage` | cosmetic only | not stored |

The honest summary: the browser still owns the economy (income, purchases, the map). A cheater who stays inside the spending bound (about 3x honest progress) is not caught, and flags only un-rank, they do not reject. Enforcing the checks and server-run economy actions are planned ([ROADMAP](../plan/ROADMAP.md)); the inventory is already the server's.

### Save & Backup dialog (Settings → *Save & backup*, or Control x5)

- **Status**: when it last saved and how big it is, whether the browser protects the storage, and any storage error or load problem.
- **Export**: the whole game as one line of text with *Copy* and *Download file* (`idlarz-YYYYMMDD-HHMM.sav`).
- **Import**: paste the text or open a file. The text is checked as it arrives and shows level / castle / tiles / play time / save date; only on confirmation does it replace the save (the old one becomes the backup) and reload. Damaged, cut-off, foreign, impossible and *newer-version* saves are refused with a reason.
- **Reset**: confirmation, then wipes the save, the backup and the damaged copy, and reloads.

### How to extend the save safely

- **New persisted field**: add it to `PERSISTED_KEYS`, make `sanitizeSave` accept it as *optional with a default* (old saves simply lack it) and validate it. No version bump. Add the field to a test that round-trips it (`tests/saves/saveStorage.test.ts`).
- **Renamed, moved or reinterpreted field, or removed content** (an item, a building, a biome): bump `SAVE_SCHEMA` in `src/lib/saveFormat.ts`. Older saves are then refused. If they must survive, write the conversion for that bump (a `MIGRATIONS`-style step in `decodeSave`) and a frozen fixture save of the old version in `tests/fixtures/saves/`; the project does not carry any today.
- A save from a *newer* schema than the running game is refused with a clear message instead of being half-loaded.
- **New action that moves resources**: validate inputs (type, range, finiteness, ownership), check affordability against the full cost bundle, and add a test in `tests/economy/economy.test.ts`.
- **Anything that decides a reward or a fight** belongs on the server side (`src/lib/offline/`), seeded by the sealed random source, not in the store (section 11 above).
- **Balance changes**: run `npm run docs:gen` and `npm test` (the click limiter, arbitrage and fight-balance tests guard the main exploits).
