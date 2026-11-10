import type { PixelIconName } from '@/config/pixelIcons';

/**
 * Avatars (IDL-71): the face a player shows in the header, the character window, the rankings and the map preview. They are **separate from classes** and purely visual.
 * Eight **starters** are open to everyone; the **unlockables** are rewards of server-side achievements (the id of the achievement is `unlockedBy`). Two rules, both enforced
 * on the server (`checkAvatar` in `lib/authValidation.ts`, the only place that decides): the id has to be in this catalog, and an unlockable one has to be among the
 * achievements the account has earned. The chosen id lives in `profiles.avatar_id` (null = none chosen yet, the hero's class bust is shown), which only the service role writes.
 *
 * **Art is a placeholder.** Every avatar points at a class bust (`portrait`, 40x40) and gets its own hue (`hue`) so the picker is usable; a locked avatar shows the same bust as
 * a black silhouette (`AVATAR_SILHOUETTE`). When the owner's portraits arrive (IDL-72: `public/pixel/portraits/avatars/<id>.png`, 40x40 bust, the sheet in
 * `art_style_reference/ui-and-portraits/README.md`) the swap is this table only: point `portrait` at the registered icon and drop `hue`. Nothing else changes.
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
	/** The picture: a registered 40x40 bust (a placeholder until the portraits exist) */
	portrait: PixelIconName;
	/** Placeholder tint, degrees of hue rotation applied to the bust so the starters look different; 0 once the real portrait is in */
	hue: number;
}

const starter = (id: string, name: string, portrait: PixelIconName, hue: number): AvatarInfo => ({ id, name, kind: 'starter', portrait, hue });
const unlock = (id: string, name: string, unlockedBy: string, how: string, portrait: PixelIconName, hue: number): AvatarInfo => ({
	id,
	name,
	kind: 'unlock',
	unlockedBy,
	how,
	portrait,
	hue,
});

export const AVATARS: readonly AvatarInfo[] = [
	starter('knight', 'Knight', 'bust_warrior', 0),
	starter('druid', 'Druid', 'bust_ranger', 70),
	starter('scout', 'Scout', 'bust_ranger', 0),
	starter('scholar', 'Scholar', 'bust_mage', 0),
	starter('miner', 'Miner', 'bust_warrior', 200),
	starter('farmer', 'Farmer', 'bust_paladin', 90),
	starter('bard', 'Bard', 'bust_mage', 300),
	starter('alchemist', 'Alchemist', 'bust_paladin', 150),
	unlock('architect', 'Architect', 'castle_10', 'Raise the castle to level 10', 'bust_paladin', 40),
	unlock('reborn', 'Reborn', 'first_rebirth', 'Rebirth for the first time', 'bust_mage', 120),
	unlock('boss_slayer', 'Boss slayer', 'boss_auroch', 'Defeat The Great Auroch', 'bust_warrior', 330),
	unlock('early_tester', 'Early tester', 'early_tester', 'Played before the new chapter', 'bust_ranger', 250),
];

/** The shape shown for an avatar the player has not unlocked (a black cut-out of this bust) */
export const AVATAR_SILHOUETTE: PixelIconName = 'bust_warrior';

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
