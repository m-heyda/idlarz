import { MASTERY_TIERS, type MasteryTier } from '@/catalog/mastery';

// Pure maths of the Bestiary mastery (IDL-309): which tier a kill count reaches, what is claimable, what the entry may show. Shared by the server (claim rules) and the browser (the window).

/** Tiers a kill count has reached (0 to the number of tiers). */
export const masteryReached = (kills: number, tiers: readonly MasteryTier[] = MASTERY_TIERS): number => tiers.filter((t) => kills >= t.kills).length;

/** Where one monster type stands. */
export interface MasteryState {
	/** Tiers reached by the kills, and claimed so far (never above reached) */
	reached: number;
	claimed: number;
	/** Reached and not claimed: the Claim button */
	claimable: number;
	/** The kills the next tier needs (null when every tier is reached) and the kills before it, so a bar can run between them */
	next: number | null;
	from: number;
	/** The layers of the entry the claimed tiers show: stats from the tier that reveals them (a UI gate, see `catalog/mastery.ts`) */
	showStats: boolean;
	showDrops: boolean;
}

/** The state of a monster type from its kills and how many tiers were claimed. A claimed count above what the kills reach (a bad row) is cut to what is reached. */
export const masteryState = (kills: number, claimed: number, tiers: readonly MasteryTier[] = MASTERY_TIERS): MasteryState => {
	const reached = masteryReached(kills, tiers);
	const taken = Math.max(0, Math.min(reached, Math.floor(claimed)));
	const next = tiers[reached]?.kills ?? null;
	const unlocked = tiers.slice(0, taken);
	return {
		reached,
		claimed: taken,
		claimable: reached - taken,
		next,
		from: reached > 0 ? tiers[reached - 1].kills : 0,
		showStats: unlocked.some((t) => t.reveal === 'stats'),
		showDrops: unlocked.some((t) => t.reveal === 'drops'),
	};
};
