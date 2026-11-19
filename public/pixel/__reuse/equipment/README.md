# __reuse/equipment (75 cut-outs of the equipment sheets, full size)

Eight sheets of equipment art supplied by the owner on 2026-11-16 (Sprite Fusion / generated), each item cut out to its own transparent PNG at the size it had on the sheet (about 200 to 380 px, **not** game size). They are the pool for new items and for replacing placeholders. In Storybook they are in Assets > Armor and Assets > Weapons under "cut-outs: ...", tagged `unused` unless a 64 px copy is wired (then `used`, and "used by" names the icon).

| Folder | Count | Sheets | Style |
| ------ | ----- | ------ | ----- |
| `cape/` | 22 | 12 capes in dark pixel art, 10 labelled capes (two were removed on 2026-11-19) | `pixel_*`, `toon_*` |
| `shoulder/` | 18 | 9 pauldrons in dark pixel art, 9 labelled pauldron pairs | `pixel_*`, `toon_*` |
| `bow/` | 11 | 11 labelled bows (the crossbow-like one was removed on 2026-11-19) | `toon_*` |
| `tome/` | 12 | 12 labelled spellbooks | `toon_*` |
| `axe/` | 12 | 12 labelled axes | `toon_*` |

`pixel_*` is the sharper, darker pixel look; `toon_*` is the cleaner outlined look. The two do not match each other, so a ladder looks best from one style. Names come from the captions on the sheets, or from the look where a sheet had none.

## What is wired (64 px copies)

The cut-out is scaled to 64x64 (`ITEM_ART_SIZE`) and written to `public/pixel/items/<slot>/`. The map cut-out -> icon is `scripts/assets/equipment-used.json`.

- **Capes:** the seven cape items (`rag_cloak`, `hide_cloak`, `travellers_cape`, `leather_cloak`, `cloth_cape`, `steel_cloak`, `obsidian_cloak`) now use supplied art (`art_<item>`, files `items/cape/<item>.png`); the built 40 px icons are gone. The nine grade placeholders G4 to S3 of cape, shoulder, bow, axe and tome (`art_ph_*`) are replaced in place (same file names). The order inside each ladder is a first guess by how grand the piece looks; swap files freely.
- **Also wired later the same day:** the four older shoulder items, the wooden and starfall bows, three axes and three tomes took unused cut-outs. Still unused: the second cape set (except the travellers' cape), `toon_ornate_gold_crusaders`, `toon_dark_spiked_demonic` and a few more (the owner removed `toon_mechanical_steel_crossbow_fantasy_bow`, `toon_armored_knight_cape` and `toon_assassins_hooded_cloak` on 2026-11-19: no code or registry names them any more); Storybook shows which.

Rules of thumb for the cut-outs: they were cut by a script (`flood fill from the sheet background`), so a few edges, thin bow strings and one crossbow stock are slightly trimmed. Re-cut by hand when an item ships.
