/**
 * The picture behind the monster in the combat window: one wide pixel-art landscape (1200x400, `public/pixel/ui/combat/combat_<biome>.webp`, made in Gemini from the
 * biome prompts) per biome, chosen by the biome the monster lives in (`biomeOfType`). A biome without a picture keeps the plain dark stage.
 *
 * The picture is drawn `zoom` times as wide as the stage and drifts slowly from one side to the other and back (`panSec` for the whole trip) for a parallax feel; a black
 * layer of `dim` opacity (`dimDead` once the monster is dead, so the loot reads) keeps the monster and its bar clear. `prefers-reduced-motion` stops the drift.
 * The values reach the stylesheet as CSS variables set by `CombatPanel`.
 *
 * `lava` is the planned land after the battlefield (IDL-371): its picture is ready, no monster lives there yet.
 *
 * @category Architecture/Art
 * @order 6
 */
export const COMBAT_BACKGROUND_STYLE = {
	/** Opacity of the black layer over the picture while the monster fights */
	dim: 0.25,
	/** The same once the monster lies dead */
	dimDead: 0.4,
	/** Seconds for the picture to drift to one side and back */
	panSec: 70,
	/** How much wider than the stage the picture is drawn (the room it has to drift in) */
	zoom: 1.3,
} as const;

/** Biome -> picture file name (without folder and extension) */
export const COMBAT_BACKGROUNDS: Readonly<Record<string, string>> = {
	plains: 'combat_plains',
	forest: 'combat_forest',
	hills: 'combat_hills',
	swamp: 'combat_swamp',
	tundra: 'combat_tundra',
	lake: 'combat_lake',
	coast: 'combat_coast',
	jungle: 'combat_jungle',
	fields: 'combat_fields',
	orchard: 'combat_orchard',
	blight: 'combat_blight',
	battlefield: 'combat_battlefield',
	lava: 'combat_lava',
};

/** Served URL of a biome's combat picture, or undefined when it has none */
export const combatBackgroundUrl = (biome: string | undefined): string | undefined =>
	biome && COMBAT_BACKGROUNDS[biome] ? `/pixel/ui/combat/${COMBAT_BACKGROUNDS[biome]}.webp` : undefined;
