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
