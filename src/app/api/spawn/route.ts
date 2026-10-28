import { onlineRoute } from '@/lib/offlineRoute';
import { syncTickets } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

/** The chests and monsters the server says have appeared, and when to ask again. The body is empty: nothing the client says matters here. */
export async function POST(request: Request) {
	return onlineRoute(request, () => ({}), (deps, userId, _body, nowMs) => syncTickets(deps, userId, nowMs));
}
