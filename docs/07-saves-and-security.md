# 07 · Saves & security

The browser holds the game state, so **nothing in the browser can be tamper-proof**: whatever it can read, a determined person can read and edit. The goals are (1) remove every *cheap* cheat (editing `localStorage`, setting the clock forward, auto-clickers, buy/sell loops, console-injected clicks) and (2) make the things that carry the most value server-owned, so editing the browser cannot invent them. What the server owns is in [11](11-server-authority.md); how its copy of the save is verified is in [09](09-cloud-saves.md).

## 1. Where the save lives

- **`localStorage`**, key `idlarz.save` (the game), `idlarz.save.backup` (the previous game), `idlarz.save.damaged` (only if a save could not be read) and `idlarz.save.previous-game` (the game a New Game replaced; Reset never removes it). On localhost every key gets a `.dev` suffix (`src/lib/storageScope.ts`). Code: `src/lib/saveStorage.ts`. Sound/volume/ambient preferences are separate (`idlarz-settings`). The account's cloud copy is the verified one ([09](09-cloud-saves.md)); the local copy is a cache and the export path.
- **One line of text**, the same in storage and in an export: `IDLZ2.` + base64(UTF-8 JSON) + `.` + an 8-digit check code (`src/lib/saveFormat.ts`). It is deliberately **not encrypted**. The check code only detects a cut-off or garbled copy; what keeps an edited save honest is `sanitizeSave` (§2), which rejects anything the game cannot produce and recomputes everything derived.
- **Compact**: only owned tiles are written, as runs per row (`land`: `[y, x0, letters]`, one letter per biome, plus `extra` for the tiles that carry a level, building or chest; coordinates may be negative); derived values (level, combat stats, tile upgrade costs, `activeChests`) are left out and rebuilt on load. A 20-tile game is about 2 KB, a 50,000-tile map 75 KB and the 250,000-tile maximum about 350 KB.
- **Schema and migrations**: `SAVE_SCHEMA = 6` (`saveFormat.ts`). `MIGRATIONS[1]` (land as runs), `[2]` (gear ids to item instances, `legacyGear.ts`), `[3]` (Grounds tiles to land, `groundsMigration.ts`), `[4]` (monster tiers to levels, `monstersMigration.ts`), `[5]` (the slow level curve, `levelsMigration.ts`). Frozen saves of old versions live in `tests/fixtures/saves/` (`v1`, `v2`, `v3`, `v3-grounds`, `v4-monsters`, `v5-levels`); the fixture test loads every file there.
- **Why a save survives closing the browser**: writes are *synchronous*, so a write inside `pagehide` / `visibilitychange` / `beforeunload` completes before the page goes. While playing it saves at most every 2 s; nothing is written before the first load has finished (a fresh game must never overwrite a real save) or while another tab owns the game.
- **Two copies**: `backup` is the save as it was at the start of the session and is refreshed every 10 minutes. If `current` cannot be read, the game starts from `backup`, the unreadable text is kept as `damaged` (never overwritten silently) and the Save dialog says what happened and offers *Copy damaged save*.
- **Own copies are read leniently** (`src/lib/repairSave.ts`, `decodeSave(text, { lenient: true })`): the browser's `current` / `backup`, the start hub's peek and the account's save being installed. When the strict check refuses one for a *rule that moved* (HP or mana above the new maximum, attribute points that no longer match the level curve, XP below what the land now costs, Embers that no longer add up, a removed item / building / animal / upgrade, a bag of the wrong size, a castle timer past its duration, a merchant shelf with a removed item, a value out of range), that value is clamped, dropped or recomputed and the check runs again until it passes. The land is never changed, and a damaged map, a bad check code or a save that is not a save stays refused. The text the game came from is kept as `damaged` and the Save dialog says the save was adjusted. The server (`acceptSave`) and imports stay strict, and what is uploaded is the adjusted game, which passes them. **A new rule in `sanitizeSave` needs its repair in `repairSave.ts`** (`FIXES`, keyed by the reason text) and a case in `tests/repairSave.test.ts`, or a rule change can lock players out again.
- **Persistent storage**: after the first successful write the browser is asked once for `navigator.storage.persist()`. **Refusals** (storage full, blocked, private mode): the game keeps running with the save in memory and the dialog shows a warning pointing at *Copy*.
- **Old formats**: the first format (the encrypted IndexedDB vault and `IDLZ1.` exports) is no longer read: `legacyVault.ts` was deleted, so only `IDLZ2.` text saves import. `legacyGear.ts` and the other migration modules stay: they turn old *schemas* of the current format into the current one.
- Only game data is saved (`PERSISTED_KEYS` in `src/lib/sanitizeSave.ts`; the list is in [01](01-architecture.md)). Monsters and the open fight are **not** saved: they are the server's.

## 2. Validation on load / import (`sanitizeSave`)

A save is rejected if it contains anything the game cannot produce: a malformed land list (unknown biome letter, a run off the map, more than 250,000 tiles, two tiles in one place, an `extra` entry for a tile that is not there), a second castle or none, owned tiles not connected to the castle, buildings/chests on invalid tiles, unknown animals, negative / non-finite / above-10²¹ resources, more stat points than the level allows (or far fewer), fractional stats, castle level out of range, a castle upgrade that is not "next level" or has an impossible timer, click level outside the ladder, out-of-range timers, a `prestige` block that does not add up, or **less XP than the owned tiles must have produced**. Saves a few points behind (written between a purchase and the next tick) are repaired.

- **Gear**: equipped and bagged gear are item **instances** `{ base, level, rarity, quality, affixes: [{ id, roll }] }`. `base` must be in `ITEM_CATALOG` and fit the slot, and `instanceProblem` (`lib/itemInstance.ts`) checks the level window, rarity, affix ids, counts and roll ranges, so a save can only describe items the generator could make. Stats are derived on load and never read from the save. Consumables are `{ id, qty }` within the stack limit; gear never stacks.
- **Bag size** is `limitOf('bagSize')` (36 plus Pack Rat), not a constant.
- **Other optional fields**: `lootPity` (counters by `profile:table`), `autoSellUpTo` (a rarity id), `playerMp`, `merchantStock` (every offer goes through the same item validation as the bag; the price is derived, never read) and `merchantRefreshes`. A save without equipment + bag gets the starter kit; one of the two alone is rejected.
- **Prestige block** (optional): all numbers are non-negative integers, shop ids are known, levels do not exceed the maximum, `legacyPoints + emberSpent === legacyEarned` (the spent part is recomputed from the shop levels), and `rebirths = 0` implies `legacyEarned = 0` while `rebirths > 0` implies `legacyEarned > 0`. A forged point balance or shop level is rejected, not repaired.

Tests: `tests/saves.test.ts`, `saveStorage.test.ts`, `saveWorld.test.ts`, `rebirth.test.ts`. What validation **cannot** prove: that the player really earned a legal amount of gold or resources. That is what the server-side checks are for (§5).

## 3. Save & Backup (Settings → *Save & backup*, or Control x5)

- **Status**: when it last saved and how big it is, whether the browser protects the storage, and any storage error or load problem.
- **Export**: the whole game as one line of text with *Copy* and *Download file* (`idlarz-YYYYMMDD-HHMM.sav`).
- **Import**: paste the text or open a file. The text is checked as it arrives and shows level / castle / tiles / play time / save date; only on confirmation does it replace the save (the old one becomes the backup) and reload. Damaged, cut-off, foreign, impossible and *newer-version* saves are refused with a reason.
- **Reset**: confirmation, then wipes the save, the backup and the damaged copy, and reloads.

## 4. One tab at a time

A Web Lock (`navigator.locks`) lets only one tab run the game; another tab shows "Already open in another tab" with a *Play here instead* button, which takes over and reloads the latest save. A demoted tab stops writing, so two tabs can never overwrite each other or double the income.

## 5. Who checks what

| Thing | Browser | Server |
| --- | --- | --- |
| Time | game time from `performance.now()`, a tick is clamped to 0…300 s, castle timers count tick time | away time is the server clock since the last save or claim; claims are idempotent and compare-and-swap |
| Clicks | only trusted clicks on the map pay; shared token buckets (burst 8, 5/s, long-run 1.5/s) | none needed: click income is bounded by the save checks |
| Merchant | buy rounds up, sell rounds down, shelf price is 5x the sell value; tests sweep every resource | none |
| Edited save text | `sanitizeSave` rejects impossible data and recomputes derived values | the cloud copy is rebuilt from the sanitized state; gold, XP and gems are checked against income and grants |
| XP and level | save floor (XP the owned tiles must have produced) | `cloudSave/xpModel.ts` clamps a save's XP to what bought tiles, play time and server payouts can explain; the browser takes the lower number (`applyServerXp`) |
| Chests, kills, gems | none: a chest opens only against a server ticket | sealed rolls (`HMAC(LOOT_SECRET, user / run / kind / ordinal)`), the ledger holds the gem balance, a save can never raise it |
| Monsters and fights | none: the browser only displays and asks | the server places monsters, runs every fight and pays the win; HP, mana and potions are the ledger's |
| Gold jumps / forged land | none | `networth_exceeds`, `gold_jump`, `playtime_*`, `prestige_regress`, `castle_jump`, `baseline_rich` flags, **shadow mode**: stored, the save is accepted; flagged accounts are never ranked ([09](09-cloud-saves.md)) |
| Rebirth | needs castle ≥ 6 and 400 tiles (+25 per rebirth); points computed in the store; shop spending is checked by the point-conservation rule on every load | the ledger starts a new run (sealed rolls never repeat) |
| Settings in `localStorage` | cosmetic only | not stored |

The honest summary: the browser still owns the economy (income, purchases, the map). A cheater who stays inside the spending bound (about 3x honest progress) is not caught, and flags only un-rank, they do not reject. Server-owned inventory, enforcing checks and server-run economy actions are the planned next steps ([ROADMAP](ROADMAP.md)).

## 6. How to extend safely

- **New persisted field**: add it to `PERSISTED_KEYS`, make `sanitizeSave` accept it as *optional with a default* (old saves simply lack it) and validate it. No version bump. Add the field to a test that round-trips it (`tests/saveStorage.test.ts`).
- **Renamed, moved or reinterpreted field, or removed content** (an item, a building, a biome): bump `SAVE_SCHEMA` in `src/lib/saveFormat.ts` and add `MIGRATIONS[oldVersion]`, which gets the old body and returns the new one. Never edit an old migration. Freeze a save of the old version into `tests/fixtures/saves/` (`vN.sav`), so a change that breaks old saves fails the build.
- A save from a *newer* schema than the running game is refused with a clear message instead of being half-loaded.
- **New action that moves resources**: validate inputs (type, range, finiteness, ownership), check affordability against the full cost bundle, and add a test in `tests/economy.test.ts`.
- **Anything that decides a reward or a fight** belongs on the server side (`src/lib/offline/`), seeded by the sealed random source, not in the store ([11](11-server-authority.md)).
- **Balance changes**: run `npm run docs:gen` and `npm test` (the click limiter, arbitrage and fight-balance tests guard the main exploits).
