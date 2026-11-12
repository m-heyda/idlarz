import { ACHIEVEMENTS, achievementById } from '@/catalog/achievements';
import { ADMIN_UNLOCK } from '@/catalog/avatars';
import { NICK_GOLD, isNickColorId, nickEffectById } from '@/config/nickColors';

/** The stored `profiles.badge_id` that hides the badge completely (null = the default). */
export const BADGE_NONE = 'none';

/** The badges shown when the player never chose, best first: the tester medals (Beta, then Early), for the accounts that hold one. */
export const DEFAULT_BADGE_IDS: readonly string[] = ['beta_tester', 'early_tester'];

/** The achievements that can be worn as a badge: the tester medals and a few milestones. Not every achievement medal is a badge; a set of real badges comes later. */
export const BADGE_CHOICE_IDS: readonly string[] = ['beta_tester', 'early_tester', 'first_rebirth', 'castle_10', 'boss_auroch', 'golden_kill'];

/** The admin-only badge: the animated octopus. Held by the game admin's account only (the pseudo id `ADMIN_UNLOCK` that `loadEarnedAchievements` adds for `profiles.is_admin`). */
export const ADMIN_BADGE = 'admin';

/** The admin-only title ("Dev"): stored as `profiles.title_id` like any other, offered and accepted only to the account that holds `ADMIN_UNLOCK`. */
export const ADMIN_TITLE_ID = 'dev';

/** The picture of a badge: the 8 frame sprite sheet of the admin octopus (draw it with the design system's `BadgePic`), or the medal of an achievement. */
export const ADMIN_BADGE_PIC = '/pixel/new_assets/admin/admin_mark.png';
export const badgePicSrc = (badge: string): string => (badge === ADMIN_BADGE ? ADMIN_BADGE_PIC : `/pixel/new_assets/achievements/${badge}.png`);

/** What a badge is as far as the windows need to know (an achievement's medal, or the admin octopus) */
export interface BadgeInfo {
	id: string;
	/** The picture name (`badgePicSrc`) */
	badge: string;
	/** The name shown on hover and under the picture */
	title: string;
}

const ADMIN_BADGE_INFO: BadgeInfo = { id: ADMIN_BADGE, badge: ADMIN_BADGE, title: 'Dev' };

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
export const badgeOptions = (earned: readonly string[]): BadgeInfo[] => [
	...ACHIEVEMENTS.filter((a) => BADGE_CHOICE_IDS.includes(a.id) && earned.includes(a.id)),
	...(earned.includes(ADMIN_UNLOCK) ? [ADMIN_BADGE_INFO] : []),
];

export const titleOptions = (earned: readonly string[]): TitleOption[] => [
	...ACHIEVEMENTS.filter((a) => a.rewards.titleId && earned.includes(a.id)).map((a) => ({
		id: a.rewards.titleId as string,
		name: a.title,
		achievementId: a.id,
	})),
	...(earned.includes(ADMIN_UNLOCK) ? [{ id: ADMIN_TITLE_ID, name: 'Dev', achievementId: ADMIN_UNLOCK }] : []),
];

/** The badge to draw for a stored choice, or null when none is shown (hidden, nothing earned, or a choice that is no longer earned). */
export const shownBadge = (choice: string | null | undefined, earned: readonly string[]): BadgeInfo | null => {
	if (choice === BADGE_NONE) return null;
	if (choice === ADMIN_BADGE) return earned.includes(ADMIN_UNLOCK) ? ADMIN_BADGE_INFO : null;
	const id = choice ?? DEFAULT_BADGE_IDS.find((candidate) => earned.includes(candidate));
	return id && BADGE_CHOICE_IDS.includes(id) && earned.includes(id) ? (achievementById(id) ?? null) : null;
};

/** The title text for a stored title id, or null when it is not set or not earned. */
export const shownTitle = (titleId: string | null | undefined, earned: readonly string[]): string | null =>
	titleOptions(earned).find((t) => t.id === titleId)?.name ?? null;

/** What is drawn by a name: the badge picture (`/pixel/new_assets/achievements/<badge>.png`) with its name, and the title text; each null when not shown. */
export interface ShownIdentity {
	badge: string | null;
	badgeName: string | null;
	title: string | null;
	/** The nickname colour id (`config/nickColors.ts`, or `gold`); null = the default colour */
	nameColor: string | null;
	/** The game admin's account (`profiles.is_admin`): gold name and the Dev badge and title are allowed (the badge itself is a normal choice now) */
	admin: boolean;
}

/**
 * What decides which nickname colours an account may use: the admin flag (`profiles.is_admin`), whether the Name colours item was bought (`unlocked`: the fourteen plain colours)
 * and which effect items were bought (`effects`), both from `ledger.gemShop.bought`. An admin has all of them.
 */
export interface NameColorAccess {
	admin: boolean;
	unlocked: boolean;
	/** The ids of the animated effects bought (`NICK_EFFECTS`) */
	effects: readonly string[];
}

/** The colour to draw for a stored `profiles.name_color`: null when unset, unknown, or gold on an account that is not an admin. A paid colour stays shown (it was checked when it was stored). */
export const shownNameColor = (stored: string | null | undefined, admin: boolean): string | null =>
	isNickColorId(stored) && (stored !== NICK_GOLD || admin) ? stored : null;

/** Validates a colour a player asks for (null = back to the default): a plain colour needs the Name colours unlock, an effect needs its own unlock, gold needs admin; an admin may have any. */
export const checkNameColor = (input: unknown, access: NameColorAccess): { ok: true; nameColor: string | null } | { ok: false; error: string } => {
	if (input === null) return { ok: true, nameColor: null };
	if (!isNickColorId(input)) return { ok: false, error: 'Pick one of the colours.' };
	if (input === NICK_GOLD) return access.admin ? { ok: true, nameColor: input } : { ok: false, error: 'That colour is not for sale.' };
	const effect = nickEffectById(input);
	if (effect)
		return access.admin || access.effects.includes(effect.id) ? { ok: true, nameColor: input } : { ok: false, error: `Unlock the ${effect.name} name first.` };
	if (!access.admin && !access.unlocked) return { ok: false, error: 'Unlock name colours in the Gem shop first.' };
	return { ok: true, nameColor: input };
};

/** The badge, title and nickname colour to show for a stored choice (`profiles.badge_id` / `title_id` / `name_color`) and the earned achievements: the one rule the Character window, the landing and later the rankings share. */
export const shownIdentity = (
	choice: { badgeId: string | null; titleId: string | null; nameColor?: string | null },
	earned: readonly string[],
	admin = false,
): ShownIdentity => {
	const badge = shownBadge(choice.badgeId, earned);
	return {
		badge: badge?.badge ?? null,
		badgeName: badge?.title ?? null,
		title: shownTitle(choice.titleId, earned),
		nameColor: shownNameColor(choice.nameColor, admin),
		admin,
	};
};

/** Validates what a player asks for: a badge id is `BADGE_NONE`, null (default) or an earned achievement; a title id is null or an earned title. */
export const checkBadgeChoice = (
	input: { badgeId: unknown; titleId: unknown },
	earned: readonly string[],
): { ok: true; badgeId: string | null; titleId: string | null } | { ok: false; error: string } => {
	const { badgeId, titleId } = input;
	if (badgeId !== null && typeof badgeId !== 'string') return { ok: false, error: 'Pick one of your badges.' };
	if (titleId !== null && typeof titleId !== 'string') return { ok: false, error: 'Pick one of your titles.' };
	if (badgeId === ADMIN_BADGE) {
		if (!earned.includes(ADMIN_UNLOCK)) return { ok: false, error: 'That badge is not for sale.' };
	} else if (badgeId !== null && badgeId !== BADGE_NONE && !(BADGE_CHOICE_IDS.includes(badgeId) && earned.includes(badgeId)))
		return { ok: false, error: 'You have not earned that badge.' };
	if (titleId !== null && !titleOptions(earned).some((t) => t.id === titleId)) return { ok: false, error: 'You have not earned that title.' };
	return { ok: true, badgeId, titleId };
};
