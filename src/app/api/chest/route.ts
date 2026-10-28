import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { redeemChest } from '@/lib/offline/online';
import { COORD_LIMIT } from '@/utils/world';

export const dynamic = 'force-dynamic';

/** Opens the chest on one tile: `{ key, x, y }` (an idempotency key and the tile the server put the chest on). What is inside is rolled here, from a secret; the body names no amount. */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const { key, x, y } = body as { key?: unknown; x?: unknown; y?: unknown };
			const tile = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= COORD_LIMIT;
			return typeof key === 'string' && KEY.test(key) && tile(x) && tile(y) ? { key, x, y } : null;
		},
		(deps, userId, body, nowMs) => redeemChest(deps, userId, body.key, { x: body.x, y: body.y }, nowMs)
	);
}
