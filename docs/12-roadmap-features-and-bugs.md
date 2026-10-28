# 12 · Roadmap: features, known bugs and the server migration

The one place to look when planning the next step. It does not repeat the long lists: the open mechanics and bugs are in [04](04-unfinished-and-known-issues.md), the ordered build plan in [08](08-followup-plan.md), the balance questions in [05](05-balance-backlog-and-roadmap.md). This file adds what changed with the move to **accounts only, server-placed monsters and server-run combat**, and what should move to the server next.

## Where things stand

- **Accounts only.** There is no "play without account" any more: the game needs the server to spawn, place and fight. A server outage shows a retry screen; the browser save stays as a cache and as the way an old guest-only save is adopted into an account on first login. (Offline *progress* - the paid absence - is a separate, kept feature: [11](11-offline-and-sealed-rolls.md).)
- **The server owns:** when chests and monsters appear, **where a monster stands**, what a chest or a kill holds, the gem balance, **every fight** (player HP and mana, cooldowns, hits both ways, potions drunk, the kill's reward). See [11](11-offline-and-sealed-rolls.md) and the combat section of [02](02-mechanics.md).
- **Combat is automatic.** Nobody clicks a monster. With *Auto-battle* on the server sends the player against one monster at a time; the player's weapon swings at its `attackSpeed` (with Dexterity), the monster at its own `attackSpeed` (attacks per second, the same unit). Potions and skills have hotkeys (1-5) and an *Auto-use* switch with a fixed preset (`COMBAT.auto`). The panel can be minimized to an icon; a win or a defeat is announced either way.

## 1. Building system: a full rework is planned

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
| R9 | Local development needs a Supabase project and `LOOT_SECRET`: there is no guest mode to run the game without them | `README.md` | a dev-only fake backend would bring that back |
| R10 | `legacyVault.ts` (the IndexedDB and `idle-explorer-v11/v12` import) and the `IDLZ1.` import format are still shipped | `lib/legacyVault.ts`, `saveStorage.ts` | delete when nobody can still hold such a save |

## 3. Server migration backlog (ranked)

What still runs in the browser and is only checked by plausibility. Tile buying was assessed and **stays client-side with autosave**: it is the most frequent action (an API call per click would be the real server load), its gold lives in the client-authored save the server already checks, and the one server consumer of the map (monster placement) tolerates the autosave lag - a tile bought but not yet saved just is not eligible yet. It becomes worth an API when `verify.ts` stops being shadow mode and starts rejecting.

1. **Ledger-owned inventory and equipment** (closes R3, R5, R6): the bag, the worn gear and the loot pity live in the ledger; the browser shows them. Then a fight can never use gear the player does not own.
2. **Enforce `verify.ts`** (today it only flags): rejecting a save that gained more than the server granted.
3. **Economy actions** by the server where they pay out: castle upgrade, rebirth/Legacy, farm purchases, building costs. Batch them (one call per few seconds) rather than one per click.
4. **XP, levels and stat points** from server-held XP; the fight profile then trusts the level.
5. **Merchant and sell** (gold for gear): server-priced.
6. **Chest placement** (R2) next to monster placement.
7. **Spawn caps from the real map**: the server now counts free tiles for monsters from the map; chests and the overall share (`SPAWN_LIMIT`) still use an estimate from the owned-tile count.

Call volume: every online request is one compare-and-swap on the ledger plus a read of the save row; the map row is read only when the land changed or a monster waits for a tile. Combat polling is `COMBAT.poll` (2 s with the panel open, 8 s minimized or hidden, and as long as 10 min when nothing can change).

## 4. Config extensions planned (the shape is ready)

- **Monster spawn rules** are per monster (`MonsterDef.spawn`): `biomes` (an allowlist - water and the castle never appear), `minCastleDistance`, `maxCastleDistance`, and `minRebirths` (a monster that only comes after rebirths). A new monster is one entry in `MONSTERS`; `tests/monsterConfig.test.ts` checks the shape.
- **Biomes unlocked by rebirth**: extend `BIOME_RULES` with `unlock: { purchases?, rebirths? }` (today swamp and tundra unlock after 6 and 10 purchases). Not built; a monster's `biomes` list already follows whatever biomes exist.
- **Per-biome loot and modifiers**, **per-monster loot sources** (`lootSourceId` already exists per monster).
- **Fight tunables** all sit in `COMBAT` (`tickSec`, `maxCatchUpSec`, `maxFightSec`, `poll`, `auto`): thresholds, retry cooldowns, which monster is next (`engageOrder`: `weakest` or `oldest`). Letting the player set their own thresholds is a settings screen on top of the same numbers.

## 5. Documentation to keep in step

- [04](04-unfinished-and-known-issues.md) U9 (offline progress) and [08](08-followup-plan.md) C7 are built; U5 and the combat notes there describe click combat that no longer exists.
- Regenerate [generated/fight-sim.md](generated/fight-sim.md) with `npm run fight-sim -- --md` whenever gear or monsters change; `tests/fightBalance.test.ts` pins the tuning.
