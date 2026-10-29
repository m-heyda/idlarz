# resources/ : materials, currencies, drops and consumables

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first. Context: the tier ladder in [docs/18](../../docs/18-biome-buildings-and-material-tiers.md) section 4, the five T2 materials in [docs/12](../../docs/12-rebirth-biomes.md), the registry in [docs/19](../../docs/19-first-build-steps.md) step B.

## 1. Files (grids of 48 icons on brown cells unless noted; JPG)

| File | Contents | Use |
|---|---|---|
| `+6cTJq.jpg` | **meats and animal goods**: raw cuts, steaks, ribs, sausages, drumsticks, hides, skulls, horns, antlers, bones, feathers | T0 meat, T1 hide, monster drops |
| `4YF8Ye.jpg` | **treasure**: chests in many materials (wood, gold, jade, ice), keys, coin stacks and a gold coin, goblets, crowns | gold and currency icons, chests, T4 relic frames (crowns) |
| `4g66dJ.jpg` (grey-lilac background) | **mining set**: pickaxes and drills, then four rows of **ore, crystal and ingot variants** (grey stone, blue ice, orange copper, green and red ores; each as rock, chunks, powder, ingot) | T0 stone and coal, T3 Iron Ore, Frostshard, Salt, Scrap Steel, ingots |
| `6XcbLq.jpg` | **gems, crystals and minerals** (about 48 shapes and colours) | gems currency, Pearls, Frostshard, rarity materials |
| `ArQkEU.jpg` | **monster and dungeon loot**: skulls, bones, a heart, eyeballs, a brain, rings, crowns, scrolls, books, a voodoo doll, keys | drops, T4 relics, Corrupted Core |
| `FCPYjh.jpg` (grey-lilac background) | **arcane relics** at 32x32 and 16x16 (prisms, cubes, sigils, a green crystal, a swirling orb) | T4 relics, Ichor and Corrupted Core ideas; shows how an icon reads at **16 px** |
| `InY+yp.jpg` | **creature parts**: horns, hides, claws, fangs, wings, eyes, slime cores, ember hearts, tentacles, bottled venom | T1 hide, Venom, Corrupted Core, monster drops |
| `K2qMMX.jpg` | **fish, crabs, shells, hooks and fishing gear** | Fishery and Pearl Diver goods, food drops |
| `SUNO7+.jpg` | **monster and bandit loot**: teeth, boots, belts, weapons, bones, beads, meat, potions | drops |
| `Vim3pB.jpg` (grey-lilac background) | **herbs and plants**: leaves, flowers, potted plants, mushrooms in pots | Herbs, Dye, Royal Jelly flowers |
| `_hbq+M.jpg` | **witch and ritual items**: grimoire, candles, vials, herbs, claws, spider, scrolls, keys, mushrooms, potions | potion reagents, Spores, Ichor ideas |
| `ceH18S.jpg` | **fairy and nature items**: bees and a hive, flowers, berries, a teapot, jars, wings, petals, ribbons | Honey, Royal Jelly, Cloth (ribbons and fabrics), the orchard |
| `eaDVgW.jpg` | **48 mushrooms** (every colour and size) | Spores, food, the swamp and orchard |
| `jdix0M.jpg` | **farming**: seed bags, tools (hoes, rakes, sickles, shovels), crates, baskets, jars, pots, a watering can, seedlings | farm goods; also the **farm update** (see `../farm/`) |

Cross-references: `../monsters/yoaPlM.png` (right panel) has **small items**: rice and food, eggs, feathers, a mushroom ring, tools, lanterns, paper, a map, fish, herbs, bottles.

**Gaps (draw new in our kit): wood logs and planks, Hardwood, cloth bolts, milk, eggs, bread/food staples, XP orb, Honey comb and jar as a hero icon, War Medals.** The current wood, stone, coal, meat and gold icons were cut from our own sheet (`reference/resource-sheet.jpg`) and are good; the rest is procedural.

## 2. What we want

- **Replace every current resource graphic** with new, **more detailed** icons built from this material. Constraint: **on a very small area the item must still be clearly recognisable**. The header draws a 40 px sprite at **20 px** (`ICON_SCALE` in `ResourceDisplay.tsx`), so test every icon at 20 px and 16 px next to its neighbours, and give each resource one **distinct silhouette and one distinct dominant colour** (the 16 px relic row in `FCPYjh.jpg` shows the level of simplification that survives).
- Cover the **whole ladder**, not only what is in the game now. Plan the assets for all of these, even though only some will be implemented soon:

| Tier | Resources | Start from |
|---|---|---|
| currency | gold (coin and nugget), gems (the green gem stays), Embers, XP orb | `4YF8Ye.jpg` coins, `6XcbLq.jpg` |
| **T0 base** | wood, stone, coal, food, meat | existing cuts stay as the baseline; `4g66dJ.jpg` rocks and coal, `+6cTJq.jpg` meat |
| **T1 farm** | eggs, milk, hide | `jdix0M.jpg` jars and baskets, `+6cTJq.jpg` hides, `../monsters/yoaPlM.png` eggs |
| **T2 biome goods** | Hardwood, Cloth, Honey, Ichor, War Medals | `ceH18S.jpg` honey and ribbon, `InY+yp.jpg` slime and venom, `4YF8Ye.jpg` coins (medals), draw Hardwood new |
| **T3 extracts (12)** | Herbs, Sap, Iron Ore, Spores, Frostshard, Pearls, Salt, Venom, Dye, Royal Jelly, Corrupted Core, Scrap Steel | `Vim3pB.jpg`, `4g66dJ.jpg` ores and powders, `eaDVgW.jpg`, `6XcbLq.jpg`, `K2qMMX.jpg` shells, `InY+yp.jpg` |
| **T4 relics** | boss relics (crowns, cores, sigils) | `FCPYjh.jpg`, `ArQkEU.jpg` crowns, `4YF8Ye.jpg` crowns |
| Reserved art already in the repo | iron, fish, mana, blue crystal, sapphire, shard, mystery crate | stays as **placeholder T3 icons** until the new set exists |

- **Drops and consumables** (for later, assets only now): **potions** (HP, mana, buffs; use the 48 flasks in `../equip/0tP6Sm.jpg`), **edible items with buffs** (cooked meat, bread, fruit, honey cakes, mushrooms, fish), monster parts (fangs, claws, hearts, eyes, hides), keys, scrolls, trinkets. These are not resources in the registry; they become items ([docs/10](../../docs/10-loot-system.md)) and buff foods later.

## 3. What agents should do with it later

1. **Resource art swap** is its own PR after the registry exists ([docs/19](../../docs/19-first-build-steps.md) step B, RELEASE-PLAN P0.5): one catalog entry per resource carries the icon id, so the swap is data, not code.
2. For each resource: choose the cell(s), **recreate** at 40 px in `scripts/pixel/sprites_resources.py` / `sprites_sheet.py` style (coloured outline, 5-tone ramp, one to three pieces, hard alpha, no shadow, twinkle strip only for gold and crystals). A direct cut is allowed only with a cleared licence (root README) and a clean result; the sheets are **JPG**, so cuts carry noise and normally need a redraw.
3. Test at 20 px and 16 px in the header strip, in a tier group beside the other icons, in light and dark UI. Reject an icon that is confused with another resource (food vs gold was an old problem: carrots, not bread).
4. Keep ids stable: saves store resource keys, not icon ids, but the catalog, tests and docs name them.
5. Plan the **T3 set as 12 icons in one coherent family** (same viewing angle, same highlight), and the **T2 set as 5** with an obvious biome link.
6. Do **not** implement potions, buff foods or monster-part items from here without a design decision; produce the art so it is ready.

## Provenance of anything cut from here

(none yet)
