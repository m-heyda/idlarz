import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_UNLOCK } from '@/catalog/avatars';
import {
	RANKING_LIMIT,
	RANKING_REFRESH_MS,
	buildRankingRows,
	craftLevelValue,
	refreshArgs,
	type LiveBoardId,
	type RankingBoardAnswer,
	type RankingBoardId,
	type RankingEntry,
	type RankingProfile,
} from '@/lib/rankings';

// SERVER ONLY. Reads the ranking tables (`player_rankings`, `ranking_meta`; no player may read them directly) and the profile of each listed player, with the service-role client.

/** What a board orders by: the stored columns of `player_rankings`, and the filter that keeps a player with nothing to show off the board */
const BOARDS: Readonly<Record<LiveBoardId, { rank: string; prev: string; value: string; min: number }>> = {
	level: { rank: 'rank_level', prev: 'prev_rank_level', value: 'level', min: 0 },
	rebirths: { rank: 'rank_rebirths', prev: 'prev_rank_rebirths', value: 'rebirths', min: 1 },
	crafting: { rank: 'rank_crafting', prev: 'prev_rank_crafting', value: 'craft_xp', min: 1 },
	tiles: { rank: 'rank_tiles', prev: 'prev_rank_tiles, prev_rank_kills', value: 'best_tiles', min: 1 },
	kills: { rank: 'rank_kills', prev: 'prev_rank_kills', value: 'kills', min: 1 },
};

type Stored = Record<string, unknown>;

const num = (value: unknown): number =>
	typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : 0;

const toEntry = (board: LiveBoardId, row: Stored): RankingEntry => {
	const def = BOARDS[board];
	const raw = num(row[def.value]);
	return {
		userId: String(row.user_id),
		rank: num(row[def.rank]),
		previousRank: row[def.prev] === null || row[def.prev] === undefined ? null : num(row[def.prev]),
		value: board === 'crafting' ? craftLevelValue(raw) : raw,
		// only the Level board has a paragon mark, and it reads the lifetime XP
		xp: board === 'level' ? num(row.xp) : 0,
	};
};

/** Rebuilds the places when the last rebuild is 24 hours old (one SQL call, `refresh_rankings()`, which also guards itself); returns when the places were last rebuilt. A failed read throws. */
export const refreshIfDue = async (db: SupabaseClient, nowMs = Date.now()): Promise<string | null> => {
	const meta = await db.from('ranking_meta').select('refreshed_at').eq('id', true).maybeSingle();
	if (meta.error) throw new Error(meta.error.message);
	const last = typeof meta.data?.refreshed_at === 'string' ? meta.data.refreshed_at : null;
	if (last && nowMs - Date.parse(last) < RANKING_REFRESH_MS) return last;
	const done = await db.rpc('refresh_rankings', refreshArgs());
	// a failed rebuild must not hide the places that exist: serve the last ones, and only fail when there never were any
	if (done.error) {
		if (last) return last;
		throw new Error(done.error.message);
	}
	const again = await db.from('ranking_meta').select('refreshed_at').eq('id', true).maybeSingle();
	return typeof again.data?.refreshed_at === 'string' ? again.data.refreshed_at : last;
};

/** The profile columns and the earned achievements of the listed players, in two queries */
const loadPeople = async (db: SupabaseClient, ids: readonly string[]) => {
	const profiles = new Map<string, RankingProfile>();
	const earned = new Map<string, string[]>();
	if (ids.length === 0) return { profiles, earned };
	const [profileRows, achievementRows] = await Promise.all([
		db
			.from('profiles')
			.select('id, character_name, player_class, avatar_id, badge_id, title_id, name_color, is_admin')
			.in('id', ids as string[]),
		db
			.from('player_achievements')
			.select('user_id, achievement_id')
			.in('user_id', ids as string[]),
	]);
	if (profileRows.error) throw new Error(profileRows.error.message);
	if (achievementRows.error) throw new Error(achievementRows.error.message);
	for (const row of profileRows.data ?? []) {
		const admin = row.is_admin === true;
		profiles.set(String(row.id), {
			name: typeof row.character_name === 'string' ? row.character_name : '',
			playerClass: typeof row.player_class === 'string' ? row.player_class : null,
			avatarId: typeof row.avatar_id === 'string' ? row.avatar_id : null,
			badgeId: typeof row.badge_id === 'string' ? row.badge_id : null,
			titleId: typeof row.title_id === 'string' ? row.title_id : null,
			nameColor: typeof row.name_color === 'string' ? row.name_color : null,
			admin,
		});
		// the game admin's account also holds the pseudo id that unlocks the Admin avatar (same rule as `loadEarnedAchievements`)
		earned.set(String(row.id), admin ? [ADMIN_UNLOCK] : []);
	}
	for (const row of achievementRows.data ?? []) earned.get(String(row.user_id))?.push(String(row.achievement_id));
	return { profiles, earned };
};

const COLUMNS =
	'user_id, level, xp, rebirths, craft_xp, best_tiles, kills, rank_level, rank_rebirths, rank_crafting, rank_tiles, rank_kills, prev_rank_level, prev_rank_rebirths, prev_rank_crafting, prev_rank_tiles';

/**
 * One board: the first `RANKING_LIMIT` places and, when the asking player is ranked further down, their own place. The cosmetics are read now (not at the last rebuild), so a new colour or avatar shows at once.
 * A failed read throws.
 */
export const loadBoard = async (db: SupabaseClient, board: LiveBoardId, meId: string | null, nowMs = Date.now()): Promise<RankingBoardAnswer> => {
	const refreshedAt = await refreshIfDue(db, nowMs);
	const def = BOARDS[board];
	const top = await db
		.from('player_rankings')
		.select(COLUMNS)
		.gte(def.value, def.min)
		.not(def.rank, 'is', null)
		.order(def.rank, { ascending: true })
		.limit(RANKING_LIMIT);
	if (top.error) throw new Error(top.error.message);
	const entries = (top.data ?? []).map((row) => toEntry(board, row as Stored));
	let mineEntry: RankingEntry | null = null;
	if (meId && !entries.some((entry) => entry.userId === meId)) {
		const own = await db.from('player_rankings').select(COLUMNS).eq('user_id', meId).gte(def.value, def.min).not(def.rank, 'is', null).maybeSingle();
		if (own.error) throw new Error(own.error.message);
		if (own.data) mineEntry = toEntry(board, own.data as Stored);
	}
	const { profiles, earned } = await loadPeople(
		db,
		[...entries, ...(mineEntry ? [mineEntry] : [])].map((entry) => entry.userId),
	);
	const rows = buildRankingRows(entries, profiles, earned, meId);
	const mine = mineEntry ? (buildRankingRows([mineEntry], profiles, earned, meId)[0] ?? null) : null;
	return { board: board as RankingBoardId, rows, mine, refreshedAt };
};
