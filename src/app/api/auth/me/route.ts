import { createSupabaseServer } from '@/lib/supabase/server';
import { GAME_EPOCH, needsResetFor } from '@/config/epoch';
import { fail, guardConfigured, isOutage, json, loadProfile, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

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
		// `epoch`: the data epoch the server is on; `needsReset`: this account's game is on an older one and has to go through the new chapter screen (both dark while the epoch is the baseline)
		return json({
			user: { id: data.user.id, email: data.user.email ?? null },
			profile,
			epoch: GAME_EPOCH,
			needsReset: profile !== null && needsResetFor(epoch),
		});
	} catch {
		return unavailable();
	}
}
