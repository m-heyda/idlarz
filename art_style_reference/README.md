# art_style_reference

**Reference material for new art. Nothing in this folder is imported by the game.** It is the visual brief for resources, buildings, roads, biomes, monsters, equipment, portraits and UI. Which assets are needed and when: [docs/RELEASE-PLAN.md](../docs/RELEASE-PLAN.md) section 6.

Every sub-folder has its own `README.md`: an index of the files in it (what each sheet contains), what we want from it, and **what agents must do with it later**. Read the folder README before touching a file. The approved current style lives in `scripts/pixel/reference/` (`STYLE.md` and its images); where a reference here disagrees with `STYLE.md`, **`STYLE.md` and the current map win**.

| Folder | What it is | Status |
|---|---|---|
| [`biomes/`](biomes/README.md) | prop and decor details for Blight and Battlefield (bones, veined rocks, roots, dead trees, tombstones) | detail reference, not a skeleton to copy |
| [`buildings/`](buildings/README.md) | how detailed the 36 biome buildings should look | style and detail reference |
| [`equip/`](equip/README.md) | about 600 equipment icons: weapons, armor, jewelry, potions, set examples; plus the **item grading plan** (12 grades per slot, 3 special sets) | reference and, where licence allows, direct cuts |
| [`monsters/`](monsters/README.md) | monster samples, animation samples, and the **roster plan** (3-4 per biome plus a boss, 12 biomes) | reference; rat stays the baseline |
| [`resources/`](resources/README.md) | materials, ores, goods, drops, potions, relics, fish, fungi | replaces all current resource icons |
| [`roads/`](roads/README.md) | road materials, how roads blend into ground, bridges | environment reference |
| [`ui-and-portraits/`](ui-and-portraits/README.md) | avatar portraits, skill icons, battle backgrounds, NPC | reference |
| [`farm/`](farm/README.md) | top-down farm and crops | **IGNORE FOR NOW**, future farm update |

(`landing/` was removed on 2026-10-29: the landing page is built from the map renderer, not from sample art.)

## Rules for every agent that uses these files

1. **Reference first, copy second.** A sheet here is a target for look, detail level and palette. Default action: **recreate in the procedural pipeline** (`scripts/pixel/`) so the result matches the map, the 1 px coloured outline and the 5-tone ramp of `STYLE.md`. Cutting a sprite out and using it as is allowed only when **all** of these hold: the licence is cleared (next section), the sprite already fits our canvas size and outline style, and it looks right next to the current map at integer scale.
2. **Licences are not established.** The sheets look like previews of marketplace asset packs. Some carry visible watermarks (`SAMPLE`, `EMBER SPROUT`, `elie automata`); one states "free for commercial use" (the Yokai Hunters sheet); the rest show no licence text. **Never cut or ship from a watermarked sheet.** For an unmarked sheet, ask the owner to confirm the licence before the first direct cut, and record the answer in the table below. The owner will fill in "cleared" entries; agents never assume it.
3. **No resampling to fit.** Reference sprites are drawn at other pixel densities (many are 2-4x our scale). Do not shrink them with a smoothing filter. Either redraw at our size or, for a clean cut, scale by an exact integer factor with nearest neighbour and re-quantize.
4. **Our sizes** (from `STYLE.md`): terrain tile 48 px; map buildings 48x60 (may overflow the tile a little, see `buildings/`); resource and item icons 40 px, drawn at 20 px in the header, so they must read at 20 px; busts 40x40; monsters 40x40 (rat), 56x56 (boss), see `monsters/`; no ground shadows on sprites; outline is a dark hue-shifted tone of the material, never pure black; glow comes from the game (rarity glow in `RARITIES`), so **cut sprites must have no baked-in glow, halo or background tile**.
5. **Cutting procedure** (when rule 1 allows it): follow `scripts/pixel/extract_sheet.py` (crop box, key the background out by flood fill, fit bottom-aligned, quantize to the shared palette without dither, hard alpha, close the outline). Outputs go to `scripts/pixel/assets/<name>.png` (committed), are registered in `sprites_sheet.py` and `pixelIcons.ts`, and get a line in the "Provenance" section of the folder README they came from.
6. **Never delete or replace a game asset before its replacement is wired.** Items, monsters and buildings reference sprites by id; removing a file breaks the build and old saves. Order: produce, register, switch the catalog entry, run the tests and `npm run build`, then delete the old file in the same PR.
7. **Placeholders are fine** (RELEASE-PLAN rule 5): a feature may ship with an existing sprite or a tinted generic one, as long as the catalog key is the final one.
8. When you use a reference, record in the PR description which sheet and which region it came from, so a licence problem can be traced and fixed.

## Source and licence status (owner fills in)

| Source group | Where | What the sheet shows | Status |
|---|---|---|---|
| Yokai Hunters (234 objects) | `monsters/yoaPlM.png` | text on the sheet: "free for commercial use" | stated free for commercial use; confirm the pack page before shipping |
| Ember Sprout sample | `buildings/Screenshot 2026-10-29 0341562.png` | watermarked "SAMPLE" | **reference only, never ship** |
| Monster pack preview | `monsters/GxKS61.jpg` | watermarked "SAMPLE" | **reference only, never ship** |
| elie automata animations | `monsters/Screenshot 2026-10-29 040837.png`, `monsters/9_if99.gif` | watermarked in every frame | **reference only, never ship** |
| Pixel Monsters vol. 7, 9, 12 | `monsters/v15wxm.png`, `_G4XXB.png`, `zHVM0_.png` | pack banners | unknown, confirm |
| Everything else | equip, resources, roads, biomes, buildings (`f33ile.jpg`), ui, farm, remaining monsters | no visible licence text | unknown, confirm before any direct cut |
