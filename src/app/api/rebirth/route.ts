import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { rebirthStep } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

/**
 * The server runs the player's rebirth: `{ key }`. It judges the last stored save (the browser uploads first), answers with the Embers the rebirth
 * pays and the starter inventory, and wipes the server's bag and gear at once. The body names no amount: nothing in it can change what is paid.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => (typeof body.key === 'string' && KEY.test(body.key) ? { key: body.key } : null),
		(deps, userId, body, nowMs) => rebirthStep(deps, userId, body.key, nowMs)
	);
}
