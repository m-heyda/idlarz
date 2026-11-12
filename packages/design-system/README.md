# @idlarz/design-system

Props-only pixel-art UI (wood, stone, gold trim) for Idle Realm. **Storybook only for now** (`npm run storybook`, category "Design System"); the game does not import it yet.

- `src/tokens.css` / `src/styles.css`: colours, rarity glows, frames and every `ds-*` class (all scoped under `.ds-root`, no clash with the game's `.px-*`).
- `src/components/`: primitives, tooltips, upgrade tiles. No store reads, no game imports.
- `src/views/`: full screens composed from them with mock data (HUD, Hero, Merchant, Building upgrades, Tooltips).
- `src/assets/`: art cut from `docs/plan/design/ui-kit-sheet-frames-bars.webp` by `scripts/build-assets.py` (crop, resize, clear the busy cobble). The slate texture is generated, clean on purpose. Pieces worth redoing in Sprite Fusion later: frame corners, tab plates, the title plaque centre ornament.
- Missing menu icons (Realm, Fight, Bestiary): the HUD reuses the nearest stone icons.
