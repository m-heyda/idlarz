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

/** docs/plan/ROADMAP.md: the PR fails when a guarded milestone moves by more than 15 %. */
export const PACING_TOLERANCE = 0.15;

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

export const comparePacing = (base: PacingBaseline, current: PacingBaseline, tolerance = PACING_TOLERANCE): PacingViolation[] => {
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
			if (Math.abs(change) > tolerance) violations.push({ profile, milestone, base: b, current: c, change });
		}
	}
	return violations;
};

const fmt = (days: number | null): string => (days == null ? 'never' : days < 1 ? `${(days * 24).toFixed(1)} h` : `${days.toFixed(2)} d`);

export const formatViolations = (violations: PacingViolation[], tolerance = PACING_TOLERANCE): string =>
	violations
		.map((v) =>
			v.change == null
				? `${v.profile} ${v.milestone}: ${fmt(v.base)} -> ${fmt(v.current)}`
				: `${v.profile} ${v.milestone}: ${fmt(v.base)} -> ${fmt(v.current)} (${v.change > 0 ? '+' : ''}${(v.change * 100).toFixed(1)} %, allowed ±${tolerance * 100} %)`,
		)
		.join('\n');
