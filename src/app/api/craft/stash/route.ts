import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { craftStep } from '@/lib/offline/online';
import { parseWithdraw } from '@/lib/offline/craft';

export const dynamic = 'force-dynamic';

/**
 * Withdraw crafted potions or trade goods from the crafting stash into the bag: `{ key, id, qty }` (an idempotency key, the item id, how many). As many as fit move, the rest stays in the stash. The answer is the bag and the crafting state. At most one request per second per player.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const withdraw = parseWithdraw(body);
			return typeof body.key === 'string' && KEY.test(body.key) && withdraw ? { key: body.key, ...withdraw } : null;
		},
		(deps, userId, body, nowMs) => craftStep(deps, userId, body.key, { action: 'withdraw', id: body.id, qty: body.qty }, nowMs),
	);
}
