import type { SupabaseClient } from '@supabase/supabase-js';
import { readBuffs } from '@/lib/buffs';
import type { CombatState } from './fightTypes';
import type { CraftState, Inventory } from './types';
import { craftFromJson, isEmptyCraft, isEmptyLegacy, legacyFromJson, zeroTotals, type GrantTotals, type Ledger, type LedgerRepo } from './ledger';
import type { AchievementRepo } from './achievements';
import { isEmptyStats, readStats } from './stats';
import { upgradeStoredBank, type TicketBank } from './tickets';

interface Row {
	ver: number;
	run_id: number;
	rebirths: number;
	anchor_at: string;
	reset_at: string | null;
	bank: TicketBank;
	ord_chest: number;
	ord_kill: number;
	granted: GrantTotals;
	granted_seen: GrantTotals;
	gems: number;
	last_key: string | null;
	last_result: unknown;
	combat: CombatState | null;
	inv: Inventory | null;
	craft: CraftState | null;
	buffs: unknown;
	stats: unknown;
	legacy: unknown;
}

const COLUMNS =
	'ver, run_id, rebirths, anchor_at, reset_at, bank, ord_chest, ord_kill, granted, granted_seen, gems, last_key, last_result, combat, inv, craft, buffs, stats, legacy';

const toRow = (ledger: Ledger) => ({
	ver: ledger.ver,
	run_id: ledger.runId,
	rebirths: ledger.rebirths,
	anchor_at: new Date(ledger.anchorAt).toISOString(),
	reset_at: ledger.resetAt === null ? null : new Date(ledger.resetAt).toISOString(),
	bank: ledger.bank,
	ord_chest: ledger.ordChest,
	ord_kill: ledger.ordKill,
	granted: ledger.granted,
	granted_seen: ledger.grantedSeen,
	gems: ledger.gems,
	last_key: ledger.lastKey,
	last_result: ledger.lastResult,
	combat: ledger.combat,
	inv: ledger.inv,
	craft: isEmptyCraft(ledger.craft) ? null : ledger.craft,
	buffs: ledger.buffs.length === 0 ? null : ledger.buffs,
	stats: isEmptyStats(ledger.stats) ? null : ledger.stats,
	legacy: isEmptyLegacy(ledger.legacy) ? null : ledger.legacy,
	updated_at: new Date().toISOString(),
});

const fromRow = (row: Row): Ledger => ({
	ver: row.ver,
	runId: row.run_id,
	rebirths: row.rebirths,
	anchorAt: Date.parse(row.anchor_at),
	resetAt: row.reset_at ? Date.parse(row.reset_at) : null,
	bank: upgradeStoredBank(row.bank),
	ordChest: row.ord_chest,
	ordKill: row.ord_kill,
	granted: { ...zeroTotals(), ...row.granted },
	grantedSeen: { ...zeroTotals(), ...row.granted_seen },
	gems: row.gems,
	lastKey: row.last_key,
	lastResult: row.last_result,
	combat: row.combat ? { ...row.combat, queue: row.combat.queue ?? [] } : null,
	inv: row.inv ?? null,
	craft: craftFromJson(row.craft),
	buffs: readBuffs(row.buffs, 0),
	stats: readStats(row.stats),
	legacy: legacyFromJson(row.legacy),
});

/**
 * The ledger in Supabase (service role: players have no write access, see supabase/migrations/offline_ledger.sql). A write is a
 * compare-and-swap on `ver`: an insert for a row that does not exist yet, an update `where ver = expected` otherwise.
 */
export const supabaseLedgerRepo = (db: SupabaseClient): LedgerRepo => ({
	async load(userId) {
		const { data, error } = await db.from('player_ledger').select(COLUMNS).eq('user_id', userId).maybeSingle();
		if (error) throw new Error(error.message);
		return data ? fromRow(data as unknown as Row) : null;
	},

	async commit(userId, expectedVer, ledger) {
		if (expectedVer === 0) {
			const { error } = await db.from('player_ledger').insert({ user_id: userId, ...toRow(ledger) });
			if (!error) return true;
			if (error.code === '23505') return false; // somebody created it first
			throw new Error(error.message);
		}
		const { data, error } = await db.from('player_ledger').update(toRow(ledger)).eq('user_id', userId).eq('ver', expectedVer).select('ver');
		if (error) throw new Error(error.message);
		return (data?.length ?? 0) === 1;
	},
});

/** The `player_achievements` mirror: one `insert ... on conflict do nothing` for the ids a request paid. Service role only. */
export const supabaseAchievementRepo = (db: SupabaseClient): AchievementRepo => ({
	async record(userId, ids, atMs) {
		if (ids.length === 0) return;
		const earnedAt = new Date(atMs).toISOString();
		const { error } = await db.from('player_achievements').upsert(
			ids.map((id) => ({ user_id: userId, achievement_id: id, earned_at: earnedAt })),
			{ onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
		);
		if (error) throw new Error(error.message);
	},
});
