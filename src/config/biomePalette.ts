/**
 * One colour per biome, the single place for them: the flat colours the terrain shows before its textures load, the dots
 * of the minimap, and (as `HIGHLIGHT_COLORS`) the tint a biome area gets when it is highlighted. The map colours are the
 * average look of each ground in the art (terrainRenderer.ts draws them as the fallback), so the minimap reads like the map.
 */
export const BIOME_COLORS: Readonly<Record<string, string>> = {
	empty: '#1a1a1a',
	castle: '#6045a0',
	forest: '#317433',
	plains: '#65a540',
	hills: '#709046',
	swamp: '#6c6b33',
	tundra: '#e3edf7',
	lake: '#35a6d8',
	coast: '#dcc791',
	// dev-only biomes (config/biomeStage.ts): the average look of each ground
	jungle: '#195f52',
	fields: '#d8b84e',
	orchard: '#88c850',
	blight: '#523070',
	battlefield: '#725f4a',
};

/** The unexplored ring next to explored land, (a terrain ground that is no biome). */
export const MIST_COLOR = '#112248';
export const YARD_COLOR = '#928068';

/**
 * Tints for highlighting an area: brighter and more saturated than the ground they lie on (a forest-green tint on a
 * forest would not show), one clearly different hue per biome.
 */
export const HIGHLIGHT_COLORS: Readonly<Record<string, string>> = {
	forest: '#2dff9a',
	plains: '#d4ff3a',
	hills: '#ffe14d',
	swamp: '#e0d23a',
	tundra: '#6fd8ff',
	lake: '#ff7ae0',
	coast: '#ff5a3c',
	jungle: '#00ffd0',
	fields: '#3a6cff',
	orchard: '#ff70c0',
	blight: '#c050ff',
	battlefield: '#ff3030',
};

const FALLBACK_HIGHLIGHT = '#ffffff';

/** The map colour of a biome (a neutral grey for anything unknown). */
export const biomeColor = (biome: string): string => BIOME_COLORS[biome] ?? '#555555';

/** The highlight tint of a biome. */
export const highlightColor = (biome: string): string => HIGHLIGHT_COLORS[biome] ?? FALLBACK_HIGHLIGHT;
