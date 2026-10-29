# buildings/ : how detailed the biome buildings should look

**Reference material. Nothing here is imported by the game.** Read [../README.md](../README.md) first.

## Files

| File | Contents | Notes |
|---|---|---|
| `f33ile.jpg` (3079x2053, dark background) | **21 medieval and gothic buildings** in a 3/4 view on a small grass base: smithy, forge with fire, forest hut between pines, castles with red or grey spires, graveyard plots, churches and chapels, timber houses, a golden-roofed manor, a mossy leaf-roof hut, a library, a candy-roof cottage, a stone tower with a glass dome, a barn-like workshop, stone cottages | the main **detail and mood** reference: stonework, timber framing, roof shingles, small props at the door (barrels, cauldrons, anvils), warm window light |
| `Screenshot 2026-10-29 0341562.png` (1200x800) | a **watermarked sample** ("SAMPLE - EMBER SPROUT") of a building kit: two timber-framed houses with blue and green roofs, a tree, bushes, props and furniture | **reference only, never ship** (watermark); useful for roof tiling, window glow, stone base and how a kit splits into pieces |

## What we want from them

- Buildings with **more detail than the current 48x60 town sprites** (`scripts/pixel/reference/town.png`): visible materials (stone courses, planks, shingles), 1-2 small props at the door, a lit window or fire, an identity you can read at a glance in a 48 px tile.
- Drawn in **our** pixel style and palette so they sit on our tiles: coloured 1 px outline, 5-tone ramp lit from the top left, hard alpha, **no ground shadow and no grass base disc** (the sheets draw a base; our tile provides the ground).
- **A building may go off the tile a little**: canvas **56x68** (the current 48x60 plus about 4 px each side and 8 px up), anchored bottom-centre on the tile. Anything taller than the canvas (a spire, a chimney, a tree crown) is cropped or redesigned, not enlarged.
- Two looks per building (level 1-2 and level 3-5) and a glow on level 5 ([docs/18](../../docs/18-biome-buildings-and-material-tiers.md) section 9). Interior and furniture pieces in the kit sample are **not** needed.

## Mapping: which reference suits which of the 36 buildings

Use as a starting point; the choice of the final look is made per biome release.

| Archetype | Buildings (doc 18) | Take from `f33ile.jpg` |
|---|---|---|
| Smithy, forge, workshop | Quarry, Deep Mine, Salvage Yard, Siege Works, Salt Works | row 1 col 1-2, row 4 col 3 (anvil, forge fire, stone and timber) |
| Wooden hut, camp | Lumberyard, Logging Camp, Sap Tapper, Hen Barn, Dairy Barn, Granary | row 1 col 3 (hut between pines), row 2 col 6 (leaf roof), row 4 col 6 (timber barn) |
| Manor, treasury, market | Harbor, Apiary (golden roof), Dye Works, Fishery | row 2 col 5 (golden), row 3 col 2 (golden thatch) |
| Stone hall, library | Herb Garden, Spore Cellar, Pearl Diver, Ice Cutter | row 3 col 3 (library), row 4 col 5-6 (stone cottages) |
| Towers and observatory | Tar Pit, Ooze Vat, Frost Obelisk, Lighthouse | row 4 col 1 (dome tower) |
| Shrines and monuments (Idols) | all Idols | row 1 col 6, row 2 col 1 (graveyard monument plots), row 3 col 6 (skull chapel) for the Blight Idol |

Biome rules: Idols are statues, totems and shrines (small footprint, monument look), Producers are working buildings, Extractors are tools-and-pit buildings. Blight and Battlefield buildings (special biomes) get the richest treatment: glow from level 3.

## What agents should do with it later

1. Before drawing a building, read the biome's three entries in [docs/18](../../docs/18-biome-buildings-and-material-tiers.md) section 3 and pick the archetype row above.
2. Draw it in `scripts/pixel/sprites_buildings.py` style (procedural, the shared body kits and materials), 56x68 canvas, and add it to the build manifest; the 16 old sprites stay as **placeholders** until each building's real sprite is registered (RELEASE-PLAN P6.3, P6.9).
3. Do not cut from these sheets (grass base, different density, a watermark on one). Use them for proportions, roof and window treatment, and the amount of small props.
4. Check each building next to its biome's ground at 1x in the map before approving.

## Provenance of anything cut from here

(none yet)
