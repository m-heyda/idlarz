import { KEY, onlineRoute } from '@/lib/offlineRoute';
import type { MasteryRequest } from '@/lib/offline/gemTypes';
import { masteryStep } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

type Body = { key: string; request: MasteryRequest };

/**
 * Bestiary mastery: `{ action: 'claim', key, type, tier }` claims tier `tier` (1-based) of one monster type, `{ action: 'claimAll', key }` claims every tier that is waiting, in one request. The server judges the tier from its own kill counts;
 * the answer says what was claimed and the bestiary rides along as on every online answer. `key` is the idempotency key.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body): Body | null => {
			if (typeof body.key !== 'string' || !KEY.test(body.key)) return null;
			if (body.action === 'claimAll') return { key: body.key, request: { action: 'claimAll' } };
			if (body.action === 'claim' && typeof body.type === 'string' && body.type.length > 0 && body.type.length <= 40 && Number.isInteger(body.tier))
				return { key: body.key, request: { action: 'claim', type: body.type, tier: body.tier as number } };
			return null;
		},
		(deps, userId, body, nowMs) => masteryStep(deps, userId, body.key, body.request, nowMs),
	);
}
