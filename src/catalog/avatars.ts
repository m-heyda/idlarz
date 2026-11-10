import type { PlayerClassId } from '@/config/playerClasses';

/**
 * Avatars (IDL-71): the face a player shows in the header, the character window, the rankings and the map preview. They are purely visual. Each class **owns two starters** ({@link CLASS_AVATARS}):
 * the creation screens offer a new hero the two of the class it picked, and the server refuses another class's starter at sign-up (`checkCreationAvatar`). Later, any starter can still be worn with any class (the Avatar window).
 * Eight **starters** are open to everyone; the **unlockables** are rewards of server-side achievements (the id of the achievement is `unlockedBy`). Two rules, both enforced
 * on the server (`checkAvatar` in `lib/authValidation.ts`, the only place that decides): the id has to be in this catalog, and an unlockable one has to be among the
 * achievements the account has earned. The chosen id lives in `profiles.avatar_id` (null = none chosen yet, the hero's class bust is shown), which only the service role writes.
 *
 * **Art.** The owner's framed busts (64x64, `public/pixel/new_assets/heroes/<portrait>.png`, listed in `public/pixel/new_assets/README.md`) are the portraits; `avatarArtUrl` is the only place that
 * builds the path, so a new picture is a change to the `portrait` field. The six horned busts not used here stay in the pool for later unlocks. A locked avatar is shown as a black
 * cut-out of its own picture (generated in `AvatarArt`, no extra art needed). Small uses (header, rankings at 20 px) scale the same file down.
 *
 * @category Progression/Avatars
 * @title Avatars
 * @order 4
 */
export interface AvatarInfo {
	id: string;
	name: string;
	/** `starter`: open to everyone. `unlock`: needs the achievement `unlockedBy`. */
	kind: 'starter' | 'unlock';
	/** Achievement id (unlockables only, the ids of `player_achievements.achievement_id`) */
	unlockedBy?: string;
	/** How to earn it (shown on the locked card) */
	how?: string;
	/** The picture: file name (no extension) of a framed bust in `public/pixel/new_assets/heroes/` */
	portrait: string;
}

const starter = (id: string, name: string, portrait: string): AvatarInfo => ({ id, name, kind: 'starter', portrait });
const unlock = (id: string, name: string, unlockedBy: string, how: string, portrait: string): AvatarInfo => ({
	id,
	name,
	kind: 'unlock',
	unlockedBy,
	how,
	portrait,
});

export const AVATARS: readonly AvatarInfo[] = [
	starter('knight', 'Knight', 'avatar_red_haired_knight'),
	starter('druid', 'Druid', 'avatar_green_horned_elf'),
	starter('scout', 'Scout', 'avatar_red_plume_lady'),
	starter('scholar', 'Scholar', 'avatar_winged_helm_veteran'),
	starter('miner', 'Miner', 'avatar_dwarf_knight_orange_eyes'),
	starter('farmer', 'Farmer', 'avatar_chain_knight_woman'),
	starter('bard', 'Bard', 'avatar_purple_elf_lady'),
	starter('alchemist', 'Alchemist', 'avatar_blue_plume_knight'),
	unlock('architect', 'Architect', 'castle_10', 'Raise the castle to level 10', 'avatar_gold_lion_knight'),
	unlock('reborn', 'Reborn', 'first_rebirth', 'Rebirth for the first time', 'avatar_horned_scarred_woman'),
	unlock('boss_slayer', 'Boss slayer', 'boss_auroch', 'Defeat The Great Auroch', 'avatar_horned_brute_dark'),
	unlock('early_tester', 'Early tester', 'early_tester', 'Played before the new chapter', 'avatar_horned_chainmail'),
];

/**
 * The two starter avatars each class owns. The creation screens (sign-up, "Finish your hero", "A new chapter") show a hero the two of the class it picked, and the server accepts
 * only those at sign-up (`checkCreationAvatar`); every starter belongs to exactly one class. Afterwards the Avatar window lets the player wear any starter or earned avatar with any class.
 * The first of the two is the class's **default avatar** ({@link CLASS_DEFAULT_AVATAR}).
 *
 * @category Progression/Avatars
 * @order 3
 */
export const CLASS_AVATARS: Readonly<Record<PlayerClassId, readonly [string, string]>> = {
	warrior: ['knight', 'miner'],
	paladin: ['alchemist', 'scholar'],
	ranger: ['scout', 'farmer'],
	mage: ['druid', 'bard'],
};

/** The default avatar of a class (the first of its two): shown while `profiles.avatar_id` is null and preselected when a class is picked. */
export const CLASS_DEFAULT_AVATAR: Readonly<Record<PlayerClassId, string>> = {
	warrior: CLASS_AVATARS.warrior[0],
	paladin: CLASS_AVATARS.paladin[0],
	ranger: CLASS_AVATARS.ranger[0],
	mage: CLASS_AVATARS.mage[0],
};

/** The avatar the creation screens show for a class: the pick when it is one of the class's two (or an earned extra), otherwise the class's default; null while no class is chosen. */
export const creatorAvatar = (playerClass: PlayerClassId | null, pick: string | null, earned: readonly string[] = []): string | null => {
	if (!playerClass) return null;
	return pick && (CLASS_AVATARS[playerClass].includes(pick) || earned.includes(pick)) ? pick : CLASS_DEFAULT_AVATAR[playerClass];
};

/** The avatar to show: the chosen one when it is in the catalog, otherwise the class default (never undefined). */
export const resolveAvatar = (id: string | null | undefined, playerClass: PlayerClassId): AvatarInfo =>
	avatarById(id) ?? (avatarById(CLASS_DEFAULT_AVATAR[playerClass]) as AvatarInfo);

/** The served picture of an avatar */
export const avatarArtUrl = (avatar: AvatarInfo): string => `/pixel/new_assets/heroes/${avatar.portrait}.png`;

export const AVATAR_BY_ID: ReadonlyMap<string, AvatarInfo> = new Map(AVATARS.map((avatar) => [avatar.id, avatar]));

export const avatarById = (id: string | null | undefined): AvatarInfo | undefined => (id ? AVATAR_BY_ID.get(id) : undefined);

/**
 * The avatar ids an account may use: every starter plus each unlockable whose achievement is in `earned`. Unknown achievement ids are ignored.
 *
 * @category Progression/Avatars
 * @order 1
 */
export const unlockedAvatarIds = (earned: Iterable<string>): string[] => {
	const have = new Set(earned);
	return AVATARS.filter((avatar) => avatar.kind === 'starter' || (avatar.unlockedBy !== undefined && have.has(avatar.unlockedBy))).map((avatar) => avatar.id);
};

/** The avatars everyone may pick without any achievement (what a brand-new account is offered) */
export const STARTER_AVATAR_IDS: readonly string[] = AVATARS.filter((avatar) => avatar.kind === 'starter').map((avatar) => avatar.id);
