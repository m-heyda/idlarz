/** Pure helpers behind the design-system components (kept apart so they can be unit tested). */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Rarities from weakest to best; uncommon and above get a coloured, glowing rim. */
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

/** Does this rarity get a glow around its tooltip and slot? Common has none. */
export const hasGlow = (rarity: Rarity | undefined): boolean => rarity !== undefined && rarity !== 'common';

export type GemState = 'on' | 'max' | 'off';

/**
 * The diamonds of a level indicator: `level` yellow gems, the rest dim; when `level === max` every gem turns purple.
 * `max` is clamped to 1..20 so a bad config cannot draw hundreds of nodes.
 */
export const gemStates = (level: number, max: number): GemState[] => {
	const total = Math.max(1, Math.min(20, Math.floor(max)));
	const lit = Math.max(0, Math.min(total, Math.floor(level)));
	const done = lit === total;
	return Array.from({ length: total }, (_, i) => (i < lit ? (done ? 'max' : 'on') : 'off'));
};

export type UpgradeState = 'maxed' | 'ready' | 'short';

/** An upgrade tile is maxed at its last level, ready when the player has the gold, short otherwise. */
export const upgradeState = (level: number, max: number, cost: number, have: number): UpgradeState =>
	level >= max ? 'maxed' : have >= cost ? 'ready' : 'short';

/** Short number format used in the mocks: 1.2K, 3.40M. */
export const compact = (n: number): string => {
	const abs = Math.abs(n);
	if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
	if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
	return String(Math.round(n));
};

export interface Point {
	x: number;
	y: number;
}
export interface Size {
	w: number;
	h: number;
}

/** Keeps a value inside [min, max]; when the range is empty (max < min) the minimum wins, so a window bigger than the screen still sits at its top-left. */
export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Where a dragged window may sit: at least `keepVisible` px of it stays on screen sideways, its title never goes above `minY` (under a fixed header) or below the bottom edge.
 * Pure, so the game's window store can run its own drag with this clamp, or a test can pin the rule down.
 */
export const clampWindowPosition = (
	pos: Point,
	size: Size,
	viewport: Size,
	opts: { keepVisible?: number; minY?: number; bottomMargin?: number } = {},
): Point => {
	const keep = opts.keepVisible ?? 80;
	return {
		x: clamp(pos.x, keep - size.w, viewport.w - keep),
		y: clamp(pos.y, opts.minY ?? 0, viewport.h - (opts.bottomMargin ?? 40)),
	};
};

/** The size a resize drag asks for, kept between the window's minimum and the room left to the screen edge (`margin` px). */
export const clampWindowSize = (start: Size, delta: Point, min: Size, room: Size, margin = 8): Size => ({
	w: clamp(start.w + delta.x, min.w, room.w - margin),
	h: clamp(start.h + delta.y, min.h, room.h - margin),
});

const AMOUNT_SUFFIXES = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx'];

/**
 * A typed amount ("250", "1,500", "1.5k", "2m", "3B"): a whole number of at least 1, or null for anything else (empty, negative, an unknown suffix, a fraction of a unit). The same rules as the game's `parseAmount`, kept here so the
 * `AmountInput` works without the game; the game can pass its own parser instead.
 */
export const parseAmountText = (text: string): number | null => {
	const match = /^(\d+(?:\.\d+)?)\s*([a-z]*)$/i.exec(text.replace(/[,_\s]+/g, '').toLowerCase());
	if (!match) return null;
	const tier = AMOUNT_SUFFIXES.indexOf(match[2]);
	if (tier < 0) return null;
	const value = Math.floor(Number(match[1]) * Math.pow(1000, tier) + 1e-6);
	return Number.isFinite(value) && value >= 1 ? value : null;
};

/** A typed or chosen amount held between 0 and `max` (a typed amount over the stock sells the stock). */
export const clampAmount = (value: number, max: number): number =>
	Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), Math.max(0, Math.floor(max)))) : 0;

/**
 * The adapter from the game's rarity id (a string that may be anything a save or a future catalog holds) to a design-system `Rarity`: a known id passes, anything else reads as `common`. Wiring code calls it instead of casting.
 */
export const toRarity = (id: string | undefined | null): Rarity => ((RARITIES as readonly string[]).includes(id ?? '') ? (id as Rarity) : 'common');

/**
 * How much a dock icon swells while the pointer is `distance` px from its centre: 1 (normal) far away, `peak` right under the pointer, falling off smoothly over `reach` px, so the neighbours of the hovered icon are lifted a little too.
 */
export const dockMagnification = (distance: number, peak = 1.25, reach = 100): number => {
	if (!Number.isFinite(distance) || distance >= reach) return 1;
	const t = 1 - Math.max(0, distance) / reach;
	return 1 + (peak - 1) * (0.5 - 0.5 * Math.cos(Math.PI * t));
};
