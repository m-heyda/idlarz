import type { SupabaseClient } from '@supabase/supabase-js';
import { craftFromJson } from './ledger';
import type { BootSnapshot, Inventory } from './types';

/**
 * The game's first load (`GET /api/auth/me?game=1`): the signed-in player's own bag, gear and crafting state, read from their `player_ledger` row (`inv`, `craft`: two columns, one select, nothing but
 * what the Bag window draws) so the Bag and its Crafting tab have their data on the first render instead of asking `/api/craft` when they open. Read-only: it never writes and the
 * browser's copy is only a picture, the next online answer replaces it. A failed read or a row without an inventory is `null` / `inv: null`, never an error for the sign-in.
 *
 * @category Saves & Server/The ledger
 * @order 8
 */
export const loadBootSnapshot = async (db: Pick<SupabaseClient, 'from'>, userId: string, nowMs: number): Promise<BootSnapshot | null> => {
	try {
		const { data, error } = await db.from('player_ledger').select('inv, craft').eq('user_id', userId).maybeSingle();
		if (error) return null;
		const row = data as { inv?: Inventory | null; craft?: unknown } | null;
		const inv = row?.inv && typeof row.inv === 'object' && Array.isArray(row.inv.bag) ? row.inv : null;
		return { inv, craft: craftFromJson(row?.craft), serverNowSec: Math.floor(nowMs / 1000) };
	} catch {
		return null;
	}
};

/** Whether `/api/auth/me` may carry gameplay data: only when asked for, only for an account with a profile, and never for one whose game is on an older epoch (it goes through the new chapter screen first). */
export const sendsBootSnapshot = (opts: { wanted: boolean; hasProfile: boolean; needsReset: boolean }): boolean =>
	opts.wanted && opts.hasProfile && !opts.needsReset;
