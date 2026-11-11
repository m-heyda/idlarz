import { checkEmailOnly } from '@/lib/authValidation';
import { fail, isOutage, json, readBody, unavailable } from '@/lib/authRoute';
import { clientIp, createRateLimiter, type RateLimiter } from '@/lib/rateLimit';
import { resetRedirectTo, siteOrigin } from '@/lib/authCallback';

/** The one answer to a reset request, whether or not the account exists (no account enumeration). */
export const RESET_MESSAGE = 'If that account exists, we sent a reset link.';

const WINDOW_MS = 15 * 60 * 1000;

/** The part of the Supabase client this flow needs (so a test can hand in a fake). */
export interface ResetAuth {
	resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: { status?: number } | null }>;
}

export interface ResetDeps {
	auth: () => Promise<ResetAuth>;
	perEmail: RateLimiter;
	perIp: RateLimiter;
	env: { SITE_URL?: string; VERCEL_URL?: string };
}

/** Limits shared by the live route: 3 requests per email and 10 per address per 15 minutes. */
export const liveLimiters = () => ({
	perEmail: createRateLimiter({ limit: 3, windowMs: WINDOW_MS }),
	perIp: createRateLimiter({ limit: 10, windowMs: WINDOW_MS }),
});

/**
 * `POST /api/auth/reset { email }` (password reset, IDL-65): asks Supabase to email a reset link. The answer never depends on whether the account exists
 * (200 with {@link RESET_MESSAGE}; Supabase's own refusals, such as an unknown email or its per-email limit, are answered the same way). Only a malformed
 * email (400), our own limit (429, generic) or an outage (503) differ. The limit is per address (first `x-forwarded-for` hop) and per email, counted before
 * Supabase is asked, so it cannot be used to probe accounts either. The email and the link are never logged.
 */
export const handleResetRequest = async (request: Request, deps: ResetDeps): Promise<Response> => {
	const email = checkEmailOnly(await readBody(request));
	if (!email.ok) return fail(email.error, 400);
	const ipOk = deps.perIp.take(clientIp(request.headers));
	const emailOk = deps.perEmail.take(email.value);
	if (!ipOk || !emailOk) return fail('Too many requests. Try again in a few minutes.', 429);
	try {
		const auth = await deps.auth();
		const redirectTo = resetRedirectTo(siteOrigin(deps.env, request.url));
		const { error } = await auth.resetPasswordForEmail(email.value, { redirectTo });
		if (isOutage(error)) return unavailable();
		return json({ ok: true, message: RESET_MESSAGE });
	} catch {
		return unavailable();
	}
};
