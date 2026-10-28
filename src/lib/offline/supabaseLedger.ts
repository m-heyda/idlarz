import type { SupabaseClient } from '@supabase/supabase-js';
import { zeroTotals, type GrantTotals, type Ledger, type LedgerRepo } from './ledger';
import { emptyBank, type TicketBank } from './tickets';

interface Row {
	ver: number;
	run_id: number;
	rebirths: number;
	anchor_at: string;
	bank: TicketBank;
	ord_chest: number;
	ord_kill: number;
	granted: GrantTotals;
	granted_seen: GrantTotals;
	gems: number;
	last_key: string | null;
	last_result: unknown;
}

const COLUMNS = 'ver, run_id, rebirths, anchor_at, bank, ord_chest, ord_kill, granted, granted_seen, gems, last_key, last_result';

const toRow = (ledger: Ledger) => ({
	ver: ledger.ver,
	run_id: ledger.runId,
	rebirths: ledger.rebirths,
	anchor_at: new Date(ledger.anchorAt).toISOString(),
	bank: ledger.bank,
	ord_chest: ledger.ordChest,
	ord_kill: ledger.ordKill,
	granted: ledger.granted,
	granted_seen: ledger.grantedSeen,
	gems: ledger.gems,
	last_key: ledger.lastKey,
	last_result: ledger.lastResult,
	updated_at: new Date().toISOString(),
});

const fromRow = (row: Row): Ledger => ({
	ver: row.ver,
	runId: row.run_id,
	rebirths: row.rebirths,
	anchorAt: Date.parse(row.anchor_at),
	bank: { ...emptyBank(0), ...row.bank },
	ordChest: row.ord_chest,
	ordKill: row.ord_kill,
	granted: { ...zeroTotals(), ...row.granted },
	grantedSeen: { ...zeroTotals(), ...row.granted_seen },
	gems: row.gems,
	lastKey: row.last_key,
	lastResult: row.last_result,
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
