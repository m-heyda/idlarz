import { createSupabaseServer } from '@/lib/supabase/server';
import { adminConfigured } from '@/lib/supabase/admin';
import { EPOCH_HEADER, epochFromHeader, isStaleEpoch } from '@/config/epoch';
import { fail, guardConfigured, isOutage, json, unavailable } from '@/lib/authRoute';

/** The answer to a browser that belongs to an older data epoch (a tab left open across the new chapter flip): 412, and the browser reloads into the epoch guard. */
export const staleEpochResponse = () => json({ error: 'The game has started a new chapter. Reload to continue.', staleEpoch: true }, 412);

/**
 * The signed-in player's id from the session cookie (never from the request body), or the response to send instead. With the `request`, a browser that last saw an older
 * data epoch than the server's (`x-game-epoch`, see `config/epoch.ts`) is refused first: 412 `staleEpoch`. Dark while the server is on the baseline epoch.
 */
export const requirePlayer = async (request?: Request) => {
	const off = guardConfigured() ?? (adminConfigured() ? null : unavailable());
	if (off) return { response: off };
	if (request && isStaleEpoch(epochFromHeader(request.headers.get(EPOCH_HEADER)))) return { response: staleEpochResponse() };
	const supabase = await createSupabaseServer();
	const { data, error } = await supabase.auth.getUser();
	if (isOutage(error)) return { response: unavailable() };
	if (error || !data.user) return { response: fail('Not signed in.', 401) };
	return { userId: data.user.id, supabase };
};
