import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resources } from '@/types/game';
import type { SaveRepo, StoredSave, WorldPart } from './pipeline';
import type { SaveFlag } from './verify';
import { DEFAULT_DERIVED, type SaveDerived } from './summary';
import { runSecondsOf, type RebirthEntry } from './rebirthHistory';

interface Row {
	rev: number;
	schema: number;
	server_saved_at: string;
	created_at: string;
	core: StoredSave['core'];
	world_hash: string;
	play_seconds: number;
	level: number;
	xp: number;
	gold: number;
	gems: number;
	click_level: number;
	castle_level: number;
	tiles_owned: number;
	buildings_owned: number;
	rebirths: number;
	legacy_points: number;
	legacy_earned: number;
	xp_gain_pct: number;
	rates: Resources;
	/** Null until the row's first save under the offline ledger; `DEFAULT_DERIVED` fills it */
	derived: SaveDerived | null;
	flags: SaveFlag[];
	audit_ratio: number;
	fresh_start: boolean;
	ever_flagged: boolean;
	test_account: boolean;
	last_archive_at: string;
}

const COLUMNS =
	'rev, schema, server_saved_at, created_at, core, world_hash, play_seconds, level, xp, gold, gems, click_level, castle_level, tiles_owned, buildings_owned, rebirths, legacy_points, legacy_earned, xp_gain_pct, rates, derived, flags, audit_ratio, fresh_start, ever_flagged, test_account, last_archive_at';

const iso = (ms: number) => new Date(ms).toISOString();

const toRow = (save: StoredSave) => ({
	rev: save.rev,
	schema: save.schema,
	server_saved_at: iso(save.serverSavedAt),
	created_at: iso(save.createdAt),
	core: save.core,
	world_hash: save.worldHash,
	play_seconds: save.summary.playSeconds,
	level: save.summary.level,
	xp: save.summary.xp,
	gold: save.summary.gold,
	gems: save.summary.gems,
	click_level: save.summary.clickLevel,
	castle_level: save.summary.castleLevel,
	tiles_owned: save.summary.tilesOwned,
	buildings_owned: 0, // the column outlives the old building system (IDL-259): NOT NULL, so it is written as 0
	rebirths: save.summary.rebirths,
	legacy_points: save.summary.legacyPoints,
	legacy_earned: save.summary.legacyEarned,
	xp_gain_pct: save.summary.xpGainPct,
	rates: save.summary.rates,
	derived: save.summary.derived,
	gold_per_min: save.summary.rates.gold * 60,
	flags: save.flags,
	audit_ratio: save.auditRatio,
	fresh_start: save.freshStart,
	ever_flagged: save.everFlagged,
	test_account: save.testAccount,
	last_archive_at: iso(save.lastArchiveAt),
});

const fromRow = (row: Row): StoredSave => ({
	rev: row.rev,
	schema: row.schema,
	core: row.core,
	worldHash: row.world_hash,
	summary: {
		rates: row.rates,
		gold: Number(row.gold),
		xp: Number(row.xp),
		gems: row.gems,
		level: row.level,
		clickLevel: row.click_level,
		tilesOwned: row.tiles_owned,
		castleLevel: row.castle_level,
		rebirths: row.rebirths,
		legacyPoints: row.legacy_points,
		legacyEarned: row.legacy_earned,
		xpGainPct: Number(row.xp_gain_pct),
		playSeconds: Number(row.play_seconds),
		derived: { ...DEFAULT_DERIVED, ...(row.derived ?? {}) },
	},
	flags: row.flags ?? [],
	auditRatio: Number(row.audit_ratio),
	freshStart: row.fresh_start,
	everFlagged: row.ever_flagged,
	testAccount: row.test_account,
	serverSavedAt: Date.parse(row.server_saved_at),
	createdAt: Date.parse(row.created_at),
	lastArchiveAt: Date.parse(row.last_archive_at),
});

/** The `save_history.flags` value that marks the new chapter's archive of an account's old game: never trimmed. */
export const CHAPTER_ARCHIVE_FLAG = 'epoch_archive';

/** The full body of a save (map included), as kept in the history. */
const fullBody = (save: StoredSave) => ({ ...save.core, land: save.world?.land, extra: save.world?.extra });

/** The cloud save in Supabase (service role: players have no write access to these tables). */
export const supabaseSaveRepo = (db: SupabaseClient): SaveRepo => {
	const trim = async (userId: string, pinned: boolean, keep: number) => {
		const { data } = await db
			.from('save_history')
			.select('id')
			.eq('user_id', userId)
			.eq('pinned', pinned)
			.not('flags', 'cs', `{${CHAPTER_ARCHIVE_FLAG}}`) // the new chapter's archive is never trimmed
			.order('rev', { ascending: false })
			.range(keep, keep + 50);
		const ids = (data ?? []).map((row: { id: number }) => row.id);
		if (ids.length) await db.from('save_history').delete().in('id', ids);
	};

	return {
		async load(userId, options) {
			const { data, error } = await db.from('player_saves').select(COLUMNS).eq('user_id', userId).maybeSingle();
			if (error) throw new Error(error.message);
			if (!data) return null;
			const stored = fromRow(data as unknown as Row);
			if (options?.world) {
				const { data: world, error: worldError } = await db.from('player_worlds').select('hash, land, extra, tiles').eq('user_id', userId).maybeSingle();
				if (worldError) throw new Error(worldError.message);
				if (!world || world.hash !== stored.worldHash) throw new Error('the map does not match the save');
				stored.world = world as WorldPart;
			}
			return stored;
		},

		async commit(userId, baseRev, save, world, stats) {
			const { data, error } = await db.rpc('save_player_state', {
				p_user: userId,
				p_base_rev: baseRev,
				p_save: toRow(save),
				p_world: world,
				p_stats: {
					display_name: stats.displayName,
					level: save.summary.level,
					tiles_owned: save.summary.tilesOwned,
					castle_level: save.summary.castleLevel,
					rebirths: save.summary.rebirths,
					legacy_earned: save.summary.legacyEarned,
					gold_per_min: save.summary.rates.gold * 60,
					play_seconds: save.summary.playSeconds,
					trusted: stats.trusted,
				},
			});
			if (error) throw new Error(error.message);
			return data === true;
		},

		async archive(userId, save, keep) {
			const { error } = await db
				.from('save_history')
				.insert({ user_id: userId, rev: save.rev, schema: save.schema, state: fullBody(save), flags: save.flags, server_saved_at: iso(save.serverSavedAt) });
			if (error) return; // the save itself is already stored; a missing history row is not worth failing the request
			await trim(userId, false, keep);
		},

		async pin(userId, save, keep) {
			const { data } = await db.from('save_history').update({ pinned: true }).eq('user_id', userId).eq('rev', save.rev).select('id');
			if (!data?.length) {
				const { error } = await db.from('save_history').insert({
					user_id: userId,
					rev: save.rev,
					schema: save.schema,
					state: fullBody(save),
					flags: save.flags,
					server_saved_at: iso(save.serverSavedAt),
					pinned: true,
				});
				if (error) return;
			}
			await trim(userId, true, keep);
		},

		async pinChapter(userId, save) {
			const flags = [...new Set<string>([...save.flags, CHAPTER_ARCHIVE_FLAG])];
			const updated = await db.from('save_history').update({ pinned: true, flags }).eq('user_id', userId).eq('rev', save.rev).select('id');
			if (updated.error) throw new Error(updated.error.message);
			if (updated.data?.length) return;
			const inserted = await db
				.from('save_history')
				.insert({ user_id: userId, rev: save.rev, schema: save.schema, state: fullBody(save), flags, server_saved_at: iso(save.serverSavedAt), pinned: true });
			if (inserted.error) throw new Error(inserted.error.message);
		},

		async remove(userId) {
			const saveDelete = await db.from('player_saves').delete().eq('user_id', userId);
			if (saveDelete.error) throw new Error(saveDelete.error.message);
			const historyDelete = await db.from('rebirth_history').delete().eq('user_id', userId);
			if (historyDelete.error) throw new Error(historyDelete.error.message);
		},

		async recordRebirth(userId, record) {
			// the run's length is this rebirth's play time minus the previous rebirth's
			const { data: last } = await db
				.from('rebirth_history')
				.select('play_seconds')
				.eq('user_id', userId)
				.lt('rebirth_no', record.rebirthNo)
				.order('rebirth_no', { ascending: false })
				.limit(1)
				.maybeSingle();
			const { error } = await db.from('rebirth_history').upsert(
				{
					user_id: userId,
					rebirth_no: record.rebirthNo,
					at: iso(record.at),
					run_seconds: runSecondsOf(record, last ? Number(last.play_seconds) : null),
					play_seconds: record.playSeconds,
					tiles: record.tiles,
					buildings: 0, // legacy column, see buildings_owned
					castle_level: record.castleLevel,
					level: record.level,
					xp: record.xp,
					gold: record.gold,
					gold_per_sec: record.goldPerSec,
					click_level: record.clickLevel,
					embers_gained: record.embersGained,
					legacy_earned: record.legacyEarned,
					stats: { rates: record.rates },
				},
				{ onConflict: 'user_id,rebirth_no', ignoreDuplicates: true },
			);
			if (error) throw new Error(error.message);
		},
	};
};

const HISTORY_COLUMNS =
	'rebirth_no, at, run_seconds, play_seconds, tiles, buildings, castle_level, level, xp, gold, gold_per_sec, click_level, embers_gained, legacy_earned, stats';

/** The rebirths of a player, newest first (the Rebirths tab). `db` is the player's own client: row level security lets them read only their own rows. */
export const loadRebirthHistory = async (db: SupabaseClient, userId: string, limit = 200): Promise<RebirthEntry[]> => {
	const { data, error } = await db.from('rebirth_history').select(HISTORY_COLUMNS).eq('user_id', userId).order('rebirth_no', { ascending: false }).limit(limit);
	if (error) throw new Error(error.message);
	return (data ?? []).map((row) => ({
		rebirthNo: row.rebirth_no,
		at: row.at,
		runSeconds: Number(row.run_seconds),
		playSeconds: Number(row.play_seconds),
		tiles: row.tiles,
		castleLevel: row.castle_level,
		level: row.level,
		xp: Number(row.xp),
		gold: Number(row.gold),
		goldPerSec: Number(row.gold_per_sec),
		clickLevel: row.click_level,
		embersGained: row.embers_gained,
		legacyEarned: row.legacy_earned,
		rates: (row.stats?.rates ?? {}) as Resources,
	}));
};
