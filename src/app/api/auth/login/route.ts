import { createSupabaseServer } from '@/lib/supabase/server';
import { checkCredentials } from '@/lib/authValidation';
import { fail, guardConfigured, isOutage, json, loadProfile, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	const credentials = checkCredentials(await readBody(request));
	if (!credentials.ok) return fail(credentials.error, 400);
	try {
		const supabase = await createSupabaseServer();
		const { data, error } = await supabase.auth.signInWithPassword(credentials.value);
		if (isOutage(error)) return unavailable();
		if (error || !data.user) return fail('Wrong email or password.', 401);
		const { profile, failed } = await loadProfile(supabase, data.user.id);
		if (failed) return unavailable();
		return json({ user: { id: data.user.id, email: data.user.email ?? null }, profile });
	} catch {
		return unavailable();
	}
}
