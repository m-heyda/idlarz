import { KEY, onlineRoute } from '@/lib/offlineRoute';
import type { CharacterRequest } from '@/lib/offline/gemTypes';
import { characterStep } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

type Body = { key: string | null; request: CharacterRequest };

/**
 * The player's attribute points: `{ action: 'sync' }` reads the server's allocation, `{ action: 'allocate', key, add: { strength: 2, ... } }` puts points into attributes up to what the level has earned. The server holds the allocation (ledger `attrs`);
 * the answer always carries it, so a browser whose preview was refused puts it right. Giving the points back is a purchase of the gem shop (`attr_respec`, the first one free).
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body): Body | null => {
			if (body.action === 'sync') return { key: null, request: { action: 'sync' } };
			if (body.action !== 'allocate' || typeof body.key !== 'string' || !KEY.test(body.key)) return null;
			if (typeof body.add !== 'object' || body.add === null || Array.isArray(body.add)) return null;
			return { key: body.key, request: { action: 'allocate', add: body.add as Record<string, number> } };
		},
		(deps, userId, body, nowMs) => characterStep(deps, userId, body.key, body.request, nowMs),
	);
}
