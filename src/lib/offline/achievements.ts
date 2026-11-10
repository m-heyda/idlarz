import { ACHIEVEMENTS, achievementById, type AchievementCondition, type AchievementDef } from '@/catalog/achievements';
import { TUTORIAL_PATH } from '@/catalog/tutorial';
import { GEMS_CAP } from '@/config/economy';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import { guideLive } from '@/lib/tutorial/live';
import type { LifetimeStats } from '@/lib/offline/stats';

// SERVER ONLY. Achievements (IDL-73, gem rewards IDL-194): pure functions of numbers the server already holds. Nothing here reads a request; the browser cannot name an
// achievement, so a forged claim has nowhere to go. Called from `withLedger` after every online step (spawn poll, chest, fight, tutorial, offline claim).

/** The numbers the conditions read. All of them come from the ledger or the last accepted save. */
export interface AchievementFacts {
	stats: LifetimeStats;
	castleLevel: number;
	rebirths: number;
	/** Buildings built, lifetime. The building system has no counter yet, so this is 0 until it reports one. */
	buildings: number;
}

export const factsOf = (ledger: Ledger, summary: StoredSave['summary']): AchievementFacts => ({
	stats: ledger.stats,
	castleLevel: summary.castleLevel,
	rebirths: Math.max(ledger.rebirths, summary.rebirths),
	buildings: 0,
});

const lastStepId = TUTORIAL_PATH[TUTORIAL_PATH.length - 1]?.id;
const totalKills = (stats: LifetimeStats): number => Object.values(stats.kills).reduce((sum, n) => sum + n, 0);

/** Whether one condition holds for these facts. */
export const conditionHolds = (when: AchievementCondition, f: AchievementFacts): boolean => {
	switch (when.kind) {
		case 'tutorial':
			return !!lastStepId && f.stats.tutorial.done.includes(lastStepId);
		case 'tiles':
			return f.stats.tiles >= when.min;
		case 'buildings':
			return f.buildings >= when.min;
		case 'kills':
			return totalKills(f.stats) >= when.min;
		case 'chests':
			return f.stats.chests >= when.min;
		case 'castle':
			return f.castleLevel >= when.level;
		case 'rebirths':
			return f.rebirths >= when.min;
		case 'kill':
			return (f.stats.kills[when.monster] ?? 0) >= when.min;
		case 'golden':
			return f.stats.golden >= when.min;
		case 'manual':
			return false;
	}
};

/**
 * The achievements whose condition holds now and that are not paid yet, in catalog order. A paid one never comes back, however the numbers move later
 * (a rebirth resets the castle level; the achievement stays earned).
 */
export const achievementsDue = (facts: AchievementFacts): AchievementDef[] =>
	ACHIEVEMENTS.filter((a) => !facts.stats.achievements.includes(a.id) && conditionHolds(a.when, facts));

/** What the browser is told about a payout: the achievement and the gems it paid. */
export interface AchievementUnlock {
	id: string;
	gems: number;
}

/** Pays the given achievements into the ledger: gems onto the authoritative balance (capped by `GEMS_CAP`), recorded in `granted`, ids in `stats.achievements`. An id already paid or not in the catalog pays nothing. */
export const payAchievements = (ledger: Ledger, ids: readonly string[]): { ledger: Ledger; unlocked: AchievementUnlock[] } => {
	const seen = new Set(ledger.stats.achievements);
	const unlocked: AchievementUnlock[] = [];
	let gems = ledger.gems;
	for (const id of ids) {
		const def = achievementById(id);
		if (!def || seen.has(id)) continue;
		seen.add(id);
		const next = Math.min(GEMS_CAP, gems + def.rewards.gems);
		unlocked.push({ id, gems: next - gems });
		gems = next;
	}
	if (unlocked.length === 0) return { ledger, unlocked };
	const paid = unlocked.reduce((sum, u) => sum + u.gems, 0);
	return {
		ledger: {
			...ledger,
			gems,
			granted: addTotals(ledger.granted, { gems: paid }),
			stats: { ...ledger.stats, achievements: [...ledger.stats.achievements, ...unlocked.map((u) => u.id)] },
		},
		unlocked,
	};
};

/**
 * Lazy evaluation, once per online request: the achievements that became due are paid and recorded in the same ledger write (a compare-and-swap, so two requests
 * at once cannot both pay; a replayed request finds the id recorded and pays nothing). The caller mirrors the ids into `player_achievements` with
 * `insert ... on conflict do nothing` after the write lands (`AchievementRepo`).
 *
 * - **Gems**: `rewards.gems` is added to `ledger.gems` (capped by `GEMS_CAP`) and to `granted.gems`, like a chest's gem find. Gems are not an economy input, so the pacing sim does not move.
 * - **Avatar and title** are only recorded with the achievement; the avatar picker (IDL-71) offers the avatars of the earned ones.
 * - **Early tester** is never checked here: the new chapter reset grants it.
 * - **Dark until the new chapter**: while the guide is dark (`guideLive`: `GAME_EPOCH` still the baseline and no `NEXT_PUBLIC_GUIDE=on`) nothing is paid, so the live game gets no surprise gems and the first achievement
 *   (the tutorial's end) cannot be reached anyway. The one-line epoch flip switches it on together with the guide.
 *
 * @category Progression/Achievements
 * @order 1
 * @see achievementsDue, payAchievements
 */
export const settleAchievements = (ledger: Ledger, summary: StoredSave['summary']): { ledger: Ledger; unlocked: AchievementUnlock[] } =>
	!guideLive()
		? { ledger, unlocked: [] }
		: payAchievements(
				ledger,
				achievementsDue(factsOf(ledger, summary)).map((a) => a.id),
			);

/** What the browser gets about achievements: the newly paid ones (for the toast) and, on a poll, the full list of earned ids. */
export interface AchievementReport {
	/** Paid by this request */
	fresh: AchievementUnlock[];
	/** Every earned id (present on the spawn poll and whenever something was paid) */
	earned: string[];
	/** The gem balance after the payout, so the header can follow */
	gemsTotal: number;
}

export const reportOf = (ledger: Ledger, fresh: AchievementUnlock[]): AchievementReport => ({
	fresh,
	earned: [...ledger.stats.achievements],
	gemsTotal: ledger.gems,
});

/** Where the earned ids are mirrored: `player_achievements`, written by the server only. */
export interface AchievementRepo {
	/** `insert ... on conflict do nothing` for each id; a second call for the same id changes nothing. */
	record(userId: string, ids: readonly string[], atMs: number): Promise<void>;
}
