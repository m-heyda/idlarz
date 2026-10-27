import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Session cookies are for the server only: the browser never talks to Supabase, so JS has no business reading them. */
const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
};

export const supabaseConfigured = (): boolean => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

/** A Supabase client acting as the signed-in player (cookies in, refreshed cookies out). Throws when the env is missing. */
export const createSupabaseServer = async () => {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_ANON_KEY;
	if (!url || !key) throw new Error('Supabase is not configured');
	const store = await cookies();
	return createServerClient(url, key, {
		cookieOptions: COOKIE_OPTIONS,
		cookies: {
			getAll: () => store.getAll(),
			setAll: (list) => {
				try {
					list.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...COOKIE_OPTIONS }));
				} catch {
					/* called where cookies are read-only: the route handlers below are where they are written */
				}
			},
		},
	});
};
