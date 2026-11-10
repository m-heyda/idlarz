import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { loginRedirectPath } from '@/lib/playRoute';

/**
 * Guards `/play` (IDL-61): refreshes the Supabase session (`getUser()` rotates the cookies) and sends a guest to `/?login=1&next=/play`.
 * A convenience, not the security boundary: every API route still answers 401 itself. It fails open: no Supabase variables or an auth outage lets the request
 * through, so the `/play` page's own gate can show "accounts unavailable" (an outage is never treated as "logged out").
 */
export async function middleware(request: NextRequest) {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_ANON_KEY;
	if (!url || !key) return NextResponse.next();

	let response = NextResponse.next({ request });
	const supabase = createServerClient(url, key, {
		cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
		cookies: {
			getAll: () => request.cookies.getAll(),
			setAll: (list) => {
				list.forEach(({ name, value }) => request.cookies.set(name, value));
				response = NextResponse.next({ request });
				list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
			},
		},
	});

	try {
		const { data, error } = await supabase.auth.getUser();
		const outage = error && (!error.status || error.status >= 500);
		if (!data.user && !outage) {
			const redirect = NextResponse.redirect(new URL(loginRedirectPath(request.nextUrl.pathname + request.nextUrl.search), request.url));
			response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
			return redirect;
		}
	} catch {
		/* fail open: the page's gate decides */
	}
	return response;
}

export const config = { matcher: ['/play', '/play/:path*'] };
