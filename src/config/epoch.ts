/**
 * The data epoch: which "chapter" of the game an account's data belongs to. Raising `GAME_EPOCH` is the new chapter release (IDL-253, a PR that changes this one number and nothing else): from then on every account
 * whose profile is on an older epoch has to confirm the "A new chapter" screen (`POST /api/auth/epoch`), which archives their game into a pinned history row and starts it over (account, name and gems are kept), and every browser
 * and tab still on the old epoch is refused by the server until it reloads. While `GAME_EPOCH` equals `BASELINE_EPOCH` the whole mechanism is dark: nobody needs a reset and nothing is refused.
 *
 * - `profiles.epoch` is the epoch of the account's game; null (every account made before the epoch existed) counts as `BASELINE_EPOCH`.
 * - `/api/auth/me` sends `epoch` (this constant) and `needsReset`; the browser remembers the epoch it last saw (`lib/epochGuard`) and sends it in the `x-game-epoch` header of every game request.
 * - A request whose header is lower than `GAME_EPOCH` (a tab that was open at the flip; no header counts as `BASELINE_EPOCH`) answers 412 `stale_epoch` and the browser reloads into the guard.
 *
 * @category Saves & Server/Epoch
 * @order 1
 */
export const BASELINE_EPOCH = 1;

/** The data epoch the server is on. Raising it is the release: see the doc block above. */
export const GAME_EPOCH = 2;

/** The request header that carries the epoch the browser last saw. */
export const EPOCH_HEADER = 'x-game-epoch';

/** Whether an account whose profile holds `profileEpoch` (null = never set) has to go through the new chapter screen. */
export const needsResetFor = (profileEpoch: number | null | undefined, serverEpoch: number = GAME_EPOCH): boolean =>
	(profileEpoch ?? BASELINE_EPOCH) < serverEpoch;

/** The epoch a request header carries, or null when it is missing or not a whole number of at least 1. */
export const epochFromHeader = (value: string | null): number | null => {
	if (value === null) return null;
	const n = Number(value);
	return Number.isInteger(n) && n >= 1 ? n : null;
};

/** Whether a request from a browser that last saw `headerEpoch` (null = it sent none) belongs to an older epoch than the server's. */
export const isStaleEpoch = (headerEpoch: number | null, serverEpoch: number = GAME_EPOCH): boolean => (headerEpoch ?? BASELINE_EPOCH) < serverEpoch;
