# biomes/ : detail reference for the new biomes (not a skeleton to copy)

**This is reference material to base art on. Nothing here is imported by the game.** Read [../README.md](../README.md) for the rules first.

## Files

| File | Contents | Useful for |
|---|---|---|
| `AEcKbU.jpg` (1800x1200, flat grey-green background) | a **graveyard and bone set**: a giant crowned skeleton, scattered bones, ribcages, a skull pile with thorns, a horned skull, a bird skull, dead white trees with red thorn vines, zombie hands rising from the ground (4 skin tones), a skull-topped mausoleum in 3 sizes, 17 tombstones, three big dead black trees with green drips | **Battlefield** (bones, skulls, tombstones, bone piles, ribcages, broken ground) and a boss lair; **Blight** (dead trees, thorn vines, hands from the ground, green drips) |
| `ixzlDW.jpg` (1800x1200, same background) | a **flesh-and-vein set**: veined rocks in grey, brown and black (5 sizes each), stone circles and arches with red roots, big dark root trees with red veins, bone fragments with roots, **blob clusters covered in small eyes** (5 sizes) | **Blight**: ground props, pulsing eye-blob props, root "tendrils" at the biome rim, rock clusters |

## What we want from them

- **Only details.** Use individual props and the *idea* (veins crawling over rocks, eyes in blobs, thorny vines on bones). **Do not use the big crowned skeleton** as a map piece (it is far larger than a tile; it may become a boss-lair or a Glossary illustration later, decided separately).
- **The map keeps its current style.** The terrain of Blight and Battlefield is made by the existing dual-grid pipeline (`terrain_art.py`, `terrain_logic.py`, `terrain_props.py`) and must look like the seven current biomes. The reference props are drawn at a higher pixel density and with a soft drop shadow; our props have no ground shadows and use the 48 px tile scale.
- **These two biomes are the "special" last ones** (RELEASE-PLAN P12): richer than the others (an extra animated layer such as pulsing veins or drifting ash, a deeper interior tier, two building pad variants, glowing level 3+ buildings), but the same palette discipline.

## What agents should do with it later

1. When the Blight and Battlefield releases start (P12), open both sheets and make a **prop list** per biome: Blight = veined rocks (3 sizes), eye blobs (3 sizes), root tendrils (rim pieces), dead trees (2), thorn vines; Battlefield = bone piles, skulls, ribcage, tombstones (4), broken weapons and banners (not in these sheets: draw new), scorch marks. Pick the props by silhouette, 24-48 px wide on our scale.
2. **Redraw** each chosen prop in `scripts/pixel/terrain_props.py` style (coloured 1 px outline, 5-tone ramp lit from the top left). A clean direct cut (rule 1 of the root README) is possible only after the licence is cleared; the soft shadow under each prop must be removed.
3. Add the props to the biome's manifest (`terrain_build.py`), the TypeScript port (`utils/terrain.ts`, the parity test must pass) and `biomePalette.ts`. Pick the ground colours **from the current map**, not from these sheets: Blight is violet-black with sickly green pools, Battlefield is churned mud and ash ([docs/12](../../docs/12-rebirth-biomes.md) section 2.2).
4. Keep an unknown-state in mind ([docs/22](../../docs/22-glossary-and-mastery.md)): props must read as dark shapes too.
5. Do not touch the seven existing biomes (forest, plains, hills, swamp, tundra, lake, coast). They stay unchanged.

## Provenance of anything cut from here

(none yet; add one line per cut: file, region, output name, who confirmed the licence)
