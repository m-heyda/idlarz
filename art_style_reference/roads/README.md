# roads/ : road materials, blending, and bridges

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first. Context: roads connect a Producer or Extractor to the castle for +100 % production ([docs/18](../../docs/18-biome-buildings-and-material-tiers.md) section 5.2, RELEASE-PLAN P6.8).

## 1. Files

| File | Contents | Use |
|---|---|---|
| `Path-and-Road-Top-Down-Tileset-Pixel-Art.jpg` (1800x1200) | "Road tiles pixel art": **six road materials** as vertical strips on grass: blue-grey cobble, dark brown dirt, yellow flagstone, grey gravel, pale cream cobble, with grass-edge and ground transitions | the **material and edge treatment** to match per biome |
| `Path-and-Road-Top-Down-Tileset-Pixel-Art5-720x480.webp` | a **sample map**: the same roads as networks (corners, T-junctions, crossings, dead ends) winding over different ground colours (green, olive, teal, sand, orange) | how a road **blends into each ground**; what the autotile set must cover |
| `daCBUQ.jpg` (1800x1200) | "Top-down bridges": about 20 **bridges** (rope bridges, arched stone bridges, plank bridges, wooden and stone short spans, a rope ladder), horizontal and vertical | lake and swamp crossings |

## 2. What we want

- Variety of roads **per biome**, built so they **match our current map art style** (48 px tiles, the dual-grid look): the road is an **overlay above the ground**, an environment piece that must stay clearly visible but is not a building. Match our edge language: the road keeps the colours of its own material and a short blend where it meets the ground.
- A **4-neighbour autotile** per road (16 variants plus end caps and a small entrance stub toward a building), plus bridge pieces for lakes and a plank causeway for swamp and jungle.
- Planned set per ground family, from [docs/18](../../docs/18-biome-buildings-and-material-tiers.md): packed dirt path (plains, fields, orchard, forest), cobble (coast, castle area), stone causeway (hills), **snow-packed road with sled ruts (tundra)**, **plank causeway on stilts (swamp, jungle)**, **wooden or stone bridge (lakes)**, bone-and-ash track (Blight), trampled mud with wheel ruts (Battlefield).

## 3. Mapping from the references

| Our road | Base on |
|---|---|
| dirt path | the dark brown strip |
| cobble | the blue-grey and pale cream strips |
| stone causeway | the grey gravel strip |
| tundra snow road | the pale cream strip recoloured to white with blue ruts (new) |
| swamp and jungle causeway | the plank and rope bridges of `daCBUQ.jpg` laid as a straight road (new, on stilts) |
| lake bridge | the arched stone and wooden plank bridges of `daCBUQ.jpg` |
| Blight and Battlefield roads | draw new from the biome palettes, with the same edge rules |

## 4. What agents should do with it later

1. Build roads in the pixel pipeline as **overlays** (`terrain_props.py` style, no dual grid), one set per ground family, and a connected-road glow by the game (not baked).
2. Do **not** copy the tiles: they are a different tile size and a flat shaded look. Take the **materials, the edge softness and the junction coverage** from the references, then draw at 48 px with our outline and ramp rules.
3. Verify each set on **all neighbouring biomes** (a road crossing from plains into forest must still read), and next to the castle area.
4. Include end caps and the entrance stub toward buildings, the corner-with-bridge case, and a bridge over lake tiles.
5. Cost, multipliers and the build UI are design items in docs/18 and are not decided here.

## Provenance of anything cut from here

(none yet)
