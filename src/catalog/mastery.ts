// Bestiary mastery as data (IDL-309, decided 2026-11-12: the hybrid ladder). A monster type has the same ladder of kill tiers; reaching a tier lets the player claim it. Appending a tier later (the
// decided 1,000 and 5,000 steps) is a config change: tiers are numbered by position and a claim is the count of tiers taken, so nothing stored changes meaning. Nothing here imports the server.

/** What a tier unlocks in the Bestiary window. */
export type MasteryReveal = 'stats' | 'drops';

export interface MasteryTier {
	/** Kills of the type that reach the tier */
	kills: number;
	/** The layer of the entry the tier shows (the data is in the client catalog anyway: this is a UI gate, not a secret) */
	reveal?: MasteryReveal;
	/** What the tier gives, as the text the window shows. **Placeholder only**: no bonus is applied until the bonus model and the balance pass (IDL-310). */
	bonus?: string;
	/** Gems the claim pays (0: none; the owner left gems per tier open). Capped by `GEMS_CAP` like every gem payout. */
	gems: number;
}

/**
 * The mastery ladder shared by every monster type: 10 kills reveal the stats, 100 the drop table (with a small bonus), 500 is Mastery I (the decided +10% XP and +5% loot chance, as text for now), 2,500 is Mastery II
 * with a title or pet. The decided 1,000 and 5,000 steps (up to +50% XP per type) are appended later as tiers 5 and 6.
 *
 * @title Bestiary mastery
 * @category Progression/Mastery
 * @order 0
 * @see masteryState, claimMastery
 */
export const MASTERY_TIERS: readonly MasteryTier[] = [
	{ kills: 10, reveal: 'stats', gems: 0 },
	{ kills: 100, reveal: 'drops', bonus: 'A small bonus against this monster (placeholder)', gems: 0 },
	{ kills: 500, bonus: 'Mastery I: +10% XP and +5% loot chance from this monster (placeholder)', gems: 0 },
	{ kills: 2500, bonus: 'Mastery II and a title or pet (placeholder)', gems: 0 },
];

/** Kills that fill a Bestiary entry: the first tier (the Scholar deed counts the entries that reached it). */
export const MASTERY_ENTRY_KILLS: number = MASTERY_TIERS[0].kills;
