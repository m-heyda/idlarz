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

/** The stored id of the animated rainbow nickname: bought separately in the Gem shop (`NICK_RAINBOW_ITEM`). */
export const NICK_RAINBOW = 'rainbow';

/** The gem shop item that unlocks the plain colours (all fourteen) for the account. */
export const NICK_COLORS_ITEM = 'name_colors';

/** The gem shop item that unlocks the rainbow nickname. */
export const NICK_RAINBOW_ITEM = 'name_rainbow';

/**
 * Every colour is open on a development build (`next dev`, tests): the account's own purchases and `is_admin` are not needed to try the rainbow and the gold nickname. A production build never has it.
 * The server applies it when it answers (`lib/badgeServer.ts`), so the same rule holds for the picker and for what a request may store.
 */
export const DEV_UNLOCK_COLOURS: boolean = process.env.NODE_ENV !== 'production';

export const nickColorById = (id: unknown): NickColor | null => NICK_COLORS.find((color) => color.id === id) ?? null;

/** The value `NickName` takes for a stored id: the CSS colour, `gold` / `rainbow` for the two animated ones, or undefined for the default colour. */
export const nickColorValue = (id: string | null | undefined): string | undefined => (id === NICK_GOLD || id === NICK_RAINBOW ? id : nickColorById(id)?.hex);

/** Whether `id` is a colour that can be stored at all: one of the fourteen, the rainbow or gold. */
export const isNickColorId = (id: unknown): id is string => id === NICK_GOLD || id === NICK_RAINBOW || nickColorById(id) !== null;

/** Dark or light text for a swatch of this colour, whichever reads better on it. */
export const inkOn = (hex: string): string => {
	const n = parseInt(hex.slice(1), 16);
	const luma = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
	return luma > 150 ? '#1a1208' : '#ffffff';
};
