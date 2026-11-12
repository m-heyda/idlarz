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
