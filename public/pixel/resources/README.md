# Resource art (Sprite Fusion, 32 x 32)

Generated icons for resources, materials and spare ideas. Roster in code: `src/catalog/resourceArt.ts` (test: `tests/resourceArt.test.ts`).

| File name | Meaning |
|---|---|
| `<name>.png` of a **live** resource: `gold`, `gems`, `wood`, `stone`, `coal`, `food`, `meat`, `eggs`, `milk`, `hide`, `xp`, `embers`, `fish`, `iron-ore` | In the game today. `python scripts/pixel/build.py` pads it to 40 x 40 (no scaling) and writes the icon into `public/pixel/icons/` (`gems` is the icon `diamond`, `embers` is the icon `legacy`, `fish` is `res_fish`, `iron-ore` is `res_iron`); gold and Embers also get a twinkle strip. To change one, replace the picture here and rebuild. |
| `<name>.png` of a **planned** resource: `hardwood`, `cloth`, `honey`, `herbs`, `sap`, `spores`, `frostshard`, `pearls`, `salt`, `dye`, `corrupted-core`, `scrap-steel` | In the roster with `enabled: false`; the resource itself is not in the game yet (docs/12 and docs/18). Planned with no picture yet: Ichor, War Medals, Venom, Royal Jelly. |
| `_<name>.png` | **Spare**: generated, consistent with the set, not assigned to anything. Not in the roster. To use one, drop the `_` and add it to `RESOURCE_ART`. |

Spare art: bacon, carrot, emerald star, hollow log, fire drop, teal crystals, bones, clay, coins, glowberry, moon, sand, blood, copper ore, dark potion, wheat sheaf, feather, grapes, geode, dark horn, jug, orange mushrooms, ember coal, rock pile, scallion, dried herbs, heart gem, dark shard, horn, beet, sticks, scrap, wool, obsidian, tar.
