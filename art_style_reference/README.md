# art_style_reference

**Reference material for new art. Nothing in this folder is imported by the game.** It is the visual brief for resources, buildings, roads, biomes, monsters, equipment, portraits and UI. Which assets are needed and when: [docs/plan/RELEASE-PLAN.md](../docs/plan/RELEASE-PLAN.md) section 6.

Every sub-folder has its own `README.md`: an index of the files in it (what each sheet contains), what we want from it, and **what agents must do with it later**. Read the folder README before touching a file. The approved current style lives in `scripts/pixel/reference/` (`STYLE.md` and its images); where a reference here disagrees with `STYLE.md`, **`STYLE.md` and the current map win**.

| Folder | What it is | Status |
|---|---|---|
| [`biomes/`](biomes/README.md) | prop and decor details for Blight and Battlefield (bones, veined rocks, roots, dead trees, tombstones) | detail reference, not a skeleton to copy |
| [`buildings/`](buildings/README.md) | how detailed the 36 biome buildings should look | style and detail reference |
| [`equip/`](equip/README.md) | about 600 equipment icons: weapons, armor, jewelry, potions; plus the **item grading plan** (12 grades per slot, 3 special sets) | reference and direct cuts (licensed, see Licence) |
| [`monsters/`](monsters/README.md) | monster samples and the **roster plan** (3-4 per biome plus a boss, 12 biomes) | reference; rat stays the baseline |
| [`resources/`](resources/README.md) | materials, ores, goods, drops, potions, relics, fish, fungi | replaces all current resource icons |
| [`roads/`](roads/README.md) | road materials, how roads blend into ground, bridges | environment reference |
| [`ui-and-portraits/`](ui-and-portraits/README.md) | avatar portraits, skill icons, battle backgrounds, NPC | reference |
| [`farm/`](farm/README.md) | top-down farm and crops | **IGNORE FOR NOW**, future farm update |

(`landing/` was removed on 2026-10-29: the landing page is built from the map renderer, not from sample art.)

## Rules for every agent that uses these files

1. **Reference first, copy second.** A sheet here is a target for look, detail level and palette. Default action: **recreate in the procedural pipeline** (`scripts/pixel/`) so the result matches the map, the 1 px coloured outline and the 5-tone ramp of `STYLE.md`. Cutting a sprite out and using it as is is **allowed and licensed** (see Licence below) when **both** of these hold: the sprite already fits our canvas size and outline style, and it looks right next to the current map at integer scale. If it does not, recreate it.
2. **Licence: cleared by the owner.** The images in this folder were all obtained under licences that let the owner use them for free in this game. Agents may copy and cut PNGs from any sheet straight into the game; there is nothing to confirm per sheet. See the Licence section below.
3. **No resampling to fit.** Reference sprites are drawn at other pixel densities (many are 2-4x our scale). Do not shrink them with a smoothing filter. Either redraw at our size or, for a clean cut, scale by an exact integer factor with nearest neighbour and re-quantize.
4. **Our sizes** (from `STYLE.md`): terrain tile 48 px; map buildings 48x60 (may overflow the tile a little, see `buildings/`); resource and item icons 40 px, drawn at 20 px in the header, so they must read at 20 px; busts 40x40; monsters 40x40 (rat), 56x56 (boss), see `monsters/`; no ground shadows on sprites; outline is a dark hue-shifted tone of the material, never pure black; glow comes from the game (rarity glow in `RARITIES`), so **cut sprites must have no baked-in glow, halo or background tile**.
5. **Cutting procedure** (when rule 1 allows it): follow `scripts/pixel/extract_sheet.py` (crop box, key the background out by flood fill, fit bottom-aligned, quantize to the shared palette without dither, hard alpha, close the outline). Outputs go to `scripts/pixel/assets/<name>.png` (committed), are registered in `sprites_sheet.py` and `pixelIcons.ts`, and get a line in the "Provenance" section of the folder README they came from.
6. **Never delete or replace a game asset before its replacement is wired.** Items, monsters and buildings reference sprites by id; removing a file breaks the build and old saves. Order: produce, register, switch the catalog entry, run the tests and `npm run build`, then delete the old file in the same PR.
7. **Placeholders are fine** (RELEASE-PLAN rule 5): a feature may ship with an existing sprite or a tinted generic one, as long as the catalog key is the final one.
8. When you use a reference, record in the PR description which sheet and which region it came from, so the origin of every sprite can be traced.

## Licence

**Owner statement (2026-11-07): every image in `art_style_reference/` was obtained by the owner with a licence to use it for free in this game.** That includes cutting sprites out of the sheets and shipping them (copying the PNGs directly into `scripts/pixel/assets/` and the game).

- Agents: do not treat any sheet as "reference only" for licence reasons, and do not ask the owner to confirm a licence before a cut. The only reasons to redraw instead of cut are the practical ones in rule 1 (canvas size, outline, pixel density, baked glow or background).
- The licence terms of the original packs are held by the owner, not stored in this repository. If a pack page later turns out to ask for a credit line, the owner will say so and it goes into this section.
- Some sheets in the sub-folders were removed from the repository over time to keep it small. Each folder README only describes the files that are in the folder now.
