// The colours a player can give their nickname (IDL: name colour). A leaf module: pure data, imported by the server (`catalog/badges.ts`) and by every window that draws a name.

/** One nickname colour: the stored id, the label of the swatch and the CSS colour. */
export interface NickColor {
	id: string;
	name: string;
	hex: string;
}

/**
 * The twelve colours of the picker, in the order the swatches are drawn. Bought once for the whole account in the Gem shop ("Name colours", `NICK_COLORS_ITEM`); stored on `profiles.name_color`.
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
	{ id: 'teal', name: 'Teal', hex: '#2dd4bf' },
	{ id: 'sky', name: 'Sky', hex: '#56b6f7' },
	{ id: 'blue', name: 'Blue', hex: '#4f8df5' },
	{ id: 'violet', name: 'Violet', hex: '#a371f7' },
	{ id: 'magenta', name: 'Magenta', hex: '#e05fd0' },
	{ id: 'rose', name: 'Rose', hex: '#ff8fab' },
	{ id: 'silver', name: 'Silver', hex: '#e6edf3' },
];

/** The stored id of the special gold nickname with glowing stars: for admin accounts only (`profiles.is_admin`), never for sale. */
export const NICK_GOLD = 'gold';

/** The gem shop item that unlocks the picker (all twelve colours) for the account. */
export const NICK_COLORS_ITEM = 'name_colors';

export const nickColorById = (id: unknown): NickColor | null => NICK_COLORS.find((color) => color.id === id) ?? null;

/** The value `NickName` takes for a stored id: the CSS colour, `gold` for the admin nickname, or undefined for the default colour. */
export const nickColorValue = (id: string | null | undefined): string | undefined => (id === NICK_GOLD ? NICK_GOLD : nickColorById(id)?.hex);

/** Whether `id` is a colour that can be stored at all: one of the twelve, or gold. */
export const isNickColorId = (id: unknown): id is string => id === NICK_GOLD || nickColorById(id) !== null;
