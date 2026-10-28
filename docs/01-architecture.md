# 01 · Architecture

## Stack

| Piece | Version | Notes |
| --- | --- | --- |
| Next.js | 15.5.28 | App Router, one page (`src/app/page.tsx`), `'use client'` |
| React | 19.3.x | |
| Tailwind CSS | 4.3.x via `@tailwindcss/postcss` | `@import 'tailwindcss'` in `globals.css`; pixel-art UI kit styles in `src/app/globals.css` and `src/styles/*` |
| Zustand | 5.0.x | `persist` with a custom localStorage text-save storage |
| TypeScript | 5.9 (`target ES2017`) | `strict` |
| ESLint | 9 (flat config) | `npm run lint` = `eslint .` (CLI; `next lint` is gone) |
| Test / sim runner | `tsx` (devDependency) | `npm test` (node:test), `npm run sim`, `npm run report` |

The game state is client-side. For signed-in players a small server layer (`src/app/api/*`, Supabase) stores the cloud save and, since [11](11-offline-and-sealed-rolls.md), decides offline progress, chest and monster tickets, sealed rolls and gems. Guests play entirely client-side.

## File map

```
src/
├── app/page.tsx              game loop, tab lock, hidden Ctrl×5 shortcut, global right-click handler, composes all overlays
├── config/
│   ├── gameConfig.ts         ALL tunable constants (costs, curves, biomes, castle, animals, merchant, click limiter, chests, stats)
│   ├── combatConfig.ts       COMBAT + MONSTERS: HP, regen, armor, spawn, monster defs (level scaling, armor, crit, Stun resist, grade), STAT_RULES
│   ├── itemCatalog.ts        facade: re-exports src/catalog and derives BASIC_GEAR / RATTATUI_SET for older imports
├── catalog/                  THE catalog: index.ts (ITEM_CATALOG, SETS, setCounts, starter kit, equipment layout), items/*.ts (one file per family: wooden, cloth, steel,
│                             obsidian, rattatui, legendary, consumables), rarity.ts, stats.ts, sets.ts, resources.ts, skills.ts (Heal, Stun), loot.ts (the supplies list)
│   ├── biomePalette.ts       one colour per biome (flat terrain fallback, minimap dots, BIOMES.baseColor) and the highlight tints
│   ├── playerClasses.ts, pixelIcons.ts
├── types/game.ts             Resources, Tile, CharacterStats, GameState (store interface), ClickInput, TileCost ...
├── stores/
│   ├── gameStore.ts          the single game store: every action (buyTile, tick, upgradeCastle, clickForGold, tapTile, rebirth, buyLegacyUpgrade, claimCritterGift ...)
│   ├── uiStore.ts            transient UI flags (class dialog, save menu, settings, legacy, tutorial, right-click menu, highlight, toast, view options)
│   ├── viewStore.ts          where the map is on the screen (pan x/y, zoom, window size), clamped to the explored land; read by Grid and the minimap
│   └── settingsStore.ts      sound / volume / ambient-life preferences (localStorage `idlarz-settings`, not game state)
├── utils/
│   ├── gameUtils.ts          pure maths: rates, costs, level curve, stat modifiers, tooltips text helpers
│   ├── world.ts              THE map: a sparse immutable `World` (explored tiles by numeric key, incremental counters + bounds), copy-on-write setTile/patchTile, row adapters for tests
│   ├── cluster.ts            connectedCluster: the connected same-biome area around a tile (the "Highlight" menu entry)
│   ├── worldGen.ts           seeded synthetic worlds (tests, `npm run perf`, the admin "+N tiles" buttons)
│   ├── terrain.ts            dual-grid map terrain: ground rank, dual-cell layers, tile depth, prop + dock placement (port of scripts/pixel/terrain_logic.py), plus the chunk helpers (worldGround, chunkSignature, chunkSprites, chunkPads)
│   ├── formatters.ts, audioManager.ts
├── lib/
│   ├── clickLimiter.ts       token-bucket limiter shared by gold clicks, tile taps and critter gifts (NOT fight hits)
│   ├── hitGuard.ts           fight hits: trusted clicks only, one DOM event counts once, no rate limit
│   ├── fightSim.ts           a bot that fights with the real combat rules (scripts/fight-sim.ts, tests/fightBalance.test.ts)
│   ├── castleWard.ts         the castle's ward (castle level 7+): isInWard, monstersOutsideWard, fortressWallTier; the growing violet range area: castleRangeRadius, inCastleRange
│   ├── castleFinder.ts       pure maths for finding the castle again: isCastleOnScreen, compassArrow (where on the screen edge the arrow goes, its angle, the distance)
│   ├── inventory.ts          pure bag / equipment operations + aggregateStats (the one place gear is summed)
│   ├── combat.ts             max HP, damage per click, armor mitigation, regen, fight state machine (stepFight)
│   ├── monsters.ts           monster levels and stats, spawn level windows, spawn tile, growth, boss timer
│   ├── loot.ts               kill rewards and drops (gold / xp as seconds of income)
│   ├── combatFx.ts           window event bus: hit / hurt / heal effects for the fight modal
│   ├── inventoryDrag.ts      drag payload shared by the bag and the equipment slots
│   ├── ambientLife.ts        pure picker for the wandering map critters (owned tile in view, biome-matched type)
│   ├── terrainRenderer.ts    loads the terrain atlas and draws one terrain chunk (16x16 tiles) onto its own canvas; a frame-budgeted draw queue
│   ├── mapView.ts            pure view maths: clampPosition (the pan limit), visibleTileRange, centerOf / positionForCenter
│   ├── minimap.ts            pure minimap layout and pixel painting (biome squares, castle + workshop markers, clustered red monster and yellow chest dots + chest glow picture, view rectangle maths)
│   ├── saveFormat.ts         the save text (IDLZ2.<base64 JSON>.<check>): compact body (the map as runs per row), schema 2 + migrations, encode/decode
│   ├── saveStorage.ts        localStorage storage: sync flush on close, backup + damaged copy, persist(), import/reset
│   ├── legacyVault.ts        read-only: the old encrypted IndexedDB vault and IDLZ1 exports
│   ├── sanitizeSave.ts       validation/normalisation of any loaded or imported save; PERSISTED_KEYS
│   ├── floatText.ts          "+N resource" popups at the cursor
├── hooks/
│   ├── useHydration.ts       true when the save has been loaded and the splash was shown long enough
│   ├── useSingleTab.ts       Web Lock: one tab owns the game
│   └── useCtrlSequence.ts    Control ×5 detector (shortcut to Save & Backup)
└── components/game/          Grid (pan + stepped wheel zoom, mounts only the explored and buyable tiles on screen), TerrainLayer (one canvas per chunk near the screen), HighlightLayer (the area tint), Minimap + BottomRightStack (overview), CastleCompass (edge arrow + "Back to castle" while the castle is off screen), Tile (transparent hit area + overlays), TileStatus, BiomeTooltip + MapTipLayer, dialogs (castle, biome,
    │                         building), header (GameHeader: PlayerCard + HeaderButtons in HeaderMenu, ResourceDisplay chips, LevelOrb, NotifyDot), Menu window (MenuOverlay + PixelTabs: Character, Stats, Merchant, Farm tabs; state in `uiStore` `menuOpen`/`menuTab`), WaterLayer (ripples), AmbientLife (decorative critters + rare golden gift),
    │                         CastleRange (violet area: 3x3, growing to 9x9 from castle level 8) / CastleFortress (walls, gate, corner towers on the inner 3x3, castle 7+), MonsterSprite / MonsterArt (monsters on tiles), ItemSlot / ItemTooltip / Bag (inventory)
    └── overlays/             Statistics, Character (paper doll + bag), FightModal, Farm (+scene/critters), Merchant, NamePrompt + Tutorial,
                              SettingsDialog, LegacyDialog (rebirth + shop), TutorialDialog, SaveMenuDialog,
                              TabLockOverlay, LevelUp/Chest notifications, LoadingScreen
scripts/
├── sim.ts                    bot simulation on the REAL store (milestones per player profile)
├── balance-report.ts         tables for docs/generated/balance-tables.md
└── pixel/                    sprite generators -> public/pixel/ (see "Pixel art pipeline")
tests/                        clickLimiter, economy (exploit/behaviour), saves (validation + crypto), castle, rebirth, ambient,
                              items, inventory, equipment, combat, monsters, loot, fight, kingInvariant, terrain (+ Python parity fixture)
```

## The map (`World`)

The map has no edge. `GameState.tiles` is a `World` (`src/utils/world.ts`): an immutable, sparse set of the **explored** tiles on an integer grid with negative coordinates, stored as `ReadonlyMap<number, Tile>` under a small-integer key (`tileKey(x, y)`, `|x|, |y| <= COORD_LIMIT = 16,000`, at most `MAX_OWNED_TILES = 250,000` tiles). Unexplored land is simply absent (`getTile` gives `undefined`, `tileAt` an empty tile). Updates are copy-on-write (`setTile`, `patchTile`, batched `setTiles`), so `state.tiles` changes exactly when the map does; the owned / building / chest / per-biome counters and the bounding box are kept up to date incrementally (O(1) reads, no per-tick scans). Tiles an old save knew by row and column keep their logical coordinates: the castle stays at (25, 25), so old saves and the procedural art (which hashes absolute coordinates, parity-tested against Python) are unchanged.

- Reads go through `getTile` / `tileAt` / `isOwnedAt` / `hasOwnedNeighbour` / `forEachOwned` / `ownedRowMajor` (a cached row-then-column order, so seeded pickers and saves do not depend on the order tiles were added). `buyTile` checks `hasOwnedNeighbour`, the coordinate range and the tile limit.
- A purchase costs one Map copy (about 16 ms at 50,000 tiles, mostly that copy plus the income pass); `npm run perf` prints the timings of the things that happen while playing at 5k / 50k / 250k tiles.
- Tests that were written for the old 50 x 50 array use `worldFromRows` / `rowsOf` / `gridCells` / `tileAt` from `tests/helpers.ts`.
- The map you can pan over is limited by `clampPosition` (`src/lib/mapView.ts`): the middle of the screen stays within the explored land's bounding box plus `PAN_MARGIN_TILES` (6), re-applied whenever the land, the window or the zoom changes. Nothing else limits panning, and zoom steps do not depend on the map size.

## State (`GameState`)

Persisted (`PERSISTED_KEYS`): `tiles`, `resources`, `level`, `previousLevel`, `playerName`, `playerClass`, `characterStats`, `farmLevels`, `farmUpgrades`, `merchantUpgrades`, `clickLevel`, `castleUpgrade`, `playSeconds`, chest fields, `prestige` (rebirths, Legacy points earned/unspent, shop levels; optional in saves), `gems` (the premium currency; optional in saves, default 1000), and the combat state: `equipment` (item ids by slot), `bag` (36 `{id, qty}` slots, plus 4 per Pack Rat level), `playerHp`, `playerMp`, `bossSpawnTimer`, `merchantStock` (the shelf of goods, optional), `monsters`, `monsterSpawnTimer`, `nextMonsterId` (all optional in saves; a save without equipment + bag gets the starter kit). Rebuilt on load: `resourceRates`, derived combat stats, reputation, castle upgrade cost, every window/dialog flag, `isHydrated`. `fight` (the open fight) is transient and never saved.

## The loop

`GameApp.tsx` runs `setInterval(…, 100 ms)` **only** in the owning tab and only after the save is loaded. Each interval computes `deltaTime = performance.now() − last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 … MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps but a changed system clock can neither skip nor reverse time. Offline progress is not computed here: a signed-in player's absence is claimed from the server before the loop starts ([11](11-offline-and-sealed-rolls.md)).

`tick` order: accumulate resources → XP (with `xpGainMultiplier`) → castle upgrade timer (finishing recomputes the rates) → chests (never on a monster tile) → monsters (age, evolve, spawn; the monster being fought is frozen) → fight step (monster attacks, King timer) or HP regeneration → level / stat points → one `set()`. The fight step clamps its delta to 1 s, so a throttled background tab slows a fight down instead of replaying minutes of attacks.

## Persistence

`persist` + `saveStorage` (see [07](07-security-and-exploits.md)): state objects are kept as-is in memory and encoded to one line of text only when written (debounced 2 s, and synchronously on `pagehide`). On start the storage reads `current` (or `backup`, or the old IndexedDB vault once), decodes and validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. The initial in-memory world is a fixed placeholder (so the server render and the first client render match); a player without a save gets a random start in `merge`. The schema version lives in `saveFormat.ts` (`SAVE_SCHEMA`, `MIGRATIONS`).

## Clicks

Fight hits (`hitMonster`) come from the fight modal, outside the map, and take a token from the same limiter (one token per physical click, trusted clicks only).

`useClickIncome` (called by `GameHeader`) registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold` (and the tile's `onClick` calls `tapTile` for the same event); both ask the shared limiter with the event's `timeStamp` as id, so one physical click costs one token. Catching a critter gift (`claimCritterGift`, map or farm window) goes through the same limiter and also has a per-source cooldown; the amount is always computed by the store.

## Rebirth

`rebirth()` checks castle level and tile count, computes the Legacy points, and rebuilds the state with `createInitialData(prestige)` (the starting bundle from the *Provisions* upgrade is applied there). Name, class, play time, and prestige are kept; everything else is reset. Prestige effects are passed as an optional argument into `calculateResourceRates`, `calculateTileCost`, `calculateBuildingCost` and `castleUpgradeDuration`, so the maths stays in `gameUtils.ts`.

## Ambient life

`AmbientLife` (inside `Grid`) spawns a critter every few seconds on an owned tile in view; they are decorative. About 1 in 12 carries a gift and is clickable; the click goes through `claimCritterGift`. It is off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.

## Rendering notes

- `Grid` mounts only the tiles that matter on screen: explored tiles and the unexplored ones touching them (what can be bought), inside the visible range plus two tiles. The list is rebuilt when that integer range or the map changes, not on every pixel of panning. The pan / zoom position lives in `viewStore`; fling inertia keeps its velocity in a ref with friction (no per-frame React state). The world div is a zero-size origin placed with `translate() scale()`; everything inside is positioned in world pixels, negative ones included.
- **Wheel zoom** is stepped (0.75 / 1 / 1.5 / 2, one step per 50 px of wheel delta) so the pixel art stays crisp and zooms around the cursor; the steps do not depend on the map size (zoom out to find far-away land; 0.5 is deferred, see [04](04-unfinished-and-known-issues.md)). The zoom is exposed to CSS as `--map-zoom`; tile tooltips scale with it, castle/building dialogs do not.
- **Terrain**: the ground is drawn in **chunks** of 16 x 16 tiles (768 px, `CHUNK_TILES`), one `<canvas>` each (`TerrainLayer` / `TerrainChunk`), only for the chunks on screen plus a ring around them, by `terrainRenderer.ts` from the atlas in `public/pixel/terrain/` + `src/config/terrainAtlas.json`. A chunk's picture depends only on the ground inside the chunk plus `CHUNK_HALO` (5) tiles, so its `chunkSignature` (one character per tile of that window, building tiles upper case) decides when it is redrawn: a purchase redraws the chunks next to it, never pan, zoom or a chest toggle. The ground comes from `worldGround(world)` (explored tile -> its ground, unexplored next to explored -> 'mist'), cached per World. Dual cells on a chunk border are drawn by both chunks, sprites that reach over a border (a tree, a pier) by both too, the texture pattern is anchored at the world origin and each canvas is 2 px larger than its part, so there are no seams even at fractional zoom. Draws are queued and run within a 6 ms frame budget (at least one chunk per frame); flat colours show first and until the atlas loads. Tiles are transparent hit areas that carry the castle, buildings, chest, '?' marker and hover overlays. Buyable unexplored tiles are drawn as the dark 'mist' sea. `tests/terrainChunks.test.ts` checks the halo is enough, that equal signatures mean equal pictures, and that nothing is cut at a border.
- **Highlight**: the tile menu's "Highlight this ... area" tints the connected same-biome area (`connectedCluster`, an iterative flood fill) with the biome's colour from `biomePalette.ts` for 3 s, drawn by `HighlightLayer` as one screen-space canvas (only tiles on screen are looked at, so a 20,000-tile area costs the same as a 20-tile one), no border.
- **Minimap**: `Minimap` (bottom right, switched in the global menu) paints one square per explored tile in its biome colour into one `ImageData` (`src/lib/minimap.ts`, repainted at most every 200 ms; 4 ms at 50,000 tiles), a gold marker on the castle, purple ones on workshops, and outlines the visible part (moved straight in the DOM, no React render per pan frame). Click or drag centres the view there (clamped like any pan); it is outside the map's click area, so it never pays gold. A small map is drawn up to 6 px per tile, a big one down to a fraction of a pixel.
- **Biome rules and chests**: `src/config/biomeRules.ts` (numbers) + `src/utils/biomeRules.ts` (unlocks, conflicts, clustering, the starting ring) decide what a purchase becomes; `src/lib/chests.ts` decides where chests appear and what they hold. Both are pure with an injectable `random()`. The free starting ring is `GameState.freeTiles`; costs use `economyTiles()` (see [02](02-mechanics.md)).
- **Buildings**: any explored tile except the castle and lakes can take one (`buildOnTile`, `canBuildOn`, price `calculateBuildingCost` / `buildingCostFactor`); the right-click `BuildMenu` component opens from `Tile.tsx`. A building keeps its tile's own ground and gets a pad of that biome (`allPads()` in `terrain.ts`, art in `terrain_pads.py`, drawn under the sprites) (the same rule is ported to `terrain_logic.py` and covered by the parity fixture, where a lowercase letter marks a building). Building tiles carry no props.
- Tile tooltips are portalled into `MapTipLayer`, a layer above the critters, because every tile is its own stacking context.
- `NotifyDot` is the one "needs attention" marker (a soft orange dot). It is used on header controls and the Menu tabs: unspent stat points (level orb, Stats tab) and an affordable farm animal or upgrade (Farm tab); the Menu button shows either (`useMenuAttention`).
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
npm test         # unit/exploit tests (limiter, economy, saves, castle, rebirth, ambient)
npm run sim      # bot simulation -> docs/generated/sim-milestones.md
npm run report   # tables -> docs/generated/balance-tables.md
```
