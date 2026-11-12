# Wiring the design system into the game

**Status: plan, not built.** The design system lives in `packages/design-system` and is reviewed in Storybook (category "Design System", branch `agntc/idle-realm-ui-refresh-85d8c5`). Nothing in `src/` uses it yet. Companions: [ui-refresh.md](ui-refresh.md) (layout reference), IDL-289 (UI/UX redesign), IDL-290 (design system in code), `packages/design-system/INTEGRATION.md` (which game component maps to which design-system component, and what the game keeps).

## Rules for every wiring branch

- **One screen or one concern per branch**, small enough to review in a sitting, each mergeable on its own.
- **Adapters, not rewrites.** The game keeps its stores, rules and server calls. A thin adapter (`src/components/game/ds/*.tsx`) reads the store and passes plain props to the design-system component. Pure row and label builders live in `src/lib/` so they are unit-tested.
- **Old and new side by side until a screen is signed off.** Switch with one flag (`uiStore.newUi`, default off; a `?ui=new` query turns it on for testing) so every branch can merge to `main` without changing what players see.
- **No save, server or balance change.** All of this is presentation, so each PR is save-compatible by construction (CLAUDE.md checklist: nothing in `SAVE_SCHEMA`, fixtures untouched).
- **Done means:** `npm run verify` green, adapters covered by unit tests, a Playwright smoke test opens the screen in both modes, before/after screenshots in the PR, the old component deleted only in the final cleanup branch.
- Desktop only (1240 px and wider), like the rest of the game.

## Branches, in order

| # | Branch | What | Depends on | Visible to players |
| --- | --- | --- | --- | --- |
| 0 | storybook (this PR, `agntc/idle-realm-ui-refresh-85d8c5`) | the package, stories, tests, INTEGRATION.md | | no |
| 1 | `ui/ds-foundation` | import the package once (global CSS in `app/layout`), wrap the game in `DsRoot`, add the `newUi` flag and the `ds/` adapter folder, point the ESLint and tsconfig aliases at it, a smoke test that renders one component | 0 | no |
| 2 | `ui/ds-css-consolidation` | split `styles.css` (about 3.4k lines, built by appended overrides) into per-component sections, remove dead overrides, keep every story pixel-identical (screenshot diff of all stories) | 0 | no |
| 3 | `ui/ds-tooltips` | first adopter (as IDL-290 says): row builders for item, resource, monster, building and biome tooltips; the game's `FloatingTip` and `placeTip` keep positioning through `HoverTip place=`; item compare = two `ItemTooltip`s | 1 | yes, behind the flag |
| 4 | `ui/ds-windows` | `PixelWindow` and `PixelModal` become adapters over `WindowShell` (controlled: `windowStore` owns position, size, z-order, Esc, header clamp via `clampWindowPosition`) and `Modal` (keep the modal stack); every window gets the new frame and title at once | 1 | yes, behind the flag |
| 5 | `ui/ds-hud` | `GameHeader` to `TopBar`, `ChipGroup`, `ResourceStat` (live income tip), `GlyphButton`; the bottom menu to `Dock`, `IconButton`, `NotifyBadge`; the minimap counters inside the map | 3, 4 | yes |
| 6 | `ui/ds-hero` | character window: `HeroIdentity`, equipment groups, `XpBar`, bag grid with `Slot` and the right-click `ContextMenu` (entries map 1:1 to the game's items), `AddSlot` shortcut, Stats paper ledger, Crafting tab (`CraftQueue`, `CollapsibleGroup`, `Slider`, `CraftStash`), avatar and badge dialogs | 3, 4, 5 | yes |
| 7 | `ui/ds-merchant` | resources ticket with the slider, goods shelf and quick sell, grouped upgrades (`UpgradeTile`), Quests and Gambling as `ComingSoon` | 3, 4 | yes |
| 8 | `ui/ds-cleanup` | delete the old components and `px-*` styles that nothing uses, drop the flag, update the generated docs | 5, 6, 7 signed off | final switch |

Branches 3 and 4 can run in parallel (different files); 5, 6 and 7 can run in parallel once both are in, as long as two sessions do not touch the same screen. 2 can run any time after 0.

## Not part of wiring (separate feature work, then use the layouts)

- **Hall of Deeds** replaces achievements: needs the tiered deed model, claiming, deed points and the bonus, all server side (`src/lib/offline/`), plus save-compatible fields. The Storybook view is the layout only.
- **Bestiary**: needs per-monster kill tiers, claimable mastery rewards and discovery state, also server side and additive in the save. Layout only until then.
- **Missing art** (Sprite Fusion, CLAUDE.md): stone menu icons for Realm, Fight, Bestiary and Rebirth (the dock reuses the nearest ones), the silhouette-free equipment slots need no art. The wood and slate textures are generated; redo corners, tabs and the title plaque centre in Sprite Fusion if they should be hand-drawn.
- **Not covered by a component yet**: cursor-following map tooltips, the farm scene, toasts, the settings dialog, the landing page.

## Risks

- Window geometry is shared state today: the adapter must keep `windowStore` as the single owner, or saved layouts break. Test: drag, resize, reload, positions restored.
- Esc ordering between windows and modals is game logic (`hasOpenModal`); keep it in the adapter and leave `Modal closeOnEscape` off.
- The package uses container queries, `color-mix` and `@property`. Fine for current desktop browsers; check the supported-browser list before step 4.
- Two stylesheets coexist until step 8; every design-system class is `ds-*` and the game's is `px-*`, so nothing collides, but expect a larger CSS payload until the old styles go.

## Linear

Cut one ticket per numbered branch under IDL-290 (blocked-by as in the table), and link IDL-289 for sign-off of each screen against its Storybook view. Deeds and Bestiary get their own feature tickets with the mechanics first.
