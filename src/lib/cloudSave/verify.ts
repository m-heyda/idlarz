import type { SaveSummary } from './summary';

/**
 * Plausibility checks between two consecutive saves of one player, run on the SERVER with the SERVER's clock, from the
 * summaries alone (no state is opened). Structural forgery (impossible items, points, tiles) is refused earlier by
 * `sanitizeSave`; "the land and balance are worth more than the game could have paid" is `netWorth.ts`.
 *
 * Shadow mode: nothing here rejects a save. Every finding becomes a flag stored next to the save, so the thresholds
 * can be tuned on real play before anything is enforced. Legitimate bursts exist (chests, kills, merchant sales,
 * rebirth), so gains get a generous allowance on top of what the income rates explain.
 */
export const VERIFY = {
	/** A save cannot hold more play time than real time passed (plus a little slack for clock rounding and tick batching). */
	playtimeSlack: 1.05,
	playtimeGraceSec: 30,
	/** Income that rates x play time explain is multiplied by this before a gain counts as suspicious. */
	gainSlack: 1.5,
	/** One-off gains (chests, loot, sales) are allowed up to this many seconds of current income, plus a floor. */
	burstSec: 900,
	goldFloor: 10_000,
	xpFloor: 2_000,
	/** Without a previous save the whole balance has to be explained by the current income over the play time. */
	baselineSlack: 3,
	baselineBurstSec: 3600,
	/** A first save with at most this much play time counts as a fresh start (ranking-eligible). */
	freshStartSec: 900,
} as const;

export interface Snapshot {
	summary: SaveSummary;
	/** Server time when this save was accepted (ms). */
	serverSavedAt: number;
}

export type SaveFlag =
	| 'baseline_rich'
	| 'networth_exceeds'
	| 'playtime_regress'
	| 'playtime_fast'
	| 'gold_jump'
	| 'xp_jump'
	| 'gems_increase'
	| 'prestige_regress';

/** Flags that make an account ineligible for rankings for good. Going back in time is a player choice (older save), not a cheat. */
export const POISON_FLAGS: ReadonlySet<SaveFlag> = new Set<SaveFlag>(['baseline_rich', 'networth_exceeds', 'playtime_fast', 'gold_jump', 'xp_jump', 'gems_increase', 'prestige_regress']);

const xpRate = (s: SaveSummary) => s.rates.xp * (1 + s.xpGainPct / 100);

export const verifyTransition = (prev: Snapshot | null, next: SaveSummary, nowMs: number): SaveFlag[] => {
	const flags = new Set<SaveFlag>();

	if (!prev) {
		// First save of this account (often an existing player's whole history): can only be sanity checked
		const rate = next.rates.gold;
		const explained = rate * next.playSeconds * VERIFY.baselineSlack + rate * VERIFY.baselineBurstSec + VERIFY.goldFloor;
		if (next.gold > explained) flags.add('baseline_rich');
		return [...flags];
	}

	const before = prev.summary;
	const elapsedSec = Math.max(0, (nowMs - prev.serverSavedAt) / 1000);
	const playedSec = next.playSeconds - before.playSeconds;
	const sameRun = next.rebirths === before.rebirths;

	if (sameRun && playedSec < -1) flags.add('playtime_regress');
	if (playedSec > elapsedSec * VERIFY.playtimeSlack + VERIFY.playtimeGraceSec) flags.add('playtime_fast');

	if (next.rebirths < before.rebirths || next.legacyEarned < before.legacyEarned) flags.add('prestige_regress');
	if (next.gems > before.gems) flags.add('gems_increase'); // gems have no source in the game yet

	if (sameRun) {
		const played = Math.max(0, playedSec);
		const goldRate = Math.max(before.rates.gold, next.rates.gold);
		const goldAllowed = goldRate * played * VERIFY.gainSlack + goldRate * VERIFY.burstSec + VERIFY.goldFloor;
		if (next.gold - before.gold > goldAllowed) flags.add('gold_jump');

		const rate = Math.max(xpRate(before), xpRate(next));
		const xpAllowed = rate * played * VERIFY.gainSlack + rate * VERIFY.burstSec + VERIFY.xpFloor;
		if (next.xp - before.xp > xpAllowed) flags.add('xp_jump');
	}

	return [...flags];
};
