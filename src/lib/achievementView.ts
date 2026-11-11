/** What the Achievements window needs to know about one row, built from the fields of the server's achievement report. Pure: no store, no clock. */
export interface AchievementRowState {
	earned: boolean;
	claimed: boolean;
	/** Earned and not claimed yet: the Claim button shows */
	canClaim: boolean;
	/** 'Earned 12 Nov 2026', or null when the server did not send a time */
	earnedText: string | null;
	/** 'Claimed 13 Nov 2026', or null when not claimed or no time */
	claimedText: string | null;
}

/** The part of the report the view reads; the claimed list and the times are missing from an older server's answers. */
export interface AchievementViewInput {
	earned: readonly string[];
	claimed?: readonly string[];
	earnedAt?: Readonly<Record<string, number>>;
	claimedAt?: Readonly<Record<string, number>>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `12 Nov 2026` (UTC day), or null for a missing or invalid time. */
export const formatAchievementDate = (ms: number | undefined): string | null => {
	if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return null;
	const d = new Date(ms);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** The ids to treat as claimed: the list of the server, or (an older server that sends none) every earned id, so nothing shows a Claim button that cannot work. */
export const claimedIds = (input: AchievementViewInput): readonly string[] => input.claimed ?? input.earned;

/** The ids that can be claimed now, in the given order. */
export const claimableIds = (input: AchievementViewInput, ids: readonly string[]): string[] => {
	const claimed = claimedIds(input);
	return ids.filter((id) => input.earned.includes(id) && !claimed.includes(id));
};

export const achievementRowState = (input: AchievementViewInput, id: string): AchievementRowState => {
	const earned = input.earned.includes(id);
	const claimed = earned && claimedIds(input).includes(id);
	const earnedDate = earned ? formatAchievementDate(input.earnedAt?.[id]) : null;
	const claimedDate = claimed ? formatAchievementDate(input.claimedAt?.[id]) : null;
	return {
		earned,
		claimed,
		canClaim: earned && !claimed,
		earnedText: earnedDate && `Earned ${earnedDate}`,
		claimedText: claimedDate && `Claimed ${claimedDate}`,
	};
};
