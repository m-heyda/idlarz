import { ACHIEVEMENTS, DEEDS, achievementById, type AchievementDef } from '@/catalog/achievements';
import { GEMS_CAP } from '@/config/economy';
import type { StoredSave } from '@/lib/cloudSave/pipeline';
import { addTotals, type Ledger } from '@/lib/offline/ledger';
import { conditionHolds, conditionProgress, deedPoints, type DeedFacts } from '@/lib/deeds';
import { guideLive } from '@/lib/tutorial/live';

// SERVER ONLY. Achievements (IDL-73, gem rewards IDL-194): pure functions of numbers the server already holds. Nothing here reads a request; the browser cannot name an
// achievement, so a forged claim has nowhere to go. Called from `withLedger` after every online step (spawn poll, chest, fight, tutorial, offline claim).

/** The numbers the conditions read (see `lib/deeds.ts`). */
export type AchievementFacts = DeedFacts;

export const factsOf = (ledger: Ledger, summary: StoredSave['summary']): AchievementFacts => ({
	stats: ledger.stats,
	castleLevel: summary.castleLevel,
	rebirths: Math.max(ledger.rebirths, summary.rebirths),
	buildings: 0,
});

export { conditionHolds };

/**
 * The achievements whose condition holds now and that are not paid yet, in catalog order. A paid one never comes back, however the numbers move later
 * (a rebirth resets the castle level; the achievement stays earned).
 */
export const achievementsDue = (facts: AchievementFacts): AchievementDef[] =>
	ACHIEVEMENTS.filter((a) => !facts.stats.achievements.includes(a.id) && conditionHolds(a.when, facts));

/** What the browser is told about an earned achievement: the id and the gems its Claim button will pay. */
export interface AchievementUnlock {
	id: string;
	gems: number;
}

/** A ledger from before claiming existed paid every achievement when it was earned: its earned ids all count as claimed (nothing is paid again). */
const withClaimMode = (ledger: Ledger): Ledger =>
	ledger.stats.claimed === null ? { ...ledger, stats: { ...ledger.stats, claimed: [...ledger.stats.achievements] } } : ledger;

/**
 * Records the given achievements as earned: the id goes into `stats.achievements` with the time it was earned. **Nothing is paid here**: the gems (and any later claimable reward) are handed over when the player presses Claim
 * ({@link claimAchievement}). An id already earned, or not in the catalog, changes nothing.
 */
export const earnAchievements = (ledger: Ledger, ids: readonly string[], nowMs: number): { ledger: Ledger; unlocked: AchievementUnlock[] } => {
	const base = withClaimMode(ledger);
	const seen = new Set(base.stats.achievements);
	const unlocked: AchievementUnlock[] = [];
	for (const id of ids) {
		const def = achievementById(id);
		if (!def || seen.has(id)) continue;
		seen.add(id);
		unlocked.push({ id, gems: def.rewards.gems });
	}
	if (unlocked.length === 0) return { ledger: base, unlocked };
	const earnedAt = { ...base.stats.earnedAt };
	for (const u of unlocked) earnedAt[u.id] = nowMs;
	return {
		ledger: { ...base, stats: { ...base.stats, achievements: [...base.stats.achievements, ...unlocked.map((u) => u.id)], earnedAt } },
		unlocked,
	};
};

export type ClaimOutcome = { ok: true; ledger: Ledger; gems: number } | { ok: false; reason: 'unknown' | 'not_earned' | 'already_claimed' };

/**
 * The Claim button: pays the rewards of one earned achievement once. The gems go onto the authoritative balance (capped by `GEMS_CAP`) and into `granted` (like a chest's gem find), and the id is recorded in `stats.claimed` with the time.
 * Refused (nothing changes) for an id that is not in the catalog, was not earned, or was claimed already, so a repeated or forged claim pays nothing. The avatar and the title of an achievement are available from the moment it is earned; they do not wait for the claim.
 *
 * @category Progression/Achievements
 * @order 2
 */
export const claimAchievement = (ledger: Ledger, id: string, nowMs: number): ClaimOutcome => {
	const def = achievementById(id);
	if (!def) return { ok: false, reason: 'unknown' };
	const base = withClaimMode(ledger);
	if (!base.stats.achievements.includes(id)) return { ok: false, reason: 'not_earned' };
	if (base.stats.claimed!.includes(id)) return { ok: false, reason: 'already_claimed' };
	const gems = Math.min(GEMS_CAP, base.gems + def.rewards.gems) - base.gems;
	return {
		ok: true,
		gems,
		ledger: {
			...base,
			gems: base.gems + gems,
			granted: addTotals(base.granted, { gems }),
			stats: { ...base.stats, claimed: [...base.stats.claimed!, id], claimedAt: { ...base.stats.claimedAt, [id]: nowMs } },
		},
	};
};

export type ClaimAllOutcome = { ok: true; ledger: Ledger; gems: number; claimed: string[] } | { ok: false; reason: 'nothing_to_claim' };

/**
 * Claim all: pays every earned tier that is not claimed yet in one go (one request, one idempotency key, one ledger write, so it is all or nothing). The gems of all of them are added together and capped once by `GEMS_CAP`
 * (what the cap cuts off is lost, as with a single claim), and each id is recorded in `stats.claimed` with the time. Refused when nothing is waiting.
 *
 * @category Progression/Deeds
 * @order 3
 */
export const claimAllAchievements = (ledger: Ledger, nowMs: number): ClaimAllOutcome => {
	const base = withClaimMode(ledger);
	const done = new Set(base.stats.claimed!);
	const waiting = base.stats.achievements.filter((id) => !done.has(id) && !!achievementById(id));
	if (waiting.length === 0) return { ok: false, reason: 'nothing_to_claim' };
	const owed = waiting.reduce((sum, id) => sum + achievementById(id)!.rewards.gems, 0);
	const gems = Math.min(GEMS_CAP, base.gems + owed) - base.gems;
	const claimedAt = { ...base.stats.claimedAt };
	for (const id of waiting) claimedAt[id] = nowMs;
	return {
		ok: true,
		gems,
		claimed: waiting,
		ledger: {
			...base,
			gems: base.gems + gems,
			granted: addTotals(base.granted, { gems }),
			stats: { ...base.stats, claimed: [...base.stats.claimed!, ...waiting], claimedAt },
		},
	};
};

/**
 * The manual achievements (the testers) are granted outside the lazy evaluator and live in `player_achievements`. This merges them into the ledger once (`stats.manualSynced`), so they show in the Achievements window and can be claimed;
 * an achievement that is granted `withAchievement` another one (the Beta tester comes with the Early tester) is added too. `mirror` lists the ids that were not in the table yet (to record them there).
 */
export const mergeManual = (ledger: Ledger, held: readonly string[], nowMs: number): { ledger: Ledger; added: string[]; mirror: string[] } => {
	if (ledger.stats.manualSynced) return { ledger, added: [], mirror: [] };
	const have = new Set(held);
	const want = ACHIEVEMENTS.filter((a) => a.when.kind === 'manual' && (have.has(a.id) || (a.withAchievement !== undefined && have.has(a.withAchievement)))).map(
		(a) => a.id,
	);
	const earned = earnAchievements(ledger, want, nowMs);
	return {
		ledger: { ...earned.ledger, stats: { ...earned.ledger.stats, manualSynced: true } },
		added: earned.unlocked.map((u) => u.id),
		mirror: want.filter((id) => !have.has(id)),
	};
};

/**
 * Lazy evaluation, once per online request: the achievements that became due are recorded as earned in the same ledger write (a compare-and-swap, so two requests at once cannot both record; a replayed request finds the id recorded and records nothing).
 * The caller mirrors the ids into `player_achievements` with `insert ... on conflict do nothing` after the write lands (`AchievementRepo`).
 *
 * - **Claiming**: earning pays nothing by itself; the player claims each achievement in the Achievements window ({@link claimAchievement}). Gems are not an economy input, so the pacing sim does not move.
 * - **Avatar and title** are only recorded with the achievement; the avatar picker (IDL-71) offers the avatars of the earned ones.
 * - **The testers** are never checked here: the new chapter reset grants them (`mergeManual` brings them into the ledger).
 * - **Dark until the new chapter**: while the guide is dark (`guideLive`: `GAME_EPOCH` still the baseline and no `NEXT_PUBLIC_GUIDE=on`) nothing is earned, so the live game gets no surprises. The one-line epoch flip switches it on together with the guide.
 *
 * @category Progression/Achievements
 * @order 1
 * @see achievementsDue, earnAchievements
 */
export const settleAchievements = (ledger: Ledger, summary: StoredSave['summary'], nowMs: number): { ledger: Ledger; unlocked: AchievementUnlock[] } =>
	!guideLive()
		? { ledger, unlocked: [] }
		: earnAchievements(
				ledger,
				achievementsDue(factsOf(ledger, summary)).map((a) => a.id),
				nowMs,
			);

/** What the browser gets about achievements: the newly earned ones (for the toast) and, on a poll, the full state. */
export interface AchievementReport {
	/** Earned by this request (their rewards wait for the Claim button) */
	fresh: AchievementUnlock[];
	/** Every earned id (present on the spawn poll and whenever something was earned or claimed) */
	earned: string[];
	/** The earned ids whose rewards have been claimed */
	claimed: string[];
	/** When each was earned and claimed (epoch ms); absent for the ones earned before this was kept */
	earnedAt: Record<string, number>;
	claimedAt: Record<string, number>;
	/** The gem balance, so the header can follow */
	gemsTotal: number;
	/** Deed points of the claimed tiers (derived, never stored) and how many earned tiers wait for Claim */
	points: number;
	claimable: number;
	/** What the "bonus from deeds" line says. A placeholder until the bonus model exists (IDL-310): no stat bonus is applied. */
	bonusText: string;
	/** The player's number towards each deed (deed id -> `cur`, as the Hall of Deeds bar reads it). Present when the last accepted save is known. */
	progress?: Record<string, number>;
}

/** The placeholder the window shows for the bonus the deeds will give. */
export const DEED_BONUS_PLACEHOLDER = 'Bonus from deeds: coming soon';

/** Each deed's current number, from the same facts the conditions read. */
export const deedProgressOf = (facts: AchievementFacts): Record<string, number> => {
	const out: Record<string, number> = {};
	for (const deed of DEEDS) {
		const first = achievementById(deed.tiers[0]);
		if (first && first.when.kind !== 'manual') out[deed.id] = Math.floor(conditionProgress(first.when, facts).cur);
	}
	return out;
};

export const reportOf = (ledger: Ledger, fresh: AchievementUnlock[], summary?: StoredSave['summary']): AchievementReport => {
	// a ledger from before claiming existed paid everything at once
	const claimed = [...(ledger.stats.claimed ?? ledger.stats.achievements)];
	return {
		fresh,
		earned: [...ledger.stats.achievements],
		claimed,
		earnedAt: { ...ledger.stats.earnedAt },
		claimedAt: { ...ledger.stats.claimedAt },
		gemsTotal: ledger.gems,
		points: deedPoints(claimed),
		claimable: ledger.stats.achievements.filter((id) => !claimed.includes(id)).length,
		bonusText: DEED_BONUS_PLACEHOLDER,
		...(summary ? { progress: deedProgressOf(factsOf(ledger, summary)) } : {}),
	};
};

/** Where the earned ids are mirrored: `player_achievements`, written by the server only. */
export interface AchievementRepo {
	/** `insert ... on conflict do nothing` for each id; a second call for the same id changes nothing. */
	record(userId: string, ids: readonly string[], atMs: number): Promise<void>;
	/** The ids the account holds in the table (the manual ones are granted there). */
	list?(userId: string): Promise<string[]>;
}
