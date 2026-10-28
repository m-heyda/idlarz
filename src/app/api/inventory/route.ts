import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { inventoryStep } from '@/lib/offline/online';
import { parseOp } from '@/lib/offline/inventory';

export const dynamic = 'force-dynamic';

/**
 * One of the player's own changes to what they carry: `{ key, ...operation }` (an idempotency key, then `action` with `equip`, `unequip`, `move`,
 * `organize`, `discard`, `sell`, `sellJunk`, `autoSell`, `buyShop` or `buyOffer`). The server applies it to its inventory and answers with the
 * inventory as it stands and the gold a sale paid; the body names no amount of gold.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const op = parseOp(body);
			return typeof body.key === 'string' && KEY.test(body.key) && op ? { key: body.key, op } : null;
		},
		(deps, userId, body, nowMs) => inventoryStep(deps, userId, body.key, body.op, nowMs)
	);
}
