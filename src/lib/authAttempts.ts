import { clientIp, createRateLimiter, type RateLimiter } from '@/lib/rateLimit';

/** How long a counted sign-in or sign-up attempt stays on the books */
const WINDOW_MS = 15 * 60 * 1000;

/** What a sign-in or sign-up attempt is counted against: the sender's address and the email it names. */
export interface AuthLimiters {
	loginIp: RateLimiter;
	loginEmail: RateLimiter;
	registerIp: RateLimiter;
	registerEmail: RateLimiter;
}

/**
 * The limits of the login and register routes (IDL-126): 20 logins per address and 10 per email, 10 sign-ups per address and 5 per email, each per 15 minutes. They sit in front of Supabase (which has its own per-email limit),
 * so password guessing and account or name probing (register looks the name up first) cost the server nothing. One attempt is counted whether it succeeds or not; a refused attempt is answered 429 and not counted again.
 * Memory only, per server instance: a brake against casual abuse, not a guarantee (see `createRateLimiter`).
 *
 * @category Saves & Server
 * @title Sign-in and sign-up limits
 */
export const liveAuthLimiters = (): AuthLimiters => ({
	loginIp: createRateLimiter({ limit: 20, windowMs: WINDOW_MS }),
	loginEmail: createRateLimiter({ limit: 10, windowMs: WINDOW_MS }),
	registerIp: createRateLimiter({ limit: 10, windowMs: WINDOW_MS }),
	registerEmail: createRateLimiter({ limit: 5, windowMs: WINDOW_MS }),
});

/** The one answer to a refused attempt (generic: it says nothing about the account) */
export const AUTH_TOO_MANY = 'Too many attempts. Try again in a few minutes.';

/** Counts an attempt against the address and the email; false when either limit is used up (answer 429 {@link AUTH_TOO_MANY}). The email is compared lower-cased. */
export const takeAuthAttempt = (limiters: AuthLimiters, kind: 'login' | 'register', headers: Pick<Headers, 'get'>, email: string): boolean => {
	const [ip, byEmail] = kind === 'login' ? [limiters.loginIp, limiters.loginEmail] : [limiters.registerIp, limiters.registerEmail];
	const ipOk = ip.take(clientIp(headers));
	const emailOk = byEmail.take(email.trim().toLowerCase());
	return ipOk && emailOk;
};

/**
 * What a sign-up answer from Supabase means: `session` (Confirm email is off: the player is signed in and the profile can be written), `confirm` (Confirm email is on: the account exists and a link was emailed, there is no session yet, so
 * the profile is asked for after the first login) or `failed` (no account came back).
 */
export const signUpOutcome = (data: { user?: unknown; session?: unknown } | null | undefined): 'session' | 'confirm' | 'failed' =>
	!data?.user ? 'failed' : data.session ? 'session' : 'confirm';

/** The message of a sign-up that is waiting for the emailed link */
export const CONFIRM_EMAIL_MESSAGE = 'Check your email: we sent a link to confirm your account. Log in after you have opened it.';

/** A failed sign-in: the status and text to answer. The right password with an unconfirmed email says so; everything else is the same generic refusal (no account probing). */
export const loginFailure = (error: { message?: string } | null | undefined): { status: number; error: string; emailNotConfirmed?: true } =>
	error?.message && /not confirmed/i.test(error.message)
		? { status: 403, error: 'Confirm your email first: open the link we sent you, then log in.', emailNotConfirmed: true }
		: { status: 401, error: 'Wrong email or password.' };
