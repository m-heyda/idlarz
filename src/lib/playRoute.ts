/**
 * The front door's routes (IDL-61). The game lives at `/play`; `/` is the public landing. A guest who asks for `/play` is sent to the landing with the login window open
 * (`/?login=1&next=/play`) and, once signed in, goes back to where they were headed. `next` comes from the address bar, so it is only ever followed when it is a
 * path on this site (`safeNextPath`): anything else (another host, `//host`, a backslash trick, a control character) falls back to `/play`. This is a convenience
 * for the player, not a security boundary: every API route answers 401 on its own.
 *
 * @title The /play route and its redirects
 * @category Architecture/Routes
 * @order 1
 */

/** The route of the game itself (the gate in front of it, then the game). */
export const PLAY_PATH = '/play';

/** The route of the public landing page. */
export const LANDING_PATH = '/';

/**
 * A `next` value that is safe to navigate to: one path on this site, starting with a single `/`. Everything else (absent, another host, `//evil.example`,
 * `/\evil.example`, a scheme, control characters, very long text) is replaced by `/play`.
 */
export const safeNextPath = (raw: string | null | undefined): string => {
	if (typeof raw !== 'string' || raw.length === 0 || raw.length > 200) return PLAY_PATH;
	if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return PLAY_PATH;
	if (/[\u0000-\u001f\u007f\\]/.test(raw)) return PLAY_PATH;
	return raw;
};

/** Where a guest is sent from a protected page: the landing with the login window open and the way back. */
export const loginRedirectPath = (next: string = PLAY_PATH): string => `${LANDING_PATH}?login=1&next=${encodeURIComponent(safeNextPath(next))}`;

/** True when the address is a request for the game (`/play` and anything under it). */
export const isPlayPath = (pathname: string): boolean => pathname === PLAY_PATH || pathname.startsWith(`${PLAY_PATH}/`);
