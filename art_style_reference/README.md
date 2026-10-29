# art_style_reference

Drop sample images here. They are the visual brief for new art: resources, buildings, biomes, monsters, roads, portraits and the landing page. New assets are recreated in the procedural pixel pipeline (`scripts/pixel/`) so they match the map. Which assets are needed and when: [docs/RELEASE-PLAN.md](../docs/RELEASE-PLAN.md) section 6.

Already-approved references live in `scripts/pixel/reference/` (read `STYLE.md` there first). Do not duplicate them here.

## Folders

| Folder | Put here | Needed for |
|---|---|---|
| `resources/` | ores, ingots, goods, herbs, relics: anything that looks like the item you want | 5 T2 materials (Hardwood, Cloth, Honey, Ichor, War Medals), 12 T3 extracts, T4 relics |
| `buildings/` | buildings in the style you want matched (one per biome flavour is plenty) | 36 buildings, 3 per biome, two looks each |
| `roads/` | paths, causeways, bridges, tracks | about 10 road sets |
| `biomes/` | mood images of ground, props and critters for the new biomes | Jungle, Fields, Blossom Orchard, Blight, Battlefield |
| `monsters/` | creature samples, bosses | families per biome |
| `ui-and-portraits/` | avatar and portrait samples | 8 starter avatars and unlockables |
| `landing/` | landing page and title-lettering inspiration | landing v1 and v2 |

## Naming

`<what>-<note>.png`, for example `serpent-pit-dark-wood.png` or `blight-ground-mood.png`. Add a `.txt` of the same name if you want to say what to copy (palette, silhouette, mood) and what not to copy.

## Rules the new art must follow

- The **seven existing biomes stay unchanged**. New buildings and resources must look like they belong on the current map.
- Terrain tiles are 48 px; buildings 48x60, transparent, no ground; resource icons 40 px; coloured 1 px outline (never pure black); 5-tone ramp lit from the top left; no ground shadows; integer scaling only.
- The **last two biomes (Blight, Battlefield) are the special ones**: richer than the rest (extra animated layer, deeper interior tier, two building pad variants, glowing level 3+ buildings) but built from the same palette discipline. Upload the references you like best for them.
- PNG with transparency preferred. A reference does not have to be pixel art; say in the note what to take from it.
