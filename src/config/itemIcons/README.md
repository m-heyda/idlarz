# Item icon registry

One JSON file per equipment slot (and per weapon type under `mainHand` / `offHand`), **one line per icon**. Read by `src/config/pixelIcons.ts` (sizes, paths) and by the build (`scripts/pixel/item_registry.py`, checked at the start of `python scripts/pixel/build.py`). `tests/catalog/itemIcons.test.ts` guards the rest.

```json
{"icon": "art_wanderer_boots", "item": "wanderer_boots", "file": "feet/wanderer_boots", "slot": "feet", "weapon": null, "grade": "G1", "provenance": "Sprite Fusion prompt 'boots G1', batch 3"}
```

| Field | Meaning |
|---|---|
| `icon` | the name the catalog uses (`ItemDef.icon`). `art_<id>` = supplied 64 px art, `item_<id>` = a 40 px icon the build draws |
| `item` | the catalog item that uses it, or `null` while the art has no item yet |
| `file` | supplied art: path under `public/pixel/items/` without `.png`. `null` = built by `scripts/pixel/sprites_gear.py` into `public/pixel/icons/` |
| `slot`, `weapon` | the equipment slot and weapon type (`WeaponType`); they pick the file this line lives in (`feet.json`, `mainHand-sword.json`) |
| `grade` | `G1`-`G9` or `S1`-`S3` ([equip README](../../../art_style_reference/equip/README.md) section 3); `null` until the item is graded |
| `provenance` | where the picture came from: sheet and region, or Sprite Fusion prompt (art README rules 5 and 8) |

**Adding an icon = one line in the file of its family.** PRs for different families (for example sword vs. boots) touch different files, so they do not conflict. A new slot or weapon type is a new file plus one import in `index.ts`. A file in `public/pixel/items/` that is not registered fails the test; spare art is named `_<name>.png`. `python scripts/pixel/item_registry.py --provenance` prints the lines for the Provenance section of `art_style_reference/equip/README.md`.

**Placeholders** (`placeholders.json`, art pass 2, IDL-217): `scripts/pixel/placeholders.py` draws a 12-grade ladder (G1-G9, S1-S3) of simple silhouettes for every family with fewer than 12 registered icons, so grade data does not wait for art. They are `art_ph_<slot>[_<weapon>]_<grade>` with `item: null`, provenance `placeholder`. To replace one: register the real icon with that `grade` in its family file, then delete the placeholder line and PNG. `python scripts/pixel/placeholders.py --gaps` prints the families. `scripts/pixel/palette_swap.py` (IDL-200) remaps reuse art to the S1-S3 ramps.

**MVP stand-ins (IDL-239, 2026-11-09):** the 62 live G1-G3 ladder cells (every placeholder that had an `item`) now carry a real icon. `public/pixel/assets_to_assess_and_use` has no equipment art, so they borrow: feet, legs, neck, ring, sword, shield, mace and maul copy the 64 px art of a reserve item of the same family and grade (a separate file, so the two icons can be replaced independently; provenance names the source), and the rest are `item_<id>` icons from `sprites_gear.py` (`LADDER_ALIAS`, `LADDER_DRAWN`). They need not match as a set. The grade-null placeholders of G4 and up stay. The `EXTRA` list in `placeholders.py` is gone.
