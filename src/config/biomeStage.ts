/**
 * Which biomes are part of the game today and which exist only for development (the map lab). All thirteen are live since IDL-258: the five rebirth biomes
 * (jungle, fields, orchard, blight, battlefield) turn up one per rebirth (`BIOME_RULES.unlockAfterRebirths`). The table is empty; a future biome starts here as `'dev'`.
 *
 * One shared catalog (`BIOMES`, the palette, the terrain art and `BIOME_CODES`) describes every biome; this table is the only
 * switch. A **dev** biome is drawn and paintable in the map lab, but a purchase never rolls it (`SELECTABLE_BIOMES`), a real
 * save may not contain it (`sanitizeSave`) and the guide does not list it. Its tiles give no resources until it ships (placeholder `{}` in `BIOMES`).
 *
 * To ship a biome: delete its line here, give it real output in `BIOMES` and its unlock rule in `BIOME_RULES`. Nothing else changes.
 */
export type BiomeStage = 'live' | 'dev';

/** Biomes that are not live. Not listed = live. */
export const BIOME_STAGE: Readonly<Record<string, BiomeStage>> = {};

export const biomeStage = (biome: string): BiomeStage => BIOME_STAGE[biome] ?? 'live';
export const isLiveBiome = (biome: string): boolean => biomeStage(biome) === 'live';
