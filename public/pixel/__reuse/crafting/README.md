# __reuse/crafting and the `*_32` sheets (ores, gems, potions, ingots for the crafting rework)

Supplied by the owner on 2026-11-19 for the crafting rework ([IDL-358](https://linear.app/idlarz/issue/IDL-358), IDL-349, IDL-376). **Nothing here is wired yet**: it is the pool the new crafting ingredients, gems, ingots and potions are drawn from. Each file was cut out, trimmed and centered on a transparent square canvas (alpha noise <= 8 cleared).

| Folder | Count | What |
| ------ | ----: | ---- |
| `crafting/` | 20 | big pictures: 6 potions (1024 px or 512 px pixel art), 11 painted ores, gems and crystals (512 px), 3 ingots (64 px: copper, gold, iron) |
| `gems_32/` | 50 | 32 px sheet 1: crystals, cut and raw gems, geodes (10 x 5 cells) |
| `crystals_32/` | 48 | 32 px sheet 2: cut gems (oval, round, cut, tear), crystal clusters, spires, coral, ores (8 x 6) |
| `stones_32/` | 48 | 32 px sheet 3: jasper, opals, lava rock, pearls, mushroom stones, pitted and layered rock, copper and pyrite (8 x 6) |
| `rocks_32/` | 48 | 32 px sheet 4: coal and black rock, grey rock, dirt rock, copper rock, turquoise and malachite (8 x 6) |

The `*_32` sheets are 32 x 32 cut-outs (game icon size is 40, scale with `image-rendering: pixelated`). Names in the sheets that are numbered (`jasper_3`, `coal_5`, ...) are variants of one kind; rename the one you wire. Two styles: the `crafting/` ores are painted (not pixel art), the `*_32` ones are pixel art.

All are listed in Storybook under *Assets > Unsorted cuts* (status `reuse`). When one is wired, move it to the folder of its kind (`resources/` or `items/consumable/`), register it and update this README.
