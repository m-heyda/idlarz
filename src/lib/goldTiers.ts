import { ACHIEVEMENTS } from '@/catalog/achievements';

/** The gold amounts the Hoarder deeds ask for, ascending (read from the catalog, so a new tier is picked up by itself). */
const GOLD_TIERS: readonly number[] = ACHIEVEMENTS.flatMap((a) => (a.when.kind === 'goldPeak' ? [a.when.min] : [])).sort((a, b) => a - b);

/**
 * Whether the gold went from below a Hoarder tier to at or above it. The server only sees gold in the saves it accepts, so the game uploads right away
 * when this is true: a purse that crosses a tier and is spent again before the next 5 minute upload would otherwise never be counted.
 *
 * @category Progression/Achievements
 * @order 7
 */
export const crossedGoldTier = (before: number, after: number): boolean => after > before && GOLD_TIERS.some((tier) => before < tier && after >= tier);
