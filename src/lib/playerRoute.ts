import { createSupabaseServer } from '@/lib/supabase/server';
import { adminConfigured } from '@/lib/supabase/admin';
import { fail, guardConfigured, isOutage, unavailable } from '@/lib/authRoute';

/** The signed-in player's id from the session cookie (never from the request body), or the response to send instead. */
export const requirePlayer = async () => {
	const off = guardConfigured() ?? (adminConfigured() ? null : unavailable());
	if (off) return { response: off };
	const supabase = await createSupabaseServer();
	const { data, error } = await supabase.auth.getUser();
	if (isOutage(error)) return { response: unavailable() };
	if (error || !data.user) return { response: fail('Not signed in.', 401) };
	return { userId: data.user.id, supabase };
};
