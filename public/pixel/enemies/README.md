# Enemies (hand-supplied monster art)

Generated monster images live here, **not** produced by `scripts/pixel/build.py` (it only rewrites and prunes `icons/`, `ui/`, `bg/` and `terrain/`, so a rebuild never touches this folder).

Layout: `public/pixel/enemies/<biome>/<monster-id>.png`, one folder per biome, bosses included.

- `<biome>`: lower-case `BIOMES` key (`plains forest hills swamp tundra coast lake`, later `jungle fields orchard blight battlefield`).
- `<monster-id>`: kebab-case of the catalog id in `src/catalog/monsters.ts` (`garbageOgre` -> `garbage-ogre`). Bosses start with `boss-` (`boss-mire-matriarch`).
- PNG, transparent background, one creature, full body, original generated size (about 64 px).
- Frames for a later animation: `<monster-id>@2.png`, `@3.png`.

The roster and its `enabled` flag are in `src/catalog/monsters.ts`; `tests/monsterCatalog.test.ts` checks that every entry marked `art: true` has its file here.

On-map size: `src/config/monsterArtSize.ts` (px per monster id, with a default per grade). `MonsterSprite` reads it for any monster with `art` set, so when a monster is enabled (docs/20) its in-game sprite should pass `art: <catalog id>` and keeps the size tuned in the map lab.
