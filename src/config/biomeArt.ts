import { BIOME_RULES } from './biomeRules';

/**
 * The picture of each rebirth biome: an 80x80 framed landscape vignette (Sprite Fusion, supplied by the owner on 2026-11-10) in `public/pixel/new_assets/biomes/`. Today only the "New land
 * unlocked" window shows them (`RebirthUnlockModal`); the other vignettes of the folder (alternatives, the older biomes and three extras) wait in the asset library, category Biomes.
 * The file name is `biome_<name>.png`; change the value here to use another one.
 *
 * @category Architecture/Art
 * @order 5
 */
export const BIOME_ART: Readonly<Record<string, string>> = {
	jungle: 'biome_jungle_1',
	fields: 'biome_fields_1',
	orchard: 'biome_orchard_1',
	blight: 'biome_blight_1',
	battlefield: 'biome_battlefield_1',
};

/** Served URL of a biome's picture, or undefined when it has none (every biome a rebirth unlocks has one, pinned by tests/ui/biomeArt.test.ts) */
export const biomeArtUrl = (biome: string): string | undefined => (BIOME_ART[biome] ? `/pixel/new_assets/biomes/${BIOME_ART[biome]}.png` : undefined);

/** The rebirth biomes that have a picture (derived so a new rebirth biome without art fails the test, not the screen) */
export const REBIRTH_BIOMES_WITH_ART = Object.keys(BIOME_RULES.unlockAfterRebirths).filter((biome) => BIOME_ART[biome]);
