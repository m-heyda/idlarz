import { KEY, onlineRoute } from '@/lib/offlineRoute';
import type { ParagonRequest } from '@/lib/offline/gemTypes';
import { paragonStep } from '@/lib/offline/online';

export const dynamic = 'force-dynamic';

type Body = { key: string | null; request: ParagonRequest };

/**
 * The player's paragon points: `{ action: 'sync' }` reads the server's record, `{ action: 'allocate', key, add: { damage: 2, ... } }` puts points into upgrades up to what the paragon level has earned (a capped upgrade takes at most 25).
 * The server holds the record (ledger `paragon`); the answer always carries it, so a browser whose preview was refused puts it right. Giving the points back is a purchase of the gem shop (`paragon_respec`, the first one free).
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
		(deps, userId, body, nowMs) => paragonStep(deps, userId, body.key, body.request, nowMs),
	);
}
