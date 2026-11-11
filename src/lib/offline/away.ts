import type { SupabaseClient } from '@supabase/supabase-js';
import { offlineCapSec, offlineEfficiency, offlineMinGapSec } from '@/lib/offline/limits';

/** The landing card's away bar: how long the player has been gone, the cap that counts and the share of income paid. Numbers only, the same ones the claim will use. */
export interface AwayBlock {
	gapSec: number;
	capSec: number;
	efficiency: number;
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null);

/**
 * The read-only `away` block of `GET /api/auth/me`: gap = now minus the later of the ledger anchor and the last accepted save (as `claimOffline` measures it), with the cap and efficiency the last
 * save stored (`derived.offlineCapSec` / `offlineEfficiency`, the base limits when an older row lacks them). `null` with no save, an unreadable time, or a gap under `offlineMinGapSec` (nothing to show).
 * It never claims anything and never touches the ledger.
 *
 * @category Saves & Server/Away time
 * @order 2
 */
export const awayBlockOf = (
	save: { serverSavedAt: number; derived: unknown } | null,
	ledgerAnchorMs: number | null,
	nowMs: number,
	minGapSec: number = offlineMinGapSec(),
): AwayBlock | null => {
	if (!save || !Number.isFinite(save.serverSavedAt)) return null;
	const anchorMs = Math.max(save.serverSavedAt, ledgerAnchorMs !== null && Number.isFinite(ledgerAnchorMs) ? ledgerAnchorMs : 0);
	const gapSec = Math.max(0, (nowMs - anchorMs) / 1000);
	if (gapSec < minGapSec) return null;
	const derived = (typeof save.derived === 'object' && save.derived !== null ? save.derived : {}) as { offlineCapSec?: unknown; offlineEfficiency?: unknown };
	const capSec = num(derived.offlineCapSec) ?? offlineCapSec();
	const efficiency = num(derived.offlineEfficiency) ?? offlineEfficiency();
	return { gapSec: Math.floor(gapSec), capSec, efficiency: Math.min(1, efficiency) };
};

/** Reads the two rows (the player's own, through RLS) and builds the block; any failed read is simply no block. */
export const loadAway = async (supabase: SupabaseClient, userId: string, nowMs: number): Promise<AwayBlock | null> => {
	try {
		const [saved, ledger] = await Promise.all([
			supabase.from('player_saves').select('server_saved_at, derived').eq('user_id', userId).maybeSingle(),
			supabase.from('player_ledger').select('anchor_at').eq('user_id', userId).maybeSingle(),
		]);
		if (saved.error || !saved.data) return null;
		const savedAt = Date.parse(String((saved.data as { server_saved_at?: unknown }).server_saved_at));
		const anchor = ledger.error || !ledger.data ? null : Date.parse(String((ledger.data as { anchor_at?: unknown }).anchor_at));
		return awayBlockOf(
			{ serverSavedAt: savedAt, derived: (saved.data as { derived?: unknown }).derived },
			anchor !== null && Number.isFinite(anchor) ? anchor : null,
			nowMs,
		);
	} catch {
		return null;
	}
};

/** Whether the landing shows the Early tester badge: the player holds the achievement (`player_achievements`, their own row through RLS) and has not hidden it or picked another badge (`profiles.badge_id`); a failed read is "no". */
export const loadEarlyTester = async (supabase: SupabaseClient, userId: string): Promise<boolean> => {
	try {
		const [earned, choice] = await Promise.all([
			supabase.from('player_achievements').select('achievement_id').eq('user_id', userId).eq('achievement_id', 'early_tester').maybeSingle(),
			supabase.from('profiles').select('badge_id').eq('id', userId).maybeSingle(),
		]);
		const badgeId = typeof choice.data?.badge_id === 'string' ? choice.data.badge_id : null;
		return !earned.error && !!earned.data && (badgeId === null || badgeId === 'early_tester');
	} catch {
		return false;
	}
};
