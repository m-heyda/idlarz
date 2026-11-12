import { fitAvatar } from '@/catalog/avatars';
import { shownIdentity } from '@/catalog/badges';
import { CRAFTING } from '@/config/crafting';
import { MAX_LEVEL } from '@/config/character';
import { DEFAULT_PLAYER_CLASS, PLAYER_CLASSES, type PlayerClassId } from '@/config/playerClasses';
import { craftCumulativeXp, craftLevelOf } from '@/lib/crafting';

// Pure rules of the Rankings (no store, no server): the boards, the 24-hour movement arrows and how a stored row becomes what the window shows. The database side is
// `refresh_rankings()` (supabase/migrations/player_rankings.sql); the route is /api/rankings.

export type RankingBoardId = 'level' | 'rebirths' | 'crafting' | 'tiles' | 'quests' | 'deeds';

export interface RankingBoardInfo {
	id: RankingBoardId;
	label: string;
	/** What the number on a row means (the window's column heading) */
	valueLabel: string;
	/** Not built yet: the tab shows "coming soon" and the route refuses it */
	soon: boolean;
}

/**
 * The tabs of the Rankings window, in order. A board with `soon` is a placeholder (Quests, Deeds: they need the quest and the deed-point systems first).
 *
 * Every board lists the first 50 places of the trusted players, plus the asking player's own place below it. The places are rebuilt once per 24 hours (`refresh_rankings()`, run by the first request after that), and each row shows the change since the rebuild before.
 * Ties are broken in this order:
 * - Level: level, then lifetime XP, then who reached the level cap first.
 * - Rebirths: rebirths, then Embers ever earned.
 * - Crafting: crafting XP (counted up to the maximum crafting level), then who reached the maximum level first.
 * - Tiles: the most tiles the player ever owned in one run (`player_stats.best_tiles`), so a rebirth does not lower it.
 *
 * @category Progression/Rankings
 * @title The boards
 */
export const RANKING_BOARDS: readonly RankingBoardInfo[] = [
	{ id: 'level', label: 'Level', valueLabel: 'Level', soon: false },
	{ id: 'rebirths', label: 'Rebirths', valueLabel: 'Rebirths', soon: false },
	{ id: 'crafting', label: 'Crafting', valueLabel: 'Crafting level', soon: false },
	{ id: 'tiles', label: 'Tiles', valueLabel: 'Most tiles', soon: false },
	{ id: 'quests', label: 'Quests', valueLabel: 'Quests', soon: true },
	{ id: 'deeds', label: 'Deeds', valueLabel: 'Deed points', soon: true },
];

/** The boards that have data, the only ones the route answers */
export const LIVE_BOARD_IDS: readonly RankingBoardId[] = RANKING_BOARDS.filter((board) => !board.soon).map((board) => board.id);

export const isLiveBoard = (value: unknown): value is RankingBoardId => typeof value === 'string' && (LIVE_BOARD_IDS as readonly string[]).includes(value);

/** How many places a board lists (the player's own place is added below it when it is further down) */
export const RANKING_LIMIT = 50;

/** The ranking is rebuilt at most this often (`refresh_rankings()` does nothing inside it) */
export const RANKING_REFRESH_MS = 24 * 3600_000;

/** The arguments of `refresh_rankings()`: the maximum character level and the crafting XP of the maximum crafting level (the database has no copy of the game's config) */
export const refreshArgs = () => ({ p_level_cap: MAX_LEVEL, p_craft_max_xp: craftCumulativeXp(CRAFTING.maxLevel) });

/**
 * The paragon level of a character: 0 until paragon exists (the maximum level is 100 and nothing goes past it yet, docs/plan/13). The window already shows a paragon mark for a value above 0, so
 * shipping paragon only changes this function and `refresh_rankings()` (which already stores the lifetime XP that will order it).
 */
export const paragonOf = (xp: number, level: number): number => {
	void xp;
	void level;
	return 0;
};

export interface RankingMovement {
	/** `new`: no earlier place (joined since the last refresh) */
	dir: 'up' | 'down' | 'same' | 'new';
	/** How many places */
	by: number;
}

/**
 * The change since the refresh before: a lower number is a better place, so a smaller rank is `up`; no earlier place is `new`.
 *
 * @category Progression/Rankings
 * @title Movement arrows
 */
export const movement = (previous: number | null | undefined, now: number): RankingMovement => {
	if (previous === null || previous === undefined) return { dir: 'new', by: 0 };
	if (previous === now) return { dir: 'same', by: 0 };
	return previous > now ? { dir: 'up', by: previous - now } : { dir: 'down', by: now - previous };
};

/** One place of a board as stored (`player_rankings`): the number to show is already the board's own (level, rebirths, crafting level, most tiles) */
export interface RankingEntry {
	userId: string;
	rank: number;
	previousRank: number | null;
	value: number;
	/** Lifetime XP, for the paragon mark of the Level board */
	xp: number;
}

/** What the profile of a ranked player holds */
export interface RankingProfile {
	name: string;
	playerClass: string | null;
	avatarId: string | null;
	badgeId: string | null;
	titleId: string | null;
	nameColor: string | null;
	admin: boolean;
}

/** One row as the window draws it. No account id: only what a visitor may see. */
export interface RankingRow {
	rank: number;
	move: RankingMovement;
	name: string;
	playerClass: PlayerClassId;
	avatarId: string;
	badge: string | null;
	badgeName: string | null;
	title: string | null;
	nameColor: string | null;
	admin: boolean;
	value: number;
	paragon: number;
	/** The row of the player who asked */
	me: boolean;
}

export interface RankingBoardAnswer {
	board: RankingBoardId;
	rows: RankingRow[];
	/** The asking player's own place when it is not among `rows` (null otherwise, or when the player is not ranked) */
	mine: RankingRow | null;
	/** When the places were last rebuilt (ISO), null before the first refresh */
	refreshedAt: string | null;
}

/** The crafting level shown for a stored crafting XP */
export const craftLevelValue = (craftXp: number): number => craftLevelOf(craftXp).level;

/**
 * Turns stored entries into rows: the name, the avatar (only one the class may wear and the account has earned), the badge, the title and the colour all go through the same rules as the Character window
 * (`fitAvatar`, `shownIdentity`), so an avatar, a badge or a gold nickname that is no longer held is never shown. A player without a profile row is dropped.
 */
export const buildRankingRows = (
	entries: readonly RankingEntry[],
	profiles: ReadonlyMap<string, RankingProfile>,
	earned: ReadonlyMap<string, readonly string[]>,
	meId: string | null,
): RankingRow[] => {
	const rows: RankingRow[] = [];
	for (const entry of entries) {
		const profile = profiles.get(entry.userId);
		if (!profile) continue;
		const classId = profile.playerClass && PLAYER_CLASSES[profile.playerClass as PlayerClassId] ? (profile.playerClass as PlayerClassId) : DEFAULT_PLAYER_CLASS;
		const held = earned.get(entry.userId) ?? [];
		const identity = shownIdentity({ badgeId: profile.badgeId, titleId: profile.titleId, nameColor: profile.nameColor }, held, profile.admin);
		rows.push({
			rank: entry.rank,
			move: movement(entry.previousRank, entry.rank),
			name: profile.name,
			playerClass: classId,
			avatarId: fitAvatar(profile.avatarId, classId, held).id,
			badge: identity.badge,
			badgeName: identity.badgeName,
			title: identity.title,
			nameColor: identity.nameColor,
			admin: identity.admin,
			value: entry.value,
			paragon: paragonOf(entry.xp, entry.value),
			me: entry.userId === meId,
		});
	}
	return rows;
};
