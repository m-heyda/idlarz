import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseConfigured } from '@/lib/supabase/server';
import { callbackNext, RECOVERY_COOKIE, recoveryCookieOptions, RESET_EXPIRED_PATH, RESET_PATH } from '@/lib/authCallback';

export const dynamic = 'force-dynamic';

/**
 * `GET /auth/callback?code=...&next=/reset`: the target of the emailed reset link. Trades the one-time PKCE code for a session cookie, then goes to `next`
 * (a path on this site only, `callbackNext`). When `next` is the reset page it also sets the short-lived recovery cookie that `POST /api/auth/password` requires (IDL-384).
 * A missing, used or expired code lands on `/?reset=expired`. Neither the code nor the address is logged.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const expired = () => NextResponse.redirect(new URL(RESET_EXPIRED_PATH, url.origin));
	if (!code || !supabaseConfigured()) return expired();
	try {
		const supabase = await createSupabaseServer();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) return expired();
		const next = callbackNext(url.searchParams.get('next'));
		const response = NextResponse.redirect(new URL(next, url.origin));
		// the reset link marks its session as a recovery session: only that one may change the password (IDL-384)
		if (next === RESET_PATH) response.cookies.set(RECOVERY_COOKIE, '1', recoveryCookieOptions(url.protocol === 'https:'));
		return response;
	} catch {
		return expired();
	}
}
