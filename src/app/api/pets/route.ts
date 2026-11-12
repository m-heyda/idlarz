import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { petsStep } from '@/lib/offline/online';
import type { PetsRequest } from '@/lib/offline/pets';

export const dynamic = 'force-dynamic';

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * The cosmetic pets: `{ key, action: 'sync' }` grants the special pet to the one account the server is configured for (`YUKI_GRANT_USER_ID`) and answers the pets the account owns and the welcome letter still to be shown (only that account ever gets one);
 * `{ key, action: 'ack', id }` records that the letter of pet `id` was closed. The body names no user and no pet to grant.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const { key, action, id } = body as { key?: unknown; action?: unknown; id?: unknown };
			if (typeof key !== 'string' || !KEY.test(key)) return null;
			if (action === 'sync') return { key, request: { action: 'sync' } as PetsRequest };
			if (action === 'ack' && typeof id === 'string' && ID.test(id)) return { key, request: { action: 'ack', id } as PetsRequest };
			return null;
		},
		(deps, userId, body, nowMs) => petsStep(deps, userId, body.key, body.request, (process.env.YUKI_GRANT_USER_ID ?? '').trim(), nowMs),
	);
}
