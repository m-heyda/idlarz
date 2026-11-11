import { createSupabaseServer } from '@/lib/supabase/server';
import { GAME_EPOCH, needsResetFor } from '@/config/epoch';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin, adminConfigured } from '@/lib/supabase/admin';
import { loadBootSnapshot, sendsBootSnapshot } from '@/lib/offline/bootSnapshot';
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

/** Who is signed in (from the cookie only), their own profile row and the data epoch state (`epoch`, `needsReset`, see `config/epoch.ts`), and with `?game=1` the first-load `game` snapshot (`loadBootSnapshot`). 401 only when there is clearly no session. */
export async function GET(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.getUser();
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Not signed in.', 401);
		const { profile, epoch, failed } = await loadProfile(supabase, data.user.id);
		if (failed) return unavailable();
		const needsReset = profile !== null && needsResetFor(epoch);
		// With `?game=1` (the game's own first load, not the landing page): the bag, gear and crafting state ride along so the Bag and its Crafting tab are filled on the first render. Never for a stale epoch.
		const wantsGame =
			sendsBootSnapshot({ wanted: new URL(request.url).searchParams.get('game') === '1', hasProfile: profile !== null, needsReset }) && adminConfigured();
		// the leaderboard row (level, rebirths) for the landing's Continue card and the game snapshot: both best effort (a failed or missing read is just "nothing" and never blocks the answer), read side by side
		const [stats, game] = await Promise.all([
			profile ? loadStats(supabase, data.user.id) : null,
			wantsGame ? loadBootSnapshot(createSupabaseAdmin(), data.user.id, Date.now()) : null,
		]);
		// `epoch`: the data epoch the server is on; `needsReset`: this account's game is on an older one and has to go through the new chapter screen (both dark while the epoch is the baseline)
		return json({
			user: { id: data.user.id, email: data.user.email ?? null },
			profile,
			stats,
			epoch: GAME_EPOCH,
			needsReset,
			...(game ? { game } : {}),
		});
	} catch {
		return unavailable();
	}
}
