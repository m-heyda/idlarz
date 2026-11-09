// The pure part of the pacing guard (scripts/pacing-guard.ts, tests/economy/pacingGuard.test.ts): compares two sim baselines
// (docs/generated/sim-baseline.json, written by `npm run sim`) and lists the key milestones that moved by more than the tolerance.

/** One profile's milestones, as game days (null = never reached within the sim's horizon). */
export type ProfileMilestones = Record<string, number | null>;
export interface PacingBaseline {
	note?: string;
	profiles: Record<string, ProfileMilestones>;
}

/** The milestones a pacing change must not move unannounced: the first finish (castle 6 + click power + rebirth territory), the rebirths, the late castle, the level ladder, the tile ladder. */
export const GUARDED_MILESTONE = /^(finished|r\d+\.finished|rebirthDay\d+|castle(6|8|10)|level(50|80|90)|tiles(100|400))$/;

/** docs/plan/ROADMAP.md: the PR fails when a guarded milestone moves by more than 15 % (or by PACING_MAX_DRIFT_DAYS days). */
export const PACING_TOLERANCE = 0.15;

/** Also fails a PR: a guarded milestone that moved by more than this many game days, whatever the percentage (15 % of a day-220 milestone is 33 days, so a late milestone could drift for a month unseen). */
export const PACING_MAX_DRIFT_DAYS = 5;

/** Below this many game days a relative change is noise (a milestone at 1.2 h moving by 0.1 h is not a pacing change). */
export const PACING_FLOOR_DAYS = 0.05;

export interface PacingViolation {
	profile: string;
	milestone: string;
	base: number | null;
	current: number | null;
	/** Relative change (current / base - 1); null when one side was never reached. */
	change: number | null;
}

export const comparePacing = (
	base: PacingBaseline,
	current: PacingBaseline,
	tolerance = PACING_TOLERANCE,
	maxDriftDays = PACING_MAX_DRIFT_DAYS,
): PacingViolation[] => {
	const violations: PacingViolation[] = [];
	for (const [profile, baseMs] of Object.entries(base.profiles)) {
		const currentMs = current.profiles[profile];
		if (!currentMs) {
			// a profile that vanished is a change in what the guard can see, not a pass
			violations.push({ profile, milestone: '(whole profile missing)', base: null, current: null, change: null });
			continue;
		}
		// the union of both sides: a key the base never wrote (level90 of `human`) counts as "never reached", so a change that reaches it is seen
		const keys = new Set([...Object.keys(baseMs), ...Object.keys(currentMs)]);
		for (const milestone of [...keys].filter((k) => GUARDED_MILESTONE.test(k))) {
			const b = baseMs[milestone] ?? null;
			const c = currentMs[milestone] ?? null;
			if (b == null && c == null) continue;
			if (b == null || c == null) {
				violations.push({ profile, milestone, base: b, current: c, change: null });
				continue;
			}
			if (Math.max(b, c) < PACING_FLOOR_DAYS) continue;
			const change = c / b - 1;
			if (Math.abs(change) > tolerance || Math.abs(c - b) > maxDriftDays) violations.push({ profile, milestone, base: b, current: c, change });
		}
	}
	return violations;
};

const fmt = (days: number | null): string => (days == null ? 'never' : days < 1 ? `${(days * 24).toFixed(1)} h` : `${days.toFixed(2)} d`);

export const formatViolations = (violations: PacingViolation[], tolerance = PACING_TOLERANCE, maxDriftDays = PACING_MAX_DRIFT_DAYS): string =>
	violations
		.map((v) => {
			const head = `${v.profile} ${v.milestone}: ${fmt(v.base)} -> ${fmt(v.current)}`;
			if (v.change == null || v.base == null || v.current == null) return head;
			const days = v.current - v.base;
			return `${head} (${v.change > 0 ? '+' : ''}${(v.change * 100).toFixed(1)} %, ${days > 0 ? '+' : ''}${days.toFixed(2)} d; allowed ±${tolerance * 100} % and ±${maxDriftDays} d)`;
		})
		.join('\n');

/** A short table for the job log: per profile the guarded milestones compared, how many moved at all, and the largest move in percent and in days. */
export const formatSummary = (base: PacingBaseline, current: PacingBaseline): string => {
	const rows: string[][] = [['profile', 'guarded', 'moved', 'largest %', 'largest days']];
	for (const [profile, baseMs] of Object.entries(base.profiles)) {
		const currentMs = current.profiles[profile];
		if (!currentMs) {
			rows.push([profile, '-', '-', 'profile missing', '-']);
			continue;
		}
		const keys = [...new Set([...Object.keys(baseMs), ...Object.keys(currentMs)])].filter((k) => GUARDED_MILESTONE.test(k));
		let compared = 0;
		let moved = 0;
		let worstPct: { key: string; v: number } | null = null;
		let worstDays: { key: string; v: number } | null = null;
		for (const key of keys) {
			const b = baseMs[key] ?? null;
			const c = currentMs[key] ?? null;
			if (b == null && c == null) continue;
			compared++;
			if (b == null || c == null) {
				moved++;
				continue;
			}
			if (b === c) continue;
			moved++;
			const pct = b === 0 ? 0 : c / b - 1;
			if (!worstPct || Math.abs(pct) > Math.abs(worstPct.v)) worstPct = { key, v: pct };
			if (!worstDays || Math.abs(c - b) > Math.abs(worstDays.v)) worstDays = { key, v: c - b };
		}
		const sign = (n: number) => (n > 0 ? '+' : '');
		rows.push([
			profile,
			String(compared),
			String(moved),
			worstPct ? `${sign(worstPct.v)}${(worstPct.v * 100).toFixed(1)} % (${worstPct.key})` : '0',
			worstDays ? `${sign(worstDays.v)}${worstDays.v.toFixed(2)} d (${worstDays.key})` : '0',
		]);
	}
	const width = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
	return rows
		.map((r) =>
			r
				.map((cell, i) => cell.padEnd(width[i]))
				.join('  ')
				.trimEnd(),
		)
		.join('\n');
};
