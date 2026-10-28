import { onlineRoute } from '@/lib/offlineRoute';
import { syncTickets } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

/**
 * The chests and monsters the server says have appeared, when to ask again, and the player's combat as of now. The only thing the body
 * may say is `since`: the number of the last combat event the browser has seen (it gets the newer ones back).
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => ({ since: Number.isInteger(body.since) && (body.since as number) >= 0 ? (body.since as number) : undefined }),
		(deps, userId, body, nowMs) => syncTickets(deps, userId, nowMs, body.since)
	);
}
