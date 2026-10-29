# equip/ : equipment reference and the item grading plan

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first. This folder drives a full **replacement of every equipment graphic** and the growth of the item catalog to **12 items per slot** and **3 special sets**.

## 1. Files (each sheet is a grid of 48 icons on a brown cell background, JPG)

| File | Contents | Our slot / type |
|---|---|---|
| `0tP6Sm.jpg` | 48 **potions** and flasks (round, square, tall, barrel, bag shapes, every colour) | consumables (hp, mana, buffs, antidotes) |
| `9WdY47.jpg` | 48 **spears, glaives and halberds** | mainHand `spear` |
| `9Z3Vbg.jpg` | 48 pairs of **trousers and greaves** (cloth to plate) | `legs` |
| `DX2FFX.jpg` | 48 **staves, wands, magic hammers** (fire, ice, nature, void, lightning variants) | mainHand `staff`, `wand` |
| `EAim3s.jpg` | 48 **rings, bracelets, necklaces and amulets** (gems, wings, skulls) | `ring1/ring2`, `neck`, `charm` |
| `HvL0j1.jpg` | 48 **bows and crossbows with elemental variants** (glow, fire, frost, shadow) | `bow`, `crossbow` |
| `KkhQpi.jpg` | 48 **spears and glaives, elemental variants** | `spear` (upper tiers) |
| `M46QPM.jpg` | 48 **daggers, short swords, curved blades, sickles** | `dagger`, `sword` (short) |
| `OROeUa.jpg` | 48 **bows and crossbows, plain** | `bow`, `crossbow` |
| `PiXmLF.jpg` (grey-lilac background) | **gloves and capes**, 40 pieces, in plain colourways | `hands`, `cape` |
| `QhDaVs.jpg` (grey-lilac background) | **armour set examples**: 40 pieces (helmet, chest, legs, boots, gloves, cape) in 4 colourways plus a labelled **SET EXAMPLE** row showing how one set stays coherent | `head`, `chest`, `legs`, `feet`, `hands`, `cape`, sets |
| `URR7md.jpg` | 48 **swords** (straight, curved, elemental) | mainHand `sword` |
| `U_z2Ny.jpg` | 48 **maces, hammers, mauls and clubs** | mainHand `mace`, `maul` |
| `YAg5bN.jpg` (grey-lilac background) | **rings, earrings, necklaces, bracelets** plus a **SET EXAMPLE** (4 matching pieces) | `ring`, `neck`, `charm`, jewelry sets |
| `awKBb7.jpg` | 48 **axes** (plain) | mainHand `axe` |
| `hVi5Ez.jpg` | 48 pairs of **boots** | `feet` |
| `jSaFQ6.jpg` | 48 **axes, elemental variants** | `axe` (upper tiers) |
| `nrfbhC.jpg` | 48 **belts** | no belt slot today: see section 6 |
| `qTXBcZ.jpg` | 48 **helmets and hoods** | `head` |
| `xJe322g.jpg` (grey-lilac background) | **rings, earrings, necklaces, bracelets**, second colourway, plus a **SET EXAMPLE** | jewelry sets |
| `xJe32g.jpg` | 48 **exotic weapons**: kunai, shuriken, whips, claws, sickles, chains, fans, fists, hooks | new weapon types (section 6) |

**Gaps (not in the sheets, draw new in our kit): shields and off-hand items (no shield sheet at all), tomes, quivers, shoulders/pauldrons, charms proper, a wood-and-hide starter family.**

## 2. What we want

- **Replace all current equipment graphics** (the `item_*` icons, the gear sprites in `scripts/pixel/sprites_gear.py`, `sprites_equipment.py` and the slot icons) with new ones that are either **recreated in our pipeline from these references** or, where the licence is cleared and the quality is good, **cut directly as PNG** (root README rule 1 and 5). Direct cuts must match our look: no baked glow or cell background (the game adds the rarity glow), 40 px canvas, coloured outline.
- A **big catalog**: 12 items per slot and 3 special sets, graded by strength (below). They go into the **drop tables and crafting later** (docs [10](../../docs/10-loot-system.md), [17](../../docs/17-crafting.md)); for now the plan is only art and a grading.
- **Content is data**: items are entries in `src/catalog/items/*.ts` and recipes are keyed by tag and tier, never by id ([docs/17](../../docs/17-crafting.md) note), so adding items must not need code changes.

## 3. The grading ladder (12 grades per slot)

Each slot gets **12 items = 9 normal grades + 3 special-set pieces** (one per set). The grade is a planning label; the game's real strength comes from item level (1-100), rarity (common to legendary) and affixes. The "strength index" is a **relative planning number, not a stat**: real values are tuned later with `npm run loot-sim` and `npm run fight-sim`.

| Grade | Name | Item level | Typical rarity window | Strength index | Look cues (palette and detail) |
|---|---|---|---|---|---|
| G1 | Starter | 1-8 | common | 1.0 | wood, rags, bone; dull browns, no gems |
| G2 | Hide | 9-18 | common to uncommon | 1.6 | leather, simple cloth, bronze; warm tans |
| G3 | Iron | 19-30 | uncommon | 2.4 | plain iron, riveted, grey |
| G4 | Steel | 31-42 | uncommon to rare | 3.5 | polished steel, one accent colour |
| G5 | Knight | 43-54 | rare | 5 | reinforced, blue-steel, trim in gold |
| G6 | Obsidian | 55-66 | rare to epic | 7 | black glassy plates, red or amber glints (the existing Obsidian family) |
| G7 | Runed | 67-78 | epic | 10 | engraved runes, inlaid gems, a faint glow in the art |
| G8 | Ancient | 79-90 | epic to legendary | 14 | weathered gold and bone, relic motifs |
| G9 | Legendary | 91-100 | legendary | 20 | named uniques, strongest non-set tier, ornate silhouettes |
| **S1** | **Special set I** (Sunhoney) | 100 (set only) | set | **22** | economy set, see section 5 |
| **S2** | **Special set II** (Ashen Warlord) | 100 (set only) | set | **28** | combat set |
| **S3** | **Special set III** (Blightbound) | 100 (set only) | set | **32 (the strongest items in the game)** | caster and leech set |

Special-set pieces never appear in ordinary drop tables: they come from **boss kills, T4 relics, War Medals and Ichor crafts** ([docs/20](../../docs/20-monster-families-and-rewards.md), [docs/17](../../docs/17-crafting.md)), and are the reward for rebirths 4 and 5 content. Sets keep the existing `SetDef` shape (`catalog/sets.ts`, thresholds such as 2/4/6/9/12 pieces worn out of 13 slots).

## 4. The 12 items per slot (working titles, rename freely)

Format: G1, G2, G3, G4, G5, G6, G7, G8, G9 | S1, S2, S3.

| Slot | Items |
|---|---|
| `head` | Rag Hood, Hide Cap, Iron Cap, Steel Helm, Knight's Greathelm, Obsidian Visage, Runed Circlet, Ancient Warhelm, Crown of Embers \| Sunhoney Crown, Ashen Warlord's Visor, Blightbound Cowl |
| `shoulder` | Patched Mantle, Hide Pauldrons, Iron Spaulders, Steel Pauldrons, Knight's Spaulders, Obsidian Shoulders, Runed Epaulets, Ancient Mantle, Titan's Pauldrons \| Sunhoney Shawl, Warlord's Bulwark, Shroud Mantle |
| `chest` | Rag Tunic, Hide Jerkin, Iron Mail, Steel Cuirass, Knight's Breastplate, Obsidian Plate, Runed Hauberk, Ancient Cuirass, Dragonheart Plate \| Sunhoney Vestments, Ashen Plate, Blightbound Robe |
| `hands` | Rag Wraps, Hide Gloves, Iron Gauntlets, Steel Gauntlets, Knight's Gauntlets, Obsidian Grips, Runed Gloves, Ancient Handguards, Titan's Fists \| Sunhoney Gloves, Warlord's Gauntlets, Shroud Claws |
| `legs` | Rag Trousers, Hide Leggings, Iron Chausses, Steel Greaves, Knight's Legplates, Obsidian Cuisses, Runed Leggings, Ancient Legguards, Giantstride Plate \| Sunhoney Skirt, Warlord's Cuisses, Blightbound Leggings |
| `feet` | Rag Shoes, Hide Boots, Iron Boots, Steel Sabatons, Knight's Boots, Obsidian Treads, Runed Striders, Ancient Boots, Windwalker Greaves \| Sunhoney Slippers, Warlord's Sabatons, Shroud Treads |
| `neck` | Cord Pendant, Bone Beads, Copper Pendant, Silver Chain, Sapphire Amulet, Obsidian Choker, Runed Torc, Ancient Talisman, Heart of the Mountain \| Honeydrop Amulet, Medal of the Fallen, Ichor Locket |
| `cape` | Rag Cloak, Hide Cloak, Traveller's Cape, Steel-clasp Cloak, Knight's Mantle, Obsidian Cloak, Runed Cape, Ancient Shroud, Royal Mantle \| Sunhoney Cape, Warlord's Banner Cloak, Blightbound Shroud |
| `ring` (both ring slots) | Twig Ring, Copper Band, Iron Signet, Silver Ring, Sapphire Ring, Obsidian Band, Runed Ring, Ancient Seal, Ring of Ages \| Honeycomb Ring, Warlord's Signet, Ichor Ring |
| `charm` | Acorn Charm, Rabbit Foot, Bone Token, Bronze Medal, Lucky Coin, Obsidian Idol, Runed Totem, Ancient Relic, Heartstone \| Hive Charm, War Medal Charm, Core Charm |
| `offHand` | Wooden Buckler, Hide Shield, Iron Kite Shield, Steel Heater, Knight's Tower Shield, Obsidian Aegis, Runed Bulwark, Ancient Shield, Dragon Aegis \| Golden Ledger (tome), Ashen Tower Shield, Blight Orb |
| `mainHand` | see the weapon types below (each type has the same 9 grades + its set variant) |

**Main-hand weapon types** (the 12 current `WeaponType` values minus `shield`/`tome`, which are off-hand; one row per type; G1 to G9, then the signature piece of a set where one exists):

| Type | G1 ... G9 | Set signature |
|---|---|---|
| `sword` | Rusty Shortsword, Bronze Sword, Iron Sword, Steel Longsword, Knight's Blade, Obsidian Edge, Runed Claymore, Ancient Greatsword, Emberbrand | |
| `dagger` | Bone Knife, Bronze Dirk, Iron Dagger, Steel Stiletto, Knight's Misericord, Obsidian Fang, Runed Kris, Ancient Shiv, Nightbite | Blightbound Venomfang |
| `mace` | Wooden Club, Bronze Mace, Iron Mace, Steel Flanged Mace, Knight's Morningstar, Obsidian Crusher, Runed Scepter, Ancient Mace, Sunforged Maul | Sunhoney Honeycomb Scepter |
| `maul` | Log Maul, Bronze Hammer, Iron Maul, Steel Sledge, Knight's Warhammer, Obsidian Breaker, Runed Maul, Ancient Titanhammer, Worldbreaker | |
| `axe` | Hatchet, Bronze Axe, Iron Axe, Steel Battle Axe, Knight's Poleaxe, Obsidian Cleaver, Runed Greataxe, Ancient Executioner, Dawnsplitter | Ashen Warlord's Greataxe |
| `spear` | Sharpened Stick, Bronze Spear, Iron Spear, Steel Glaive, Knight's Lance, Obsidian Pike, Runed Halberd, Ancient Trident, Skyreach | |
| `bow` | Twig Bow, Hunting Bow, Yew Bow, Steel Recurve, Knight's Longbow, Obsidian Bow, Runed Bow, Ancient Warbow, Stormstring | |
| `crossbow` | Wooden Crossbow, Bronze Crossbow, Iron Crossbow, Steel Arbalest, Knight's Crossbow, Obsidian Repeater, Runed Crossbow, Ancient Siegebow, Doomhook | |
| `staff` | Walking Stick, Hide-bound Staff, Iron-shod Staff, Steel Staff, Knight's Quarterstaff, Obsidian Staff, Runed Staff, Ancient Staff, Archmage's Spire | Blightbound Blight Staff |
| `wand` | Twig Wand, Bronze Wand, Iron Wand, Steel Wand, Knight's Wand, Obsidian Wand, Runed Wand, Ancient Wand, Starlight Wand | |

Existing items that already fit the ladder and may keep their ids: `item_emberbrand` (G9 sword), `item_iron_sword` (G3), `item_battle_axe`, `item_hunting_bow`, `item_apprentice_wand`, `item_apprentice_tome`, the wooden starter kit (G1), the cloth family (G2 to G4 caster) and the Obsidian set (G6). The Rattatui set is **retired** ([RELEASE-PLAN](../../docs/RELEASE-PLAN.md) P3.6): its definitions and icons stay as long as any save can hold a piece, see section 7.

## 5. The three special sets (each 13 pieces: all slots, both rings, weapon and off hand)

| Set | Theme and biome tie | Palette | Weapon and off hand | Bonus direction (numbers are tuned later, shape as `SetDef`) | Base the art on |
|---|---|---|---|---|---|
| **S1 Sunhoney Raiment** (index 22) | economy: pays the kingdom (income, XP, offline cap, chest speed); tied to Fields, Blossom Orchard, Honey | cream, amber, honey gold, white cloth | Honeycomb Scepter (mace), Golden Ledger (tome) | like the Obsidian set but richer: income, XP, offline hours, kill rewards, gold find | `PiXmLF.jpg` (cloth gloves and capes), `QhDaVs.jpg` light set row, jewelry set example in `YAg5bN.jpg` |
| **S2 Ashen Warlord** (index 28) | combat plate: damage, HP, armor, crits; tied to the Battlefield and War Medals | charcoal plate, crimson trim, tarnished gold medals | Greataxe, Ashen Tower Shield | percent damage and HP, armor, crit, slow regeneration | `QhDaVs.jpg` red and black plate columns, `qTXBcZ.jpg` horned and visored helmets, `9Z3Vbg.jpg` plate legs |
| **S3 Blightbound** (index 32, strongest) | caster and leech: damage percent, life leech, Luck, a small chance-based effect; tied to the Blight, Ichor, Corrupted Core | violet-black cloth and chitin, toxic green glow | Blight Staff (or Venomfang dagger), Blight Orb | strongest raw power but fragile (low armor): damage, leech, Luck, mastery gain | dark hoods in `qTXBcZ.jpg`, `DX2FFX.jpg` void and nature staves, necrotic ring set in `xJe322g.jpg` |

The "SET EXAMPLE" rows in `QhDaVs.jpg`, `YAg5bN.jpg` and `xJe322g.jpg` are the model for coherence: **one silhouette language and one palette across all 13 pieces**, so a set reads as a set at a glance.

## 6. New weapon types and a belt slot (design decisions, not art)

`xJe32g.jpg` shows weapons our `WeaponType` does not have (whip, claws/fist, sickle/scythe, throwing blades, chains, hooks). `nrfbhC.jpg` shows 48 belts, but there is **no belt slot**. Adding either changes combat, loot or the Character window, so it needs a design decision first ([docs/10](../../docs/10-loot-system.md), `WEAPON_ATTACK_SPEED` in `catalog/weapons.ts`, `EquipmentSlot` in `types/game.ts`). **Agents: do not add a type or slot on their own.** Use these sheets only as inspiration for existing types (a whip may become a `dagger`-speed one-hander in art terms only) until the owner decides.

## 7. What agents should do with this folder later

1. **Do not delete old equipment graphics yet.** Items reference icons by id (`config/pixelIcons.ts`, `public/pixel/icons/item_*.png`, `equip_*` slot icons, `scripts/pixel/sprites_gear.py`, `sprites_equipment.py`, `scripts/pixel/reference/gear.png`). The 78 `item_*` icons plus the gear scripts are what the owner wants gone, **but only after the replacements are wired** (root README rule 6).
2. **The safe moment**: after the one-time progress reset ([RELEASE-PLAN](../../docs/RELEASE-PLAN.md) P2) every bag and set of worn gear is empty, so no save holds an old item and the old files can be removed. The retired Rattatui pieces are the only exception while saves can still carry them (until P2 ships, keep their icons or map them to a new icon).
3. **Work order** (one PR each): (E1) build the 12-per-slot catalog as data with new icon ids, art as placeholders or cuts, **not yet in any drop table**; (E2) put the 9 normal grades into the loot profiles and the craft tiers, tuned with `loot-sim` and `fight-sim`; (E3) add the three special sets through boss, relic and enchanted-craft sources; (E4) delete the old `item_*` files and gear scripts; update `docs/generated/item-catalog.md` via `npm run catalog-report`.
4. **Making an icon**: pick a reference cell by silhouette (a sword for a sword, not just colour); decide recreate or cut (root README rules 1 to 3). The sheets are **JPG**, so a direct cut carries compression noise: if a cut is wanted, ask the owner for the original PNG pack first; otherwise recreate. Output 40 px, transparent, coloured outline, no glow, one palette per grade (look cues in the ladder).
5. **Sets first as a palette sheet**: before drawing 13 pieces of a set, produce one palette and one silhouette rule from the "SET EXAMPLE" rows and get it approved.
6. Names above are working titles; keep ids stable once shipped, because saves store only the id.

## Provenance of anything cut from here

(none yet; add one line per cut: file, cell, output name, who confirmed the licence)
