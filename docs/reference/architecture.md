# Architecture

> Generated from the JSDoc in the code by `npm run docs:code`. Do not edit: change the JSDoc next to the code and commit (the pre-commit hook regenerates this).

Stack, state, the tick loop, the map, rendering and the art pipeline.

**Contents**

- The loop: [The tick loop and persistence](#gameapp)
- State: [The map (World)](#coord-limit), [`GameState`](#gamestate)
- Rendering: [Rendering the map](#rendering-the-map)
- Art: [Pixel art pipeline](#pixel-art-pipeline), [Map lab](#map-lab), [The landing world](#the-landing-world), [Asset library](#asset-library), [`NPC_PORTRAITS`](#npc-portraits), [`BIOME_ART`](#biome-art), [`ANIMAL_PIXEL_ICONS`](#animal-pixel-icons), [`animalIcon`](#animalicon)
- Routes: [The /play route and its redirects](#the-play-route-and-its-redirects)

## The loop

<a id="gameapp"></a>

### The tick loop and persistence

Source: [`src/app/GameApp.tsx:115`](../../src/app/GameApp.tsx)

The tick loop. `GameApp` runs `setInterval(..., 100 ms)` **only** in the owning tab (one tab owns the game through a Web Lock, `useSingleTab`) and only after the save is loaded and the offline claim is done.
Each interval computes `deltaTime = performance.now() - last` (monotonic) and calls `store.tick(deltaTime)`; `tick` clamps the delta to `0 ... MAX_CATCHUP_SEC` (300 s), so a throttled background tab catches up in 5-minute steps
but a changed system clock can neither skip nor reverse time. Offline progress is not computed here: a player's absence is claimed from the server before the loop starts ([`computeOfflineGrant`](saves-and-server.md#computeofflinegrant)).

`tick` order: accumulate resources -> XP (with `xpGainMultiplier`) -> castle upgrade timer (finishing recomputes the rates) -> age the monsters on the map (`advanceMonsters`; the server places them) -> HP / mana regeneration and cooldowns
(in a fight the server's HP is left alone) -> merchant stock rotation -> level / stat points -> one `set()`. **The tick does not spawn chests or monsters and does not run fights.**

`useSpawnSync` polls `/api/spawn` (it waits until the next ticket is due, 20 to 600 s; an open fight is polled once, when the plan it was sent says it ends (a fight the server could not plan: every 2 s, a minimized one every 8 s), and the boss timer and the bars run on the browser between answers; a fight action also triggers an immediate sync): the server answers with the chests and monsters
that have appeared (`applyServerTickets` -> `reconcileMap` places them on the map), the gem balance and the combat view (HP, mana, cooldowns, the open fight). A click on a monster calls `startFight`, which asks `/api/fight` to open the fight;
from then on the server swings both ways in fixed ticks, with or without the browser.

**Clicks.** `useClickIncome` (called by `GameHeader`) registers one window `click` listener. A click counts only if it is trusted and lands inside `[data-click-area]` (the map). It calls `clickForGold`, which asks the limiter ([`createClickLimiter`](economy.md#createclicklimiter))
with the event's `timeStamp` as id, so one physical click costs one token. Nothing hits a monster by clicking: a click on a monster only opens the fight.

**Persistence.** `persist` + `saveStorage`: state objects are kept as-is in memory and encoded to one line of text only when written (debounced 2 s, and synchronously on `pagehide`). On start the storage reads `current` (or `backup`, or the old IndexedDB vault once),
decodes and validates it with `sanitizeSave`, `merge` rebuilds rates and sets `isHydrated`; `onRehydrateStorage` then enables writing. The initial in-memory world is a fixed placeholder (so the server render and the first client render match);
a player without a save gets a random start in `merge`. The browser copy is a cache and the export path; the account holds the verified copy.

See also: [`computeOfflineGrant`](saves-and-server.md#computeofflinegrant), [`SAVE_SCHEMA`](saves-and-server.md#save-schema)

## State

<a id="coord-limit"></a>

### The map (World)

Source: [`src/utils/world.ts:32`](../../src/utils/world.ts)

The map has no edge. `GameState.tiles` is a `World`: an immutable, sparse set of the **explored** tiles on an integer grid with negative coordinates, stored as `ReadonlyMap<number, Tile>` under a small-integer key (`tileKey(x, y)`,
`|x|, |y| <= COORD_LIMIT = 16,000`, at most `MAX_OWNED_TILES = 250,000` tiles). Unexplored land is simply absent (`getTile` gives `undefined`, `tileAt` an empty tile). Updates are copy-on-write (`setTile`, `patchTile`, batched `setTiles`),
so `state.tiles` changes exactly when the map does; the owned / chest / per-biome counters and the bounding box are kept up to date incrementally (O(1) reads, no per-tick scans).

Tiles an old save knew by row and column keep their logical coordinates: the castle stays at (25, 25), so old saves and the procedural art (which hashes absolute coordinates, parity-tested against Python) are unchanged.

- Reads go through `getTile` / `tileAt` / `isOwnedAt` / `hasOwnedNeighbour` / `forEachOwned` / `ownedRowMajor` (a cached row-then-column order, so seeded pickers and saves do not depend on the order tiles were added).
  `buyTile` checks `hasOwnedNeighbour`, the coordinate range and the tile limit.
- A purchase costs one Map copy (about 16 ms at 50,000 tiles, mostly that copy plus the income pass); `npm run perf` prints the timings at 5k / 50k / 250k tiles.
- Tests that were written for the old 50 x 50 array use `worldFromRows` / `rowsOf` / `gridCells` / `tileAt` from `tests/helpers.ts`.
- The map you can pan over is limited by `clampPosition` (`src/lib/mapView.ts`): the middle of the screen stays within the explored land's bounding box plus `PAN_MARGIN_TILES` (6). Nothing else limits panning, and zoom steps do not depend on the map size.

<a id="gamestate"></a>

### `GameState` <small>interface</small>

Source: [`src/types/game.ts:362`](../../src/types/game.ts)

State. The persisted keys are `PERSISTED_KEYS` ([`PERSISTED_KEYS`](saves-and-server.md#persisted-keys)), the one list. Fields added later are optional in old saves and get defaults; a save without equipment + bag gets the starter kit.

Not saved: `monsters` and the open fight (`combat`) are the server's picture and arrive with each `/api/spawn` answer. Rebuilt on load: `resourceRates`, derived combat stats, castle upgrade cost, every window/dialog flag, `isHydrated`.
The stores: `gameStore.ts` (every action: buyTile, tick, upgradeCastle, clickForGold, startFight, rebirth, buyEmberUpgrade, merchant actions ...), `uiStore.ts` (transient UI flags), `viewStore.ts` (where the map is on the screen),
`settingsStore.ts` (sound, volume, ambient-life preferences; `localStorage` `idlarz-settings`, not game state), `rewardPendingStore.ts` (the chest being opened).

See also: [`PERSISTED_KEYS`](saves-and-server.md#persisted-keys)

## Rendering

<a id="rendering-the-map"></a>

### Rendering the map

Source: [`src/components/game/Grid.tsx:1`](../../src/components/game/Grid.tsx)

Rendering notes.

- `Grid` mounts only the tiles that matter on screen: explored tiles and the unexplored ones touching them (what can be bought), inside the visible range plus two tiles. The list is rebuilt when that integer range or the map changes, not on every pixel of panning.
  The pan / zoom position lives in `viewStore`; fling inertia keeps its velocity in a ref with friction (no per-frame React state). The world div is a zero-size origin placed with `translate() scale()`; everything inside is positioned in world pixels, negative ones included.
- **Wheel zoom** is stepped (0.75 / 1 / 1.5 / 2, one step per 50 px of wheel delta) so the pixel art stays crisp and zooms around the cursor. The zoom is exposed to CSS as `--map-zoom`; tile tooltips scale with it, castle dialogs do not.
- **Terrain**: the ground is drawn in **chunks** of 16 x 16 tiles (768 px, `CHUNK_TILES`), one `<canvas>` each (`TerrainLayer` / `TerrainChunk`), only for the chunks on screen plus a ring around them, by `terrainRenderer.ts` from the atlas in `public/pixel/terrain/`
  + `src/config/terrainAtlas.json`. A chunk's picture depends only on the ground inside the chunk plus `CHUNK_HALO` (5) tiles, so its `chunkSignature` (one character per tile of that window) decides when it is redrawn: a purchase redraws
  the chunks next to it, never pan, zoom or a chest toggle. Draws are queued and run within a 6 ms frame budget (at least one chunk per frame); flat colours show first and until the atlas loads. Tiles are transparent hit areas that carry the castle,
  chest, '?' marker and hover overlays. Buyable unexplored tiles are drawn as the dark 'mist' sea. `tests/world/terrainChunks.test.ts` checks the halo is enough, that equal signatures mean equal pictures, and that nothing is cut at a border.
- **Highlight**: the tile menu's "Highlight this ... area" tints the connected same-biome area (`connectedCluster`, an iterative flood fill) with the biome's colour from `biomePalette.ts` for 3 s, drawn by `HighlightLayer` as one screen-space canvas.
- **Minimap**: `Minimap` paints one square per explored tile in its biome colour into one `ImageData` (`src/lib/minimap.ts`, repainted at most every 200 ms), a gold marker on the castle, and outlines the visible part.
  Click or drag centres the view there; it is outside the map's click area, so it never pays gold.
- **Building pads** (`allPads()` in `terrain.ts`, art in `terrain_pads.py`) are drawn under a tile that carries `Tile.building`. Nothing sets it since IDL-259; the per-biome building system (R7, IDL-91) will.
- Tile tooltips are portalled into `MapTipLayer`, a layer above the critters, because every tile is its own stacking context. `NotifyDot` is the one "needs attention" marker (unspent stat points, an affordable farm animal or upgrade).
- A `Tile` reads only primitives from the store and takes `canAfford` from `Grid`, which works the price of the next tile out once for all of them; unchanged tiles are skipped by `React.memo`, so panning mounts only the tiles that enter the view.
- `AmbientLife` spawns a critter every few seconds on an owned tile in view; they are purely decorative (no clicks, no rewards) and off when disabled in Settings, when the tab is hidden, and with `prefers-reduced-motion`.
- Tutorial, stat tooltips and cost lists are generated from config constants, so they cannot drift from the rules. Font: Mozilla Headline (self-hosted, `--font-pixel`).

## Art

<a id="pixel-art-pipeline"></a>

### Pixel art pipeline

Source: [`src/config/pixelIcons.ts:1`](../../src/config/pixelIcons.ts)

All sprites, frames and the map terrain (textures, dual-grid shape atlases, trees, rocks, docks) are generated, not drawn by hand: `python scripts/pixel/build.py [name ...]` (Pillow) rewrites `public/pixel/{icons,ui,bg,terrain}/` in place and prunes
stale files afterwards, so a running dev server never 404s. `python scripts/pixel/build.py terrain` rebuilds only the terrain, `src/config/terrainAtlas.json` and `tests/fixtures/terrain-parity.json`;
`python scripts/pixel/terrain_preview.py` renders mock maps to `scripts/pixel/previews/`. Resource icons come from the supplied pictures in `public/pixel/resources/` (padded 32 -> 40 px by `sprites_resource_art.py`).
Monster art is the exception: it is hand-supplied in `public/pixel/enemies/<biome>/` and never touched by the build. `--refs` also refreshes the curated images in `scripts/pixel/reference/`; the visual rules (top-down buildings, outlines, palette,
~40 px detail) are in `scripts/pixel/reference/STYLE.md`. Unsorted supplied art waits in `public/pixel/assets_to_assess_and_use/<folder>/` (potions, buildings, map details, trees, ruins ...): each folder has a README with what is inside and what it could be used for, and nothing there is wired into the game until it is registered. Icons are registered in this file; item icons are one JSON line each in `src/config/itemIcons/` (see its README).

<a id="map-lab"></a>

### Map lab

Source: [`src/app/map-lab/page.tsx:2`](../../src/app/map-lab/page.tsx)

Map lab (`/map-lab`): a public, client-only page to look at and tweak the art. It renders the real map components (`Grid`, `Tile`, terrain, minimap) over a simulated world: no login, no `/api/*` call, nothing saved.
The panel offers biome painting, extending land, erasing, chests and monsters (by hand or random spawns), brush size, castle level, presets (start ring, rolled 60 / 400, every biome), undo (Ctrl+Z) and JSON export / import (a lab file, not a game save).

- `components/game/mapSource.tsx`: the map components read their store from this context. The game gets the real `useGameStore` / `useViewStore` by default; the lab provides `stores/labStore.ts` and its own view store (`createViewStore`).
- `lib/dragPaint.ts` (pure): hold-and-drag drawing. `createStroke(apply)` turns pointer moves into the new cells of one stroke (line interpolation, brush, no repeats, capped).
- `lib/mapEdit.ts` (pure): `applyStroke(world, cells, tool)` plus the tools (`paintTool`, `extendTool`, `eraseTool`, `chestTool`, `extendRing`). A new tool is one more `(world, cell) => Tile | undefined | 'skip'` function.
- The lab's random chests use a plain picker on purpose: the game's weighted chest placement stays server-side (`tests/server/serverBoundary.test.ts`).

<a id="the-landing-world"></a>

### The landing world

Source: [`src/lib/landingWorld.ts:4`](../../src/lib/landingWorld.ts)

The world behind the landing page: a vast, seeded land of the basic biomes (plains, forest, swamp, tundra, coast) with a sea around it, a river and ponds, and the word IDLE spelled
out in hills on a snow plain that is part of the mainland (patches of the biomes, not slabs). `/map-lab/landing-bake` draws it with the real terrain renderer and saves `public/landing/map.png`, which the landing page shows (so the landing never runs the generator).
Deterministic: the same seed gives the same picture. Pure: no canvas, no store.

<a id="asset-library"></a>

### Asset library

Source: [`scripts/assets/manifest.ts:1`](../../scripts/assets/manifest.ts)

The asset library: `buildManifest()` lists every picture the game uses or could reuse under one stable NAME, grouped by category (potions, weapons, armor,
accessories, monsters, buildings, resources, map-details, ui, portraits, unsorted). Biomes, terrain atlases and ground textures are left out on purpose.
Registered art keeps its registry id (item icons, monster and resource rosters, `pixelIcons.ts`); raw pack files in `public/pixel/assets_to_assess_and_use/`
get a generated name (`<pack>_<file>`, e.g. `tree_autumn_tree1`), with shadow renderings folded into `variants`; `scripts/assets/names.json` renames any of them.
`npm run assets:catalog` renders it into `docs/assets/` (manifest.json plus one page per category), which `stories/assets/` shows in Storybook
(`npm run storybook`) and `tests/docs/assets.test.ts` keeps current. Never edit `docs/assets/` by hand.

<a id="npc-portraits"></a>

### `NPC_PORTRAITS` <small>const</small>

Source: [`src/config/npcPortraits.ts:12`](../../src/config/npcPortraits.ts)

The NPC portraits: 12 small bust pictures (48x48, transparent, Sprite Fusion) in `public/pixel/portraits/`, named `npc_<who>`. They are NOT the 40x40 bust frame of
the avatars in `art_style_reference/ui-and-portraits/README.md`: keep them at their own size, drawn with `image-rendering: pixelated` (class `pixelated`).
The merchant window shows one face per tab (`MERCHANT_PORTRAIT`); every other portrait stays in the asset library (category Portraits) as a ready face for
a future quest giver, innkeeper, blacksmith or dialogue.

<a id="biome-art"></a>

### `BIOME_ART` <small>const</small>

Source: [`src/config/biomeArt.ts:11`](../../src/config/biomeArt.ts)

The picture of each rebirth biome: an 80x80 framed landscape vignette (Sprite Fusion, supplied by the owner on 2026-11-10) in `public/pixel/new_assets/biomes/`. Today only the "New land
unlocked" window shows them (`RebirthUnlockModal`); the other vignettes of the folder (alternatives, the older biomes and three extras) wait in the asset library, category Biomes.
The file name is `biome_<name>.png`; change the value here to use another one.

<a id="animal-pixel-icons"></a>

### `ANIMAL_PIXEL_ICONS` <small>const</small>

Source: [`src/config/pixelIcons.ts:249`](../../src/config/pixelIcons.ts)

Farm animal id -> its sprites. Chickens and cows come in two looks, the others in one. Which look an animal wears is [`animalIcon`](architecture.md#animalicon).

<a id="animalicon"></a>

### `animalIcon` <small>function</small>

Source: [`src/config/pixelIcons.ts:264`](../../src/config/pixelIcons.ts)

The sprite one animal wears: a stable pick among its kind's looks from a hash of `seed` (the farm uses the animal's key, e.g. `chicken-3`),
so a chicken keeps its look between renders and visits and a flock is mixed. Without a seed it is the kind's first look (shop cards, tutorial).
Pure: no random numbers.

**Formula**

```text
look = ANIMAL_PIXEL_ICONS[kind][hash(seed) mod number of looks], hash(s) = fold h = h*31 + charCode, from h = 7
```

## Routes

<a id="the-play-route-and-its-redirects"></a>

### The /play route and its redirects

Source: [`src/lib/playRoute.ts:1`](../../src/lib/playRoute.ts)

The front door's routes (IDL-61). The game lives at `/play`; `/` is the public landing. A guest who asks for `/play` is sent to the landing with the login window open
(`/?login=1&next=/play`) and, once signed in, goes back to where they were headed. `next` comes from the address bar, so it is only ever followed when it is a
path on this site (`safeNextPath`): anything else (another host, `//host`, a backslash trick, a control character) falls back to `/play`. This is a convenience
for the player, not a security boundary: every API route answers 401 on its own.
