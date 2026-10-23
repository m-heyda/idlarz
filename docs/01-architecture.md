# 01 · Architecture

## Stack

| Piece | Version | Notes |
| --- | --- | --- |
| Next.js | 15.5.28 | App Router, one page (`src/app/page.tsx`), `'use client'` |
| React | 19.3.x | |
| Tailwind CSS | 4.3.x via `@tailwindcss/postcss` | `@import 'tailwindcss'` in `globals.css`; pixel-art UI kit styles in `src/app/globals.css` and `src/styles/*` |
| Zustand | 5.0.x | `persist` with a custom encrypted IndexedDB storage |
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
│   ├── playerClasses.ts, pixelIcons.ts
├── types/game.ts             Resources, Tile, CharacterStats, GameState (store interface), ClickInput, TileCost ...
├── stores/
│   ├── gameStore.ts          the single game store: every action (buyTile, tick, upgradeCastle, clickForGold, tapTile, rebirth, buyLegacyUpgrade, claimCritterGift ...)
│   ├── uiStore.ts            transient UI flags (class dialog, save menu, settings, legacy, tutorial)
│   └── settingsStore.ts      sound / volume / ambient-life preferences (localStorage `idlarz-settings`, not game state)
├── utils/
│   ├── gameUtils.ts          pure maths: rates, costs, level curve, stat modifiers, tooltips text helpers
│   ├── formatters.ts, audioManager.ts
├── lib/
│   ├── clickLimiter.ts       token-bucket limiter shared by gold clicks, tile taps and critter gifts
│   ├── ambientLife.ts        pure picker for the wandering map critters (owned tile in view, biome-matched type)
│   ├── saveVault.ts          IndexedDB + AES-GCM vault, debounced writes, export/import/reset
│   ├── sanitizeSave.ts       validation/normalisation of any loaded or imported save; PERSISTED_KEYS
│   ├── floatText.ts          "+N resource" popups at the cursor
├── hooks/
│   ├── useHydration.ts       true when the save has been loaded and the splash was shown long enough
│   ├── useSingleTab.ts       Web Lock: one tab owns the game
│   └── useCtrlSequence.ts    Control ×5 detector (hidden save tools)
└── components/game/          Grid, Tile, TileStatus, BiomeTooltip, dialogs (castle, biome, building), header,
    │                         AmbientLife (decorative critters + rare golden gift)
    └── overlays/             Statistics, Character, Farm (+scene/critters), Merchant, NamePrompt + Tutorial,
                              SettingsDialog, LegacyDialog (rebirth + shop), TutorialDialog, SaveMenuDialog,
                              TabLockOverlay, LevelUp/Chest notifications, LoadingScreen
scripts/
├── sim.ts                    bot simulation on the REAL store (milestones per player profile)
├── balance-report.ts         tables for docs/generated/balance-tables.md
└── pixel/                    sprite generators
tests/                        clickLimiter, economy (exploit/behaviour), saves (validation + crypto), castle, rebirth, ambient
```

## State (`GameState`)

Persisted (`PERSISTED_KEYS`): `tiles`, `resources`, `level`, `previousLevel`, `playerName`, `playerClass`, `characterStats`, `farmLevels`, `clickLevel`, `castleUpgrade`, `playSeconds`, chest fields, `prestige` (rebirths, Legacy points earned/unspent, shop levels; optional in saves). Rebuilt on load: `resourceRates`, derived combat stats, reputation, castle upgrade cost, every window/dialog flag, `isHydrated`. `equipment` and `inventory` exist but are not saved (nothing changes them yet).

## The loop

`page.tsx` runs `setInterval(…, 100 ms)` **only** in the owning tab and only after the save is loaded. Each interval computes `deltaTime = performance.now() − last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 … MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps but a changed system clock can neither skip nor reverse time. There is no offline progress.

`tick` order: accumulate resources → XP (with `xpGainMultiplier`) → castle upgrade timer (finishing recomputes the rates) → chests → level / stat points → one `set()`.

## Persistence

`persist` + `vaultStorage` (see [07](07-security-and-exploits.md)): state objects are kept as-is in memory and encrypted/compressed only when written (debounced). On start the vault reads `current` (or `previous`), validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. Save key `idle-explorer-v12`, `SAVE_VERSION = 12`; old localStorage saves are deleted, not migrated.

## Clicks

`ResourceDisplay` registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold` (and the tile's `onClick` calls `tapTile` for the same event); both ask the shared limiter with the event's `timeStamp` as id, so one physical click costs one token. Catching a critter gift (`claimCritterGift`, map or farm window) goes through the same limiter and also has a per-source cooldown; the amount is always computed by the store.

## Rebirth

`rebirth()` checks castle level and tile count, computes the Legacy points, and rebuilds the state with `createInitialData(prestige)` (the starting bundle from the *Provisions* upgrade is applied there). Name, class, play time, and prestige are kept; everything else is reset. Prestige effects are passed as an optional argument into `calculateResourceRates`, `calculateTileCost`, `calculateBuildingCost` and `castleUpgradeDuration`, so the maths stays in `gameUtils.ts`.

## Ambient life

`AmbientLife` (inside `Grid`) spawns a critter every few seconds on an owned tile in view; they are decorative. About 1 in 12 carries a gift and is clickable; the click goes through `claimCritterGift`. It is off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.

## Rendering notes

- `Grid` culls to the visible window and pans with pointer handlers; fling inertia keeps its velocity in a ref with friction (no per-frame React state).
- Every visible `Tile` subscribes to `tiles` and `resources`, so tiles re-render on each tick; fine for the current viewport, the first thing to optimise if it grows ([05](05-balance-backlog-and-roadmap.md)).
- Tutorial, stat tooltips and cost lists are generated from config constants, so they cannot drift from the rules.

## Build & run

```bash
npm install
npm run dev      # next dev --turbopack
npm run build && npm run lint
npm test         # unit/exploit tests (limiter, economy, saves, castle, rebirth, ambient)
npm run sim      # bot simulation -> docs/generated/sim-milestones.md
npm run report   # tables -> docs/generated/balance-tables.md
```
