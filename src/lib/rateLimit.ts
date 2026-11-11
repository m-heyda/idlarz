/**
 * A small in-memory sliding-window limiter for routes that must not be hammered (password reset requests). Pure: the clock is passed in, so tests need no timers.
 * Memory is bounded: expired keys are dropped as the map is touched, and when `maxKeys` is reached the oldest key is evicted. It lives in one server instance only
 * (a serverless deploy has several), so it is a brake against casual abuse, not a guarantee; Supabase's own per-email limit is the second line.
 */
export interface RateLimiter {
	/** Records one attempt for `key` at `now` (ms) and says whether it is allowed. A refused attempt is not recorded. */
	take: (key: string, now?: number) => boolean;
	/** Number of keys currently held (for tests and memory checks). */
	size: () => number;
}

export interface RateLimitOptions {
	/** Attempts allowed per window */
	limit: number;
	windowMs: number;
	/** Most keys kept at once; the oldest is dropped beyond it */
	maxKeys?: number;
	clock?: () => number;
}

export const createRateLimiter = ({ limit, windowMs, maxKeys = 5000, clock = Date.now }: RateLimitOptions): RateLimiter => {
	// ordered by last use: the first key is the least recently used
	const hits = new Map<string, number[]>();

	const prune = (now: number) => {
		for (const [key, times] of hits) {
			if (times.length === 0 || now - times[times.length - 1] >= windowMs) hits.delete(key);
			else break;
		}
	};

	return {
		take: (key, at) => {
			const now = at ?? clock();
			prune(now);
			const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
			const allowed = times.length < limit;
			if (allowed) times.push(now);
			hits.delete(key);
			hits.set(key, times);
			while (hits.size > maxKeys) {
				const oldest = hits.keys().next().value;
				if (oldest === undefined) break;
				hits.delete(oldest);
			}
			return allowed;
		},
		size: () => hits.size,
	};
};

/** The client address from `x-forwarded-for` (first hop), or one shared bucket when the header is missing. Only the host's proxy sets this honestly; it is a brake, not an identity. */
export const clientIp = (headers: Pick<Headers, 'get'>): string => {
	const first = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
	return first && first.length <= 64 ? first : 'unknown';
};
