import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { redeemKill } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

/**
 * Pays a kill: `{ key, n, level, dismiss? }`. `n` is the monster's ticket number and `level` the level it had; the server never rolls
 * above what that ticket's age allows, and the loot, gold and XP come from the server, not from the request.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) =>
			typeof body.key === 'string' && KEY.test(body.key) && Number.isInteger(body.n) && (body.n as number) > 0 && Number.isFinite(body.level)
				? { key: body.key, n: body.n as number, level: body.level as number, dismiss: body.dismiss === true }
				: null,
		(deps, userId, body, nowMs) => redeemKill(deps, userId, body.key, { n: body.n, level: body.level, dismiss: body.dismiss }, nowMs)
	);
}
