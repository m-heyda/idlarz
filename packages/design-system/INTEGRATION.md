# Integration notes: design system into the game

Assessment done against the live game code (`src/components/game`, `src/stores`, `src/lib`). Nothing is wired; this is the contract for doing it.

## Verdict

The components in `src/components/` are **dumb**: they import nothing from the game (only React, `react-dom` portals and `src/logic.ts`), read no store, call no API, and hold only UI state that cannot matter outside the widget (hover open, a menu's submenu level, an uncontrolled window's drag offset). Text, numbers, icons and handlers all come in as props. `src/views/`, `src/stories/` and the mock data in them are **demos and are not exported** by `src/index.ts`; never import them from the game.

## Using it

1. Import from `@idlarz/design-system` (tsconfig path alias, no workspace needed). `index.ts` pulls in `styles.css` once.
2. Wrap a whole screen once in `<DsRoot>` (or give any ancestor the `ds-root` class). Tokens and the `ds-*` classes live under it. Portalled pieces (`HoverTip`, `ContextMenu`, `Modal`) carry `ds-root` themselves, so they work anywhere.
3. Needs `--font-pixel` from the game's `globals.css` (already there). Desktop only. Uses container queries, `color-mix` and `@property`: current Chrome, Firefox and Safari.
4. No class collides with the game: everything is `ds-*`, the game stays `px-*`.

## Game component to design-system component

| Game today | Use | What the game keeps |
| --- | --- | --- |
| `PixelWindow` | `WindowShell` in **controlled** mode: `position`, `size`, `onPositionChange`, `onSizeChange`, `onGeometryCommit` (persist), `onFocus` (bring forward), `zIndex`, `active` (front window), `fixed` (narrow screens), `flush`, `icon`, `closeLabel`, `onClose` | `windowStore` (positions, sizes, z-order, persistence), Esc handling (front window, `hasOpenModal`), the error boundary around the body, clamping to the header (use `clampWindowPosition` / `clampWindowSize` from `logic.ts`) |
| `PixelModal` | `Modal` (`size` sm 440 / md 640 / lg 1080 or `width`, `icon`, `hideClose`, `closeOnBackdrop`, `closeOnEscape`) | the modal stack (`openModals`); leave `closeOnEscape` off and keep your own key handler so only the top modal closes |
| `ItemSlot` (item, qty, equipped, locked, empty slot silhouette) | `Slot` (`icon`, `rarity`, `count`, `empty`, `locked`, `equipped`, plus every native button prop: `onClick`, `onDoubleClick`, `onContextMenu`, `draggable`, `onDragStart`, `onDrop`, `aria-*`) | item resolution (`resolveItem`), drag state (`getDrag`), what a click does |
| `FloatingTip` + `placeTip` + hover card stack | `HoverTip` with `place={...}` (your `placeTip` fits the signature `(anchor, tipSize, viewport) => {x, y}` after a small adapter), `closeDelayMs` + `interactive` (the 100 ms hoverable linger), or `open` / `onOpenChange` to drive it yourself | which item to show, the compare card (render two `ItemTooltip`s) |
| `ItemTooltip`, `BiomeTooltip`, `TileTooltip`, `HeaderTip` | `Tooltip` (base), `ItemTooltip`, `ResourceTooltip`, `MonsterTooltip`, `BuildingTooltip`, `HintTooltip`: all take a rarity, an icon, rows and a footer. Rim colour and glow follow the rarity; legendary animates | building the rows from `resolveItem` etc. |
| `ContextMenu` + `uiStore.contextMenu` | `ContextMenu` + `MenuItem` (`label`, `hint`, `liveHint`, `tooltip`, `disabled`, `danger`, `separator`, `checked`, `children` submenu, `onSelect`): same shape as the game's `ContextMenuItem`, so entries map 1:1 | the store (`openMenuAt`), the entries and what they do |
| `.px-tab` buttons | `Tabs` (`items` with `badge`, `disabled`, `title`) | which tab is active |
| `.px-btn`, `-gold`, `-red`, `-sm` | `Button` (`tone`: stone / gold / wood / dark / danger, `size`: md / sm) | |
| header resources, `ResourceDisplay` | `TopBar`, `ChipGroup`, `ResourceChip`, `ResourceStat` (chip + hover tip), `GlyphButton` | the numbers and the live income |
| `LevelBar`, XP bar | `XpBar` | the values and label text |
| bottom menu icons | `Dock`, `IconButton`, `NotifyBadge` | `menu_*` icon names |
| minimap strip | `MiniMap` | the map picture |
| `Bag` | `Slot` grid + `AddSlot` (shortcut to the Pack Rat upgrade) | the whole bag logic |
| `CraftingOverlay` accordion, `QueuePanel`, `CraftStash` | `CollapsibleGroup`, `CraftQueue` (Collect all on top), `CraftStash`, `Slider`, `SelectBox` | the craft store, timers (`finishedOf`, `formatTime`) |
| merchant `UpgradeCard` | `UpgradeTile` (+ `DiamondLevel`); `state` can force maxed / ready / short | `merchantUpgradeCost`, the buy call |
| avatar and badge dialogs | `AvatarGrid`, `BadgeTitlePicker`, `AvatarFrame`, `HeroIdentity` inside a `Modal` | `fetchAvatars`, `chooseAvatar`, `chooseBadge`, the unlock rules |
| achievements | Hall of Deeds and Bestiary are **demo views only**: build them from `Panel`, `ProgressBar`, `DiamondLevel`, `Button`, `Tabs`-style filters | all data |

## Changed in this pass to make that possible

- `WindowShell`: controlled geometry and focus, `active`, `fixed`, `flush`, `icon`, `zIndex`, `closeLabel`; still works uncontrolled for stories.
- `Modal`: sizes, icon, `hideClose`, `closeOnBackdrop`, optional Esc.
- `Slot`: now passes every native button attribute through; added `equipped`.
- `HoverTip`: controlled `open`, `disabled`, `closeDelayMs`, `interactive`, custom `place`.
- `ContextMenu`: `tooltip`, `liveHint`, submenus with Back.
- `Tabs` items: `disabled`, `title`. `Button`: `size="sm"`.
- `UpgradeTile`: `state` override and label props.
- Labels (`labels` prop with English defaults) on `CraftQueue`, `CraftStash`, `AvatarGrid`, `BadgeTitlePicker`, `ComingSoon`, `HeroIdentity`, so no copy is locked into a component.
- `logic.ts`: `clamp`, `clampWindowPosition`, `clampWindowSize` (tested), shared with the window store.
- `components/hero.tsx` renamed to `components/composites.tsx` (it holds generic pieces like `Modal`, `Slider`, `XpBar` next to game-shaped ones like `CraftQueue`).

## Known gaps and risks (not blockers for a first screen)

- **`styles.css` is ~3.4k lines** because it grew by appended override blocks (later rules win). It renders correctly but should be consolidated into per-component sections before heavy reuse; do it as its own pass with before/after screenshots of every story.
- **Number and rarity helpers are duplicated**: `compact` and the rarity colours mirror the game's `formatCompact` and `RARITIES`. When wiring, pass preformatted strings and map the game's rarity ids onto `Rarity` (`common` .. `legendary`).
- **Window store specifics stay out**: Esc ordering, header-height clamp and the narrow-screen mode are the game's; the shell only needs `fixed` and the clamp helpers.
- **Item tooltip stack**: the game shows an item card and, next to it, the worn gear. Compose two `ItemTooltip`s in one `HoverTip` (or use `ItemTooltip`'s built-in `compare` block).
- **Assets**: the frames, textures and plaques are in `src/assets` (cut from the kit sheet by `scripts/build-assets.py`; the slate and wood textures are generated). Hero art, badges and enemies come from `public/pixel` through props.
- **Not covered by a component yet**: tile/map tooltips with a cursor-following mode, the farm scene, toasts, the settings dialog, the landing page. Views for Hall of Deeds and Bestiary are layouts only.
- **Tests**: pure helpers are unit-tested (`tests/ui/designSystem.test.ts`). There is no component test harness in the repo yet (the project has no React Testing Library); add one before wiring if you want render tests.
