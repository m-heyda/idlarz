import { ACHIEVEMENTS, achievementById, type AchievementDef } from '@/catalog/achievements';

/** The stored `profiles.badge_id` that hides the badge completely (null = the default). */
export const BADGE_NONE = 'none';

/** The badge shown when the player never chose: the Early tester medal, for the accounts that hold it. */
export const DEFAULT_BADGE_ID = 'early_tester';

/** One title a player can wear: the achievement that grants it and the words shown. */
export interface TitleOption {
	/** The `rewards.titleId` that is stored on the profile */
	id: string;
	/** What is shown (the achievement's name until the titles get their own names) */
	name: string;
	achievementId: string;
}

/**
 * Badges and titles of a profile. Every achievement has a badge picture, so the badges a player may wear are the achievements it has earned; a title is the `titleId` of an earned achievement.
 * The choice lives on the profile (`badge_id`, `title_id`, written by the server after `checkBadgeChoice`): `null` badge = the default, `BADGE_NONE` = hidden.
 * @category Progression/Badges
 */
export const badgeOptions = (earned: readonly string[]): AchievementDef[] => ACHIEVEMENTS.filter((a) => earned.includes(a.id));

export const titleOptions = (earned: readonly string[]): TitleOption[] =>
	ACHIEVEMENTS.filter((a) => a.rewards.titleId && earned.includes(a.id)).map((a) => ({ id: a.rewards.titleId as string, name: a.title, achievementId: a.id }));

/** The badge to draw for a stored choice, or null when none is shown (hidden, nothing earned, or a choice that is no longer earned). */
export const shownBadge = (choice: string | null | undefined, earned: readonly string[]): AchievementDef | null => {
	if (choice === BADGE_NONE) return null;
	const id = choice ?? DEFAULT_BADGE_ID;
	return earned.includes(id) ? (achievementById(id) ?? null) : null;
};

/** The title text for a stored title id, or null when it is not set or not earned. */
export const shownTitle = (titleId: string | null | undefined, earned: readonly string[]): string | null =>
	titleOptions(earned).find((t) => t.id === titleId)?.name ?? null;

/** Validates what a player asks for: a badge id is `BADGE_NONE`, null (default) or an earned achievement; a title id is null or an earned title. */
export const checkBadgeChoice = (
	input: { badgeId: unknown; titleId: unknown },
	earned: readonly string[],
): { ok: true; badgeId: string | null; titleId: string | null } | { ok: false; error: string } => {
	const { badgeId, titleId } = input;
	if (badgeId !== null && typeof badgeId !== 'string') return { ok: false, error: 'Pick one of your badges.' };
	if (titleId !== null && typeof titleId !== 'string') return { ok: false, error: 'Pick one of your titles.' };
	if (badgeId !== null && badgeId !== BADGE_NONE && !earned.includes(badgeId)) return { ok: false, error: 'You have not earned that badge.' };
	if (titleId !== null && !titleOptions(earned).some((t) => t.id === titleId)) return { ok: false, error: 'You have not earned that title.' };
	return { ok: true, badgeId, titleId };
};
