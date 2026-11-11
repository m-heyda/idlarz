import { safeNextPath } from '@/lib/playRoute';

/** The page that sets a new password after the emailed link. */
export const RESET_PATH = '/reset';
/** Where the emailed link lands: it trades the one-time code for a session, then moves on to `next`. */
export const CALLBACK_PATH = '/auth/callback';
/** Where the callback sends a link that could not be used (expired, used twice, wrong browser). */
export const RESET_EXPIRED_PATH = '/?reset=expired';

/**
 * The `next` of the auth callback: a path on this site only (single leading `/`, no `//`, no backslash, no control characters), else `/play`.
 * It comes from the address bar, so an open redirect through it would turn a real reset email into a phishing link.
 */
export const callbackNext = (raw: string | null | undefined): string => safeNextPath(raw);

/**
 * The site's own origin for the link in the reset email. A configured `SITE_URL` wins (never trust a Host header when we know our address), then the Vercel
 * deployment host, and only then the request's own origin (local development). Supabase additionally only honours a redirect on its allow-list.
 */
export const siteOrigin = (env: { SITE_URL?: string; VERCEL_URL?: string }, requestUrl: string): string => {
	const configured = env.SITE_URL?.trim();
	if (configured) {
		try {
			const url = new URL(configured);
			if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
		} catch {
			/* fall through to the next source */
		}
	}
	const vercel = env.VERCEL_URL?.trim();
	if (vercel && /^[a-z0-9.-]+$/i.test(vercel)) return `https://${vercel}`;
	return new URL(requestUrl).origin;
};

/** The address Supabase puts in the email as the redirect target. */
export const resetRedirectTo = (origin: string): string => `${origin}${CALLBACK_PATH}?next=${encodeURIComponent(RESET_PATH)}`;
