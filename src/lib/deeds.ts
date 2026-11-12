import { ACHIEVEMENTS, achievementById, type AchievementCondition, type DeedDef } from '@/catalog/achievements';
import { TUTORIAL_PATH } from '@/catalog/tutorial';
import type { LifetimeStats } from '@/lib/offline/stats';

// Pure maths of the Hall of Deeds (IDL-306): how far a condition is, what tier a deed is on, how many points the claimed tiers are worth. No server and no store imports, so the
// server (what is due, what the report says) and the browser (the window) run the same functions on the same numbers.

/** The numbers the conditions read. All of them come from the ledger or the last accepted save. */
export interface DeedFacts {
	stats: LifetimeStats;
	castleLevel: number;
	rebirths: number;
	/** Buildings built, lifetime. The building system has no counter yet, so this is 0 until it reports one. */
	buildings: number;
}

const lastStepId = TUTORIAL_PATH[TUTORIAL_PATH.length - 1]?.id;
export const totalKills = (stats: LifetimeStats): number => Object.values(stats.kills).reduce((sum, n) => sum + n, 0);

/** The bestiary entries filled: monster types with at least `kills` kills. */
export const entriesFilled = (stats: LifetimeStats, kills: number): number => Object.values(stats.kills).filter((n) => n >= kills).length;

/** How far a condition is: the number the player has (`cur`) and the number it needs (`goal`). A yes/no condition reads 0 or 1 of 1. */
export const conditionProgress = (when: AchievementCondition, f: DeedFacts): { cur: number; goal: number } => {
	switch (when.kind) {
		case 'tutorial':
			return { cur: !!lastStepId && f.stats.tutorial.done.includes(lastStepId) ? 1 : 0, goal: 1 };
		case 'tiles':
			return { cur: f.stats.tiles, goal: when.min };
		case 'buildings':
			return { cur: f.buildings, goal: when.min };
		case 'kills':
			return { cur: totalKills(f.stats), goal: when.min };
		case 'chests':
			return { cur: f.stats.chests, goal: when.min };
		case 'castle':
			return { cur: f.castleLevel, goal: when.level };
		case 'rebirths':
			return { cur: f.rebirths, goal: when.min };
		case 'kill':
			return { cur: f.stats.kills[when.monster] ?? 0, goal: when.min };
		case 'golden':
			return { cur: f.stats.golden, goal: when.min };
		case 'goldPeak':
			return { cur: f.stats.goldPeak, goal: when.min };
		case 'unitsSold':
			return { cur: f.stats.unitsSold, goal: when.min };
		case 'crafted':
			return { cur: f.stats.crafted, goal: when.min };
		case 'flawless':
			return { cur: f.stats.flawless, goal: when.min };
		case 'entries':
			return { cur: entriesFilled(f.stats, when.kills), goal: when.min };
		case 'manual':
			return { cur: 0, goal: 1 };
	}
};

/** Whether one condition holds for these facts. */
export const conditionHolds = (when: AchievementCondition, f: DeedFacts): boolean => {
	if (when.kind === 'manual') return false;
	const { cur, goal } = conditionProgress(when, f);
	return cur >= goal;
};

/** Where a deed stands for one player. */
export interface DeedState {
	/** Tiers earned (their condition held), and tiers claimed */
	earned: number;
	claimed: number;
	/** Tiers earned and not claimed yet: the Claim button */
	claimable: number;
	/** Every tier of the deed is earned */
	complete: boolean;
	/** The goal of the first tier not earned yet (the last tier's goal when complete), and the player's number towards it */
	goal: number;
	cur: number;
	/** The goal of the tier before it (0 for the first), so a bar can run from there to `goal` */
	from: number;
	/** 0 to 1 along the bar from `from` to `goal` (1 when complete) */
	progress: number;
}

/**
 * The state of a deed: its tiers are the achievements in `tiers`, in order. A tier counts as earned when the ledger recorded it (`earned`) **or** its condition holds now (so the window is right between the server's settles; a manual tier
 * counts only when recorded), and as claimed when it is in `claimed`. Gaps are fine: tiers are judged one by one, and the next goal is the first tier not earned.
 */
export const deedState = (deed: DeedDef, facts: DeedFacts, earned: readonly string[], claimed: readonly string[]): DeedState => {
	let earnedCount = 0;
	let claimedCount = 0;
	let nextIndex = -1;
	deed.tiers.forEach((id, i) => {
		const def = achievementById(id);
		const isEarned = earned.includes(id) || (!!def && conditionHolds(def.when, facts));
		if (isEarned) earnedCount++;
		else if (nextIndex < 0) nextIndex = i;
		if (claimed.includes(id)) claimedCount++;
	});
	const complete = nextIndex < 0;
	const at = achievementById(deed.tiers[complete ? deed.tiers.length - 1 : nextIndex]);
	const before = achievementById(deed.tiers[complete ? deed.tiers.length - 2 : nextIndex - 1] ?? '');
	const now = at ? conditionProgress(at.when, facts) : { cur: 0, goal: 1 };
	const from = !complete && before ? conditionProgress(before.when, facts).goal : 0;
	const span = Math.max(1, now.goal - from);
	return {
		earned: earnedCount,
		claimed: claimedCount,
		claimable: Math.max(0, earnedCount - claimedCount),
		complete,
		goal: now.goal,
		cur: now.cur,
		from,
		progress: complete ? 1 : Math.max(0, Math.min(1, (now.cur - from) / span)),
	};
};

/** Deed points of the claimed tiers: derived from the claimed ids, never stored. */
export const deedPoints = (claimed: readonly string[]): number => claimed.reduce((sum, id) => sum + (achievementById(id)?.rewards.points ?? 0), 0);

/** The points every tier together would give (the total the window shows next to the player's). */
export const TOTAL_DEED_POINTS: number = ACHIEVEMENTS.reduce((sum, a) => sum + (a.rewards.points ?? 0), 0);
