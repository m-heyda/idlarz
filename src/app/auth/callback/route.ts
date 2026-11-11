import { NextResponse } from 'next/server';
import { createSupabaseServer, supabaseConfigured } from '@/lib/supabase/server';
import { callbackNext, RESET_EXPIRED_PATH } from '@/lib/authCallback';

export const dynamic = 'force-dynamic';

/**
 * `GET /auth/callback?code=...&next=/reset`: the target of the emailed reset link. Trades the one-time PKCE code for a session cookie, then goes to `next`
 * (a path on this site only, `callbackNext`). A missing, used or expired code lands on `/?reset=expired`. Neither the code nor the address is logged.
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
		return NextResponse.redirect(new URL(callbackNext(url.searchParams.get('next')), url.origin));
	} catch {
		return expired();
	}
}
