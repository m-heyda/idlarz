# monsters/ : monster samples and the roster plan

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first. Context: [docs/plan/20-monster-families-and-rewards.md](../../docs/plan/20-monster-families-and-rewards.md) (families, rewards), [docs/plan/12-rebirth-biomes.md](../../docs/plan/12-rebirth-biomes.md) section 5 (monsters per biome), [docs/plan/22-glossary-and-mastery.md](../../docs/plan/22-glossary-and-mastery.md) (unknown black monsters), [RELEASE-PLAN](../../docs/plan/RELEASE-PLAN.md) P3.

## 1. Files

| File | Contents | Use |
|---|---|---|
| `yoaPlM.png` (2752x1986) | **Yokai Hunters sheet**: 234 objects, hunters, many yokai (kitsune, oni, spiders, ghosts, tengu-like), trees, camp items, small items (food, feathers, eggs, mushrooms) | theme is Japanese folklore, so it fits a few monsters and many **small items** (see `resources/`); licensed, can be cut directly |
| `Pj5W12.jpg` | 48 **imps, demons, slimes, spiders, eyes and beasts** in framed tiles, saturated colours, dark outlines | style and variety reference for Blight/Battlefield families |
| `moqxOO.jpg` | 48 **mushroom, plant, slime, insect and gnome monsters** in framed tiles | style and variety for Jungle, Fields, Orchard, swamp families |
| `AAi1qG.png` (1000x924) | **goblins, orcs, skeletons, wolves, wisps and reapers**, side-view, small | Battlefield and Blight families, undead, boss ideas (tall scythe reapers) |
| `_G4XXB.png` (960x400) | **Pixel Monsters vol. 9** banner: a **bat** in three colourways | colour variants of one body is the cheapest way to build a family |

## 2. What we want

- **Our current rat stays the baseline** (it is nice): 3/4 view, head to the lower left, 2-frame idle, 40x40. Rework it **a little** to sit better next to the new monsters (slightly stronger outline contrast and more saturated accents, like `Pj5W12.jpg`), and **add animation**: a hurt flash, an attack lunge and a short death, in addition to the idle (today `monster_rat` is a 2-frame idle sheet played by `MonsterArt` at 520 ms per frame).
- **A lot of monsters**: **3-4 per biome plus one boss, for all 12 biomes** (the 7 current ones and the 5 planned ones), so the whole art style can be seen and compared early. They ship as **placeholder tinted generic sprites first** ([RELEASE-PLAN](../../docs/plan/RELEASE-PLAN.md) P3.2) and are replaced by the real sprites one family at a time.
- **Sizes**: for the first release phase **every monster almost fits one tile** (about 40-48 px, the boss up to 56 px as the plains boss is today). Bigger monsters are allowed as long as they do not go much off the tile. **Idea for later (not decided, needs a map and placement feature):** end-game bosses on **2x2 tiles** with a double-size sprite. Design the large boss sprites at 96x96 if they are made now, but do not build a 2x2 occupancy rule without a decision.
- **Readable silhouettes**: a monster must read as a black shape too (unknown monsters are drawn as the real sprite in black, [docs/plan/22-glossary-and-mastery.md](../../docs/plan/22-glossary-and-mastery.md)), so avoid sprites that are only distinguishable by colour.

## 3. Roster plan (names are placeholders; bases are the reference cells to start from)

| Biome | 3-4 monsters | Boss | Start from |
|---|---|---|---|
| Plains | rat (existing), field mouse swarm, wild boar, crow | The Great Auroch (plains boss) | our own rat sprite, `moqxOO.jpg` bottom rows (boar, rodents, goose) |
| Forest | wolf, giant spider, forest sprite, bear | Alpha Wolf | `Pj5W12.jpg` spiders; the wolf is drawn new from the rat body kit |
| Hills | rock lizard, goblin raider, stone golem, hill troll | Hill Giant | `AAi1qG.png` goblins/orcs; the golem is drawn new |
| Swamp | bog thing (slime), giant toad, leech swarm, will-o-wisp | Bog Hydra | `moqxOO.jpg` slimes, toad row |
| Tundra | frost hare, white wolf, ice wisp, snow yeti | Frost Wyrm | `AAi1qG.png` white wolf, wisps |
| Lake | giant crab, water snake, drowned ghost, pike | Lake Serpent | draw new (closest cells in `Pj5W12.jpg` and `moqxOO.jpg`) |
| Coast | sand crab, gull flock, sea snail, pirate skeleton | Kraken spawn | draw new |
| Jungle (rebirth 1) | jaguar, giant spider, viper, poison toad | Jungle Mantis King | `Pj5W12.jpg`, `moqxOO.jpg` mantis and plants |
| Fields (2) | crow flock, scarecrow, field boar, pumpkin sprite | Harvest Horror | `moqxOO.jpg` pumpkins and gnome, `yoaPlM.png` scarecrow |
| Blossom Orchard (3) | hornet swarm, bear, thorn dryad, mushroom hag | Queen Hornet | `moqxOO.jpg` mushrooms and wasp |
| Blight (4, special) | slime, blob swarm, eye cluster, tendril husk | The Maw | `Pj5W12.jpg` slimes and eyes, `../biomes/ixzlDW.jpg` eye blobs |
| Battlefield (5, special) | skeleton soldier, deserter, siege remnant, war hound | Bone Warlord | `AAi1qG.png` skeletons, `../biomes/AEcKbU.jpg` bones, reaper silhouettes |

Existing home-land families in the plan ([docs/plan/12-rebirth-biomes.md](../../docs/plan/12-rebirth-biomes.md) section 5): wolf (forest), bog thing (swamp), frost hare (tundra). The two special biomes get the most detailed monsters and bosses.

## 4. What agents should do with it later

1. **P3 (monster engine)**: ship the stats with the **generic placeholder** sprite (`monster_generic`, tinted per family by a CSS variable). Do not wait for art.
2. **Art pass per family**: pick the base cells from the table, then **recreate** the monster in `scripts/pixel/sprites_monsters.py` style (3/4 view, head to the lower left, the shared fur or skin ramps, 1 px coloured outline, 40x40, one signature feature each). Include the idle frames and the new hurt, attack and death frames; store each as a sheet like `monster_rat`. Direct cuts are allowed (everything here is licensed, see the [Licence](../README.md#licence)); redraw only when the pixel density or style does not match.
3. **Colour variants are a family tool**: the bat banner (`_G4XXB.png`) shows one body in three colourways. Use that for a family's lower and higher level variants (a lucky variant keeps the golden tint decided by the server).
4. Rework the **current rat** once: contrast pass and the extra animation frames, keeping the same body so it does not look like a different monster. Update the fight modal (`MonsterArt` 3-5x) and the map tile.
5. Keep bosses at 56 px (or 96 px if prepared for the 2x2 idea) and give each its own silhouette; **do not add 2x2 placement** without an owner decision.
6. Update `docs/generated/item-catalog.md`-style generated docs only through the existing scripts; do not hand-edit generated files.

## Provenance of anything cut from here

(none yet)
