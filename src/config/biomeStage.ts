/**
 * Which biomes are part of the game today and which exist only for development (the map lab).
 *
 * One shared catalog (`BIOMES`, the palette, the terrain art and `BIOME_CODES`) describes every biome; this table is the only
 * switch. A **dev** biome is drawn and paintable in the map lab, but a purchase never rolls it (`SELECTABLE_BIOMES`), a real
 * save may not contain it (`sanitizeSave`) and the guide does not list it. Its tiles give no resources yet (placeholder `{}`
 * in `BIOMES`; the real outputs are in docs/plan/12-rebirth-biomes.md section 2 and 4).
 *
 * To ship a biome: delete its line here, give it real output in `BIOMES` and its unlock rule in `BIOME_RULES`
 * (docs/plan/12-rebirth-biomes.md section 3). Nothing else changes.
 */
export type BiomeStage = 'live' | 'dev';

/** Biomes that are not live. Not listed = live. */
export const BIOME_STAGE: Readonly<Record<string, BiomeStage>> = {
	jungle: 'dev',
	fields: 'dev',
	orchard: 'dev',
	blight: 'dev',
	battlefield: 'dev',
};

export const biomeStage = (biome: string): BiomeStage => BIOME_STAGE[biome] ?? 'live';
export const isLiveBiome = (biome: string): boolean => biomeStage(biome) === 'live';
