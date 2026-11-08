# Resource, potion and item icon prompts (Sprite Fusion)

**This is art pass 3** (the Sprite Fusion regeneration, later releases). Pass 1 uses the icons already in `public/pixel/items/`, pass 2 generates Python placeholders for the rest: see the ROADMAP section "Item art in three passes". Same idea as [monster-art-prompts](monster-art-prompts.md): short prompts to paste into Sprite Fusion, plus the list of what we might replace. Finished icons are hand-supplied like the enemies; nothing reads them until they are wired into `src/config/pixelIcons.ts` (icons are 40 x 40 today, see section 4).

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
| E6 Melee weapons | `Icons of fantasy melee weapons` |
| E7 Ranged and magic weapons | `Icons of fantasy bows and magic staves` |
| E8 Jewellery and charms | `Icons of fantasy jewellery` |
| E9 Legendary weapons | `Icons of legendary magical weapons` |

## 3.6 Where the generated icons live now

The first generic batches are in `public/pixel/resources/` (32 x 32): the roster is `src/catalog/resourceArt.ts` and the folder rules are in `public/pixel/resources/README.md`. In short: a live resource's picture is built into its 40 x 40 game icon by `scripts/pixel/build.py` (padded, never scaled), planned resources keep their name with `enabled: false`, and spare art starts with `_`. Still without a picture: Ichor, War Medals, Venom, Royal Jelly, relics, potions and all equipment.

### 3.7 Equipment gaps (what the sheets in `art_style_reference/equip/` do not cover)

The sheets in `art_style_reference/equip/` cover potions, spears, legs, staves and wands, jewellery, bows, crossbows, daggers, swords, maces, axes, boots, belts and helmets. **They have no shields or off-hands, tomes, orbs, quivers, shoulders, gloves, capes, charms proper, chest armour or a wood-and-rag starter family.** These batches draw those. The grading ladder (G1 to G9, S1 to S3) is section 3 of `art_style_reference/equip/README.md`; the set palettes are its section 5.1.

**Where the finished PNGs go.** Raw name first (the generator's own file name is fine), then the cut recipe, then:
1. the picture goes to `public/pixel/items/<slot>/<name>.png` (64 x 64; `mainHand/<weapon type>/` for weapons, `offHand/` for shields, tomes and orbs);
2. one line in the registry file of its family, `src/config/itemIcons/<slot>[-<weapon>].json` (the icon registry of IDL-18, PR 105; see its README: icon, item, file, slot, weapon, **grade**, **provenance**). Put the batch id and prompt (for example `Sprite Fusion E-GL, G3, variant 7`) in `provenance`: that is the record art README rule 8 asks for. A file that is not registered fails `npm test`.
(IDL-32 mentions `public/pixel/reuse/<family>/`; that folder became `public/pixel/items/` and the registry replaced the intake list.)

#### Style rules that go into every prompt

Every prompt below ends with the same tail, so batches look like one game. Paste it after the batch text:

> `single object, centered, plain flat background, no glow, no halo, no cast shadow, 1 px coloured dark outline, 5-tone shading lit from the top left, chunky readable silhouette, detailed 40 px game icon style`

Why each part: the game adds the rarity glow itself (art README rule 4), sprites float with no ground shadow, the outline is a dark hue-shifted tone of the material and never pure black, and the ramp and light direction are in `scripts/pixel/reference/STYLE.md`. Size **64** for every batch (the registry and the cut recipe take 64 x 64 natively; 64 does not scale to 40 without blurring, so do not ask for 32). Pick the variants that keep the outline and the ramp; reject any with a baked halo, a gradient background or a pure black outline.

**Credits.** One generate call is 15 credits and returns about 12 variants. The totals are at the end of this section.

#### Grade vocabulary (use in the **Prompt**; the Generic alternative leaves it out)

Swap the grade words into a family's template to get a ramp. Keep the same silhouette words across the whole ramp so a slot reads as one family.

| Grade | Words to add |
|---|---|
| G1 Starter | `rough wood, rags, bone, twine, dull browns, no gems, crude stitching` |
| G2 Hide | `tanned leather, simple cloth, bronze rivets, warm tans, plain` |
| G3 Iron | `plain dark iron, riveted, grey, worn` |
| G4 Steel | `polished steel, one blue accent colour, clean edges` |
| G5 Knight | `reinforced blue-steel, gold trim, heraldic, sturdy` |
| G6 Obsidian | `black glassy plates, red or amber glints, sharp facets` |
| G7 Runed | `engraved glowing runes, inlaid gems, faint inner glow, enchanted metal` |
| G8 Ancient | `weathered gold and bone, relic motifs, cracked and old, verdigris` |
| G9 Legendary | `ornate silhouette, gold filigree, jewels, wings or crown motifs, regal` |

Prompts for G1 to G9 of one family are separate generate calls, so a full 9-grade ramp of one slot is nine calls (135 credits). The tables below give one **base template** per family and the **per-grade phrases**; combine: `<template>, <grade words>, <tail>`. The *Prompt* lines are the recommended pair for the two ends of the ramp and the sets, ready to paste.

#### Set vocabulary (S1 to S3; palettes from `equip/README.md` section 5.1, sheet `equip/sets/special-sets-palette-draft.png`)

| Set | Words to add (palette in hex, silhouette) |
|---|---|
| **S1 Sunhoney** | `cream cloth #F4E3B8 and #E3CF95, honey gold #E8C468 and #C98F2E, amber accents #E8862A, soft and round shapes, wide hems, rounded edges, hexagon honeycomb and sun-disc motifs, no spikes, no sharp points` |
| **S2 Ashen Warlord** | `charcoal plate #5A5A62 and #3F3F46, crimson trim #D03C34 and #A02424, tarnished gold only on medals #B89A4A, angular and heavy, broad horizontal shoulders, horns and visors, rivets, banner cloth` |
| **S3 Blightbound** | `violet-black cloth #583A80 and #3A2358, chitin bone #645878, toxic green glow only as a 1 to 2 px accent #9AE03C, asymmetric and tapering shapes, ragged hems, hanging tendrils, thorn and claw tips` |

For a set, write the hex values into the prompt: the generator follows them loosely, so after picking, check the result against the sheet and **palette-swap** to the exact ramps with the script (equip README 5.1) rather than regenerating. One silhouette language per set: do all 13 slots of a set in one sitting and use "Same Style" from the first approved piece.

#### Batches

Each batch lists: **Prompt** (paste, then the tail), **Generic alternative** (one category, no list, let it vary; try first if you want to follow the Sprite Fusion docs), **Keep** (what it can serve), and **Slot / registry file**.

**G-SH. Shoulders and pauldrons** (`shoulder`, `src/config/itemIcons/shoulder.json`; 12 items: G1-G9, S1-S3)
- Prompt (G1): `Icon of a pair of shoulder pads, a patched cloth mantle with a rope tie and a bone stud, rough rags, dull browns, no gems`
- Prompt (G4): `Icon of a pair of steel pauldrons, rounded overlapping plates, polished steel with one blue accent, leather straps`
- Prompt (G9): `Icon of a pair of titan pauldrons, huge ornate layered plates with gold filigree and jewels, regal horned silhouette`
- Generic alternative: `Icon of fantasy shoulder armour`
- Keep: pairs seen from the front, left and right mirrored; if only one pad comes out, mirror it (a pixel-perfect flip) before cutting.
- Set prompts: S1 `Icon of a soft round cream shawl with honey gold trim and a hexagon clasp` · S2 `Icon of a heavy charcoal bulwark of two broad horned pauldrons with crimson trim and rivets` · S3 `Icon of a violet-black ragged shroud mantle with chitin spikes and hanging tendrils`

**G-CH. Chest armour** (`chest`; 12 items; four material shapes cover the ramp)
- Prompts by material: cloth robe `Icon of a cloth robe tunic, front view, simple belt` (G1 rags, G2 linen) · leather `Icon of a leather jerkin vest with laces and a buckle` (G2-G3) · mail `Icon of a chainmail hauberk with short sleeves and a studded belt` (G3-G4) · plate `Icon of a plate breastplate cuirass with a collar and fauld` (G4-G9). Add the grade words from the table.
- Generic alternative: `Icon of fantasy body armour`
- Keep: one torso only (no helmet, no legs, no mannequin); front view, symmetric. Chest is the biggest silhouette: keep the neck hole and arm holes readable at 20 px.
- Set prompts: S1 `Icon of a cream and honey gold vestment robe, wide rounded sleeves, hexagon pattern` · S2 `Icon of a charcoal plate cuirass with crimson trim, tarnished gold medals, spiked pauldron stubs` · S3 `Icon of a violet-black ragged robe with chitin ribs and a toxic green glowing core, asymmetric hem`

**G-GL. Gloves and gauntlets** (`hands`)
- Prompts: G1 `Icon of a pair of rag hand wraps tied with twine` · G2 `Icon of a pair of leather gloves with a cuff and bronze stud` · G4 `Icon of a pair of steel gauntlets with segmented fingers` · G9 `Icon of a pair of ornate legendary gauntlets with gold claws and a jewel`
- Generic alternative: `Icon of fantasy gloves and gauntlets`
- Keep: one pair, palms down, cuffs toward the bottom; or one glove if the pair merges into a blob.
- Set prompts: S1 `Icon of cream silk gloves with honey gold cuffs` · S2 `Icon of heavy charcoal gauntlets with crimson knuckle spikes` · S3 `Icon of violet-black clawed gloves with chitin talons`

**G-CP. Capes and cloaks** (`cape`)
- Prompts: G1 `Icon of a ragged short cloak with a rope clasp` · G2 `Icon of a hide cloak with a fur collar` · G4 `Icon of a long cloak with a steel clasp` · G5 `Icon of a knight's mantle in deep blue with a gold chain clasp` · G9 `Icon of a royal mantle in crimson with an ermine collar and gold embroidery`
- Generic alternative: `Icon of fantasy capes and cloaks`
- Keep: hanging flat (no wearer), clasp at the top, a few folds; a cape seen from behind is fine if the front blob is unreadable.
- Set prompts: S1 `Icon of a cream cape with honey gold hem and a sun-disc clasp` · S2 `Icon of a charcoal banner cloak with a crimson banner and a tarnished gold medal` · S3 `Icon of a violet-black shroud with ragged tendril hem and a green glowing clasp`

**G-CM. Charms and totems** (`charm`)
- Prompts: G1 `Icon of a charm: an acorn on a cord` · G2 `Icon of a lucky rabbit foot charm on a thong` · G3 `Icon of a bone token charm` · G4 `Icon of a bronze medal charm on a ribbon` · G5 `Icon of a lucky gold coin charm` · G6 `Icon of a small black obsidian idol charm` · G7 `Icon of a runed totem charm with glowing runes` · G8 `Icon of an ancient relic charm in weathered gold and bone` · G9 `Icon of a glowing heartstone charm, a faceted red stone in a gold frame`
- Generic alternative: `Icon of fantasy lucky charms and totems`
- Keep: charms are small: leave empty margin; the cord or ribbon shows but does not touch the border.
- Set prompts: S1 `Icon of a small hive charm: a honeycomb pendant in honey gold` · S2 `Icon of a war medal charm: a tarnished gold medal on a crimson ribbon` · S3 `Icon of a corrupted core charm: a dark violet orb cage with a green glow`

**G-OH. Shields and off-hands** (`offHand`, weapon type `shield`, `src/config/itemIcons/offHand-shield.json`; the sheets have no shield at all)
- Prompts by shape: G1 `Icon of a wooden buckler, a small round shield of planks with an iron boss` · G2 `Icon of a hide-covered round shield with bronze studs` · G3 `Icon of an iron kite shield, riveted` · G4 `Icon of a steel heater shield` · G5 `Icon of a knight's tower shield, blue with a gold trim and a heraldic emblem` · G6 `Icon of an obsidian aegis, a black faceted shield with red glints` · G7 `Icon of a runed bulwark shield with glowing engraved runes` · G8 `Icon of an ancient weathered golden shield` · G9 `Icon of a dragon aegis shield with a dragon head crest, gold and red`
- Generic alternative: `Icon of fantasy shields`
- Keep: face-on, centred, no arm straps, no hand. 36 to 40 px of 64 wide so the 20 px version still reads.
- Set prompts: S2 `Icon of an ashen tower shield, charcoal plate with crimson trim and a tarnished gold medal` (S1 and S3 off-hands are the tome and the orb below)

**G-TM. Tomes** (`offHand`, weapon type `tome`; no sheet)
- Prompts: G1 `Icon of a rough bound book, a leather cover tied with twine, no gems` · G2 `Icon of a leather spellbook with bronze corners` · G4 `Icon of a steel-bound tome with a blue gem clasp` · G6 `Icon of a black obsidian tome with red glints` · G7 `Icon of a runed tome with glowing runes and an inlaid gem` · G9 `Icon of a legendary ornate tome with gold filigree, jewels and a floating page`
- Generic alternative: `Icon of fantasy magic books`
- Keep: closed book, 3/4 view, spine at the left; open books lose the silhouette at 20 px.
- Set prompt: S1 `Icon of the Golden Ledger: a cream and honey gold book with a hexagon clasp and a sun-disc on the cover`

**G-OR. Orbs** (`offHand`, magic focus held in the off hand; **needs a design decision first**: `WeaponType` has no `orb` today, art README section 6 says agents add no type on their own; the batch is for the art pool and the S3 Blight Orb)
- Prompts: G1 `Icon of a plain glass orb on a twisted wooden stand` · G4 `Icon of a steel-ringed crystal orb` · G7 `Icon of a runed orb floating over a gold ring, glowing runes` · G9 `Icon of a legendary orb with swirling stars inside, gold ring`
- Generic alternative: `Icon of fantasy magic orbs`
- Keep: if the owner decides on a type, the registry line gets `weapon: "orb"` (a new file `offHand-orb.json`); until then register as `offHand` with `weapon: "tome"` only if the item is a tome-like focus.
- Set prompt: S3 `Icon of a Blight Orb: a violet-black orb in a chitin claw cage with toxic green swirling inside`

**G-QV. Quivers** (**slot decision pending**: a quiver would be an off-hand for bows or a new slot; do not generate before the decision, IDL-32 says "only if a slot decision says so")
- Prompt: `Icon of a quiver full of arrows, leather quiver with a strap and feathered arrows`, grade words as above.
- Generic alternative: `Icon of fantasy quivers`

**G-ST. Starter G1-G2 families (rag, wood, bone, hide)** — the cheapest way to fill the lowest two grades of every slot with one coherent look
- Prompt (G1 armour set, one batch per slot is better than a mixed batch; see the slot batches above for the shapes): `Icons of crude starter gear made of rags, rough wood, bone and twine, dull browns, no gems, cap, tunic, boots, wraps, single object, centered`
- Prompt (G2 armour set): `Icons of simple hide gear, tanned leather and bronze rivets, warm tans, cap, jerkin, gloves, boots, single object, centered`
- Prompt (G1 weapons): `Icons of crude starter weapons: a sharpened stick, a stone hatchet, a bone knife, a twig bow, a wooden club, single object, centered`
- Generic alternative: `Icons of primitive starter gear`
- Keep: whichever slots the sheets have no G1 for. Add the tail from the top of this section.

**G-S1 / G-S2 / G-S3. Special sets** — the set pieces for the 13 slots not drawn in the slot batches above: head (hood or crown), shoulder, chest, hands, legs, feet, neck, cape, ring, charm, main hand, off hand.
- S1 head `Icon of a cream hooded circlet with honey gold trim` · legs `Icon of a cream skirt with a honey gold hem` · feet `Icon of cream slippers with honey gold soles` · neck `Icon of a honeydrop amulet, an amber drop in a gold frame` · ring `Icon of a honeycomb ring in honey gold` · mace `Icon of a honeycomb scepter, a hexagon head on a gold shaft`
- S2 head `Icon of a charcoal horned visor helmet with crimson plume` · legs `Icon of heavy charcoal cuisses with crimson trim` · feet `Icon of charcoal plated sabatons` · neck `Icon of a war medal on a crimson ribbon` · ring `Icon of a charcoal signet ring with a crimson stone` · axe `Icon of a charcoal greataxe with crimson edge`
- S3 head `Icon of a violet-black cowl hood with chitin horns` · legs `Icon of violet-black ragged leggings` · feet `Icon of violet-black shroud treads with claw tips` · neck `Icon of an ichor locket, a vial of green ichor in a chitin frame` · ring `Icon of a violet-black ring with a toxic green stone` · staff `Icon of a Blight Staff, a twisted chitin staff with a green glowing orb` · dagger `Icon of the Venomfang, a curved violet-black fang dagger dripping green`
- Existing art that already matches a set (only a palette swap is needed, equip README 5.1): Ashen Warlord has `magma_flail`, `cinderfang_sword`, `ember_medallion`, `ruby_signet`, `warden_plate_belt`, `drake_scale_boots`; do not regenerate those.
- Generic alternative (any set): `Icon of a fantasy armour set piece in <palette words>`

#### Credits budget

A batch is one generate call = **15 credits**, about 12 variants. Counting per grade or set call:

| Family | Calls | Credits |
|---|---|---|
| Shoulders (G1-G9 + 3 sets) | 12 | 180 |
| Chest (G1-G9 + 3 sets) | 12 | 180 |
| Gloves | 12 | 180 |
| Capes | 12 | 180 |
| Charms | 12 | 180 |
| Shields (G1-G9, S2) | 10 | 150 |
| Tomes (6 grades + S1) | 7 | 105 |
| Orbs (4 + S3), after the decision | 5 | 75 |
| Quivers, after the decision | 3 | 45 |
| Starter G1-G2 families | 4 | 60 |
| Set pieces not covered above (3 sets x 6-7 pieces) | 20 | 300 |
| **All, once** | **109** | **1635** |

Budget realistically 1.5 times that (some calls will need a re-roll). Cheapest useful first step: one G1 and one G9 call per family (about 20 calls, 300 credits) to confirm the look before ordering the middle grades.

### 3.8 Avatar portraits (IDL-72)

Avatars are **separate from classes** ([21](21-classes-avatars-achievements-offline-report.md) section 2): purely visual, shown in the header, rankings and map preview, so they must read at **20 px** in a ranking row. The references are `art_style_reference/ui-and-portraits/` (`2r0s3O.jpg` human and dwarf faces for the starters; `RagiwH.jpg`, `JnC0G_.jpg`, `XxPWs5.jpg`, `amYqsq.jpg` for the unlockables); the house look is `scripts/pixel/sprites_characters.py` and `STYLE.md` (**People**: big friendly heads, readable eyes with white and pupil, flat brows, hair with streak texture, one signature prop each, no ground shadow). Total needed: 8 starters + the unlockables + 2 frame pieces. At launch only 4 unlockables are needed (Architect, Reborn, Boss slayer, Early tester); the other 3 come with biomes and crafting, so their batch can wait.

**Size and fitting.** Our busts are 40 x 40, but Sprite Fusion makes only 16, 32 or 64. Generate at **64**. A face does not shrink from 64 to 40 without smoothing (art README rule 3 forbids it), so the generated bust is a **reference to redraw** (the ui-and-portraits README, section 3 point 1, says portraits usually need a redraw anyway: the references are more realistic than our heads), or it is kept native at 64 x 64 if the owner prefers; decide when the first batch is in, before cutting 15 of them. Ask for a **head-and-shoulders bust, front or slight 3/4 view, face filling the frame**, so it survives a crop to the middle 40 px.

**Tail for every portrait prompt** (paste after the batch text):

> `head and shoulders bust portrait, big friendly head with readable eyes, flat eyebrows, hair with streak texture, one signature prop at the shoulder, single object, centered, plain flat background, no frame, no border, no glow, no cast shadow, 1 px coloured dark outline, 5-tone shading lit from the top left, cute chunky pixel art`

(No frame in the picture: the frame is drawn by the UI from the chrome rules, bevelled stone-maroon, and the level badge goes on top.)

Batch format as in 3.7: **Prompt**, **Generic alternative**, **Keep**, **Where it goes**. Each call is 15 credits, about 12 variants; the `Same Style` button after the first approved face keeps the rest of a family looking alike. Finished files go to `public/pixel/portraits/avatars/<id>.png` (raw name first) once the owner has decided the registration path; the avatar ids are the catalog keys of IDL-72/IDL-194 (`knight`, `druid`, ...; `architect`, `reborn`, `boss_slayer`, `early_tester`).

#### A1. The 8 starter avatars (human and dwarf look; any avatar with any class)

One batch of the whole category first, then single prompts for the ones that are missing. Palette: warm skin tones, readable at 20 px, each with a distinct hair or hat colour so the eight differ by silhouette and not just by prop.

| Avatar | Prompt (then the tail) | Signature prop and colour cue |
|---|---|---|
| Knight | `Portrait of a human knight, short brown hair, steel gorget and pauldrons, red cloak clasp` | steel + red |
| Druid | `Portrait of a druid, green hooded cloak, braided auburn hair, a leaf and berry sprig on the hood` | green + brown |
| Scout | `Portrait of a scout, a short blue-grey hood, a scarf, freckles, a small spyglass at the shoulder` | slate blue + tan |
| Scholar | `Portrait of a scholar, round glasses, a violet cap, a quill at the ear, ink-stained collar` | violet + cream |
| Miner | `Portrait of a dwarf miner, big orange beard, a helmet with a lantern, a pickaxe head at the shoulder` | orange + iron grey |
| Farmer | `Portrait of a farmer, a straw hat, a friendly round face, a stalk of wheat in the mouth` | straw yellow + green |
| Bard | `Portrait of a bard, a feathered cap, a small moustache, a lute neck at the shoulder` | teal + red feather |
| Alchemist | `Portrait of an alchemist, goggles on the forehead, singed hair, a green potion flask at the shoulder` | goggle brass + toxic green |

- **Generic alternative** (one category, no list): `Portraits of fantasy adventurers` — the variants drift across kinds; keep the ones that fit the eight and fill the rest with the single prompts above.
- **Keep**: one per row; if two read the same at 20 px, drop the one with the less distinct silhouette.

#### A2. The unlockable avatars (7: 4 at launch, 3 with biomes and crafting)

Tied to server achievements (docs/plan/21-classes-avatars-achievements-offline-report.md section 3, `catalog/achievements.ts`). Looks should feel "earned": rarer materials, more ornament, a touch of glow in the eyes is fine, no baked halo.

| Avatar | Unlock | Prompt (then the tail) | Cue |
|---|---|---|---|
| Architect (launch) | castle level 10 | `Portrait of a master builder, a gold-trimmed hard cap, a rolled blueprint and a tiny tower model at the shoulder, proud smile` | stone grey + gold |
| Reborn (launch) | first rebirth | `Portrait of a reborn hero with a faint ember-green glow in the eyes, short white hair streaked with green, a green gem pin on the collar` | the embers green gem |
| Boss slayer (launch) | defeat The Great Auroch | `Portrait of a boss slayer, a scarred half-orc, a horned helmet made from a huge aurochs horn, a tusk trophy at the shoulder` | bone + dark red |
| Early tester (launch) | granted by the reset migration | `Portrait of a pioneer tester, a leather cap with brass goggles and a tiny hammer-and-wrench badge, a lopsided grin` | brass + teal |
| Biome hero, undead | Blight / Battlefield | `Portrait of a skeleton knight, a cracked skull with glowing amber eyes, a rusted visor, a torn crimson plume` | bone + crimson |
| Biome hero, tiefling | Blight, late achievements | `Portrait of a tiefling duelist, small curved horns, violet skin, a gold earring, a confident smirk` | violet + gold |
| Biome hero, elf or witch | crafting mastery | `Portrait of a forest elf archmage, long pointed ears, silver hair with a leaf circlet, a faint blue star glow` | silver + blue |

- **Generic alternative** (one category): `Portraits of fantasy heroes and monsters` · for the orc and boss slayer: `Portraits of orc warriors`; for the undead: `Portraits of skeletons and undead knights`.
- **Keep**: the three late ones are free; generate them only when their achievements are designed (the names above are working titles; the ids stay stable once shipped, saves store only the id).

#### A3. Locked silhouette and the selected frame

- **Locked silhouette** (shown in the picker for avatars the player has not unlocked): `Silhouette of a hero bust, a flat dark violet-grey filled head and shoulders shape with no face details, a small question mark in the middle, head and shoulders bust, single object, centered, plain flat background, no glow, no cast shadow, 1 px darker outline, 3-tone shading` · generic alternative: `Icon of a mystery silhouette portrait`. Keep one; it is drawn once and used for all locked slots. Size 64, redraw/crop to 40.
- **Selected frame**: this is UI chrome, not a portrait; it should come from the UI rules (`STYLE.md` UI direction: chunky bevelled stone-maroon frame, tan bevel `#c8a878`, stepped corners, a small gold pip) and be built with `scripts/pixel/ui_art.py`. Generating it with Sprite Fusion is optional: `Icon of a square pixel-art portrait frame, chunky bevelled dark maroon stone with a tan highlight bevel and a glowing gold selection border, empty transparent centre, stepped corners` (a second sprite for the unselected state would be the same with a plain tan bevel). Expect to rebuild it at 40 x 40 + border by hand; the generated one is a mood reference.

#### Credits budget (portraits)

| Batch | Calls | Credits |
|---|---|---|
| A1 starters, whole-category call + one per missing avatar (8 at most) | 9 | 135 |
| A2 launch unlockables (4) | 4 | 60 |
| A2 later unlockables (3), when designed | 3 | 45 |
| A3 locked silhouette | 1 | 15 |
| A3 selected frame (optional) | 1 | 15 |
| **Launch total (A1 + 4 launch + A3 silhouette)** | **14** | **210** |
| **All** | **18** | **270** |

Budget 1.5 times for re-rolls. Do the starters first: they are the only art in the R5 project without a placeholder fallback (IDL-72), because the picker cannot be built without them.

## 4. Fitting the result into the game

- Our icons are 40 x 40 and registered in `src/config/pixelIcons.ts`. A 32 or 64 image needs a pixel-perfect resize to 40 (or we add the larger size to the registry); sort that when the art is dropped in.
- Keep the **colour anchors** from the prompts (gold = yellow, gems = cyan, embers = green, as the header colours in `catalog/resources.ts`) so a resource stays recognisable next to its popup text.
- A batch that does not give a usable result for one item is not wasted: keep the rest, then run a one-item prompt for the missing one (still one subject, so it follows the docs).
