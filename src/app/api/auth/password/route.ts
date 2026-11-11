import { createSupabaseServer } from '@/lib/supabase/server';
import { checkNewPassword } from '@/lib/authValidation';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/** `POST /api/auth/password { password }`: sets a new password for the cookie session (the session the emailed reset link opened). No session: 401. */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	const password = checkNewPassword(await readBody(request));
	if (!password.ok) return fail(password.error, 400);
	try {
		const supabase = await createSupabaseServer();
		const { data, error: userError } = await supabase.auth.getUser();
		if (isOutage(userError)) return unavailable();
		if (userError || !data.user) return fail('This link is expired.', 401);
		const { error } = await supabase.auth.updateUser({ password: password.value });
		if (isOutage(error)) return unavailable();
		if (error) return fail('That password was not accepted. Try a different one.', 400);
		return json({ ok: true });
	} catch {
		return unavailable();
	}
}
