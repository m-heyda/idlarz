/**
 * The away-time bar (IDL-64): how much of the away cap a gap fills, as numbers the welcome-back window and the landing's Continue card both draw. Pure and display only: the server decides
 * the gap, the cap and the efficiency (`computeOfflineGrant`, `lib/offline/grant.ts`); this never changes what is paid.
 */
export interface OfflineBarInput {
	/** Seconds since the player was last seen (before the cap) */
	gapSec: number;
	/** The most the kingdom works for the player, in seconds */
	capSec: number;
	/** 0-1: the share of income an away second pays */
	efficiency: number;
}

export interface OfflineBar {
	/** 0-1: the gap against the cap (1 = the bank is full) */
	fraction: number;
	/** "6 h 20 m of 8 h": the counted time (never above the cap) against the cap */
	label: string;
	/** Seconds beyond the cap that earned nothing (0 when not capped) */
	lostSec: number;
	/** The gap is longer than the cap */
	capped: boolean;
	/** The efficiency as a whole percent (50) */
	efficiencyPct: number;
}

const finite = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0);

/** A duration as whole hours and minutes, compact: 6 h 20 m, 8 h, 45 m (under a minute reads 0 m). */
export const barDuration = (seconds: number): string => {
	const total = Math.floor(finite(seconds) / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h > 0 && m > 0) return `${h} h ${m} m`;
	if (h > 0) return `${h} h`;
	return `${m} m`;
};

export const offlineBar = (input: OfflineBarInput): OfflineBar => {
	const gap = finite(input.gapSec);
	const cap = finite(input.capSec);
	const counted = Math.min(gap, cap);
	const capped = gap > cap;
	return {
		fraction: cap > 0 ? Math.min(1, counted / cap) : 0,
		label: `${barDuration(counted)} of ${barDuration(cap)}`,
		lostSec: capped ? gap - cap : 0,
		capped,
		efficiencyPct: Math.round(Math.min(1, finite(input.efficiency)) * 100),
	};
};

/** "Capped: 4 h 10 m earned nothing" (null when not capped). */
export const cappedLine = (bar: OfflineBar): string | null => (bar.capped ? `Capped: ${barDuration(bar.lostSec)} earned nothing` : null);

/** How long the counting-down animation of the welcome-back window runs. */
export const AWAY_COUNT_MS = 1800;

/** Share of the animation still to run (1 = just started, 0 = done), eased out so the bar slows as it empties. `elapsedMs` is the time since it began. */
export const countdownLeft = (elapsedMs: number, durationMs: number = AWAY_COUNT_MS): number => {
	const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
	return Math.pow(1 - t, 2);
};
