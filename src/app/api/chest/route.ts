import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { redeemChest } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

/** Opens one chest: `{ key }` (an idempotency key). What is inside is rolled here, from a secret; the body names no amount and no chest. */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => (typeof body.key === 'string' && KEY.test(body.key) ? { key: body.key } : null),
		(deps, userId, body, nowMs) => redeemChest(deps, userId, body.key, nowMs)
	);
}
