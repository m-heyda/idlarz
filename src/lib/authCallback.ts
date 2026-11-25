import { safeNextPath } from '@/lib/playRoute';

/** The page that sets a new password after the emailed link. */
export const RESET_PATH = '/reset';
/** Where the emailed link lands: it trades the one-time code for a session, then moves on to `next`. */
export const CALLBACK_PATH = '/auth/callback';
/** Where the callback sends a link that could not be used (expired, used twice, wrong browser). */
export const RESET_EXPIRED_PATH = '/?reset=expired';

/** The cookie that marks a recovery session (IDL-384): set by `/auth/callback` when it trades the code of the emailed reset link, required by `POST /api/auth/password`. */
export const RECOVERY_COOKIE = 'idl_recovery';
/** How long a recovery session may change the password after the emailed link was opened: 15 minutes. */
export const RECOVERY_MAX_AGE_SEC = 15 * 60;

/** The options of the recovery cookie: not readable by scripts, not sent along with a cross-site request, only over https where the site is served over https. */
export const recoveryCookieOptions = (secure: boolean) => ({ httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: RECOVERY_MAX_AGE_SEC });

/** Whether the request's `Cookie` header carries the recovery cookie. */
export const hasRecoveryCookie = (cookieHeader: string | null | undefined): boolean =>
	(cookieHeader ?? '').split(';').some((part) => part.trim() === `${RECOVERY_COOKIE}=1`);

/** What the landing page says when the emailed link could not be used (IDL-301) */
export const RESET_EXPIRED_MESSAGE = 'That reset link has expired or was already used. Ask for a new one with "Forgot password".';

/**
 * The notice the landing page owes its address (`?reset=expired`, set by {@link RESET_EXPIRED_PATH}), or null. `rest` is the query string without that parameter, for the address bar, so a reload does not repeat the notice and `next` / `register` survive.
 */
export const landingNoticeOf = (search: string): { message: string; rest: string } | null => {
	const params = new URLSearchParams(search);
	if (params.get('reset') !== 'expired') return null;
	params.delete('reset');
	const rest = params.toString();
	return { message: RESET_EXPIRED_MESSAGE, rest: rest ? `?${rest}` : '' };
};

/**
 * The `next` of the auth callback: a path on this site only (single leading `/`, no `//`, no backslash, no control characters), else `/play`.
 * It comes from the address bar, so an open redirect through it would turn a real reset email into a phishing link.
 */
export const callbackNext = (raw: string | null | undefined): string => safeNextPath(raw);

/**
 * The site's own origin for the link in the reset email. A configured `SITE_URL` wins (never trust a Host header when we know our address), then the Vercel
 * deployment host, and only then the request's own origin (local development). Supabase additionally only honours a redirect on its allow-list.
 *
 * `SITE_URL` may list several origins separated by commas (for example the new and the old domain). The request's own origin is used only when it is one of
 * them, so the emailed link returns to the domain the player is on; any other request falls back to the first listed origin (a Host header never adds one).
 */
export const siteOrigin = (env: { SITE_URL?: string; VERCEL_URL?: string }, requestUrl: string): string => {
	const configured: string[] = [];
	for (const part of (env.SITE_URL ?? '').split(',')) {
		try {
			const url = new URL(part.trim());
			if (url.protocol === 'https:' || url.protocol === 'http:') configured.push(url.origin);
		} catch {
			/* skip an entry that is not a URL */
		}
	}
	if (configured.length > 0) {
		let requested = '';
		try {
			requested = new URL(requestUrl).origin;
		} catch {
			/* no usable request origin: use the first listed */
		}
		return configured.includes(requested) ? requested : configured[0];
	}
	const vercel = env.VERCEL_URL?.trim();
	if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
	return new URL(requestUrl).origin;
};

/** The address Supabase puts in the email as the redirect target. */
export const resetRedirectTo = (origin: string): string => `${origin}${CALLBACK_PATH}?next=${encodeURIComponent(RESET_PATH)}`;
