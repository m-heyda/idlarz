# 12 · Rebirth biomes: what is left (the rules are built; art, `discovered` and the checks are open)

Five biomes, one unlocked per rebirth (1 to 5): jungle, fields, orchard, blight, battlefield. Reviewed against the code on 2026-11-26; everything built was removed from this file.

**Built** (the code and its JSDoc are the record: `BIOME_RULES` in `src/config/biomeRules.ts` and the `@category Economy/Biomes` block of `src/utils/biomeRules.ts`; `src/config/biomeStage.ts`; `BIOME_CODES` in `src/lib/saveFormat.ts`; `src/catalog/monsters.ts`; `src/catalog/buildings.ts`):

- All thirteen biomes are live (IDL-258). Each of the five turns up from its rebirth (`unlockAfterRebirths` 1 to 5) and not nearer than its minimum castle distance (jungle 10, fields 14, orchard 18, blight 22, battlefield 22; `minCastleDistance`), with a weight that ramps up over eight tiles beyond it (`distanceWeights`). The never-adjacent pairs, the cluster-copy chances and the biome letters `j d o b w` (frozen) are in the same config.
- The map and its biomes reset on every rebirth, always; discovery would be the only thing that persists (see below).
- Every rebirth biome has monsters (the rosters are in `src/catalog/monsters.ts`) and a Producer and an Extractor with their own extract (Canopy Camp and Venom Press, Windmill Farmstead and Dye Works, Blossom Yard and Royal Apiary, and so on, built in 0.9.0).
- **The T2 goods of the old draft are gone** (decided 2026-11-24, IDL-107 and IDL-109 closed): Hardwood, Cloth and Honey were dropped and the extracts replace the T2 tier; the merchant sells T0 and T1 only (he does buy the home biomes' T3 extracts from the player and never sells them back, `MERCHANT_BUYABLE` in `src/config/merchant.ts`). Ichor (Blight) and War Medals (Battlefield) stay crafting-only goods and belong to IDL-110.
- **There is no global "+12 distance offset" in the code.** The old draft proposed one and IDL-90 and IDL-127 still talk about it; the base minimums above are what is live. Whether they should be raised is the calibration question below.

## What is open

1. **Art per biome** (Linear, in progress): jungle IDL-106, fields and orchard IDL-108, blight and battlefield IDL-110. Each needs a ground texture (flat plus one deeper interior tier), a rim set against every neighbour, props, decor, two building pad variants, two or three ambient critters, a minimap colour, a highlight colour and its material icons; follow `scripts/pixel/reference/STYLE.md`. Briefs as approved in the map lab: **Jungle** teal rainforest with rivers, palms, bamboo, banyans and exotic flowers (critters: parrot, monkey, a snake); **Fields** a patchwork of farm plots with scarecrows, haystacks, a broken fence, ravens; **Orchard** seven blossom tree shapes in five colours, hives, bees, butterflies, drifting petals; **Blight** a violet spore wasteland (giant mushrooms, amethyst crystals, brambles, tentacles, pods, tiny slimes) with sickly green pools; **Battlefield** churned mud and ash, broken weapons, banners, bone piles, scorch marks, crows. Pipeline touch list per biome: `terrain_art.py`, `terrain_logic.py`, `terrain_props.py`, `terrain_build.py`, `utils/terrain.ts` (parity test), `biomePalette.ts`, `AMBIENT_LIFE.byBiome`, `pixelIcons.ts`. New pictures follow the Sprite Fusion rule in `CLAUDE.md`.
2. **`discovered: string[]`** optional in the save core with a legal-by-map server check (a biome letter present in the land makes it legal); discovery survives rebirth and unlocks the header slot and the Guide entry. Critical path of the Guide work. IDL-87.
3. **Checks in `verify.ts`**, shadow flags first: `biome_locked` (a tile whose biome needs more rebirths than the ledger's) and `biome_too_near` (a gated biome closer than its minimum). Both are O(tiles) over data the server already reads. IDL-89.
4. **Beelining rule (decided, not built):** a gated biome only rolls on a tile with at least **two owned neighbours** (4-neighbourhood), which stops one-tile tunnels outward (`biomeVerdicts` has no such rule today). Watch the sim; a distance toll on the tile price stays an option. No ticket yet: take it with IDL-90.
5. **Calibration** of the minimum distances with a rebirth-aware expansion pattern in the sim (how far a `human-rebirth6` run reaches by rebirth 5); the base values live, 10/14/18/22/22, are the starting point. IDL-90. IDL-127 ("drop the offset") is moot because the offset does not exist.
6. **Guide and glossary entries** for the biomes and their monsters (a Biomes page, a line in the Rebirth dialog: "Rebirth 2 unlocks Fields"), kept as data in `catalog/`. Part of the glossary work (IDL-83).
7. **Monsters per biome and spawn pressure:** the families template, the per-band spawn tables and the bosses are in [20](20-monster-families-and-rewards.md).

## Decisions that still stand

- Third biome: Blossom Orchard (milk, Royal Jelly); material names are fixed, Blight's is Blight Ichor (key `ichor`).
- Rosters are 3 monsters and a boss for jungle, fields and orchard, 4 and a boss for blight and battlefield (IDL-105).
- Every rebirth-biome tile gives its main T0 output or gold at 0.3/s and its T1 product at 0.1/s, nothing growing per rebirth; the Extractor gives its T3 extract at 0.3/s at level 1. The extract sinks are sized in hours of production at a reference map of 40 biome tiles (2 to 12 h, the top craft and enchant 1 to 3 days), checked by a sim table (IDL-199).
- The castle's area bonus (radius up to 4) never reaches these biomes (they start 10+ tiles out); see [18](18-biome-buildings-and-material-tiers.md) for the position bonus that would.

## Still to settle

1. Whether the base minimum distances stay as they are or move once expedition play exists (item 5).
2. The basic-output rates of each new biome (gold, hide, eggs, milk, coal, stone, wood) next to its extract rate: set with the sim and the "minutes to cover" check.
3. For the art, not the rules: which neighbouring biomes make a natural transition for each (a beach for the jungle, a farm fringe for fields).
