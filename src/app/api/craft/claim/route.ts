import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { craftStep } from '@/lib/offline/online';
import { parseClaimSlot } from '@/lib/offline/craft';

export const dynamic = 'force-dynamic';

/**
 * Claim a crafting batch: `{ key, slot? }` (an idempotency key, the batch slot, default 0). The finished crafts are paid into the bag (or the component stock) with their crafting XP; what does not fit waits in the batch, it is never turned into gold. The answer is the bag and the crafting state. At most one request per second per player.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const slot = parseClaimSlot(body);
			return typeof body.key === 'string' && KEY.test(body.key) && slot ? { key: body.key, ...slot } : null;
		},
		(deps, userId, body, nowMs) => craftStep(deps, userId, body.key, { action: 'claim', slot: body.slot }, nowMs),
	);
}
