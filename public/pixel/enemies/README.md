# Enemies (hand-supplied monster art)

Generated monster images go here, **not** produced by `scripts/pixel/build.py` (it only rewrites and prunes `icons/`, `ui/`, `bg/` and `terrain/`, so nothing in this folder is ever deleted by a rebuild).

Drop new images straight into this folder (flat, named after the monster in `docs/monster-art-prompts.md`); they get sorted into the layout below afterwards.

Target layout: `public/pixel/enemies/<biome>/<monster-id>.png`, one folder per biome, bosses included.

- `<biome>`: `plains forest hills swamp tundra coast lake jungle fields orchard blight battlefield` (lower case, the `BIOMES` keys).
- `<monster-id>`: lower-case kebab-case of the monster name from `docs/monster-art-prompts.md`, e.g. `garbage-ogre`, `dumpback`, `rot-heron`. Bosses get a `boss-` prefix: `boss-mire-matriarch`.
- Format: PNG with a transparent background, one creature, full body, centered. Keep the original generated size; do not downscale by hand.
- Later animation frames (if any) use `<monster-id>@2.png`, `@3.png`.
