import { createSupabaseServer } from '@/lib/supabase/server';
import { fail, guardConfigured, isOutage, json, loadProfile, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** Who is signed in (from the cookie only) and their own profile row. 401 only when there is clearly no session. */
export async function GET() {
	const off = guardConfigured();
	if (off) return off;
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.getUser();
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Not signed in.', 401);
		const { profile, failed } = await loadProfile(supabase, data.user.id);
		if (failed) return unavailable();
		return json({ user: { id: data.user.id, email: data.user.email ?? null }, profile });
	} catch {
		return unavailable();
	}
}
