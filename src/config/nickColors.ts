// The colours a player can give their nickname. A leaf module: pure data, imported by the server (`catalog/badges.ts`) and by every window that draws a name.

/** One nickname colour: the stored id, the label of the swatch and the CSS colour. */
export interface NickColor {
	id: string;
	name: string;
	hex: string;
}

/**
 * The fourteen plain colours of the picker, in the order the swatches are drawn (by hue). Bought once for the whole account in the Gem shop ("Name colours", `NICK_COLORS_ITEM`); stored on `profiles.name_color`.
 * The animated **Rainbow** (`NICK_RAINBOW`) is a separate purchase (`NICK_RAINBOW_ITEM`) and the gold nickname with stars (`NICK_GOLD`) is for admin accounts only.
 *
 * @category Progression/Badges
 * @order 2
 */
export const NICK_COLORS: readonly NickColor[] = [
	{ id: 'crimson', name: 'Crimson', hex: '#e5534b' },
	{ id: 'orange', name: 'Orange', hex: '#f0883e' },
	{ id: 'lemon', name: 'Lemon', hex: '#e8e46a' },
	{ id: 'lime', name: 'Lime', hex: '#8fd14f' },
	{ id: 'green', name: 'Green', hex: '#3fb950' },
	{ id: 'mint', name: 'Mint', hex: '#7ee8b0' },
	{ id: 'teal', name: 'Teal', hex: '#2dd4bf' },
	{ id: 'sky', name: 'Sky', hex: '#56b6f7' },
	{ id: 'blue', name: 'Blue', hex: '#4f8df5' },
	{ id: 'indigo', name: 'Indigo', hex: '#6c63ff' },
	{ id: 'violet', name: 'Violet', hex: '#a371f7' },
	{ id: 'magenta', name: 'Magenta', hex: '#e05fd0' },
	{ id: 'rose', name: 'Rose', hex: '#ff8fab' },
	{ id: 'silver', name: 'Silver', hex: '#e6edf3' },
];

/** The stored id of the special gold nickname with glowing stars: for admin accounts only (`profiles.is_admin`), never for sale. */
export const NICK_GOLD = 'gold';

/** The stored id of the animated rainbow nickname (the first of the {@link NICK_EFFECTS}). */
export const NICK_RAINBOW = 'rainbow';

/** The gem shop item that unlocks the plain colours (all fourteen) for the account. */
export const NICK_COLORS_ITEM = 'name_colors';

/** One animated nickname effect: the stored id (it is also the `NickName` colour value), the label, the gem shop item that unlocks it and a line about it. */
export interface NickEffect {
	id: string;
	name: string;
	/** The one-time gem shop item (`GEM_SHOP`, 500 gems each) */
	item: string;
	blurb: string;
}

/**
 * The animated nickname effects, each a separate one-time purchase of 500 gems in the Gem shop (or straight from the name window): Rainbow, Aurora, Ember, Frost and Void. None looks like the gold admin nickname (no gold, no stars).
 * Stored on `profiles.name_color` like a plain colour; the look of each is the `.ds-nick-<id>` class of the design system.
 *
 * @category Progression/Badges
 * @order 3
 */
export const NICK_EFFECTS: readonly NickEffect[] = [
	{ id: 'rainbow', name: 'Rainbow', item: 'name_rainbow', blurb: 'Shifts slowly through every colour.' },
	{ id: 'aurora', name: 'Aurora', item: 'name_aurora', blurb: 'Northern lights drifting green, blue and violet.' },
	{ id: 'ember', name: 'Ember', item: 'name_ember', blurb: 'A glowing coal that flickers from yellow to red.' },
	{ id: 'frost', name: 'Frost', item: 'name_frost', blurb: 'Icy white and blue with a glint that sweeps across.' },
	{ id: 'void', name: 'Void', item: 'name_void', blurb: 'A pale violet name breathing out a dark purple glow.' },
];

export const nickEffectById = (id: unknown): NickEffect | null => NICK_EFFECTS.find((effect) => effect.id === id) ?? null;

export const nickColorById = (id: unknown): NickColor | null => NICK_COLORS.find((color) => color.id === id) ?? null;

/** The value `NickName` takes for a stored id: the CSS colour, `gold` or the id of an animated effect, or undefined for the default colour. */
export const nickColorValue = (id: string | null | undefined): string | undefined =>
	id === NICK_GOLD || nickEffectById(id) ? (id as string) : nickColorById(id)?.hex;

/** Whether `id` is a colour that can be stored at all: one of the fourteen, an effect or gold. */
export const isNickColorId = (id: unknown): id is string => id === NICK_GOLD || nickEffectById(id) !== null || nickColorById(id) !== null;

/** Dark or light text for a swatch of this colour, whichever reads better on it. */
export const inkOn = (hex: string): string => {
	const n = parseInt(hex.slice(1), 16);
	const luma = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
	return luma > 150 ? '#1a1208' : '#ffffff';
};
