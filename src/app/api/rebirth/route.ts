import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { rebirthStep } from '@/lib/offline/online';
import { parseKeep } from '@/lib/rebirthKeep';

export const dynamic = 'force-dynamic';

/**
 * The server runs the player's rebirth: `{ key, keep? }`. `keep` names up to 15 places (`{from:'bag',index}` / `{from:'equip',slot}`) whose legendary gear the player carries over (see `lib/rebirthKeep.ts`); the server reads the items from its own inventory. It judges the last stored save (the browser uploads first), answers with the Embers the rebirth
 * pays and the starter inventory, and wipes the server's bag and gear at once. The body names no amount: nothing in it can change what is paid.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const keep = parseKeep(body.keep);
			return typeof body.key === 'string' && KEY.test(body.key) && keep ? { key: body.key, keep } : null;
		},
		(deps, userId, body, nowMs) => rebirthStep(deps, userId, body.key, nowMs, body.keep),
	);
}
