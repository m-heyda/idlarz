import { createRateLimiter, type RateLimiter } from '@/lib/rateLimit';

/** The window of the per-account request limit */
export const PLAYER_RATE_WINDOW_MS = 60_000;

/** Requests one signed-in account may make per window across every `/api` route that uses `requirePlayer` */
export const PLAYER_RATE_LIMIT = 600;

/** The answer to an account over the limit */
export const PLAYER_TOO_MANY = 'Too many requests. Slow down a little.';

/**
 * A ceiling on how many requests one signed-in account can send (IDL-126): 600 a minute (10 a second, sustained) over all game routes together. Normal play is far under it (the save is one request per 10 s, a fight poll a few a minute,
 * a craft one a second at most, mining a rock one batch every 2 s (`FLUSH_MS` in `rockClient.ts`: 30 a minute, 60 with the extra send when a rock breaks, one at a time across all rocks and the server still gates the clicks themselves with `ROCK.maxCps`)); a script that hammers the routes is answered 429. Memory only, per server instance, so it is a brake against casual abuse and not a guarantee (see `createRateLimiter`); the per-route gaps (save 10 s, craft 1 s,
 * offline) stay as they are, and `/api/auth/login` and `/register` have their own limits (`liveAuthLimiters`).
 *
 * @category Saves & Server
 * @title Per-account request limit
 */
export const playerLimiter = (): RateLimiter => createRateLimiter({ limit: PLAYER_RATE_LIMIT, windowMs: PLAYER_RATE_WINDOW_MS, maxKeys: 20_000 });

const live = playerLimiter();

/** Counts one request of the account; false when it is over the limit (answer 429 {@link PLAYER_TOO_MANY}) */
export const takePlayerRequest = (userId: string, limiter: RateLimiter = live): boolean => limiter.take(userId);
