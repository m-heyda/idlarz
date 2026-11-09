# buildings (150 files, 52x52)

`medieval-buildings-pixel-art-pack (1..150).png`: 150 top-down medieval buildings on a transparent 52x52 canvas, numbered, no names. Houses with red, green and brown roofs, windmills, watchtowers, castles, gatehouses, churches, market stalls (striped awnings), blacksmiths with a chimney, tents, wells, lighthouses, mine entrances, wooden palisade forts, bridges.

Pack name: not recorded (taken from the file names). Licence: free to use (confirmed by the owner, 2026-11-09).

**Use for**

- R7 biome buildings (`docs/plan/18-biome-buildings-and-material-tiers.md`): three buildings per biome (Producer, Extractor, Idol) with levels; the tower, wall and castle pieces can show the higher levels.
- Village decor around the castle, the farm window scene, minimap landmarks.
- 52 px does not divide the 48 px tile: re-render at 2x (104) or crop and place by feet position, keeping nearest-neighbour scaling.

**Assessment:** the largest consistent building set, with many recolours of the same shapes. Pick about 30 distinct ones, name them, and recolour per biome palette (`scripts/pixel/palette_swap.py` does the same for item art).
