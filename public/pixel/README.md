# public/pixel: the game's pictures

Everything the game draws lives here, in folders by what the picture **is** (not by who supplied it or when). Served as `/pixel/<folder>/<file>.png`. All art is pixel art: draw it at 1x or integer scales with `image-rendering: pixelated`. Licence: supplied by the owner (Sprite Fusion), free to use for the game.

**Where to look first:** Storybook (`npm run storybook`, section *Assets*) lists every picture with its name, size and whether the game uses it. The list is generated from the code by `npm run assets:catalog` (`scripts/assets/manifest.ts`, output in `docs/assets/`), so it stays true when you move a file; run it after every reorganisation.

## Layout

| Folder | What is in it | In the game? |
| ------ | ------------- | ------------ |
| `icons/` | resource, equipment-slot, bonus, animal, biome-tile and item icons, shine strips | yes (registered in `src/config/pixelIcons.ts` and `src/config/itemIcons/`) |
| `items/` | supplied 64 px item art, one folder per slot (`head`, `mainHand`, ...); `consumable/` potions, `junk/` the junk materials, `legendary/` | yes (`src/config/itemIcons/*.json`; the junk icons are the `junk/junk_*` lines of `consumable.json`) |
| `resources/` | the supplied resource pictures (see its README) | yes |
| `ui/` | frames, bars, banners, the 13 `menu_*.png` dock icons, `blacksmith.png`, `alder_talk.png`, `logo_idler_realm.png` (the "Idler Realm" logo with its castle and tiles, transparent, 603x389, for the landing rework, not used yet), `coin_pouch.png`, `treasure_chest.png`; `ui/heroes/` the avatar busts ([README](ui/heroes/README.md)), `ui/admin/` the admin's animated mark ([README](ui/admin/README.md)), `ui/biomes/` the 5 vignettes of the "New land unlocked" window | yes |
| `achievements/` | the medals shown as achievement badges ([README](achievements/README.md)) | yes, except the spares listed there |
| `idols/` | Idol statues, one primary per biome ([README](idols/README.md)) | the 12 primaries; alternatives are spare |
| `castles/` | castle levels 1..10, premium skins, loading strip ([README](castles/README.md)) | levels yes, skins planned |
| `enemies/` | monsters and bosses, `enemies/<biome>/<id>.png` ([README](enemies/README.md)) | yes (`enabled` monsters) |
| `farm/`, `bg/`, `terrain/` | farm props; `bg/` crack tile, fog and the farm meadow; `terrain/` the ground textures (`tex_<biome>.png`, also used as the dialog swatches) and shape atlases | yes |
| `farm_rework/` | 18 isometric 200 px farm props for the later farm rework ([README](farm_rework/README.md)) | yes, baked down into `farm/` (all but `fence_section`) |
| `pets/` | Yuki (`kaczkawu_dog.png`, in the game) and new pet sprite sheets not sorted yet ([README](pets/README.md)) | Yuki only |
| `wireframe/` | the green hologram "early tester" set: sources of the Beta tester avatar and the Early tester badge, plus three pets ([README](wireframe/README.md)) | partly (copies are wired, see README) |
| `__reuse/` | loose cut-outs (15), 75 equipment cut-outs in `__reuse/equipment/` ([README](__reuse/equipment/README.md)) 63 prepared equipment sets in `__reuse/sets/` ([README](__reuse/sets/README.md)) and the crafting-rework ores, gems, potions and ingots in `__reuse/crafting/` and `__reuse/*_32/` ([README](__reuse/crafting/README.md), 214 pictures) that nothing in the game uses yet, grouped by kind (the 9 skill icons for the later Skills tab are in `__reuse/skills/`); found by name in Storybook *Unsorted cuts*. The `__` puts it at the top and marks it as a pool to organise later | no |
| `assets_to_assess_and_use/` | raw packs, one folder per pack, each with its own README: **nothing here is wired until it is registered** | no |

Rule of thumb: a picture the game loads goes in the folder of its kind; a picture we may want later goes to `__reuse/` (single cut-outs) or `assets_to_assess_and_use/` (whole packs) until we decide.

## Adding art

1. Put the file in the folder of its kind (names: lower-case, `snake_case`, descriptive; never the number or hash the tool produced).
2. Wire it: add it to the registry that fits (`pixelIcons.ts`, `itemIcons/*.json`, `avatars.ts`, `achievements.ts`, `idols.ts`, ...). Registry paths are plain strings, so **a moved or renamed file is a broken picture, not a build error**. After moving anything run `npm test` (`tests/saves/avatars.test.ts`, `tests/server/achievements.test.ts` and the others check that the files exist) and `npm run assets:catalog`.
3. Add a row to the README of the folder.
4. New pictures are made in Sprite Fusion (see `CLAUDE.md`, *Assets*); `scripts/pixel/*.py` is the legacy generator and no longer the way to make art.

## What `scripts/pixel/build.py` still owns

The legacy generator rewrites `icons/` (the built `item_*` icons, resources, terrain parts) and `ui/` frames; it refuses to run without `--legacy`. The menu icons, hero busts and everything else in this README are hand-supplied and never touched by it.
