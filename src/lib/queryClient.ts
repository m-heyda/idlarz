import { QueryClient } from '@tanstack/react-query';

/**
 * The browser's one cache for server reads that several windows share (TanStack Query). A key is fetched once and then served from the cache until it is marked stale; a window that opens again shows the cached answer at once instead of loading again.
 * Only reads that are cheap to keep and rarely change are here (today the avatar unlock list); the game's own state (saves, ledger, gems) stays in its stores and is never cached by this.
 * Mutations are not wired here: a change that makes a cached read wrong calls {@link invalidate}, and the next window that needs it fetches it again.
 */
export const QUERY_KEYS = {
	/** `GET /api/auth/avatar`: the hero's class and the avatars the account may pick */
	avatars: ['avatars'] as const,
} as const;

/** How long a cached answer counts as fresh. The things that can change it (an achievement earned, a class change) call {@link invalidate}, so this is only the safety net. */
export const QUERY_STALE_MS = 5 * 60_000;

export const makeQueryClient = (): QueryClient =>
	new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: QUERY_STALE_MS,
				gcTime: 30 * 60_000,
				retry: 1,
				// a game tab is switched away from all the time: coming back must not refetch, the stores have their own sync
				refetchOnWindowFocus: false,
				refetchOnReconnect: false,
			},
		},
	});

let browserClient: QueryClient | null = null;

/** The one client of the page (the provider and plain store code share it); a server render gets a fresh one so nothing leaks between requests. */
export const getQueryClient = (): QueryClient => {
	if (typeof window === 'undefined') return makeQueryClient();
	if (!browserClient) browserClient = makeQueryClient();
	return browserClient;
};

/** Marks a cached read as stale; the next window that uses it fetches it again (and one that is open refetches now). Safe to call from a store, before or without any provider. */
export const invalidate = (key: readonly unknown[]): void => {
	void getQueryClient().invalidateQueries({ queryKey: key });
};
