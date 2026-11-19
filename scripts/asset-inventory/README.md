# Pixel asset inventory

A one-file page (`pixel-asset-inventory.html`) that lists every non-armor picture that can be a resource, material, junk, component or ore: used, planned and unused. Open it in a browser (no server).

- Tag each picture: status, category, tier, grade, rarity, add to game, found in ores (per rock tier), chest, delete, reviewed. Tick **hide reviewed** to leave only what still needs a decision.
- **Copy edited / "add to game" / full config** puts JSON on the clipboard; **Copy delete list** gives the files marked safe to remove.
- **Import config** applies a copied config on top of the current tags.

## Keeping it current

1. `npm run assets:catalog` (refreshes `docs/assets/manifest.json`, the used / planned / unused source).
2. `npm run assets:inventory` rebuilds the page. New pictures appear with a proposed tag (rules in `build.cjs`).
3. To keep your decisions across rebuilds, paste the full config into `decisions.json` (same folder); its values override the proposals.

`build.cjs` is the generator, `template.html` the page. Nothing here is read by the game.
