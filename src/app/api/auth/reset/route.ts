import { createSupabaseServer } from '@/lib/supabase/server';
import { guardConfigured } from '@/lib/authRoute';
import { handleResetRequest, liveLimiters } from '@/lib/authReset';

export const dynamic = 'force-dynamic';

const limiters = liveLimiters();

/** `POST /api/auth/reset { email }`: emails a password reset link; the answer is the same whether or not the account exists (`handleResetRequest`). */
export async function POST(request: Request) {
	const off = guardConfigured();
	if (off) return off;
	return handleResetRequest(request, {
		auth: async () => (await createSupabaseServer()).auth,
		...limiters,
		env: { SITE_URL: process.env.SITE_URL, VERCEL_URL: process.env.VERCEL_URL },
	});
}
