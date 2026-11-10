import { createSupabaseServer } from '@/lib/supabase/server';
import { GAME_EPOCH, needsResetFor } from '@/config/epoch';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fail, guardConfigured, isOutage, json, loadProfile, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** The player's own level and rebirth count from their `player_stats` row; null when there is no row yet (a new account) or the read failed. */
const loadStats = async (supabase: SupabaseClient, userId: string): Promise<{ level: number; rebirths: number } | null> => {
	try {
		const { data, error } = await supabase.from('player_stats').select('level, rebirths').eq('user_id', userId).maybeSingle();
		if (error || !data || typeof data.level !== 'number' || typeof data.rebirths !== 'number') return null;
		return { level: data.level, rebirths: data.rebirths };
	} catch {
		return null;
	}
};

/** Who is signed in (from the cookie only), their own profile row and the data epoch state (`epoch`, `needsReset`, see `config/epoch.ts`). 401 only when there is clearly no session. */
export async function GET() {
	const off = guardConfigured();
	if (off) return off;
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.getUser();
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Not signed in.', 401);
		const { profile, epoch, failed } = await loadProfile(supabase, data.user.id);
		if (failed) return unavailable();
		// the leaderboard row (level, rebirths) for the landing's Continue card: best effort, a failed or missing read is just "no numbers" and never blocks the answer
		const stats = profile ? await loadStats(supabase, data.user.id) : null;
		// `epoch`: the data epoch the server is on; `needsReset`: this account's game is on an older one and has to go through the new chapter screen (both dark while the epoch is the baseline)
		return json({
			user: { id: data.user.id, email: data.user.email ?? null },
			profile,
			stats,
			epoch: GAME_EPOCH,
			needsReset: profile !== null && needsResetFor(epoch),
		});
	} catch {
		return unavailable();
	}
}
