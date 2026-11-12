import { useQuery } from '@tanstack/react-query';
import { fetchAvatars, type AvatarState } from '@/lib/authClient';
import { QUERY_KEYS } from '@/lib/queryClient';

/**
 * The hero's class and the avatars the account may pick, read once and kept (`GET /api/auth/avatar`). `data` is undefined only the first time, while it loads (the picker shows skeleton cards then); every later open of the window
 * shows the cached answer at once. A new unlock (an achievement) or a class change invalidates it (`invalidate(QUERY_KEYS.avatars)`). A failed read throws so the query retries once and then reports `isError`.
 */
export const useAvatarState = (enabled: boolean) =>
	useQuery<AvatarState>({
		queryKey: QUERY_KEYS.avatars,
		enabled,
		queryFn: async () => {
			const state = await fetchAvatars();
			if (!state) throw new Error('The avatars could not be loaded.');
			return state;
		},
	});
