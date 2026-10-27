import type { SupabaseClient } from '@supabase/supabase-js';
import type { Resources } from '@/types/game';
import type { SaveRepo, StoredSave, WorldPart } from './pipeline';
import type { SaveFlag } from './verify';

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
	flags: SaveFlag[];
	audit_ratio: number;
	fresh_start: boolean;
	ever_flagged: boolean;
	test_account: boolean;
}

const COLUMNS =
	'rev, schema, server_saved_at, created_at, core, world_hash, play_seconds, level, xp, gold, gems, click_level, castle_level, tiles_owned, buildings_owned, rebirths, legacy_points, legacy_earned, xp_gain_pct, rates, flags, audit_ratio, fresh_start, ever_flagged, test_account';

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
	buildings_owned: save.summary.buildingsOwned,
	rebirths: save.summary.rebirths,
	legacy_points: save.summary.legacyPoints,
	legacy_earned: save.summary.legacyEarned,
	xp_gain_pct: save.summary.xpGainPct,
	rates: save.summary.rates,
	gold_per_min: save.summary.rates.gold * 60,
	flags: save.flags,
	audit_ratio: save.auditRatio,
	fresh_start: save.freshStart,
	ever_flagged: save.everFlagged,
	test_account: save.testAccount,
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
		buildingsOwned: row.buildings_owned,
		castleLevel: row.castle_level,
		rebirths: row.rebirths,
		legacyPoints: row.legacy_points,
		legacyEarned: row.legacy_earned,
		xpGainPct: Number(row.xp_gain_pct),
		playSeconds: Number(row.play_seconds),
	},
	flags: row.flags ?? [],
	auditRatio: Number(row.audit_ratio),
	freshStart: row.fresh_start,
	everFlagged: row.ever_flagged,
	testAccount: row.test_account,
	serverSavedAt: Date.parse(row.server_saved_at),
	createdAt: Date.parse(row.created_at),
});

/** The full body of a save (map included), as kept in the history. */
const fullBody = (save: StoredSave) => ({ ...save.core, land: save.world?.land, extra: save.world?.extra });

/** The cloud save in Supabase (service role: players have no write access to these tables). */
export const supabaseSaveRepo = (db: SupabaseClient): SaveRepo => {
	const trim = async (userId: string, pinned: boolean, keep: number) => {
		const { data } = await db.from('save_history').select('id').eq('user_id', userId).eq('pinned', pinned).order('rev', { ascending: false }).range(keep, keep + 50);
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
				const { error } = await db
					.from('save_history')
					.insert({ user_id: userId, rev: save.rev, schema: save.schema, state: fullBody(save), flags: save.flags, server_saved_at: iso(save.serverSavedAt), pinned: true });
				if (error) return;
			}
			await trim(userId, true, keep);
		},
	};
};
