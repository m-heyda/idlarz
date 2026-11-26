import { KEY, onlineRoute } from '@/lib/offlineRoute';
import { rebirthStep, type RebirthOptions } from '@/lib/offline/online';
import { parseKeep } from '@/lib/rebirthKeep';

export const dynamic = 'force-dynamic';

/**
 * The server runs the player's rebirth: `{ key, keep?, keepAttrs?, resetParagon? }`. `keepAttrs: true` keeps the attribute points through the rebirth (the extra 20 are free to spend on top; left out, every point goes back as it always did), `resetParagon: true` takes the paragon points back for free (left out, they stay). `keep` names up to 15 places (`{from:'bag',index}` / `{from:'equip',slot}`) whose legendary gear the player carries over (see `lib/rebirthKeep.ts`); the server reads the items from its own inventory. It judges the last stored save (the browser uploads first), answers with the Embers the rebirth
 * pays and the starter inventory, and wipes the server's bag and gear at once. The body names no amount: nothing in it can change what is paid.
 */
export async function POST(request: Request) {
	return onlineRoute(
		request,
		(body) => {
			const keep = parseKeep(body.keep);
			const options: RebirthOptions = { keepAttrs: body.keepAttrs === true, resetParagon: body.resetParagon === true };
			return typeof body.key === 'string' && KEY.test(body.key) && keep ? { key: body.key, keep, options } : null;
		},
		(deps, userId, body, nowMs) => rebirthStep(deps, userId, body.key, nowMs, body.keep, body.options),
	);
}
