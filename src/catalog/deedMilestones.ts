// The deed point milestones of the Hall of Deeds (IDL-321, decided in IDL-310: points are a score plus milestone rewards; nothing is spent). Pure data: no server and no store imports.

/** What a milestone's bonus changes: the gold or the XP a kill pays (the server applies it in `payKill`, next to the Bestiary mastery bonuses). */
export type DeedBonusStat = 'gold' | 'xp';

export interface DeedMilestone {
	/** `dm_<points>`; append-only, an id that shipped keeps its meaning */
	id: string;
	/** Claimed deed points that open it */
	points: number;
	/** Gems the Claim button pays (once) */
	gems: number;
	/** A permanent bonus that is on from the claim, in % */
	bonus?: { stat: DeedBonusStat; pct: number };
}

/** Each stat of the deed bonus is cut at this (percent), however many milestones are claimed. Placeholder numbers until the balance pass (IDL-275). */
export const DEED_BONUS_CAP_PCT = 5;

/**
 * The milestones, by claimed deed points (all tiers together are worth about 7,800). Each pays gems once on Claim and switches on a small permanent bonus on kill gold or kill XP; the bonuses add up (+5% gold and +5% XP at the top, exactly at `DEED_BONUS_CAP_PCT`).
 * Points count only after their tier was claimed, so a milestone is reached by claiming, and a milestone is claimed on its own button or by Claim all. The numbers are placeholders for the balance pass.
 *
 * @title Deed milestones
 * @category Progression/Deeds
 * @order 4
 */
export const DEED_MILESTONES: readonly DeedMilestone[] = [
	{ id: 'dm_50', points: 50, gems: 25, bonus: { stat: 'gold', pct: 1 } },
	{ id: 'dm_150', points: 150, gems: 50, bonus: { stat: 'xp', pct: 1 } },
	{ id: 'dm_300', points: 300, gems: 75, bonus: { stat: 'gold', pct: 1 } },
	{ id: 'dm_600', points: 600, gems: 100, bonus: { stat: 'xp', pct: 1 } },
	{ id: 'dm_1000', points: 1000, gems: 150, bonus: { stat: 'gold', pct: 1 } },
	{ id: 'dm_1500', points: 1500, gems: 200, bonus: { stat: 'xp', pct: 1 } },
	{ id: 'dm_2250', points: 2250, gems: 300, bonus: { stat: 'gold', pct: 1 } },
	{ id: 'dm_3000', points: 3000, gems: 500, bonus: { stat: 'xp', pct: 1 } },
	{ id: 'dm_4500', points: 4500, gems: 600, bonus: { stat: 'gold', pct: 1 } },
	{ id: 'dm_6000', points: 6000, gems: 800, bonus: { stat: 'xp', pct: 1 } },
];

export const milestoneById = (id: string): DeedMilestone | undefined => DEED_MILESTONES.find((m) => m.id === id);

/** True for an id that names a milestone (the Claim request carries tier ids and milestone ids in the same field). */
export const isMilestoneId = (id: string): boolean => id.startsWith('dm_');
