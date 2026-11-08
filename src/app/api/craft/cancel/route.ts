import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { craftStep } from '@/lib/offline/online';
import { parseSlot } from '@/lib/offline/craft';

export const dynamic = 'force-dynamic';

/**
 * Cancel a crafting batch: `{ key, slot? }` (an idempotency key, the batch slot, default 0). The finished crafts are paid first (what does not fit keeps waiting), the unfinished ones end: their components return to the stock and the answer names the resources to give back. The answer is the bag and the crafting state. At most one request per second per player.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const slot = parseSlot(body);
			return typeof body.key === 'string' && KEY.test(body.key) && slot ? { key: body.key, ...slot } : null;
		},
		(deps, userId, body, nowMs) => craftStep(deps, userId, body.key, { action: 'cancel', slot: body.slot }, nowMs),
	);
}
