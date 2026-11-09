# Saves & Server

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

The save, cloud-save checks, the ledger, sealed rolls, away time and the threat model.

**Contents**

- Threat model: [The server's rule and the threat model](#the-server-s-rule-and-the-threat-model)
- The save: [`SAVE_SCHEMA`](#save-schema), [`createSaveStorage`](#createsavestorage), [`sanitizeSave`](#sanitizesave), [`PERSISTED_KEYS`](#persisted-keys), [Save and Backup dialog](#save-and-backup-dialog)
- Uploading: [`SYNC`](#sync), [`canRebase`](#canrebase), [`MANUAL_CLOUD_COOLDOWN_MS`](#manual-cloud-cooldown-ms), [`resolveConflict`](#resolveconflict), [`withPushLock`](#withpushlock)
- Accepting a save: [`acceptSave`](#acceptsave), [`FLAG_POLICY`](#flag-policy), [`trustedEconomy`](#trustedeconomy), [`XP_MODEL`](#xp-model), [`EMBER_MODEL`](#ember-model), [`MIN_SAVE_INTERVAL_MS`](#min-save-interval-ms), [`verifyTransition`](#verifytransition), [`isNonProduction`](#isnonproduction), [`POISON_FLAGS`](#poison-flags), [`ENFORCEMENT`](#enforcement)
- The ledger: [`Ledger`](#ledger), [`sealedRng`](#sealedrng)
- Endpoints: [Endpoints (the API routes)](#endpoints-the-api-routes)
- Away time: [`computeOfflineGrant`](#computeofflinegrant), [`ensureSeasonReset`](#ensureseasonreset)

## Threat model

<a id="the-server-s-rule-and-the-threat-model"></a>

### The server's rule and the threat model

Source: [`src/lib/cloudSave/pipeline.ts:1`](../../src/lib/cloudSave/pipeline.ts)

What the browser keeps, what the server keeps, and what the server decides.

**The rule of the game.** The game needs an account (there is no guest mode). The browser holds the game state and runs the economy (income, purchases, the map, the farm, the merchant's prices, stat allocation, rebirth bookkeeping).
The server owns what is worth cheating for: when chests and monsters appear and where they stand, every kill and chest reward, every fight, the gem balance, the bag and worn gear, away-time pay, the XP ceiling and the Ember bound.
The server judges the browser's save by plausibility, not by replaying actions.

**What the server guarantees (and what it cannot)**

| Guarantee | How |
| --- | --- |
| Away time is server time | `now - max(ledger.anchor_at, last accepted save)` on the server clock; the client sends no duration |
| Value only comes from server answers | income while away, chest and kill rewards and gems are computed by the server; the grant ledger (`granted`) holds the lifetime totals, and the save verifier allows a gain only up to `income x time + what the server granted since the last save` |
| Rolls cannot be re-rolled or predicted | a reward is seeded by `HMAC(LOOT_SECRET, userId / run / kind / ordinal)` ([`sealedRng`](saves-and-server.md#sealedrng)); the ordinal is consumed on the server, a repeated request with the same key replays the stored answer |
| Opening 5 chests in 5 seconds earns nothing extra | a chest opens only against a **ticket** the server minted from its own clock; no ticket, no reward. The same logic catches a forged gold jump in the next upload (`gold_jump`, `networth_exceeds`) |
| Gems are the server's | `player_ledger.gems` is the balance; an upload can never raise it (a larger number is flagged `gems_increase` and replaced by the ledger balance); a new account starts at the 1000 gift at most |
| Two browsers cannot both claim | every ledger write is a compare-and-swap on `ver` |

**Who checks what**

| Thing | Browser | Server |
| --- | --- | --- |
| Time | game time from `performance.now()`, a tick is clamped to 0...300 s, castle timers count tick time | away time is the server clock since the last save or claim; claims are idempotent and compare-and-swap |
| Clicks | only trusted clicks on the map pay; shared token buckets (burst 8, 5/s, long-run 1.5/s) | none needed: click income is bounded by the save checks |
| Merchant | buy rounds up, sell rounds down, shelf price is 5x the sell value; tests sweep every resource | none |
| Edited save text | `sanitizeSave` rejects impossible data and recomputes derived values | the cloud copy is rebuilt from the sanitized state; gold, XP and gems are checked against income and grants |
| XP and level | save floor (XP the owned tiles must have produced) | `xpModel.ts` clamps a save's XP to what bought tiles, play time and server payouts can explain; the browser takes the lower number (`applyServerXp`) |
| Chests, kills, gems | none: a chest opens only against a server ticket | sealed rolls, the ledger holds the gem balance, a save can never raise it |
| Monsters and fights | none: the browser only displays and asks | the server places monsters, runs every fight and pays the win; HP, mana and potions are the ledger's |
| Gold jumps / forged land | none | the flags of [`FLAG_POLICY`](saves-and-server.md#flag-policy), in **shadow mode**: stored, the save is accepted; flagged accounts are never ranked |
| Rebirth | needs castle >= 6 and 400 tiles (+50 per rebirth); points computed in the store; shop spending is checked by the point-conservation rule on every load | the ledger starts a new run (sealed rolls never repeat) |
| Settings in `localStorage` | cosmetic only | not stored |

**Honest limits.** A cheater who stays inside the spending bound (about 3x honest progress) is not caught; flags only un-rank because enforcement is off. The save text is not signed; editing localStorage is easy and the server is what is trusted.
Gear and bag contents cannot be verified from a save, which is why the server owns them. Gems cannot be raised by a save; the first save of an existing player cannot be delta-checked.
Tile purchases, building costs, farm and castle upgrades are paid in the browser, not by the server. Monsters and chests are placed by the server ([`placeTickets`](monsters.md#placetickets)). The level a kill is paid at is not claimed by the client:
it comes from the ticket's spawn level and age ([`levelAtAge`](monsters.md#levelatage)). Enforcing the checks and server-run economy actions are planned (`docs/plan/ROADMAP.md`); the inventory is already the server's.

See also: [`acceptSave`](saves-and-server.md#acceptsave), [`FLAG_POLICY`](saves-and-server.md#flag-policy), [`ENFORCEMENT`](saves-and-server.md#enforcement)

## The save

<a id="save-schema"></a>

### `SAVE_SCHEMA` <small>const</small>

Source: [`src/lib/saveFormat.ts:35`](../../src/lib/saveFormat.ts)

The save in the browser. **Text format**: `IDLZ2.` + base64(UTF-8 JSON) + `.` + 8-digit FNV check. Not encrypted; the check only catches cut-off text. Any other schema is refused (no migrations kept). Max text 3,000,000 characters.
The map is compact (only owned tiles, as runs per row, plus `extra` for tiles with a level, building or chest); derived values (level, combat stats, tile upgrade costs, active chest count) are rebuilt on load.
Not saved: monsters and the open fight (the server's).

See also: [`PERSISTED_KEYS`](saves-and-server.md#persisted-keys), [`sanitizeSave`](saves-and-server.md#sanitizesave)

<a id="createsavestorage"></a>

### `createSaveStorage` <small>function</small>

Source: [`src/lib/saveStorage.ts:75`](../../src/lib/saveStorage.ts)

Where the save lives: `localStorage` keys `idlarz.save`, `.backup`, `.damaged`, `.previous-game` (on localhost every key gets a `.dev` suffix, `src/lib/storageScope.ts`). Written 2 s after a change (`FLUSH_DELAY_MS`)
and on hide/close; the backup rotates every 10 minutes. A read goes through `sanitizeSave`; if `current` is refused the game starts from `backup`, keeps the bad text as `damaged`, then falls back to a new game.
One tab owns the game at a time (`src/hooks/useSingleTab.ts`, a Web Lock).

<a id="sanitizesave"></a>

### `sanitizeSave` <small>function</small>

Source: [`src/lib/sanitizeSave.ts:193`](../../src/lib/sanitizeSave.ts)

Validates and normalises a loaded/imported save. Anything that cannot be produced by playing the game
(impossible grid, negative/huge/non-numeric values, more stat points than the level allows, XP that does not
pay for the owned tiles ...) is rejected; derived values (rates, level, combat stats, castle
cost) are recomputed instead of trusted. Returns the cleaned persisted slice.

Validation of any loaded or imported save. It rejects what the game cannot produce: bad land, a second castle, unconnected tiles, unknown ids, values below 0 or above 1e21, wrong attribute sums, impossible castle upgrades,
a click level outside the ladder, a prestige block that does not add up, less XP than the owned tiles produced; gear must be valid item instances (`instanceProblem` in `src/lib/itemInstance.ts`). Gear stats are derived, never read from the save.

<a id="persisted-keys"></a>

### `PERSISTED_KEYS` <small>const</small>

Source: [`src/lib/sanitizeSave.ts:60`](../../src/lib/sanitizeSave.ts)

The part of the game state that is saved. Rates, window flags and the like are recomputed on load.

**How to extend the save safely.**

- **New persisted field**: add it to `PERSISTED_KEYS`, make `sanitizeSave` accept it as *optional with a default* (old saves simply lack it) and validate it. No version bump. Add the field to a test that round-trips it (`tests/saves/saveStorage.test.ts`).
- **Renamed, moved or reinterpreted field, or removed content** (an item, a building, a biome): bump `SAVE_SCHEMA` in `src/lib/saveFormat.ts`. Older saves are then refused. If they must survive, write the conversion for that bump
  (a `MIGRATIONS`-style step in `decodeSave`) and a frozen fixture save of the old version in `tests/fixtures/saves/`; the project does not carry any today. A save from a *newer* schema than the running game is refused with a clear message.
- **New action that moves resources**: validate inputs (type, range, finiteness, ownership), check affordability against the full cost bundle, and add a test in `tests/economy/economy.test.ts`.
- **Anything that decides a reward or a fight** belongs on the server side (`src/lib/offline/`), seeded by the sealed random source, not in the store.
- **Balance changes**: run `npm run docs:gen` and `npm test` (the click limiter, arbitrage and fight-balance tests guard the main exploits).

The list below is the one list of persisted state: `tiles`, `resources`, `level`, `playerName`, `characterStats`, `farmLevels`, `merchantUpgrades`, `prestige`, `equipment`, `bag`, ... Everything not listed is rebuilt on load
(`resourceRates`, derived combat stats, every window flag) or belongs to the server (`monsters`, the open fight).

**PERSISTED_KEYS** _(computed from the code)_

`tiles`, `resources`, `level`, `previousLevel`, `playerName`, `playerClass`, `characterStats`, `farmLevels`, `farmUpgrades`, `merchantUpgrades`, `clickLevel`, `castleUpgrade`, `prestige`, `freeTiles`, `playSeconds`, `activeChests`, `gems`, `equipment`, `bag`, `playerHp`, `playerMp`, `lootPity`, `autoSellUpTo`, `merchantStock`, `merchantRefreshes`, `merchantRefresh`

<a id="save-and-backup-dialog"></a>

### Save and Backup dialog

Source: [`src/components/game/overlays/SaveMenuDialog.tsx:1`](../../src/components/game/overlays/SaveMenuDialog.tsx)

The Save & Backup dialog (Settings, *Save & backup*, or Control x5).

- **Status**: when it last saved and how big it is, whether the browser protects the storage, and any storage error or load problem.
- **Export**: the whole game as one line of text with *Copy* and *Download file* (`idlarz-YYYYMMDD-HHMM.sav`).
- **Import**: paste the text or open a file. The text is checked as it arrives and shows level / castle / tiles / play time / save date; only on confirmation does it replace the save (the old one becomes the backup) and reload.
  Damaged, cut-off, foreign, impossible and *newer-version* saves are refused with a reason.
- **Reset**: confirmation, then wipes the save, the backup and the damaged copy, and reloads.

## Uploading

<a id="sync"></a>

### `SYNC` <small>const</small>

Source: [`src/lib/syncPolicy.ts:17`](../../src/lib/syncPolicy.ts)

When the game is copied to the account's cloud save. Pure: the clock, the timers and the upload itself are injected,
so the cadence is tested without a browser.

  first upload     4 s after the game starts
  events           a purchase, castle upgrade, rebirth, level up: uploaded after a short settle (5 s) so a burst is ONE
                   upload, and never closer than 30 s to the previous attempt
  heartbeat        every 5 min (idle income is rebuilt from the rates on the server, so frequent uploads add nothing)
  hiding the tab   uploaded at once, unless an upload was tried in the last 11 s (the server accepts one per 10 s)
  failure          30 s, 1 min, 2 min, 5 min, then 5 min; back to normal after a success. A 409 the browser cannot resolve on its own
                   (the account's save is ahead) is a failure too: re-checked on this schedule, never given up for the session

**When the game is uploaded to the account** _(computed from the code)_

| Trigger | Upload |
| --- | --- |
| game start | once, after 4 s |
| milestone (tile, building, castle upgrade, rebirth, shop buys, level up, equip, claim ...) | after a 5 s settle, never closer than 30 s to the previous attempt |
| idle | every 5 min |
| tab hidden | at once unless an attempt was made in the last 11 s; `keepalive` only below 60 K bytes |
| menu "Save game" | at most once per 10 minutes |
| failure | backoff 30 s, 1 min, 2 min, 5 min |

<a id="canrebase"></a>

### `canRebase` <small>function</small>

Source: [`src/lib/cloudRecovery.ts:27`](../../src/lib/cloudRecovery.ts)

Whether a refused upload (409, "the account has a newer save") may be resolved without asking the player: this browser's game is the same
game as the account's save and is at least as far along, so uploading it on top of the cloud revision loses nothing. Decided from numbers
both sides hold, never from anything the server could be asked to trust:

  - the cloud revision is above the one this browser's link holds (the account's save continued from the one this browser knew; a New Game
    on another device starts the revisions again and is never "continued"), and
  - the cloud save is not ahead in play time, level or tiles, and is in the same rebirth (a higher rebirth count is another run).

Anything else (the cloud is ahead in any of them, or the rebirths differ) is a real divergence: the player chooses in the hub and nothing is
overwritten. The server's own revision check stays as it was; this only lets the browser re-base on the revision it is told about.

**Formula**

```text
recover = cloud.rev > link.rev && cloud.playSeconds <= local.playSeconds && cloud.level <= local.level && cloud.tilesOwned <= local.tilesOwned && cloud.rebirths == local.rebirths
```

<a id="manual-cloud-cooldown-ms"></a>

### `MANUAL_CLOUD_COOLDOWN_MS` <small>const</small>

Source: [`src/lib/manualCloudSave.ts:15`](../../src/lib/manualCloudSave.ts)

"Save game" in the menu: always saves to this browser, and when an account is signed in it also uploads the game to the
account's cloud save, at most once every 10 minutes. The automatic uploads (milestones, the 5 minute heartbeat, hiding the
tab) keep running on their own; this is the player's manual button, so the limit is about how often it may be pressed.
Pure apart from the small registry and the remembered time: the clock, the storage and the uploader are injected.

The menu's "Save game" button uploads at most once per 10 minutes.

<a id="resolveconflict"></a>

### `resolveConflict` <small>function</small>

Source: [`src/lib/cloudClient.ts:211`](../../src/lib/cloudClient.ts)

After a 409, decide whether it needs the player. Looks at the account's save once and answers:
  - it is one of this browser's own lost uploads (`isOwnSave`), or this browser's game is the same game and at least as far along
    (`canRebase`): the link is moved to its revision and the caller uploads again (`rebased`);
  - it is ahead of, or another game than, this browser's: `diverged`, the player picks in the hub;
  - the account has no save (`gone`), or could not be read (`unknown`).
Nothing is uploaded here, so the server's revision check stays the only thing that decides what is stored.

<a id="withpushlock"></a>

### `withPushLock` <small>const</small>

Source: [`src/lib/pushLock.ts:19`](../../src/lib/pushLock.ts)

One upload at a time per browser. Everything that reads the link, uploads and writes the new link back runs inside this lock, so a second
tab (a tab that took the game over from the first, or a browser without the game-owner lock) waits for the upload in flight and then reads the
revision it left, instead of sending the one it read before. Without Web Locks the work simply runs (graceful fallback), and a conflict that
still happens is resolved by `resolveConflict`. The lock dies with the page, so a closing tab never holds it up.

## Accepting a save

<a id="acceptsave"></a>

### `acceptSave` <small>function</small>

Source: [`src/lib/cloudSave/pipeline.ts:186`](../../src/lib/cloudSave/pipeline.ts)

Accepts a save from a client that says it was based on revision `baseRev` (0 = this account has no save yet).
  - the text must decode (checksum, schema, `sanitizeSave`), otherwise `invalid`
  - a stale `baseRev` is a `conflict`: the player picks a side in the hub, nothing is overwritten silently
  - the stored copy is rebuilt from the sanitized state, and rates and headline numbers are computed here
  - the spending check and the transition from the previous save are verified; each flag has a decision in `FLAG_POLICY` (flag, clamp or reject; reject only while `ENFORCEMENT.enabled`, shadow mode otherwise)
  - the map is only written when it changed; every ~30 min (by the clock) and when a new flag appears a full copy goes to the history

Accepting a save (`POST /api/save`):

1. The user id comes from the session cookie only; the body is capped at 600,000 bytes (`SAVE_BODY_MAX`); at most one accepted save per 10 s per account ([`MIN_SAVE_INTERVAL_MS`](saves-and-server.md#min-save-interval-ms)).
2. The text must decode (checksum, schema, `sanitizeSave`). The stored copy is rebuilt from the sanitized state; rates and headline numbers are computed on the server (`summarize` in `cloudSave/summary.ts`).
3. `baseRev` must equal the stored `rev` (compare-and-swap) or the answer is `conflict`.
4. The server's inventory (bag, gear, pity, auto-sell) is stamped over the upload before anything is derived (a rebirth wipes it once, a New Game takes the new game's).
5. The checks of [`verifyTransition`](saves-and-server.md#verifytransition) run, each producing a flag with a policy in [`FLAG_POLICY`](saves-and-server.md#flag-policy).

History: a full copy goes to `save_history` every 30 minutes of the clock and when a new flag appears; 6 newest + 3 pinned per player (`HISTORY_EVERY_MS`, `HISTORY_KEEP`, `PINNED_KEEP`).
Test accounts: a save through a non-production server marks the account `test_account` (sticky); its flags never count and it is never ranked ([`isNonProduction`](saves-and-server.md#isnonproduction)).
Ranking eligibility (`trusted`): the first save was a young game (<= 900 s of play) and no poison flag was ever raised ([`POISON_FLAGS`](saves-and-server.md#poison-flags)).

<a id="flag-policy"></a>

### `FLAG_POLICY` <small>const</small>

Source: [`src/lib/cloudSave/verify.ts:87`](../../src/lib/cloudSave/verify.ts)

The flags and what the server does with each. Meaning of each flag:

- `baseline_rich`: the first save holds more gold than its rates and play time explain.
- `networth_exceeds`: land, buildings, castle, merchant levels, gold and stock worth more than income x time x 3 + 3,600 s of burst (`netWorth.ts`).
- `playtime_regress`: play time went back within a run. `playtime_fast`: more play time than real time passed (x1.05 + 30 s).
- `gold_jump`: gold gain above income x time x 1.5 + burst + 1,000 + 2% of the balance + server grants.
- `xp_jump`: XP above what bought tiles, play time and server payouts explain ([`XP_MODEL`](saves-and-server.md#xp-model)).
- `gems_increase`: gems above the server's balance. `prestige_regress`: rebirths or Embers earned went down.
- `castle_jump`: castle level or timer faster than real time. `ember_jump`: Embers above what the last save's castle and land can pay ([`EMBER_MODEL`](saves-and-server.md#ember-model)).

**Rejection is switched off**: `ENFORCEMENT.enabled = false`. In this shadow mode flagged saves are stored and only the account's ranking eligibility suffers ([`POISON_FLAGS`](saves-and-server.md#poison-flags)).
With it on, only `playtime_fast`, `gold_jump` and `gems_increase` refuse a save (HTTP 422).

**What the server does with each flag** _(computed from the code)_

| Flag | Decision | Refuses a save when enforcement is on | Un-ranks the account (poison) |
| --- | --- | --- | --- |
| `baseline_rich` | flag | no | yes |
| `networth_exceeds` | clamp | no | yes |
| `playtime_regress` | flag | no | no |
| `playtime_fast` | reject | yes | yes |
| `gold_jump` | reject | yes | yes |
| `xp_jump` | clamp | no | yes |
| `gems_increase` | reject | yes | yes |
| `prestige_regress` | flag | no | yes |
| `castle_jump` | clamp | no | yes |
| `ember_jump` | clamp | no | yes |

<a id="trustedeconomy"></a>

### `trustedEconomy` <small>function</small>

Source: [`src/lib/cloudSave/trustedEconomy.ts:37`](../../src/lib/cloudSave/trustedEconomy.ts)

`ratio` is the net-worth check's `required / allowed` (over 1 = the save claims more than its time can explain). With a baseline the rates
and the castle are the previous save's; without one (the account's first save, or the first of a new run) there is nothing trusted to fall
back on, so the claimed rates are cut by the same ratio: the economy is worth what the play time can explain.

After `castle_jump` or `networth_exceeds` the rates, castle level and castle timer the server pays from are those of the last trusted save of the same run; unpaid merchant levels are put back to the last trusted level (Pack Rat excepted).

<a id="xp-model"></a>

### `XP_MODEL` <small>const</small>

Source: [`src/lib/cloudSave/xpModel.ts:21`](../../src/lib/cloudSave/xpModel.ts)

The server's model of how much XP a character can have. XP is lifetime progress (it carries over a rebirth), and most of it comes from
buying tiles, which the browser does by itself. The server therefore adds up what two consecutive saves can explain, from numbers it
derives itself: the XP of the tiles bought in between (the same `calculateXpGain` the game uses), the passive XP of the play time (rates
x the time that really passed), and what the server itself paid (kills, chests, absences: the ledger's grants). That sum is kept
from save to save as `derived.xpBase`; a save that holds more than the base plus a one-off headroom is clamped to it (and flagged).

Generous on purpose: an honest player is never clamped (the numbers include a margin for gifts and rounding), while XP out of thin air is
bounded by what the player has really bought and played.

In short: allowed = tile XP of the bought tiles x 1.02 + passive XP x 1.25 + server grants, plus a headroom of 900 s of income or 2,000. The first save may hold 3x that. The browser takes the lower XP the server returns.

<a id="ember-model"></a>

### `EMBER_MODEL` <small>const</small>

Source: [`src/lib/cloudSave/emberModel.ts:29`](../../src/lib/cloudSave/emberModel.ts)

The server's model of how many Embers (and rebirths) an account can hold. Embers multiply the income of every resource but XP
(`1 + 0.1 x earned^0.6`), and the server derives offline pay, kill rewards and chest gold from the stored save, so a save that
claims Embers no rebirth paid would pay out for real. Until the server runs the rebirth itself (`/api/rebirth`, IDL-102) the
browser still does, so the server bounds what two consecutive saves can explain, from numbers it already holds (IDL-166):

 - Embers only rise together with the rebirth count: a save at the same rebirth count cannot hold more than the last one did
   (buying shop levels lowers the unspent points, never the Embers ever earned).
 - A rebirth is believable when the previous save was at castle level 6 or more (a running upgrade counts) with the territory the
   next rebirth needs, give or take the tiles bought since; at most one rebirth fits between two saves.
 - The gain is at most what the previous save's castle and territory pay, with the Ancestral Tithe at its maximum (the merchant
   upgrades bought without gold are put back by the trusted economy, IDL-168, but a Tithe bought since the last upload is not known here).
 - A first save (nothing to compare with) holds a whole history: its rebirths are bounded by the play time and its Embers by the
   best rebirth the game can pay.

In short: Embers only rise with the rebirth count; one rebirth fits between two saves and it must be believable from the previous castle and land; a first save is bounded by 4 hours of play per rebirth and a 1,000-tile best case.
`requireServerRebirth` is off.

<a id="min-save-interval-ms"></a>

### `MIN_SAVE_INTERVAL_MS` <small>const</small>

Source: [`src/lib/cloudSave/pipeline.ts:71`](../../src/lib/cloudSave/pipeline.ts)

Saves from one player are accepted at most this often (an honest client sends every ~90 s).

<a id="verifytransition"></a>

### `verifyTransition` <small>function</small>

Source: [`src/lib/cloudSave/verify.ts:176`](../../src/lib/cloudSave/verify.ts)

Runs every plausibility check between two consecutive saves and returns the flags that fired; see [`FLAG_POLICY`](saves-and-server.md#flag-policy) for what each one means and does.

<a id="isnonproduction"></a>

### `isNonProduction` <small>function</small>

Source: [`src/lib/cloudSave/environment.ts:12`](../../src/lib/cloudSave/environment.ts)

Is this server a production server? Decided from the server's own environment only; nothing the client sends can
influence it, so a player cannot claim to be a tester (or a tester claim to be a player).

Non-production = `next dev` on a developer's machine (NODE_ENV is "development") or a Vercel preview / development
deployment (VERCEL_ENV). Everything else counts as production, including a missing VERCEL_ENV: if the platform
variables were not exposed, real players must stay in the checks, not slip out of them.

<a id="poison-flags"></a>

### `POISON_FLAGS` <small>const</small>

Source: [`src/lib/cloudSave/verify.ts:128`](../../src/lib/cloudSave/verify.ts)

Flags that make an account ineligible for rankings for good. Going back in time is a player choice (older save), not a cheat.

<a id="enforcement"></a>

### `ENFORCEMENT` <small>const</small>

Source: [`src/lib/cloudSave/verify.ts:113`](../../src/lib/cloudSave/verify.ts)

The kill switch and the allowlist for enforcement (IDL-112). Shadow mode is the default: nothing is refused until the flags of real
accounts have been read (`check-live-saves`), no honest account is among them, and someone flips `enabled`. Only flags that are `reject`
in `FLAG_POLICY` AND listed here refuse a save, so one noisy check can be taken out without touching the others.

## The ledger

<a id="ledger"></a>

### `Ledger` <small>interface</small>

Source: [`src/lib/offline/ledger.ts:78`](../../src/lib/offline/ledger.ts)

The ledger: one row per player, written only by the server (`player_ledger`; the only SQL logic is the atomic save function, the compare-and-swap on `ver` is in TypeScript). It holds the run id and rebirth count, the away-time anchor,
the **ticket bank** (timers and waiting chests and monsters), the kill and chest counters that seal the rolls, `granted` and `grantedSeen` (what the server paid), the gem balance, the last idempotency key and result,
`combat` (HP, mana, cooldowns, the open fight, queue, switches, retry times, event log), `inv` (bag, gear, pity, auto-sell, Pack Rat size) and `resetAt`.

- **Idempotency**: a repeated request with the same key replays the stored answer; two browsers cannot both claim (compare-and-swap).
- **Tickets**: a chest or monster exists only as a ticket the server minted from its own clock. Opening a chest names a tile; no ticket on that tile, no reward. Timers and caps: [`advanceBank`](monsters.md#advancebank) and [`ticketCap`](monsters.md#ticketcap).
  The browser draws exactly the tickets the server lists (`reconcileTickets` in `src/lib/offline/reconcile.ts`).
- **Tables** (`supabase/schema.sql`, `supabase/migrations/*`): `profiles`, `player_saves` (small row: `core`, typed columns, `rev`, `flags`), `player_worlds` (the map, written only when it changed, by hash), `player_stats` (leaderboard row, trusted only),
  `save_history`, `player_ledger`, `rebirth_history`, `app_settings` (season reset marker). The only write path for a save is `save_player_state`, executable by the service role.

See also: [`sealedRng`](saves-and-server.md#sealedrng), [`computeOfflineGrant`](saves-and-server.md#computeofflinegrant)

<a id="sealedrng"></a>

### `sealedRng` <small>function</small>

Source: [`src/lib/offline/seal.ts:18`](../../src/lib/offline/seal.ts)

A random source for one reward: `kind` and `ordinal` name it (the 7th chest of this run, rat ticket 12, ...), `runId` separates a
player's runs (a rebirth or a new game starts again at ordinal 1 without repeating the old rewards). Every draw is a fresh HMAC of
(secret, key, draw number), so there is no short seed to brute-force.

Sealed rolls: every reward is seeded by `HMAC-SHA256(LOOT_SECRET, userId | runId | kind | ordinal)` with a fresh digest per draw. The ordinal is consumed on the server, so a reload cannot reroll.
A rebirth or New Game starts a new run id. `LOOT_SECRET` is server-only; without it `/api/offline`, `/api/spawn`, `/api/chest` and `/api/fight` answer 503.

## Endpoints

<a id="endpoints-the-api-routes"></a>

### Endpoints (the API routes)

Source: [`src/lib/offline/service.ts:1`](../../src/lib/offline/service.ts)

The endpoints under `src/app/api`. Each route handler only authenticates and calls the pure service in `src/lib/offline/`.

`inventory` operations except the two purchases and `autoSell` are refused while a fight is open. The merchant's prices and shelf are still the browser's: a purchase through `inventory` is checked for being a valid item,
and its gold is paid in the browser.

**API routes (scanned from src/app/api)** _(computed from the code)_

| Route | Methods | File |
| --- | --- | --- |
| `/api/auth/login` | POST | `src/app/api/auth/login/route.ts` |
| `/api/auth/logout` | POST | `src/app/api/auth/logout/route.ts` |
| `/api/auth/me` | GET | `src/app/api/auth/me/route.ts` |
| `/api/auth/profile` | POST | `src/app/api/auth/profile/route.ts` |
| `/api/auth/register` | POST | `src/app/api/auth/register/route.ts` |
| `/api/chest` | POST | `src/app/api/chest/route.ts` |
| `/api/craft/cancel` | POST | `src/app/api/craft/cancel/route.ts` |
| `/api/craft/claim` | POST | `src/app/api/craft/claim/route.ts` |
| `/api/craft` | POST | `src/app/api/craft/route.ts` |
| `/api/craft/stash` | POST | `src/app/api/craft/stash/route.ts` |
| `/api/fight` | POST | `src/app/api/fight/route.ts` |
| `/api/inventory` | POST | `src/app/api/inventory/route.ts` |
| `/api/offline` | POST | `src/app/api/offline/route.ts` |
| `/api/rebirth` | POST | `src/app/api/rebirth/route.ts` |
| `/api/rebirths` | GET | `src/app/api/rebirths/route.ts` |
| `/api/save` | GET, DELETE, POST | `src/app/api/save/route.ts` |
| `/api/spawn` | POST | `src/app/api/spawn/route.ts` |

## Away time

<a id="computeofflinegrant"></a>

### `computeOfflineGrant` <small>function</small>

Source: [`src/lib/offline/grant.ts:70`](../../src/lib/offline/grant.ts)

The grant for an absence of `gapSec`, or null when it is shorter than the minimum (nothing to show). Income is piecewise: if the
castle upgrade finishes while away, the rest of the time earns at the higher rates. Amounts are rounded down.

Away time (`/api/offline`).

- Gap = server clock now minus the later of the ledger anchor and the last accepted save. Gaps shorter than 300 s (`offlineMinGapSec`) pay nothing.
- `elapsed = min(gap, cap)` with cap = 8 h + Night Watch + set hours (hard 72 h).
- Paid = `rates x elapsed x efficiency`, efficiency = 50% + Steward + set points (hard 100%); XP also times `(1 + XP gain %)`; floored. If the castle upgrade finishes during `elapsed`, the rest is paid at the higher rates.
- Castle timers and monster growth run at full speed for the whole `elapsed`; chests and monsters arrive at the efficiency rate.
- Online calls are refused with `claim_first` when more than [`UNCLAIMED_SEC`](combat.md#unclaimed-sec) passed since the player was last seen; a gap over 900 s also rests the hero ([`restThrough`](combat.md#restthrough)).
  The client heals HP/mana fully for a gap of 600 s or more (`FULL_HEAL_AFTER_SEC` in `src/lib/offline/apply.ts`).
- Write-skipping: a poll that moved only the clock does not write the ledger unless the anchor fell 120 s behind (`ANCHOR_REFRESH_MS`).

**Formula**

```text
elapsed = min(gap, 8 h + Night Watch hours + set hours)           (hard cap 72 h)
paid[r] = floor(rate[r] x elapsed x efficiency)                    efficiency = min(1, 0.5 + 0.05 x Steward level + set points)
```

<a id="ensureseasonreset"></a>

### `ensureSeasonReset` <small>function</small>

Source: [`src/lib/offline/season.ts:33`](../../src/lib/offline/season.ts)

Resets the player's game when a season reset happened that their ledger does not know about. Returns the marker (for the browser, which
drops a local save older than it) and whether a reset was done now. A failure to read the marker never blocks a login.

Season resets: `npm run reset-players` writes `app_settings.last_reset`; a player whose ledger `resetAt` is older is reset once at their next login. Operating guide: the Ops page (season reset CLI).
