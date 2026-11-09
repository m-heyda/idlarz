# potions (48 icons, 32x32)

`Icon1.png` to `Icon48.png`: corked potion bottles in 48 shapes and colours (test tubes, round and teardrop flasks, crystal shards, grail shapes) on a transparent 32x32 canvas, drawn in the same pixel style as the supplied equipment art. No names. Colours: red, blue, purple, orange, green, yellow, teal, black, pink, gold, ice.

**Use for**

- Crafted potions (crafting v0.1 and later, IDL-227, IDL-241) and the consumable families: HP (red), mana (blue), regen (pink), antidote (green), speed (yellow), buffs (purple, orange), utility (teal). The consumable pass-1 work (IDL-25) already wired 12 other potion icons in `public/pixel/items/consumable`.
- Glass Vial and flask icons for the crafting components.
- 32 px scales to 64 px at 2x (the size the other item art is supplied at) and then to 40 for the UI.

**To do before use:** choose the icon per potion id, give each a snake_case name, register it in `src/config/itemIcons/consumable.json` with provenance, upscale 2x with nearest-neighbour. Licence: free to use (confirmed by the owner, 2026-11-09).
