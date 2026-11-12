import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/lib/queryClient';
import { RANKING_BOARDS, type RankingBoardAnswer, type RankingBoardId, type RankingRow } from '@/lib/rankings';

const isRow = (value: unknown): value is RankingRow =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as RankingRow).rank === 'number' &&
	typeof (value as RankingRow).name === 'string' &&
	typeof (value as RankingRow).value === 'number';

/** One board of the Rankings (`GET /api/rankings?board=…`); null on any failure or a body of the wrong shape, so the window shows its error state rather than a half-drawn list. */
export const fetchRankings = async (board: RankingBoardId): Promise<RankingBoardAnswer | null> => {
	try {
		const response = await fetch(`/api/rankings?board=${encodeURIComponent(board)}`, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
		if (!response.ok) return null;
		const body = (await response.json().catch(() => null)) as Partial<RankingBoardAnswer> | null;
		if (!body || !Array.isArray(body.rows) || !body.rows.every(isRow)) return null;
		if (body.mine !== null && body.mine !== undefined && !isRow(body.mine)) return null;
		return { board, rows: body.rows, mine: body.mine ?? null, refreshedAt: typeof body.refreshedAt === 'string' ? body.refreshedAt : null };
	} catch {
		return null;
	}
};

/**
 * A board of the Rankings, cached per board (`QUERY_KEYS.rankings`): the first open of a tab loads it (the window shows skeleton rows), every later open of that tab is served from the cache. The server rebuilds the places once a day, so
 * a minute of freshness is plenty (the cache must not outlive a rebuild by long). A board that is not built yet (`soon`) is never fetched. A failed read throws, so the query retries once and then reports `isError`.
 */
export const useRankings = (board: RankingBoardId) =>
	useQuery<RankingBoardAnswer>({
		queryKey: QUERY_KEYS.rankings(board),
		staleTime: 60_000,
		enabled: !RANKING_BOARDS.find((entry) => entry.id === board)?.soon,
		queryFn: async () => {
			const answer = await fetchRankings(board);
			if (!answer) throw new Error('The rankings could not be loaded.');
			return answer;
		},
	});
