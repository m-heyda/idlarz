# 12 · Roadmap: features, known bugs and the server migration

The one place to look when planning the next step. It does not repeat the long lists: the open mechanics and bugs are in [04](04-unfinished-and-known-issues.md), the ordered build plan in [08](08-followup-plan.md), the balance questions in [05](05-balance-backlog-and-roadmap.md). This file adds what changed with the move to **accounts only, server-placed monsters and server-run combat**, and what should move to the server next.

## Where things stand

- **Accounts only.** There is no "play without account" any more: the game needs the server to spawn, place and fight. A server outage shows a retry screen; the browser save stays as a cache and as the way an old guest-only save is adopted into an account on first login. (Offline *progress* - the paid absence - is a separate, kept feature: [11](11-offline-and-sealed-rolls.md).)
- **The server owns:** when chests and monsters appear, **where a monster stands**, what a chest or a kill holds, the gem balance, **every fight** (player HP and mana, cooldowns, hits both ways, potions drunk, the kill's reward). See [11](11-offline-and-sealed-rolls.md) and the combat section of [02](02-mechanics.md).
- **Combat is the server's; a click starts it.** A click on a monster opens the fight against it (auto-battle on or off); nobody clicks to hit. With *Auto-battle* on (off by default) the server also sends the player against the next monster, one at a time; the player's weapon swings at its `attackSpeed` (with Dexterity), the monster at its own `attackSpeed` (attacks per second, the same unit). Potions and skills have hotkeys (1-5) and an *Auto-use* switch with a fixed preset (`COMBAT.auto`). The panel shows only while a fight is open and can be minimized to an icon; a win or a defeat is announced either way.

## 1. Building system: a full rework is planned

The design draft (levels, demolish, specialisation, tier-2 resources, how they tie into rebirth and what the first-run pacing must not lose) is [13](13-roadmap-building-and-resources.md).

Not part of this change; reviewed later. State today, so the rework starts from facts:

- Config: `BUILDINGS` (16 buildings, each a `resourceGeneration` rate) and `BUILDING_COST` (a base cost, early/mid/late growth factors, `blockedBiomes`) in `src/config/gameConfig.ts`; cost maths `calculateBuildingCost`, `canBuildOn`, output `calculateTileOutput` in `src/utils/gameUtils.ts`.
- Rules: `buildOnTile` in the store. One building per tile, any land biome except the castle and lakes, nothing on a tile with a chest or a monster. Buildings are permanent: no demolish, swap or levels ([04 U13](04-unfinished-and-known-issues.md)).
- UI: `BuildDialog.tsx` (right-click a tile), `BiomeTooltip.tsx`.
- Server: nothing. A building is `tile.building` in the save, checked only by plausibility (`cloudSave/netWorth.ts`).
- Interaction with monsters: a monster stands only on a tile without a building (`canSpawnOn`), and the server moves it if the player builds there after it was placed.

## 2. Known bugs and leftovers

| # | What | Where | Note |
|---|---|---|---|
| R1 | A registered pixel icon is missing on disk: `merchant.png` (the failing test `every registered pixel icon exists on disk`). The "get rid of merchant" commit removed the image, but the portrait is still registered and the Merchant tab is still reachable | `src/config/pixelIcons.ts:69`, `MenuOverlay.tsx` | already failing before the combat work; decide: restore the art or drop the registration and the tab |
| R2 | Chests are still placed on a tile by the browser (`pickChestSpot`); only their count is the server's | `lib/chests.ts`, `lib/offline/reconcile.ts` | harmless today (a position carries no value), but the same placement should move to the server with monsters' |
| R3 | `luck`, `goldFind`, income `rates`, equipment and the bag the server rolls with come from the **last accepted save**, which the client wrote; `cloudSave/verify.ts` only flags | `cloudSave/summary.ts`, `lib/offline/profile.ts` | the combat engine reads the fight profile from the save when a fight starts; a forged save can claim gear it never found. Closing this is the ledger-owned inventory below |
| R4 | There is no "can I win this?" gate: auto-battle engages the weakest waiting monster at 80 % HP, loses to anything too strong and rests; a monster that beat the player is left alone for 5 min (a boss 10 min) | `COMBAT.auto` | enough for now; a win-chance estimate would let it skip hopeless fights |
| R5 | Potions the server drank are removed from the **browser's** bag when the event arrives; the server counts them against the saved bag (`consumed` minus `consumedSeen`). A reload in the middle can leave the local bag one potion too full for a moment | `lib/offline/fight.ts`, `cloudSave/pipeline.ts` | the server never lets a potion be drunk twice; the right fix is the server-owned bag |
| R6 | A fight uses the gear of the last accepted save, frozen when the fight starts. The cloud save goes out soon after an equip, but not at once | `useCloudSync` | equipping is blocked while a fight is open in the browser |
| R7 | `dangerBonus` (one level per 8 tiles from the castle) is now 0 or 1: rats stand at most 9 tiles out | `lib/monsters.ts` | the frontier is no longer more dangerous than the home land; rework with the biomes |
| R8 | The King's balance changed with auto-attack: his HP is 1000 (was 9600 for a clicker) so the best gear wins comfortably, obsidian narrowly, steel not | `MONSTERS.ratKing`, `docs/generated/fight-sim.md` | needs a real playtest |
| R9 | Local development needs a Supabase project and `LOOT_SECRET`: there is no guest mode to run the game without them | `README.md` | a dev-only fake backend would bring that back. Dev sessions on localhost use their own browser keys (`.dev` suffix, `storageScope.ts`) |
| R10 | `legacyVault.ts` (the IndexedDB and `idle-explorer-v11/v12` import) and the `IDLZ1.` import format are still shipped | `lib/legacyVault.ts`, `saveStorage.ts` | delete when nobody can still hold such a save |
| R11 | A sync (no key) overwrites the ledger's `last_key` / `last_result` (`onlineStep` writes `lastKey: key`), so the idempotency record of the previous keyed request (a chest open, a hotkey) is gone when a poll lands between a lost answer and its retry; the retry then takes a second ticket or answers "no ticket" | `lib/offline/online.ts` | keep the old record when the step has no key; rare (the retry follows within a second) |
| R12 | A release that reads a new column goes live before its SQL migration is applied: on 2026-10-28 between about 01:21 and 01:39 UTC every ledger read failed ("column player_ledger.combat does not exist") until `combat_ledger.sql` ran | `supabase/migrations/` | apply additive migrations before deploying the code that reads them, or read the new column defensively |

## 3. Server migration backlog (ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag - a tile bought but not yet saved just is not eligible yet. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

1. **Ledger-owned inventory and equipment** (closes R3, R5, R6): the bag, the worn gear and the loot pity live in the ledger; the browser shows them. Then a fight can never use gear the player does not own.
2. **Enforce `verify.ts`** (today it only flags): rejecting a save that gained more than the server granted.
3. **Economy actions** by the server where they pay out: castle upgrade, rebirth/Embers, farm purchases, building costs. Batch them (one call per few seconds) rather than one per click.
4. ~~**XP, levels and stat points** from server-held XP~~ **done in part**: the server models and clamps XP (`cloudSave/xpModel.ts`) and the fight profile derives the level from the saved XP. Still client-side: the *award* of tile-purchase XP (tile buying stays a client action, see above) and the attribute allocation (bounded by the level's points).
5. **Merchant and sell** (gold for gear, resource sell/buy, upgrades): server-priced. Today every merchant action is a client store action checked only by `sanitizeSave`, `netWorth` and the gold/XP flags; the Goods shelf and the Resources table are pure UI over `buyOffer`, `buyItem`, `sellResources`, `buyResource` and `buyMerchantUpgrade`, so moving them behind routes later changes no UI.
6. **Chest placement** (R2) next to monster placement.
7. **Spawn caps from the real map**: the server now counts free tiles for monsters from the map; chests and the overall share (`SPAWN_LIMIT`) still use an estimate from the owned-tile count.

Call volume (see 3b for the free-tier notes): every online request is one compare-and-swap on the ledger plus a read of the save row; the map row is read only when the land changed or a monster waits for a tile. Combat polling is `COMBAT.poll` (2 s with the panel open, 8 s minimized or hidden, and as long as 10 min when nothing can change).

## 3b. Server authority and free-tier notes

Decisions and findings from the header / resource-tier pass (read from the code, **not measured against the live project**). Nothing here changed server code.

1. **No cron job and no Realtime channel are needed now.** Everything the server decides is computed lazily on a request from timestamps ([11](11-offline-and-sealed-rolls.md)); the browser never talks to Supabase directly, only to `/api/*`. Add `pg_cron` only for a feature that must progress while nobody is online (a leaderboard season roll-up, expiring events). The header's production rates (per second / minute / hour) are derived client-side from the state the player already holds (`resourceRates`); they cost no request.
2. **Catalogs stay in code, not in the database.** The API routes import the same TypeScript modules as the browser (`src/catalog/*`, `gameConfig.ts`, `combatConfig.ts`), so client and server cannot disagree, and a catalog change ships with its tests (`tests/catalog.test.ts`, `serverBoundary.test.ts`). The DB stores ids and numbers inside `core`. Move a catalog to tables only if you need to change content without a deploy (live events, A/B prices); until then it would add reads on a free tier and a second source of truth. The new `tier` field in `src/catalog/resources.ts` drives the header, so adding a tier is a catalog change.
3. **Rebirth and Embers are client-authoritative.** `sanitizeSave` only checks conservation (`legacyPoints + shop spending = legacyEarned`) and ranges, and `verify.ts` flags a counter that goes down; nothing checks that the Embers earned match the castle level and tiles of the run that ended. A crafted save can claim any conserving total up to 1,000,000. *Recommended next, cheap:* a shadow flag in `cloudSave/verify.ts` that compares the claimed gain with `emberGain(castle_level, tiles_owned)` of the previously stored row (`player_saves` already has both columns), with a tolerance for the autosave lag, reusing the poison-flag path (un-ranks, stops offline pay). *Later:* a server-owned `/api/rebirth` (item 3 above).
4. **Free-tier hot spot: polling during a fight.** While a fight is open the browser calls `/api/spawn` / `/api/fight` every 2 s (about 1,800 requests an hour). Each request does `auth.getUser()`, a read of `player_saves` and of `player_ledger`, and **a ledger UPDATE even for a read-only sync**: every online step returns `anchorAt: nowMs` (`offline/online.ts`) and `toRow` stamps `updated_at` (`offline/supabaseLedger.ts`). *Recommended next:* skip the write when the step changed nothing but the anchor (or raise the poll interval while the fight is only being watched). The 5-minute save heartbeat (12 an hour, one RPC each) and the 30-minute history copies are modest by comparison.
5. **Resource key lists are still duplicated by hand** (the `Resources` interface, `INITIAL_RESOURCES`, `BASE_GENERATION_RATES`, `CASTLE_BASE_RATES`, `FARM_PRODUCT_KEYS`, `zeroResources`, `sanitizeSave` `OPTIONAL_RESOURCES`, `offline/grant.ts`, `offline/ledger.ts` `zeroTotals`, ...). The header groups no longer are: they come from the catalog tiers. A new resource still has to be added to those lists together, see [13 §3](13-roadmap-building-and-resources.md). `tests/catalog.test.ts` fails if a stored resource has no tier.
6. **Secret in the repo**: `.env.example` carries a concrete `LOOT_SECRET` value ("the shared one every new workspace starts with"). Fine while the repo is private; rotate it, and give every deployment its own, before any public release.

## 4. Config extensions planned (the shape is ready)

- **Monster spawn rules** are per monster (`MonsterDef.spawn`): `biomes` (an allowlist - water and the castle never appear), `minCastleDistance`, `maxCastleDistance`, and `minRebirths` (a monster that only comes after rebirths). A new monster is one entry in `MONSTERS`; `tests/monsterConfig.test.ts` checks the shape.
- **Biomes unlocked by rebirth**: extend `BIOME_RULES` with `unlock: { purchases?, rebirths? }` (today swamp and tundra unlock after 6 and 10 purchases). Not built; a monster's `biomes` list already follows whatever biomes exist.
- **Per-biome loot and modifiers**, **per-monster loot sources** (`lootSourceId` already exists per monster).
- **Fight tunables** all sit in `COMBAT` (`tickSec`, `maxCatchUpSec`, `maxFightSec`, `poll`, `auto`): thresholds, retry cooldowns, which monster is next (`engageOrder`: `weakest` or `oldest`). Letting the player set their own thresholds is a settings screen on top of the same numbers.

## 4b. Paragon levels (draft, not built)

The level curve ends at level 100 (the soft cap is 80, level 90 comes around the 5th rebirth and 100 around the 10th, `LEVELING` in `gameConfig.ts`). Past it, a **paragon** track gives the endless part of the game without feeding the attribute economy (a level-100 character already holds 157 attribute points):
- After level 100 the same lifetime XP keeps counting; every paragon level (a flat step first, then slowly growing, tuned with the sim like the main curve) gives **one paragon point**. The server's XP ceiling already carries lifetime XP over rebirths, so nothing new has to be tracked for the XP.
- Points go into a few **small, capped, account-wide bonuses** (income, XP gain, Luck, offline efficiency, maybe a combat stat), not attribute points; each bonus has its own level cap so the sum can never run away.
- The leaderboard ranks level, then paragon level.
- Open questions: points per level, the caps, whether levels 81-100 should give extra attribute points as a reward for the steep part, whether paragon points reset (probably not), and how the Ember shop and the merchant's Ancestral Tithe interact with it.

## 5. Documentation to keep in step

- [04](04-unfinished-and-known-issues.md) U9 (offline progress) and [08](08-followup-plan.md) C7 are built; U5 and the combat notes there describe click combat that no longer exists.
- Regenerate [generated/fight-sim.md](generated/fight-sim.md) with `npm run fight-sim -- --md` whenever gear or monsters change; `tests/fightBalance.test.ts` pins the tuning.
