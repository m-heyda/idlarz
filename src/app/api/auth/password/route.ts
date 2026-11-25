import { createSupabaseServer } from '@/lib/supabase/server';
import { checkNewPassword } from '@/lib/authValidation';
import { hasRecoveryCookie, RECOVERY_COOKIE } from '@/lib/authCallback';
import { fail, guardConfigured, isOutage, json, readBody, unavailable } from '@/lib/authRoute';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/auth/password { password }`: sets a new password for the session the emailed reset link opened. That session is told from a normal sign-in by the recovery cookie
 * `/auth/callback` sets (IDL-384, 15 minutes); a normal session, or no session, gets 401 "This link is expired." and nothing changes. The cookie is spent on success.
 */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	if (!hasRecoveryCookie(request.headers.get('cookie'))) return fail('This link is expired.', 401);
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
		const response = json({ ok: true });
		response.cookies.delete(RECOVERY_COOKIE);
		return response;
	} catch {
		return unavailable();
	}
}
