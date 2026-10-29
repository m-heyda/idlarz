# Resource, potion and item icon prompts (Sprite Fusion)

Same idea as [monster-art-prompts](monster-art-prompts.md): short prompts to paste into Sprite Fusion, plus the list of what we might replace. Finished icons are hand-supplied like the enemies; nothing reads them until they are wired into `src/config/pixelIcons.ts` (icons are 40 x 40 today, see section 4).

## 1. How the generator behaves (from the Sprite Fusion API docs)

Source: <https://www.spritefusion.com/docs/pixel-art-generator/api/generate-and-transform-images>

- One `generate` call takes a `prompt` (up to 10,000 characters), a `size` (**16, 32 or 64**) and optional tags. **It returns several variants on its own** (the dragon screenshot shows 12 per prompt, 15 credits).
- The docs say to **describe one subject, not a number**: use "Icons of a magic potion", never "15 icons of a magic potion". They also say **not to ask for a grid, sheet or atlas**; packing several assets into one image is not supported.
- So "several resources in one prompt" works by naming a **category** (food from animals, ore and gems, healing potions). The variants then drift across the category, and you keep the ones you like. A category prompt costs the same as a single-item prompt, which is the whole trick.
- Use **64** for anything we ship at 40 x 40 (downscale cleanly) and for rarer items; 32 only if you want a chunkier look. The "Same Style" button in the app keeps a batch consistent with an icon you already picked.
- **Two prompt styles per batch.** The "Prompt" lists a few items, which goes against the docs' one-subject advice but steers the variants. The **Generic alternative** is the docs-compliant version: one category, no list, and the model supplies the variety. Try the generic one first if you want to follow the docs; use the listed one when the generic result is too samey or misses an item. Both cost the same.
- Every prompt below follows one shape: `Icons of <category>, <2-3 shared visual traits>, single object, centered, plain background`. The shared traits (palette, material) keep the variants of one batch looking like one family.
- Each batch lists **what to keep**: the game items it can serve, so one good batch fills several slots.

## 2. What we might replace (the inventory)

### 2.1 Resources and currency (`catalog/resources.ts`)

| Key | Name | Tier | Icon today | Notes |
|---|---|---|---|---|
| gold | Gold | currency | `gold.png` (+ shine) | coin |
| gems | Gems | currency | `diamond.png` | premium currency |
| embers | Embers | currency | `legacy.png` | rebirth currency |
| xp | XP | none | `xp.png`, `level_orb.png` | |
| wood | Wood | T0 | `wood.png` | |
| stone | Stone | T0 | `stone.png` | |
| coal | Coal | T0 | `coal.png` | |
| food | Food | T0 | `food.png` | plains, lake and coast output |
| meat | Meat | T0 | `meat.png` | |
| eggs | Eggs | T1 | `eggs.png` | |
| milk | Milk | T1 | `milk.png` | |
| hide | Hide | T1 | `hide.png` | |
| iron, fish, mana, crystal, sapphire, abilityShard, randomItem | extra / reward icons | n/a | `res_iron`, `res_fish`, `res_mana`, `res_crystal`, `res_sapphire`, `res_shard`, `res_mystery` (+ `_shine`) | reward and ability icons, not header resources |

### 2.2 Planned materials (design drafts, [12](12-rebirth-biomes.md), [17](17-crafting.md), [18](18-biome-buildings-and-material-tiers.md): no icon exists yet)

| Tier | Materials |
|---|---|
| T2 biome goods | Hardwood (jungle), Cloth (fields), Honey (orchard), Ichor (blight), War Medals (battlefield) |
| T3 extracts | Herbs (plains), Sap (forest), Iron Ore (hills), Spores (swamp), Frostshard (tundra), Pearls (lake), Salt (coast), Venom (jungle), Dye (fields), Royal Jelly (orchard), Corrupted Core (blight), Scrap Steel (battlefield) |
| T4 relics | boss drops, names open (placeholders: Rat King's Crown, boss cores) |

### 2.3 Potions and consumables

| Item | Icon today | Notes |
|---|---|---|
| Minor Healing Potion (`potion_minor`) | `item_potion_hp.png` | the only two that exist |
| Greater Healing Potion (`potion_greater`) | `item_potion_greater.png` | |
| Mana / stamina / buff potions | none | not in the game yet; batch P3 below is a pool to draw future ones from |
| Potion reagents | none | Herbs, Spores and Royal Jelly are the planned potion inputs (T3 above) |

### 2.4 Equipment icons (`public/pixel/icons/item_*.png`, 40 x 40)

Slots: head, neck, shoulder, chest, hands, legs, feet, cape, ring, charm, main hand, off hand.

| Set | Icons today |
|---|---|
| Starter (wooden) | club, sword, shield, pendant, ring, acorn charm, apprentice wand and tome, oak staff, hunting bow, recurve bow |
| Cloth | hat, robe, mantle, cape, gloves, trousers, slippers, amulet, ring, charm |
| Leather | cap, vest, pauldrons, cloak, gloves, leggings, boots |
| Steel | helm, cuirass, pauldrons, gauntlets, greaves, sabatons, gorget, ring, charm, cloak, shield, sword, dagger, mace, spear |
| Obsidian | helm, cuirass, pauldrons, gauntlets, greaves, sabatons, cloak, pendant, ring, charm, aegis, blade, kris, maul, staff, longbow, crossbow |
| Rattatui (rat set) | cap, tunic, shoulderpads, gloves, trousers, boots, cloak, amulet, ring, charm, buckler, fang blade |
| Legendary | Emberbrand, Starfall Bow, Titan Maul, Battle Axe, Iron Sword |
| Slot placeholders | `equip_*.png` (12 slot silhouettes) |

## 3. Prompt batches

Paste the **Prompt**, pick a size, generate once, keep the variants you like. If a batch drifts, generate a second time and use "Same Style" on the best icon.

### 3.1 Resources

**R1. Wood, stone, coal (raw materials, T0)**
- Prompt: `Icons of raw building materials from the land, chunky and readable, warm earth tones with strong dark outlines: cut logs, stone blocks, lumps of coal and ore, single object, centered`
- Keep: wood, stone, coal, iron (res_iron), later Iron Ore.
- Generic alternative (one category, no list, let it vary): `Icons of raw materials`

**R2. Food from the land**
- Prompt: `Icons of simple farm food and harvested crops, bright warm colours, soft highlights: wheat bundle, bread loaf, fish, vegetables, a basket of food, single object, centered`
- Keep: food, fish (res_fish), the food stack on the farm tooltips.
- Generic alternative (one category, no list, let it vary): `Icons of food`

**R3. Food from animals (the one that gives variants for several items)**
- Prompt: `Icons of food and goods that come from farm animals, rustic and cute, cream and pink and brown tones: a jug of milk, an egg, a raw meat cut, a leather hide, a feather, single object, centered`
- Keep: meat, eggs, milk, hide. Generate twice; the second run is the safety net for whichever one the first missed.
- Generic alternative (one category, no list, let it vary): `Icons of food and goods from farm animals`

**R4. Currency and rare shine**
- Prompt: `Icons of valuable treasure currency, glossy and bright, gold and cyan and violet: a gold coin, a cut diamond, a glowing ember orb, a stack of coins, single object, centered`
- Keep: gold, gems, embers, level_orb, xp star.
- Generic alternative (one category, no list, let it vary): `Icons of treasure and currency`

**R5. Gems and magic crystals**
- Prompt: `Icons of magical gemstones and crystals, faceted, glowing from inside, saturated blue and violet and green: a sapphire, a crystal cluster, a mana crystal, an ability shard, single object, centered`
- Keep: crystal, sapphire, mana, abilityShard, mystery reward (add "question mark" if you want that one).
- Generic alternative (one category, no list, let it vary): `Icons of magical gemstones`

### 3.2 Planned T2 and T3 materials (draw them early, they are needed by crafting)

**M1. Biome goods (T2)**
- Prompt: `Icons of crafting materials from fantasy biomes, a bit rare-looking, strong dark outlines: a dark red hardwood log, a folded linen cloth bale, a dripping honeycomb, a drop of green-purple ichor, a tarnished medal on a torn ribbon, single object, centered`
- Keep: Hardwood, Cloth, Honey, Ichor, War Medals. If one is missing, run the batch again with only that item in the prompt.
- Generic alternative (one category, no list, let it vary): `Icons of fantasy crafting materials`

**M2. Plant extracts**
- Prompt: `Icons of alchemy ingredients from plants, small and colourful, hand-picked look: bundle of herbs, a drop of tree sap, glowing mushroom spores, a jar of royal jelly, bright dye powder in a bowl, single object, centered`
- Keep: Herbs, Sap, Spores, Royal Jelly, Dye.
- Generic alternative (one category, no list, let it vary): `Icons of alchemy ingredients from plants`

**M3. Mineral and sea extracts**
- Prompt: `Icons of raw crafting minerals, shiny and rough-cut: iron ore chunk, a pearl in an open shell, a pile of coarse salt, a blue frost shard, scrap steel plates, single object, centered`
- Keep: Iron Ore, Pearls, Salt, Frostshard, Scrap Steel.
- Generic alternative (one category, no list, let it vary): `Icons of raw minerals and ores`

**M4. Dark and monster extracts**
- Prompt: `Icons of monster-derived crafting reagents, a little sinister: a snake venom vial, a pulsing dark green corrupted core, a glowing violet ooze jar, a crown fragment, a boss relic gem, single object, centered`
- Keep: Venom, Corrupted Core, Ichor (alternate take), T4 relics.
- Generic alternative (one category, no list, let it vary): `Icons of monster parts used for crafting`

### 3.3 Potions and consumables

**P1. Healing potions (red)**
- Prompt: `Icons of healing potions in glass bottles, red liquid, cork stoppers, from small to large bottles, bright highlights, single object, centered`
- Keep: Minor Healing (the smallest), Greater Healing (a bigger or fancier bottle). Use "Same Style" on the Minor to make the Greater.
- Generic alternative (one category, no list, let it vary): `Icons of healing potions`

**P2. Mana and magic potions (blue and violet)**
- Prompt: `Icons of magic potions in glass bottles, glowing blue and violet and green liquid, different bottle shapes, sparkles inside, single object, centered`
- Keep: mana, buff, and utility potions for later; unused ones are a free pool.
- Generic alternative (one category, no list, let it vary): `Icons of magic potions`

**P3. Elixirs and vials**
- Prompt: `Icons of alchemy vials and elixirs, small rounded flasks and tall tubes, gold and orange and teal liquids, wax seals, single object, centered`
- Keep: tonics, antidotes and boss-drop potions when they arrive.
- Generic alternative (one category, no list, let it vary): `Icons of alchemy vials and elixirs`

### 3.4 Equipment (only if you want to redo the 40 x 40 sets)

One batch = one slot family in one material, so the variants of a batch are interchangeable pieces of a set. The set's palette is in the prompt; reuse the same palette words for every batch of that set.

| Batch | Prompt |
|---|---|
| E1 Steel armour | `Icons of steel plate armour pieces, polished silver-blue with dark outlines: helmet, breastplate, pauldrons, gauntlets, greaves, single object, centered` |
| E2 Leather armour | `Icons of brown leather armour pieces, stitched and buckled: cap, vest, pauldrons, gloves, boots, single object, centered` |
| E3 Cloth gear | `Icons of cloth mage gear, blue and cream with gold trim: pointed hat, robe, gloves, slippers, mantle, single object, centered` |
| E4 Obsidian gear | `Icons of black obsidian armour and weapons with glowing red cracks: helm, cuirass, gauntlets, blade, maul, staff, single object, centered` |
| E5 Rat set | `Icons of crude scavenger gear made from rat fur, tails and teeth, grey and pink and tan: cap, tunic, buckler, fang blade, boots, single object, centered` |
| E6 Melee weapons | `Icons of fantasy melee weapons in different materials: sword, axe, mace, spear, dagger, shield, single object, centered` |
| E7 Ranged and magic weapons | `Icons of fantasy bows, crossbows, staves, wands and tomes, wood and gold and glowing gems, single object, centered` |
| E8 Jewellery and charms | `Icons of fantasy rings, amulets and charms, gold and silver with a coloured gem, single object, centered` |
| E9 Legendary weapons | `Icons of legendary fantasy weapons with a magical glow: a flaming sword, a star bow, a titan hammer, a great battle axe, single object, centered` |

### 3.5 Generic alternatives for the equipment batches

| Batch | Generic alternative |
|---|---|
| E1 Steel armour | `Icons of steel plate armour` |
| E2 Leather armour | `Icons of leather armour` |
| E3 Cloth gear | `Icons of mage cloth clothing` |
| E4 Obsidian gear | `Icons of black obsidian armour with glowing red cracks` |
| E5 Rat set | `Icons of crude scavenger gear made from animal fur and bones` |
| E6 Melee weapons | `Icons of fantasy melee weapons` |
| E7 Ranged and magic weapons | `Icons of fantasy bows and magic staves` |
| E8 Jewellery and charms | `Icons of fantasy jewellery` |
| E9 Legendary weapons | `Icons of legendary magical weapons` |

## 3.6 Where the generated icons live now

The first generic batches are in `public/pixel/resources/` (32 x 32): the roster is `src/catalog/resourceArt.ts` and the folder rules are in `public/pixel/resources/README.md`. In short: a live resource's picture is built into its 40 x 40 game icon by `scripts/pixel/build.py` (padded, never scaled), planned resources keep their name with `enabled: false`, and spare art starts with `_`. Still without a picture: Ichor, War Medals, Venom, Royal Jelly, relics, potions and all equipment.

## 4. Fitting the result into the game

- Our icons are 40 x 40 and registered in `src/config/pixelIcons.ts`. A 32 or 64 image needs a pixel-perfect resize to 40 (or we add the larger size to the registry); sort that when the art is dropped in.
- Keep the **colour anchors** from the prompts (gold = yellow, gems = cyan, embers = green, as the header colours in `catalog/resources.ts`) so a resource stays recognisable next to its popup text.
- A batch that does not give a usable result for one item is not wasted: keep the rest, then run a one-item prompt for the missing one (still one subject, so it follows the docs).
