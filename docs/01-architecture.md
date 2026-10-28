# 01 · Architecture

## Stack

| Piece | Version | Notes |
| --- | --- | --- |
| Next.js | 15.5.28 | App Router; `src/app/page.tsx` is the account gate, `GameApp.tsx` is the game (`'use client'`) |
| React | 19.3.x | |
| Tailwind CSS | 4.3.x via `@tailwindcss/postcss` | `@import 'tailwindcss'` in `globals.css`; pixel-art UI kit styles in `src/app/globals.css` and `src/styles/*` |
| Zustand | 5.0.x | `persist` with a custom localStorage text-save storage |
| Supabase | `@supabase/ssr` + `supabase-js` | accounts, cloud saves, the server ledger; only the `/api/*` route handlers talk to it |
| TypeScript | 5.9 (`target ES2017`) | `strict` |
| ESLint | 9 (flat config) | `npm run lint` = `eslint .` (CLI; `next lint` is gone) |
| Test / sim runner | `tsx` (devDependency) | `npm test` (node:test), `npm run sim`, `npm run report`, `npm run docs:gen` |

The game is **played with an account only** (no guest mode). The browser runs the economy, the map and the UI; a server layer (`src/app/api/*`, Supabase) holds the account, the verified cloud copy of the save and the **ledger**, which decides what the browser cannot be trusted with: offline progress, which chests and monsters exist and where, every fight, sealed chest/kill rolls, gems and the XP ceiling. See [09](09-cloud-saves.md) (saves) and [11](11-server-authority.md) (everything server-side). Without the server nothing spawns and no fight can start.

## File map

```
src/
├── app/
│   ├── page.tsx              the gate: checking → login/register (StartDialog) → profile → save hub (SaveHub: continue / choose / new game) → GameApp; AuthUnavailable when Supabase is not reachable
│   ├── GameApp.tsx           the game: 100 ms tick loop, single-tab lock, hidden Ctrl×5 shortcut, the three sync hooks, composes all overlays
│   ├── layout.tsx, globals.css
│   └── api/                  auth/{login,logout,me,profile,register}, save (cloud save), offline (claim an absence), spawn (tickets + combat view), chest (open a chest), fight (start / hotkey / auto switches / dismiss)
├── config/
│   ├── gameConfig.ts         ALL tunable economy constants (costs, curves, biomes, castle, animals, merchant, click limiter, chests, stats, rebirth, offline, luck)
│   ├── combatConfig.ts       COMBAT + MONSTERS + STAT_RULES: HP, regen, armor, spawn, monster defs (level scaling, armor, crit, Stun resist, grade)
│   ├── limits.ts             the limits registry (`limitOf('bagSize')` etc.: base value + effects like Pack Rat)
│   ├── biomeRules.ts, biomePalette.ts, playerClasses.ts, pixelIcons.ts, terrainAtlas.json
│   └── itemCatalog.ts        facade: re-exports src/catalog and derives BASIC_GEAR / RATTATUI_SET for older imports
├── catalog/                  THE item catalog: index.ts (ITEM_CATALOG, SETS, starter kit, equipment layout), items/*.ts (starter, cloth, steel, obsidian, rattatui, legendary,
│                             consumables + define.ts helpers), weapons.ts (attack speed per weapon type), rarity.ts, stats.ts, affixes.ts, sets.ts, resources.ts, skills.ts (Heal, Stun),
│                             loot.ts + lootConfig.ts (loot profiles, pools, merchant stock; see 10-loot-system.md)
├── types/game.ts             Resources, Tile, CharacterStats, ItemInstance, Monster, GameState (store interface), ClickInput ...
├── stores/
│   ├── gameStore.ts          the single game store: every action (buyTile, tick, upgradeCastle, clickForGold, startFight, rebirth, buyEmberUpgrade, merchant actions ...)
│   ├── uiStore.ts            transient UI flags (menu, dialogs, right-click menu, highlight, toast) and remembered panel state (`setPref`)
│   ├── viewStore.ts          where the map is on the screen (pan x/y, zoom, window size), clamped to the explored land
│   ├── settingsStore.ts      sound / volume / ambient-life preferences (localStorage `idlarz-settings`, not game state)
│   └── rewardPendingStore.ts the chest being opened (waiting for the server) and its animation
├── utils/
│   ├── gameUtils.ts          pure maths: rates, costs, level curve, stat modifiers, tooltip text helpers
│   ├── world.ts              THE map: a sparse immutable `World` (explored tiles by numeric key, incremental counters + bounds), copy-on-write setTile/patchTile, row adapters for tests
│   └── biomeRules.ts, growWorld.ts, worldGen.ts, cluster.ts, terrain.ts (dual-grid terrain, port of scripts/pixel/terrain_logic.py), water.ts, formatters.ts, audioManager.ts
├── lib/
│   ├── clickLimiter.ts       token-bucket limiter for gold clicks
│   ├── combat.ts             pure combat rules: max HP, armor mitigation, damage per hit, crit, regen (used by the server engine and the UI)
│   ├── monsters.ts           monster levels and stats, spawn level windows, growth
│   ├── skills.ts, effectiveStats.ts, statBonuses.ts, itemInstance.ts, inventory.ts (pure bag/equipment ops + aggregateStats), limits.ts, merchant.ts, chests.ts, luck.ts, rng.ts
│   ├── loot/                 kill / chest / merchant-stock rolls: generate, kill, receive, pools, validate, autoSell, data
│   ├── offline/              the server engine, pure and unit-tested: tickets (spawn timers), placement, fight (the tick engine), profile (player stats for a fight), reward, grant,
│   │                         ledger + supabaseLedger, seal / secret (sealed rolls), reconcile, service / online (the request handlers), limits, types
│   ├── cloudSave/            the cloud-save pipeline: pipeline, verify (plausibility, shadow mode), netWorth, xpModel (the server's XP ceiling), summary, supabaseRepo, environment
│   ├── supabase/             server.ts (cookie client), admin.ts (service-role client)
│   ├── authClient / authRoute / authValidation / playerRoute / offlineRoute   the browser and route-handler sides of login and the ledger routes
│   ├── cloudClient, manualCloudSave, saveEvents, syncPolicy, startPlan, serverSession   when and how the browser pushes saves to the account
│   ├── rewardsClient, offlineClient, offlineFlow, combatCursor, combatFx   the browser side of /api/spawn, /api/chest, /api/fight, /api/offline
│   ├── saveFormat.ts         the save text (IDLZ2.<base64 JSON>.<check>): compact body, `SAVE_SCHEMA` + `MIGRATIONS`, encode/decode
│   ├── saveStorage.ts, storageScope.ts   localStorage storage: sync flush on close, backup + damaged copy, `.dev` key suffix on localhost, persist(), import/reset
│   ├── sanitizeSave.ts       validation/normalisation of any loaded or imported save; PERSISTED_KEYS
│   ├── groundsMigration, levelsMigration, monstersMigration, legacyGear   one migration module per old save schema (frozen fixtures in tests/fixtures/saves guard them)
│   ├── fightSim.ts           a bot that fights with the real engine (scripts/fight-sim.ts, tests/fightBalance.test.ts)
│   └── castleWard, castleFinder, mapView, minimap, terrainRenderer, tipPlacement, ambientLife, floatText, inventoryDrag, globalMenu, uiPrefs, clipboard
├── hooks/
│   ├── useHydration, useSingleTab (Web Lock: one tab owns the game), useCtrlSequence, useClickIncome, useGlobalContextMenu, useMenuAttention
│   └── useOfflineClaim (claims the absence before the loop starts), useCloudSync (pushes the save), useSpawnSync (polls /api/spawn: tickets + combat view)
└── components/
    ├── auth/                 StartDialog (login / register), SaveHub, AuthUnavailable
    └── game/                 Grid (pan + stepped wheel zoom, mounts only the explored and buyable tiles on screen), TerrainLayer, HighlightLayer, Minimap + BottomRightStack,
        │                     CastleCompass, Tile (transparent hit area + overlays), BiomeTooltip + MapTipLayer, BuildDialog, CastleUpgradeDialog, header (GameHeader: PlayerCard,
        │                     ResourceDisplay, HeaderMenu), ItemSlot / ItemTooltip / Bag, MonsterSprite / MonsterArt, CastleRange / CastleFortress, WaterLayer, AmbientLife
        │                     (decorative critters), GameDebug (dev panel)
        └── overlays/         MenuOverlay (tabs: Equipment, Character, Merchant, Farm; opened from the avatar), CharacterOverlay, StatisticsOverlay, CombatWidget (the fight window),
                              RewardPendingChest + ChestNotification, OfflineDialog (welcome back), Farm* (scene, HUD, animal and upgrade docks), Merchant/* (Resources, Goods, Upgrades;
                              Quests and Gambling are placeholder tabs), RebirthDialog, SettingsDialog, SaveMenuDialog, Tutorial + TutorialDialog, TabLockOverlay, LevelUpNotification, LoadingScreen
supabase/                     schema.sql (a fresh project) + migrations/ (autosave_history_by_time, offline_ledger, combat_ledger: run in that order on an older project)
scripts/
├── sim.ts                    bot simulation on the REAL store (milestones per player profile)
├── balance-report.ts, catalog-report.ts, fight-sim.ts, loot-sim.ts   generators of docs/generated/*.md (`npm run docs:gen` runs them all)
├── perf-world.ts             timings at 5k / 50k / 250k tiles (`npm run perf`)
└── pixel/                    sprite generators -> public/pixel/ (see "Pixel art pipeline")
tests/                        one file per area (economy, saves, castle, rebirth, loot, offline/ledger, fight engine and balance, merchant, terrain ...); helpers.ts builds games; fixtures/ holds frozen old saves
```

## The map (`World`)

The map has no edge. `GameState.tiles` is a `World` (`src/utils/world.ts`): an immutable, sparse set of the **explored** tiles on an integer grid with negative coordinates, stored as `ReadonlyMap<number, Tile>` under a small-integer key (`tileKey(x, y)`, `|x|, |y| <= COORD_LIMIT = 16,000`, at most `MAX_OWNED_TILES = 250,000` tiles). Unexplored land is simply absent (`getTile` gives `undefined`, `tileAt` an empty tile). Updates are copy-on-write (`setTile`, `patchTile`, batched `setTiles`), so `state.tiles` changes exactly when the map does; the owned / building / chest / per-biome counters and the bounding box are kept up to date incrementally (O(1) reads, no per-tick scans). Tiles an old save knew by row and column keep their logical coordinates: the castle stays at (25, 25), so old saves and the procedural art (which hashes absolute coordinates, parity-tested against Python) are unchanged.

- Reads go through `getTile` / `tileAt` / `isOwnedAt` / `hasOwnedNeighbour` / `forEachOwned` / `ownedRowMajor` (a cached row-then-column order, so seeded pickers and saves do not depend on the order tiles were added). `buyTile` checks `hasOwnedNeighbour`, the coordinate range and the tile limit.
- A purchase costs one Map copy (about 16 ms at 50,000 tiles, mostly that copy plus the income pass); `npm run perf` prints the timings of the things that happen while playing at 5k / 50k / 250k tiles.
- Tests that were written for the old 50 x 50 array use `worldFromRows` / `rowsOf` / `gridCells` / `tileAt` from `tests/helpers.ts`.
- The map you can pan over is limited by `clampPosition` (`src/lib/mapView.ts`): the middle of the screen stays within the explored land's bounding box plus `PAN_MARGIN_TILES` (6), re-applied whenever the land, the window or the zoom changes. Nothing else limits panning, and zoom steps do not depend on the map size.

## State (`GameState`)

Persisted (`PERSISTED_KEYS` in `sanitizeSave.ts`, the one list): `tiles`, `resources`, `level`, `previousLevel`, `playerName`, `playerClass`, `characterStats`, `farmLevels`, `farmUpgrades`, `merchantUpgrades`, `clickLevel`, `castleUpgrade`, `prestige` (rebirths, Embers earned/unspent, shop levels), `freeTiles`, `playSeconds`, `activeChests`, `gems`, `equipment` (item instances by slot), `bag` (`limitOf('bagSize')` slots: 36 plus Pack Rat), `playerHp`, `playerMp`, `lootPity`, `autoSellUpTo`, `merchantStock`, `merchantRefreshes`. Fields added later are optional in old saves and get defaults; a save without equipment + bag gets the starter kit.

Not saved: `monsters` and the open fight (`combat`) are the server's picture and arrive with each `/api/spawn` answer. Rebuilt on load: `resourceRates`, derived combat stats, castle upgrade cost, every window/dialog flag, `isHydrated`.

## The loop

`GameApp.tsx` runs `setInterval(…, 100 ms)` **only** in the owning tab and only after the save is loaded and the offline claim is done. Each interval computes `deltaTime = performance.now() − last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 … MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps but a changed system clock can neither skip nor reverse time. Offline progress is not computed here: a player's absence is claimed from the server before the loop starts ([11](11-server-authority.md)).

`tick` order: accumulate resources → XP (with `xpGainMultiplier`) → castle upgrade timer (finishing recomputes the rates) → age the monsters on the map (`advanceMonsters`; the server places them, see below) → HP / mana regeneration and cooldowns (in a fight the server's HP is left alone) → merchant stock rotation → level / stat points → one `set()`. **The tick does not spawn chests or monsters and does not run fights.**

`useSpawnSync` polls `/api/spawn` (it waits until the next ticket is due, 20 to 600 s; an open fight is polled every 2 s, a minimized one every 8 s; a fight action also triggers an immediate sync): the server answers with the chests and monsters that have appeared (`applyServerTickets` → `reconcileMap` places them on the map), the gem balance and the combat view (HP, mana, cooldowns, the open fight). A click on a monster calls `startFight`, which asks `/api/fight` to open the fight; from then on the server swings both ways in fixed ticks, with or without the browser ([11](11-server-authority.md)).

## Persistence

`persist` + `saveStorage` (see [07](07-saves-and-security.md)): state objects are kept as-is in memory and encoded to one line of text only when written (debounced 2 s, and synchronously on `pagehide`). On start the storage reads `current` (or `backup`, or the old IndexedDB vault once), decodes and validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. The initial in-memory world is a fixed placeholder (so the server render and the first client render match); a player without a save gets a random start in `merge`. The schema version lives in `saveFormat.ts` (`SAVE_SCHEMA = 6`, `MIGRATIONS[1..5]`). The browser copy is a cache and the export path; the account holds the verified copy ([09](09-cloud-saves.md)).

## Clicks

`useClickIncome` (called by `GameHeader`) registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold`, which asks the limiter with the event's `timeStamp` as id, so one physical click costs one token. Nothing hits a monster by clicking: a click on a monster only opens the fight (`startFight`).

## Rebirth

`rebirth()` asks `rebirthStatus` (the one place the requirements live; the header button and the Rebirth window read it too), takes the Embers it computes, and rebuilds the state with `createInitialData(prestige)` (the starting bundle from the *Provisions* upgrade is applied there). **Kept:** name, class, play time, prestige, Embers, the character (lifetime XP, level, attributes with unspent points), `equipment`, `bag` (and the room Pack Rat made), `gems`, `lootPity`, `autoSellUpTo`. **Reset:** the map, resources, castle, farm, chests, the other merchant upgrades. Prestige effects are passed as an optional argument into `calculateResourceRates`, `calculateTileCost`, `calculateBuildingCost` and `castleUpgradeDuration`, so the maths stays in `gameUtils.ts`.

## Ambient life

`AmbientLife` (inside `Grid`) spawns a critter every few seconds on an owned tile in view; they are purely decorative (no clicks, no rewards). It is off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.

## Rendering notes

- `Grid` mounts only the tiles that matter on screen: explored tiles and the unexplored ones touching them (what can be bought), inside the visible range plus two tiles. The list is rebuilt when that integer range or the map changes, not on every pixel of panning. The pan / zoom position lives in `viewStore`; fling inertia keeps its velocity in a ref with friction (no per-frame React state). The world div is a zero-size origin placed with `translate() scale()`; everything inside is positioned in world pixels, negative ones included.
- **Wheel zoom** is stepped (0.75 / 1 / 1.5 / 2, one step per 50 px of wheel delta) so the pixel art stays crisp and zooms around the cursor; the steps do not depend on the map size (zoom out to find far-away land; a 0.5 step is still open, see [ROADMAP](ROADMAP.md)). The zoom is exposed to CSS as `--map-zoom`; tile tooltips scale with it, castle/building dialogs do not.
- **Terrain**: the ground is drawn in **chunks** of 16 x 16 tiles (768 px, `CHUNK_TILES`), one `<canvas>` each (`TerrainLayer` / `TerrainChunk`), only for the chunks on screen plus a ring around them, by `terrainRenderer.ts` from the atlas in `public/pixel/terrain/` + `src/config/terrainAtlas.json`. A chunk's picture depends only on the ground inside the chunk plus `CHUNK_HALO` (5) tiles, so its `chunkSignature` (one character per tile of that window, building tiles upper case) decides when it is redrawn: a purchase redraws the chunks next to it, never pan, zoom or a chest toggle. The ground comes from `worldGround(world)` (explored tile -> its ground, unexplored next to explored -> 'mist'), cached per World. Dual cells on a chunk border are drawn by both chunks, sprites that reach over a border (a tree, a pier) by both too, the texture pattern is anchored at the world origin and each canvas is 2 px larger than its part, so there are no seams even at fractional zoom. Draws are queued and run within a 6 ms frame budget (at least one chunk per frame); flat colours show first and until the atlas loads. Tiles are transparent hit areas that carry the castle, buildings, chest, '?' marker and hover overlays. Buyable unexplored tiles are drawn as the dark 'mist' sea. `tests/terrainChunks.test.ts` checks the halo is enough, that equal signatures mean equal pictures, and that nothing is cut at a border.
- **Highlight**: the tile menu's "Highlight this ... area" tints the connected same-biome area (`connectedCluster`, an iterative flood fill) with the biome's colour from `biomePalette.ts` for 3 s, drawn by `HighlightLayer` as one screen-space canvas (only tiles on screen are looked at, so a 20,000-tile area costs the same as a 20-tile one), no border.
- **Minimap**: `Minimap` (bottom right, switched in the global menu) paints one square per explored tile in its biome colour into one `ImageData` (`src/lib/minimap.ts`, repainted at most every 200 ms; 4 ms at 50,000 tiles), a gold marker on the castle, purple ones on workshops, and outlines the visible part (moved straight in the DOM, no React render per pan frame). Click or drag centres the view there (clamped like any pan); it is outside the map's click area, so it never pays gold. A small map is drawn up to 6 px per tile, a big one down to a fraction of a pixel.
- **Biome rules and chests**: `src/config/biomeRules.ts` (numbers) + `src/utils/biomeRules.ts` (unlocks, conflicts, clustering, the starting tiles) decide what a purchase becomes; `src/lib/chests.ts` decides where chests appear and what they hold. Both are pure with an injectable `random()`. The free starting tiles are `GameState.freeTiles`; costs use `economyTiles()` (see [02](02-mechanics.md)).
- **Buildings**: any explored tile except the castle and lakes can take one (`buildOnTile`, `canBuildOn`, price `calculateBuildingCost` / `buildingCostFactor`); the right-click `BuildDialog` opens from `Tile.tsx`. A building keeps its tile's own ground and gets a pad of that biome (`allPads()` in `terrain.ts`, art in `terrain_pads.py`, drawn under the sprites) (the same rule is ported to `terrain_logic.py` and covered by the parity fixture, where a lowercase letter marks a building). Building tiles carry no props.
- Tile tooltips are portalled into `MapTipLayer`, a layer above the critters, because every tile is its own stacking context.
- `NotifyDot` is the one "needs attention" marker (a soft orange dot). It is used on the avatar in the header and on the Menu tabs: unspent stat points (Stats tab) and an affordable farm animal or upgrade (Farm tab); the avatar shows either (`useMenuAttention`).
- Font: Mozilla Headline (self-hosted via `@fontsource-variable/mozilla-headline`, exposed as `--font-pixel`).
- A `Tile` reads only primitives from the store (its own monster, chest and, for the castle, its level) and takes `canAfford` from `Grid`, which works the price of the next tile out once for all of them; unchanged tiles are skipped by `React.memo` (their props are primitives), so panning mounts only the tiles that enter the view.
- Tutorial, stat tooltips and cost lists are generated from config constants, so they cannot drift from the rules.

## Pixel art pipeline

All sprites, frames and the map terrain (textures, dual-grid shape atlases, trees, rocks, docks) are generated, not drawn by hand: `python scripts/pixel/build.py [name ...]` (Pillow) rewrites `public/pixel/{icons,ui,bg,terrain}/` in place and prunes stale files afterwards, so a running dev server never 404s. `python scripts/pixel/build.py terrain` rebuilds only the terrain, `src/config/terrainAtlas.json` and `tests/fixtures/terrain-parity.json`; `python scripts/pixel/terrain_preview.py` renders mock maps to `scripts/pixel/previews/`. `--refs` also refreshes the curated images in `scripts/pixel/reference/`; the visual rules (top-down buildings, outlines, palette, ~40 px detail) are in `scripts/pixel/reference/STYLE.md`. Icons are registered in `src/config/pixelIcons.ts`.

## Build & run

```bash
npm install
npm run dev      # next dev --turbopack
npm run build && npm run lint
npm test         # node:test over tests/**/*.test.ts
npm run docs:gen # regenerate everything in docs/generated (report, sim, catalog-report, fight-sim, loot-sim)
```
