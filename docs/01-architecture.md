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

No backend, no API routes. The whole game is client-side state.

## File map

```
src/
├── app/page.tsx              game loop, tab lock, hidden Ctrl×5 shortcut, composes all overlays
├── config/
│   ├── gameConfig.ts         ALL tunable constants (costs, curves, biomes, castle, animals, merchant, click limiter, chests, stats)
│   ├── combatConfig.ts       COMBAT + MONSTERS: HP, regen, armor, spawn, tiers, drops, Rat King
│   ├── itemCatalog.ts        every item (ITEM_CATALOG), the Rattatui set, starter kit, equipment slot layout
│   ├── playerClasses.ts, pixelIcons.ts
├── types/game.ts             Resources, Tile, CharacterStats, GameState (store interface), ClickInput, TileCost ...
├── stores/
│   ├── gameStore.ts          the single game store: every action (buyTile, tick, upgradeCastle, clickForGold, tapTile, rebirth, buyLegacyUpgrade, claimCritterGift ...)
│   ├── uiStore.ts            transient UI flags (class dialog, save menu, settings, legacy, tutorial)
│   └── settingsStore.ts      sound / volume / ambient-life preferences (localStorage `idlarz-settings`, not game state)
├── utils/
│   ├── gameUtils.ts          pure maths: rates, costs, level curve, stat modifiers, tooltips text helpers
│   ├── terrain.ts            dual-grid map terrain: ground rank, dual-cell layers, tile depth, prop + dock placement (port of scripts/pixel/terrain_logic.py)
│   ├── formatters.ts, audioManager.ts
├── lib/
│   ├── clickLimiter.ts       token-bucket limiter shared by gold clicks, tile taps, critter gifts and fight hits
│   ├── castleWard.ts         the castle's ward (castle level 7+): isInWard, monstersOutsideWard, fortressWallTier
│   ├── inventory.ts          pure bag / equipment operations + aggregateStats (the one place gear is summed)
│   ├── combat.ts             max HP, damage per click, armor mitigation, regen, fight state machine (stepFight)
│   ├── monsters.ts           tiers, monster stats, spawn tile, aging and Rat King evolution
│   ├── loot.ts               kill rewards and drops (gold / xp as seconds of income)
│   ├── combatFx.ts           window event bus: hit / hurt / heal effects for the fight modal
│   ├── inventoryDrag.ts      drag payload shared by the bag and the equipment slots
│   ├── ambientLife.ts        pure picker for the wandering map critters (owned tile in view, biome-matched type)
│   ├── terrainRenderer.ts    loads the terrain atlas and draws the whole map ground onto one canvas
│   ├── saveFormat.ts         the save text (IDLZ2.<base64 JSON>.<check>): compact body, schema + migrations, encode/decode
│   ├── saveStorage.ts        localStorage storage: sync flush on close, backup + damaged copy, persist(), import/reset
│   ├── legacyVault.ts        read-only: the old encrypted IndexedDB vault and IDLZ1 exports
│   ├── sanitizeSave.ts       validation/normalisation of any loaded or imported save; PERSISTED_KEYS
│   ├── floatText.ts          "+N resource" popups at the cursor
├── hooks/
│   ├── useHydration.ts       true when the save has been loaded and the splash was shown long enough
│   ├── useSingleTab.ts       Web Lock: one tab owns the game
│   └── useCtrlSequence.ts    Control ×5 detector (shortcut to Save & Backup)
└── components/game/          Grid (pan + stepped wheel zoom), TerrainLayer (canvas ground), Tile (transparent hit area + overlays), TileStatus, BiomeTooltip + MapTipLayer, dialogs (castle, biome,
    │                         building), header (HeaderMenu, LevelOrb, NotifyDot), AmbientLife (decorative critters + rare golden gift),
    │                         CastleRange (violet 3x3 area, castle < 7) / CastleFortress (walls, gate, corner towers, castle 7+), MonsterSprite / MonsterArt (monsters on tiles), ItemSlot / ItemTooltip / Bag (inventory)
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

## State (`GameState`)

Persisted (`PERSISTED_KEYS`): `tiles`, `resources`, `level`, `previousLevel`, `playerName`, `playerClass`, `characterStats`, `farmLevels`, `farmUpgrades`, `merchantUpgrades`, `clickLevel`, `castleUpgrade`, `playSeconds`, chest fields, `prestige` (rebirths, Gems = Legacy points earned/unspent, shop levels; optional in saves), and the combat state: `equipment` (item ids by slot), `bag` (36 `{id, qty}` slots, plus 4 per Pack Rat level), `playerHp`, `monsters`, `monsterSpawnTimer`, `nextMonsterId` (all optional in saves; a save without equipment + bag gets the starter kit). Rebuilt on load: `resourceRates`, derived combat stats, reputation, castle upgrade cost, every window/dialog flag, `isHydrated`. `fight` (the open fight) is transient and never saved.

## The loop

`page.tsx` runs `setInterval(…, 100 ms)` **only** in the owning tab and only after the save is loaded. Each interval computes `deltaTime = performance.now() − last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 … MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps but a changed system clock can neither skip nor reverse time. There is no offline progress.

`tick` order: accumulate resources → XP (with `xpGainMultiplier`) → castle upgrade timer (finishing recomputes the rates) → chests (never on a monster tile) → monsters (age, evolve, spawn; the monster being fought is frozen) → fight step (monster attacks, King timer) or HP regeneration → level / stat points → one `set()`. The fight step clamps its delta to 1 s, so a throttled background tab slows a fight down instead of replaying minutes of attacks.

## Persistence

`persist` + `saveStorage` (see [07](07-security-and-exploits.md)): state objects are kept as-is in memory and encoded to one line of text only when written (debounced 2 s, and synchronously on `pagehide`). On start the storage reads `current` (or `backup`, or the old IndexedDB vault once), decodes and validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. The initial in-memory world is a fixed placeholder (so the server render and the first client render match); a player without a save gets a random start in `merge`. The schema version lives in `saveFormat.ts` (`SAVE_SCHEMA`, `MIGRATIONS`).

## Clicks

Fight hits (`hitMonster`) come from the fight modal, outside the map, and take a token from the same limiter (one token per physical click, trusted clicks only).

`ResourceDisplay` registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold` (and the tile's `onClick` calls `tapTile` for the same event); both ask the shared limiter with the event's `timeStamp` as id, so one physical click costs one token. Catching a critter gift (`claimCritterGift`, map or farm window) goes through the same limiter and also has a per-source cooldown; the amount is always computed by the store.

## Rebirth

`rebirth()` checks castle level and tile count, computes the Legacy points, and rebuilds the state with `createInitialData(prestige)` (the starting bundle from the *Provisions* upgrade is applied there). Name, class, play time, and prestige are kept; everything else is reset. Prestige effects are passed as an optional argument into `calculateResourceRates`, `calculateTileCost`, `calculateBuildingCost` and `castleUpgradeDuration`, so the maths stays in `gameUtils.ts`.

## Ambient life

`AmbientLife` (inside `Grid`) spawns a critter every few seconds on an owned tile in view; they are decorative. About 1 in 12 carries a gift and is clickable; the click goes through `claimCritterGift`. It is off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.

## Rendering notes

- `Grid` culls to the visible window and pans with pointer handlers; fling inertia keeps its velocity in a ref with friction (no per-frame React state).
- **Wheel zoom** is stepped (0.75 / 1 / 1.5 / 2, one step per 50 px of wheel delta) so the pixel art stays crisp, zooms around the cursor and never goes below the level where the world stops covering the screen. The zoom is exposed to CSS as `--map-zoom`; tile tooltips scale with it, castle/building dialogs do not.
- **Terrain**: the map ground is one 2400x2400 `<canvas>` (`TerrainLayer`, first child of the world div) drawn by `terrainRenderer.ts` from the atlas in `public/pixel/terrain/` + `src/config/terrainAtlas.json`. It redraws only when `terrainKey(tiles)` changes (a purchase, a yard upgrade, rebirth, load - not on pan, zoom or chest toggles), so panning and zoom just move one raster with no cell seams. Tiles are transparent hit areas that carry the castle, buildings, chest, '?' marker and hover overlays. Buyable unexplored tiles are drawn as the dark 'mist' sea; a flat colour per ground is shown until the atlas loads.
- **Biome rules and chests**: `src/config/biomeRules.ts` (numbers) + `src/utils/biomeRules.ts` (unlocks, conflicts, clustering, picker verdicts, the starting ring) decide what a purchase becomes; `src/lib/chests.ts` decides where chests appear and what they hold. Both are pure with an injectable `random()`. The free starting ring is `GameState.freeTiles`; costs use `economyTiles()` (see [02](02-mechanics.md)).
- **Foundations**: a built-on grounds tile resolves to the biome around it (`foundation()` in `terrain.ts`, ported to `terrain_logic.py` and covered by the parity fixture) and gets a pad decal (`terrain_pads.py`, drawn under the sprites); building tiles carry no props.
- Tile tooltips are portalled into `MapTipLayer`, a layer above the critters, because every tile is its own stacking context.
- `NotifyDot` is the one "needs attention" marker (a soft orange dot). It is used on header controls only: unspent stat points on the level orb and an affordable farm animal or upgrade on the Farm button.
- Font: Mozilla Headline (self-hosted via `@fontsource-variable/mozilla-headline`, exposed as `--font-pixel`).
- Every visible `Tile` subscribes to `tiles` and `resources`, so tiles re-render on each tick; fine for the current viewport, the first thing to optimise if it grows ([05](05-balance-backlog-and-roadmap.md)).
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
