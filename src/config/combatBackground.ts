/**
 * The picture behind the monster in the combat window: one wide pixel-art landscape (1200x400, `public/pixel/ui/combat/combat_<biome>.webp`, made in Gemini from the
 * biome prompts) per biome, chosen by the biome the monster lives in (`biomeOfType`). A biome without a picture keeps the plain dark stage.
 *
 * The picture fills the scene at the top of the combat window (the header on a blurred dark glass, then the stage); the bars, potions and switches below sit on a dark panel.
 * It is drawn `zoom` times as wide as the scene and glides slowly from one side to the other and back (`panSec` for the whole trip, eased so it never jerks);
 * a black layer of `dim` opacity (`dimDead` once the monster is dead, so the loot reads) keeps the monster and the text clear. `prefers-reduced-motion` stops the glide.
 * The values reach the stylesheet as CSS variables set by `CombatPanel`.
 *
 * `lava` is the planned land after the battlefield (IDL-371): its picture is ready, no monster lives there yet.
 *
 * @category Architecture/Art
 * @order 6
 */
export const COMBAT_BACKGROUND_STYLE = {
	/** Opacity of the black layer over the picture while the monster fights */
	dim: 0.4,
	/** The same once the monster lies dead */
	dimDead: 0.55,
	/** Seconds for the picture to glide to one side and back (long enough to stay calm, short enough to be seen) */
	panSec: 45,
	/** How much wider than the scene the picture is drawn (the room it has to glide in) */
	zoom: 1.4,
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
